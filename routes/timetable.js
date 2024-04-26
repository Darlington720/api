const express = require("express");
const router = express.Router();
const { database, getCurrentSession } = require("../config");

router.get("/lectureTimetable", (req, res) => {
  database
    .from("lecture_timetable")
    .join(
      "lecture_sessions",
      "lecture_timetable.session_id",
      "lecture_sessions.ls_id "
    )
    .leftJoin(
      "timetable_groups",
      "lecture_timetable.timetable_group_id",
      "timetable_groups.tt_gr_id "
    )
    .join(
      "study_time",
      "timetable_groups.study_time_id",
      "study_time.study_time_code"
    )
    .join("rooms", "lecture_timetable.room_id", "rooms.room_id")
    .join("schools", "timetable_groups.school_id", "schools.school_id")

    .leftJoin("staff", "lecture_timetable.lecturer_id", "=", "staff.staff_id")
    .select(
      "lecture_timetable.tt_id",
      "lecture_timetable.day_id",
      "lecture_sessions.start_time",
      "lecture_sessions.end_time",
      "rooms.room_name",
      "lecture_timetable.c_unit_id",
      "lecture_timetable.course_unit_name",
      "lecture_timetable.lecturer_id",
      "schools.alias",
      "schools.school_id",
      "study_time.study_time_name",
      "staff.*"
    )
    .then((lec) => {
      const lectures = lec.map((obj) => {
        const newObj = Object.assign({}, obj, {
          school: obj.alias,
          study_time: obj.study_time_name,
        });

        delete newObj.alias;
        delete newObj.study_time_name;
        return newObj;
      });
      res.send(lectures);
    });
});

router.post("/lecture_timetable", async (req, res) => {
  const { school_id, study_time_id, campus, sem, year } = req.body;
  // i need to check the time tablegroups
  const tt_group = await database("timetable_groups")
    .where({
      school_id,
      study_time_id,
      campus,
      sem,
      year,
    })
    .first();

  if (!tt_group) {
    return res.send({
      success: true,
      result: [],
    });
  }

  const timetable = await database("lecture_timetable")
    .join(
      "lecture_sessions",
      "lecture_timetable.session_id",
      "lecture_sessions.ls_id"
    )
    .join("staff", "lecture_timetable.lecturer_id", "staff.staff_id")
    .join("rooms", "lecture_timetable.room_id", "rooms.room_id")
    .where({
      timetable_group_id: tt_group.tt_gr_id,
    })
    .orderBy("lecture_sessions.ls_id");

  res.send({
    success: true,
    result: timetable,
  });
});

router.post("/addExamTimetable", async (req, res) => {
  const { headers, timetable } = req.body;
  // console.log("Data received", req.body);
  const d = new Date();
  const date = d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();

  //inserting into the exams group
  const existingExamGrp = await database
    .select("*")
    .where({
      school_id: headers.school.value,
      study_time_id: headers.studyTime.value,
      campus_id: headers.campus.value,
      yr_sem_id: headers.year_sem.value,
    })
    .from("exam_groups")
    .first();

  try {
    if (!existingExamGrp) {
      const result = await database("exam_groups").insert({
        school_id: headers.school.value,
        study_time_id: headers.studyTime.value,
        campus_id: headers.campus.value,
        yr_sem_id: headers.year_sem.value,
      });

      console.log("Result from insert", result[0]);
      const fieldsToInsert = timetable.map((field) => ({
        exam_group_id: result[0],
        date:
          new Date(field.date).getFullYear() +
          "-" +
          (new Date(field.date).getMonth() + 1) +
          "-" +
          new Date(field.date).getDate(),
        session_id: field.session.value,
        room_id: field.room.value,
        course_unit_code: field.courseUnit.value.course_code,
        course_unit_name: field.courseUnit.value.course_name,
      }));

      database("exam_timetable")
        .insert(fieldsToInsert)
        .then(() => {
          res.status(200).send({
            success: true,
            message: "Successfully saved exam timetable!",
          });
        })
        .catch((err) => {
          console.log("Failed to save the data", err);
          res.status(400).send("fail");
        });

      // res.status(200).send("Received the data");
    } else {
      console.log("result from select", existingExamGrp);
      const fieldsToInsert = timetable.map((field) => ({
        exam_group_id: existingExamGrp.exam_group_id,
        date:
          new Date(field.date).getFullYear() +
          "-" +
          (new Date(field.date).getMonth() + 1) +
          "-" +
          new Date(field.date).getDate(),
        session_id: field.session.value,
        room_id: field.room.value,
        course_unit_code: field.courseUnit.value.course_code,
        course_unit_name: field.courseUnit.value.course_name,
      }));

      database
        .transaction((trx) => {
          const insertPromises = fieldsToInsert.map((field) =>
            database
              .select("*")
              .from("exam_timetable")
              .where({
                exam_group_id: field.exam_group_id,
                date: field.date,
                session_id: field.session_id,
                room_id: field.room_id,
                course_unit_code: field.course_unit_code,
              })
              .transacting(trx)
              .then((rows) => {
                if (rows.length === 0) {
                  return database
                    .insert(field)
                    .into("exam_timetable")
                    .transacting(trx);
                }
              })
          );

          return Promise.all(insertPromises)
            .then(trx.commit)
            .catch(trx.rollback);
        })
        .then(() => {
          res.status(200).send({
            success: true,
            message: "Successfully saved exam timetable!!!",
          });
        })
        .catch((err) => {
          console.log("Failed to save the data", err);
          res.status(400).send({
            success: false,
            message: `Error encountered ${err}`,
          });
        });
    }
  } catch (err) {
    console.log("Fail", err);
    res.status(400).send({
      success: false,
      message: "Failed to save the data " + err,
    });
  }
});

router.post("/edit_lecture_tt", async (req, res) => {
  const { timetable } = req.body;

  // console.log("body", timetable);

  const update_tt = await database("lecture_timetable")
    .where({
      tt_id: timetable[0].tt_id,
    })
    .update({
      day_id: timetable[0].selectedDay,
      session_id: timetable[0].selectedSession,
      lecturer_id: timetable[0].lecturer,
      room_id: timetable[0].room,
      c_unit_id: timetable[0].courseUnit.course_id,
      course_unit_name: timetable[0].courseUnit.course_name,
    });

  res.send({
    success: true,
    message: "Timetable Updated Successfully",
  });
});

router.delete("/delete_tt_cu/:tt_id", async (req, res) => {
  const { tt_id } = req.params;

  // console.log("body", timetable);

  const delete_cu = await database("lecture_timetable")
    .where({
      tt_id: tt_id,
    })
    .del();

  res.send({
    success: true,
    message: "CourseUnit Deleted Successfully",
  });
});

router.post("/examsInRoom", async (req, res) => {
  const exams = await database
    .select("course_unit_code", "course_unit_name")
    .from("exam_timetable")
    .where({
      room_id: req.body.room.value,
      session_id: req.body.session.value,
      date:
        new Date(req.body.date).getFullYear() +
        "-" +
        (new Date(req.body.date).getMonth() + 1) +
        "-" +
        new Date(req.body.date).getDate(),
    });

  res.send({
    success: true,
    result: exams,
  });
});

router.get("/requirements/class_tt", async (req, res) => {
  const schools = await database.select("*").from("schools");

  // const campus = await database("campus");

  const staff_members = await database.select("*").from("staff");

  const study_times = await database.select("*").from("study_time");

  const modules = await database.select("*").from("modules");

  const sessions = await database.select("*").from("exam_sessions");

  const rooms = await database.select("*").from("rooms");

  res.send({
    success: true,
    result: {
      schools,
      staff_members,
      study_times,
      modules,
      sessions,
      rooms,
      // campus,
    },
  });
});

router.get("/reqs/class_tt", async (req, res) => {
  const schools = await database.select("*").from("schools");

  const campus = await database("campus");

  const staff_members = await database.select("*").from("staff");

  const study_times = await database.select("*").from("study_time");

  const modules = await database.select("*").from("modules");

  const sessions = await database.select("*").from("lecture_sessions");

  const rooms = await database.select("*").from("rooms");

  res.send({
    success: true,
    result: {
      schools,
      staff_members,
      study_times,
      modules,
      sessions,
      rooms,
      campus,
    },
  });
});

router.get("/requirements/exam_tt", async (req, res) => {
  // schools
  const schools = await database.select("*").from("schools");

  // const staff_members = await database.select("*").from("staff");

  // study times
  const study_times = await database.select("*").from("study_time");

  // modules
  const modules = await database.select("*").from("modules");

  // sessions
  const sessions = await database.select("*").from("exam_sessions");

  //rooms
  const rooms = await database.select("*").from("rooms");

  // year - sem
  const year_sem = await database.select("*").from("year_sem");

  res.send({
    success: true,
    result: {
      schools,
      study_times,
      modules,
      sessions,
      rooms,
      year_sem,
    },
  });
});

router.get("/requirements/assign_inv", async (req, res) => {
  //Staff
  const staff_members = await database.select("*").from("staff");

  //rooms
  const rooms = await database.select("*").from("rooms");

  // sessions
  const sessions = await database.select("*").from("exam_sessions");

  res.send({
    success: true,
    result: {
      sessions,
      rooms,
      staff_members,
    },
  });
});

router.post("/addClassTimetable", async (req, res) => {
  const { headers, timetable } = req.body;
  const d = new Date();
  const date = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

  const currentSession = await getCurrentSession();

  const existingTimetableGroup = await database
    .select("*")
    .where({
      school_id: headers.school_id,
      study_time_id: headers.study_time_id,
      campus: headers.campus,
      sem: headers.sem,
      year: headers.year,
    })
    .from("timetable_groups");

  let timetableGroupId;
  if (existingTimetableGroup.length === 0) {
    const [timetableGroup] = await database("timetable_groups").insert({
      school_id: headers.school_id,
      study_time_id: headers.study_time_id,
      campus: headers.campus,
      sem: headers.sem,
      year: headers.year,
    });
    timetableGroupId = timetableGroup;
  } else {
    timetableGroupId = existingTimetableGroup[0].tt_gr_id;
  }

  // console.log("timetableGroup", timetableGroupId);

  const fieldsToInsert = timetable.map((field) => ({
    timetable_group_id: timetableGroupId,
    day_id: field.selectedDay,
    session_id: field.selectedSession,
    lecturer_id: field.lecturer,
    room_id: field.room,
    c_unit_id: field.courseUnit.course_id,
    course_unit_name: field.courseUnit.course_name,
    s_id: currentSession.us_id,
  }));

  let insertSuccess = true;
  let duplicates = [];
  let message;
  for (const field of fieldsToInsert) {
    const result = await database
      .raw(
        `SELECT * FROM lecture_timetable WHERE timetable_group_id = ${field.timetable_group_id} AND day_id = ${field.day_id}  AND c_unit_id = '${field.c_unit_id}' AND course_unit_name = '${field.course_unit_name}'`
      )
      .then((result) => {
        if (!result[0].length) {
          return database("lecture_timetable").insert(field);
        } else {
          insertSuccess = false;
          duplicates.push(field.course_unit_name);
          message = `Two course units cannot have the same name in the same day`;
        }
      });
  }

  if (insertSuccess) {
    res.status(200).send({
      success: true,
      message: "Successfully uploaded the timetable",
    });
  } else {
    res.status(400).send({
      success: false,
      message: message,
      duplicates,
    });
  }
});

router.post("/updateClassTimetable", async (req, res) => {
  // console.log("Receiving ", req.body);

  try {
    const updateLecture = await database
      .select("*")
      .from("lecture_timetable")
      .where({
        tt_id: req.body.timetable_id,
      })
      .update({
        day_id: req.body.day.value,
        session_id: req.body.session.value,
        room_id: req.body.room.value,
        c_unit_id: req.body.selectedModule.value.course_code,
        course_unit_name: req.body.selectedModule.value.course_name,
        lecturer_id: req.body.lecturer.value,
      });

    res.send({
      success: true,
      result: "lecture updated successfully",
    });
  } catch (error) {
    console.log("Error in updating the lecture", error);
  }
});

router.delete("/deleteLecture/:tt_id", async (req, res) => {
  const { tt_id } = req.params;

  const lectures = await database("lectures")
    .where("l_tt_id", tt_id)
    .select("*");

  // console.log("the lectures", lectures);

  if (lectures.length > 0) {
    return res.send({
      success: false,
      result: "Cant delete lecture that is already initiated by the lecturer",
    });
  } else {
    database("lecture_timetable")
      .where("tt_id", tt_id)
      .del()
      .then((data) => {
        return res.send({
          success: true,
          result: "Lecture deleted Successfully",
        });
      })
      .catch((err) => {
        console.log("err", err);
      });
  }
});

router.post("/examTT", (req, res) => {
  // const { date, room, session } = req.body;
  console.log("Received this", req.body);

  // const d =
  //   new Date(date).getFullYear() +
  //   "-" +
  //   (new Date(date).getMonth() + 1) +
  //   "-" +
  //   new Date(date).getDate();
  // console.log("Data got", req.body);
  database
    .select("*")
    // .where({
    //   assigned_date: date,
    //   room_id: room,
    //   session_id: session,
    // })
    .from("exam_groups")
    .join(
      "exam_timetable",
      "exam_groups.exam_group_id",
      "=",
      "exam_timetable.exam_group_id"
    )
    .join("schools", "exam_groups.school_id", "=", "schools.school_id")
    .join("rooms", "exam_timetable.room_id", "=", "rooms.room_id")
    .join(
      "exam_sessions",
      "exam_timetable.session_id",
      "=",
      "exam_sessions.s_id"
    )
    .where("exam_groups.month", "=", req.body.month.value)
    .andWhere("exam_groups.year", "=", req.body.year.value)
    .andWhere("exam_groups.study_time_id", "=", req.body.studyTime.value)
    .andWhere("schools.alias", "=", req.body.school)
    // .join("exam_timetable", function () {
    //   this.on("invigilators.assigned_date", "=", "exam_timetable.date")
    //     .andOn("invigilators.room_id", "=", "exam_timetable.room_id")
    //     .andOn("invigilators.session_id", "=", "exam_timetable.session_id");
    // })
    // .where(function () {
    //   this.where("invigilators.assigned_date", "=", date)
    //     .andWhere("invigilators.room_id", "=", room)
    //     .andWhere("invigilators.session_id", "=", session);
    // })
    .then((exData) => {
      res.send(exData);
    })
    .catch((err) => console.log("error ", err));
});

router.post("/classTT", async (req, res) => {
  const { studyTime, campus, sem, year } = req.body;

  function getDayName(dayNumber) {
    const daysOfWeek = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ];
    return daysOfWeek[dayNumber % 7];
  }
  console.log("Received this", req.body);
  const tt_group = await database("timetable_groups")
    .join("schools", "timetable_groups.school_id", "=", "schools.school_id")
    .select("*")
    .where({
      study_time_id: studyTime,
      campus: campus,
      sem: sem,
      year: year,
    })
    .andWhere("schools.alias", "=", req.body.school)
    .first();

  console.log("the group", tt_group);
  // res.send(tt_group);

  if (!tt_group) {
    return res.send([]);
  }

  const timetable = await database("lecture_timetable")
    // .join("schools", "timetable_groups.school_id", "=", "schools.school_id")
    // .select("*")
    .join(
      "lecture_sessions",
      "lecture_timetable.session_id",
      "lecture_sessions.ls_id "
    )
    .join("rooms", "lecture_timetable.room_id", "rooms.room_id")

    .leftJoin("staff", "lecture_timetable.lecturer_id", "=", "staff.staff_id")
    .where({
      timetable_group_id: tt_group.tt_gr_id,
    })
    // .select(
    //   "lecture_timetable.tt_id",
    //   "lecture_timetable.day_id",
    //   "lecture_sessions.session_name",
    //   "rooms.room_name",
    //   "lecture_timetable.c_unit_id",
    //   "lecture_timetable.course_unit_name",
    //   "lecture_timetable.lecturer_id",
    //   "staff.*"
    // )
    .select("*")
    .orderBy("lecture_timetable.day_id", "ASC");

  let result = [];

  timetable.map((tt) => {
    let day = getDayName(parseInt(tt.day_id));
    result.push({ ...tt, day });
  });

  res.send(result);
});

router.post("/save_new_module", async (req, res) => {
  console.log("the module received", req.body);
  const existingModule = await database
    .select("*")
    .where({
      course_name: req.body.courseName.toUpperCase(),
      school_id: req.body.school.value,
    })
    .from("modules");

  if (existingModule[0]) {
    return res.send({
      success: false,
      message: `The course unit already exists in the ${req.body.school.label}`,
    });
  }

  // insert the data provided
  const result = await database("modules").insert({
    course_id: req.body.courseID,
    course_name: req.body.courseName.toUpperCase(),
    course_code: req.body.courseCode,
    module_level: req.body.moduleLevel.value,
    study_yr: req.body.studyYr.value,
    sem: req.body.sem.value,
    school_id: req.body.school.value,
  });

  return res.send({
    success: true,
    message: "Module saved Successfully",
  });
});

module.exports = router;
