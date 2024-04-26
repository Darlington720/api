const express = require("express");
const router = express.Router();
var knex = require("knex");
var _ = require("lodash");
const moment = require("moment");
const { database, getCurrentSession } = require("../config");

router.get(`/studentBiodata/:stdno`, (req, res) => {
  const { stdno } = req.params;
  console.log(req.params);
  database
    // .orderBy("id")
    .select("*")
    .from("students_biodata")
    // .join("campus", "gates.campus_id", "=", "campus.cam_id")
    .where({
      stdno,
    })
    .then((data) => {
      res.send(data);
    });
});

router.get("/studentEnrollmentInCurrentSem/:stu_no", async (req, res) => {
  const { stu_no } = req.params;
  const allSessions = await database
    .select("*")
    .from("university_sessions")
    .orderBy("us_id", "desc")
    .limit(1);

  const currentSession = allSessions[0];

  const studentEnrollmentForTheCurrentSession = await database
    .select("*")
    .from("student_enrollment")
    .where({
      stu_no: stu_no,
      sem_half: currentSession.session_sem,
      year: currentSession.session_year,
    });

  res.send({
    success: true,
    result: {
      current_session: currentSession,
      status: studentEnrollmentForTheCurrentSession.length === 0 ? false : true,
    },
  });
});

router.post("/saveStudentEnrollment", async (req, res) => {
  //save the records, but the student can't go back to previous semesters
  // console.log("body", req.body);
  try {
    const { stu_no, study_yr, sem, sem_half, year } = req.body;

    const studentBio = await database
      .select("study_yr", "current_sem")
      .from("students_biodata")
      .where(function () {
        this.where("stdno", "=", stu_no);
      });

    // console.log("Bio", studentBio);

    const studentEnrollmentForTheCurrentSession = await database
      .select("*")
      .from("student_enrollment")
      .where({
        stu_no,
        sem_half,
        year,
      });

    // console.log("enrollment", studentEnrollmentForTheCurrentSession);

    if (
      studentEnrollmentForTheCurrentSession.length > 0 ||
      (parseInt(study_yr) <= parseInt(studentBio[0].study_yr) &&
        parseInt(studentBio[0].study_yr) !== 1 &&
        parseInt(sem) <= parseInt(studentBio[0].current_sem) &&
        parseInt(studentBio[0].current_sem) !== 1)
    ) {
      return res.send({
        success: false,
        result: "You can't enroll in previous semesters",
      });
    }

    const result = await database("student_enrollment").insert({
      stu_no,
      study_yr,
      sem,
      sem_half,
      year,
    });

    const [insertedRow] = await database
      .select()
      .from("student_enrollment")
      .where({
        stu_no,
        study_yr,
        sem,
        sem_half,
        year,
      })
      .limit(1);

    res.send({
      success: true,
      result: insertedRow,
    });
  } catch (error) {
    console.log("error", error);
    res.send({
      success: false,
      result: "System experienced an error, please try again",
    });
  }
});

router.get("/mySelectedCourseUnits/:stu_no", async (req, res) => {
  const { stu_no } = req.params;
  const currentSession = await getCurrentSession();
  // console.log("new", stu_no);

  database
    .select("*")
    .from("stu_selected_course_units")
    .where({
      stu_id: stu_no,
      session_id: currentSession.us_id,
    })
    // .join("modules", function () {
    //   this.on(
    //     "stu_selected_course_units.course_id",
    //     "=",
    //     "modules.course_id"
    //   ).andOn("stu_selected_course_units.course", "=", "modules.course_code");
    // })
    .where(function () {
      this.where("stu_id", "=", stu_no);
    })

    .then((data) => {
      res.send(data);
    });
  // database
  //   // .orderBy("id")
  //   .select("*")
  //   .from("stu_selected_course_units")
  //   .join(
  //     "modules",
  //     "stu_selected_course_units.course_id",
  //     "=",
  //     "modules.course_id"
  //   )
  //   .where(function () {
  //     this.where("stu_id", "=", stu_no);
  //   })

  //   .then((data) => {
  //     res.send(data);
  //   });
});

router.post("/myCourseUnitsTodayDashboard/", async (req, res) => {
  const d = new Date();
  const date = d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();

  const currentSession = await getCurrentSession();

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

    .where("day_id", "=", req.body.day)
    .andWhere("schools.alias", "=", req.body.school)
    .andWhere("study_time.study_time_name", "=", req.body.study_time)
    .where("s_id", "=", currentSession.us_id)

    //.join("course_units", "timetable.c_unit_id", "=", "course_units.course_id")
    .join(
      "stu_selected_course_units",
      "lecture_timetable.c_unit_id",
      "=",
      "stu_selected_course_units.course_id"
    )
    .leftJoin("staff", "lecture_timetable.lecturer_id", "=", "staff.staff_id")

    .leftJoin("lectures", function () {
      this.on("lecture_timetable.tt_id", "=", "lectures.l_tt_id")
        .andOn(
          "lectures.l_year",
          "=",
          parseInt(
            req.body.selectedYear ? req.body.selectedYear : d.getFullYear()
          )
        )
        .andOn(
          "lectures.l_month",
          "=",
          parseInt(
            req.body.selectedMonth ? req.body.selectedMonth : d.getMonth() + 1
          )
        )
        .andOn(
          "lectures.l_date",
          "=",
          parseInt(req.body.selected ? req.body.selected : d.getDate())
        );
    })
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
      "staff.*",
      "stu_selected_course_units.*",
      "lectures.*"
    )
    // .where("lectures.date", "=", req.body.date)
    .andWhere("stu_selected_course_units.stu_id", "=", req.body.stu_no)
    // .orderBy("start_time")
    .then((lec) => {
      const data = lec.map((obj) => {
        const newObj = Object.assign({}, obj, {
          school: obj.alias,
          study_time: obj.study_time_name,
          room: obj.room_name,
        });

        delete newObj.alias;
        delete newObj.study_time_name;
        return newObj;
      });

      // newArr.push(data);
      // console.log("another response herer", data);
      let lectureDetails = [];
      const fetch_3 = data.map((lecture, index) => {
        return database
          .select("*")
          .from("users")
          .join("class_reps", "users.stu_no", "=", "class_reps.class_rep_id")
          .where("class_reps.for_wc_cu", "=", lecture.c_unit_id)
          .then((classRepInfo) => {
            // console.log("Index", index);
            lectureDetails.push({ ...lecture, classRepInfo });

            // return lectureDetails;
          });
      });

      Promise.all(fetch_3).then(() => {
        // console.log("Resulting array", lectureDetails);
        const sortedAsc = lectureDetails.sort(
          (objA, objB) =>
            moment(objA.start_time, "h:mmA") - moment(objB.start_time, "h:mmA")
        );

        let finalArr = [];

        sortedAsc.map((l) => {
          finalArr.push({
            ...l,
            fullSelectedDate: date,
          });
        });

        res.send(finalArr);
        // res.connection.destroy()
      });
    });
});

router.post("/myCourseUnitsToday/", async (req, res) => {
  // const { lectures } = req.params;
  // let arr = lectures.split(",");
  // console.log(lectures.split(","));

  // console.log("is Array result", Array.isArray(req.body));
  // console.log("the body", req.body);
  // console.log("from the client ", req.body.day);

  const currentSession = await getCurrentSession();

  // console.log("session ", currentSession);

  const d = new Date();
  const date = d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
  // console.log(d.getDay());

  // console.log("from the client ", req.body.my_array);
  // console.log("date ", date);
  let currentTime = new Date().toLocaleTimeString();

  var m1 = moment(`${date} 7:00AM`, "YYYY-MM--DD h:mmA");
  // var m1 = moment(`2023-02-01 7:00AM`, "YYYY-MM--DD h:mmA");

  // var m1 = moment();

  var moment1 = moment(`${date}`, "YYYY-MM--DD");
  // var moment1 = moment(`2023-02-01`, "YYYY-MM--DD");
  // var moment1 = moment();
  let newArr = [];
  let lectureDetails = [];
  let counter = 0;
  let sortedLectureDetails = [];

  // arr.forEach((e) => {
  // console.log("lecture ", parseInt(e));
  // newArr.push(e);

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
    .leftJoin("rooms", "lecture_timetable.room_id", "rooms.room_id")
    .join("schools", "timetable_groups.school_id", "schools.school_id")

    .where("day_id", "=", req.body.day)
    .andWhere("schools.alias", "=", req.body.school)
    .andWhere("lecture_timetable.s_id", "=", currentSession.us_id)
    // .andWhere("study_time.study_time_name", "=", req.body.study_time)
    // .join(
    //   "stu_selected_course_units",
    //   "lecture_timetable.c_unit_id",
    //   "=",
    //   "stu_selected_course_units.course_id"
    // )
    .leftJoin("staff", "lecture_timetable.lecturer_id", "=", "staff.staff_id")

    // .leftJoin("lectures", "lecture_timetable.tt_id", "=", "lectures.l_tt_id")
    .leftJoin("lectures", function () {
      this.on("lecture_timetable.tt_id", "=", "lectures.l_tt_id").andOn(
        "lectures.date",
        "=",
        database.raw("?", [req.body.date])
      );
    })
    // .andWhere("lectures.date", "=", req.body.date)
    // .select("*")
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
      "staff.*",
      // "stu_selected_course_units.*",
      "lectures.*"
    )
    // .where("lectures.date", "=", req.body.date)
    // .andWhere("stu_selected_course_units.stu_id", "=", req.body.stu_no)
    // .orderBy("start_time")
    .then(async (lec) => {
      // console.log("lec from db", lec);
      const data = lec.map((obj) => {
        const newObj = Object.assign({}, obj, {
          school: obj.alias,
          study_time: obj.study_time_name,
          room: obj.room_name,
        });

        delete newObj.alias;
        delete newObj.study_time_name;
        return newObj;
      });
      // res.send(lectures);
      // console.log("The lectures", data);

      data.map((item) => {
        // console.log("THe item", item);
        JSON.parse(req.body.myArray).map((reqItem, index) => {
          let trimmedStr;
          if (reqItem.includes("-")) {
            // console.log("Req item", reqItem);
            let char_index = reqItem.lastIndexOf("-");
            trimmedStr = reqItem.slice(0, char_index);
            // console.log("trimmed???", trimmedStr);
          } else {
            // console.log("Reqitemwithout ", reqItem);
          }

          if (trimmedStr) {
            if (item.c_unit_id == reqItem || item.c_unit_id == trimmedStr) {
              var m2 = moment(
                `${req.body.date} ${item.end_time}`,
                "YYYY-MM--DD h:mmA"
              );

              var moment2 = moment(
                `${req.body.date} ${item.end_time}`,
                "YYYY-MM--DD"
              );
              if (moment.duration(moment2.diff(moment1))._data.days > 0) {
                // console.log(moment.duration(moment2.diff(moment1))._data.days);
                // console.log("Lecture is not supposed to be taught now");
                newArr.push({ ...item, status: "not now" });
                // console.log({ ...item, status: "not now" });
              } else {
                if (m1.isBefore(m2)) {
                  // console.log({ ...item, status: "on" });
                  newArr.push({ ...item, status: "on" });
                  // console.log("Lecture is still on");
                } else {
                  // console.log({ ...item, status: "off" });
                  newArr.push({ ...item, status: "off" });
                  // console.log("Lecture is supposed to have ended");
                }
              }
            }
          } else {
            if (item.c_unit_id == reqItem) {
              var m2 = moment(
                `${req.body.date} ${item.end_time}`,
                "YYYY-MM--DD h:mmA"
              );

              var moment2 = moment(
                `${req.body.date} ${item.end_time}`,
                "YYYY-MM--DD"
              );
              if (moment.duration(moment2.diff(moment1))._data.days > 0) {
                // console.log(moment.duration(moment2.diff(moment1))._data.days);
                // console.log("Lecture is not supposed to be taught now");
                newArr.push({ ...item, status: "not now" });
                // console.log({ ...item, status: "not now" });
              } else {
                if (m1.isBefore(m2)) {
                  // console.log({ ...item, status: "on" });
                  newArr.push({ ...item, status: "on" });
                  // console.log("Lecture is still on");
                } else {
                  // console.log({ ...item, status: "off" });
                  newArr.push({ ...item, status: "off" });
                  // console.log("Lecture is supposed to have ended");
                }
              }
            }
          }
        });
      });

      // console.log("New array so far", newArr);

      const fetch_1 = async () => {
        const data10 = await database
          .select("*")
          .from("lecture_members")
          .where("date", "=", req.body.date)
          .andWhere("member_id", "=", req.body.stu_no);

        const result = newArr.map((lecture) => {
          const itemA = data10.find(
            (student) =>
              lecture.has_ended && student.lecture_id == lecture.c_unit_id
          );
          if (itemA) {
            return { ...lecture, attendedLecture: true };
          }
          return lecture;
        });

        return result;
      };

      const result = await fetch_1();

      const fetch_3 = result.map((lecture, index) => {
        return database
          .select("*")
          .from("users")
          .join("class_reps", "users.stu_no", "=", "class_reps.class_rep_id")
          .where("class_reps.for_wc_cu", "=", lecture.c_unit_id)
          .then((classRepInfo) => {
            counter++;

            // console.log("Index", index);
            lectureDetails.push({ ...lecture, classRepInfo });

            // return lectureDetails;
          });
      });

      Promise.all(fetch_3).then(() => {
        const sortedAsc = lectureDetails.sort(
          (objA, objB) =>
            moment(objA.start_time, "h:mmA") - moment(objB.start_time, "h:mmA")
        );
        res.send(sortedAsc);
        // console.log("Resulting array", sortedAsc);
      });
    });

  // res.send(newArr);
});

router.get(`/allCourseUnits/:course_code`, (req, res) => {
  const { course_code } = req.params;

  database
    // .orderBy("id")
    .select("*")
    .from("modules")
    .where({
      course_code: course_code,
    })
    .orWhere("status", 1)
    .then((data) => {
      res.send(data);
    });
});

router.post("/addSelectedCourseUnit", async (req, res) => {
  const { stu_no, course_id, course_name, course_code, original_course_id } =
    req.body;
  let status = false;

  const currentSession = await getCurrentSession();

  console.log("current session", currentSession);
  // console.log("sent course unit", req.body);
  const studentSelectedCourseUnits = await database
    .from("stu_selected_course_units")
    .where({
      stu_id: stu_no,
      session_id: currentSession.us_id,
    })
    .select("*");

  // const existingCu = _.find(studentSelectedCourseUnits, {
  //   course_id: course_id || original_course_id,
  // });

  console.log("Students", studentSelectedCourseUnits);
  const existingCu = studentSelectedCourseUnits.find(
    (item) => item.course_id === (course_id || original_course_id)
  );

  // console.log("existing", existingCu);

  if (existingCu) {
    return res.send(
      `${existingCu.course_name} already added, Please Choose another one`
    );
  }

  // studentSelectedCourseUnits.forEach((courseUnit) => {
  //   if (
  //     courseUnit.course_id === course_id ||
  //     courseUnit.course_id === original_course_id
  //   ) {
  //     res.send(
  //       `${courseUnit.course_name} already added, Please Choose another one`
  //     );
  //     status = true;
  //   }
  // });

  // if (status === true) return;

  if (studentSelectedCourseUnits.length >= 8) {
    return res.send("Maximum number of course units selected");
  }

  const timetable = await database
    .from("lecture_timetable")
    .where(function () {
      this.where("c_unit_id", "=", original_course_id);
    })
    .select("*");

  // if (timetable.length > 0) {
  //   const result = await database("stu_selected_course_units").insert({
  //     stu_id: stu_no,
  //     course_id: original_course_id,
  //     course_name: course_name,
  //     course: course_code,
  //     session_id: currentSession.us_id,
  //   });

  //   return res.send("Course Unit added Successfully");
  // }

  database("stu_selected_course_units")
    .insert({
      stu_id: stu_no,
      course_id: course_id,
      course_name: course_name,
      course: course_code,
      session_id: currentSession.us_id,
    })
    .then((data) => {
      res.send("Course Unit added Successfully");
    })
    .catch((err) => res.send(err));

  // res.send("Received the data");
});

router.post("/removeSelectedCourseUnit", (req, res) => {
  const { stu_id, course_id } = req.body;
  // console.log("data", req.body);
  database("stu_selected_course_units")
    .where("stu_id", stu_id)
    .andWhere("course_id", course_id)
    .del()
    .then((data) => {
      res.send("Course Unit deleted Successfully");
    });
});

module.exports = router;
