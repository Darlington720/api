const express = require("express");
const path = require("path");
const router = express.Router();
const multer = require("multer");
const { database } = require("../config");

let active_session = {
  "sec-ch-ua":
    '"Not_A Brand";v="99", "Google Chrome";v="109", "Chromium";v="109"',
  "Content-Type": "application/json",
  "X-Requested-With": "XMLHttpRequest",
  "sec-ch-ua-mobile": "?0",
  "User-Agent":
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36",
  "sec-ch-ua-platform": '"Linux"',
  Accept: "*/*",
  host: "student.nkumbauniversity.ac.ug",
  Cookie:
    "ai=30303466666331366165303036653839656439333164363737336335356164327C7C6E6B756D6261; as=34343735303266366464333532353164636335356664623966646234623131667C7C31363030313033313333; asc=52e1ddc82b9d9009aaf2ae1e6073246f; ast=be66522e-7e42-4cc9-8c7e-0b7f2d5f9c93-1685312697; dp=62376564373862352D653961312D346632322D623735662D6538646632306337306364667C7C323032332D30352D32377E323032332D30352D32387E323032332D30352D3239; inst=6E6B756D6261; rt=62376564373862352D653961312D346632322D623735662D653864663230633730636466; st=31363030313033313333; tk=464d5cc36f919fa2d60f2631d0c1379211a9455eb41593db3c2c9212674f2410",
};

// Configure multer to store uploaded files in a desired location
const storage = multer.diskStorage({
  destination: path.resolve(__dirname, "..", "upload/evidence"),
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});
const upload = multer({ storage });

router.post("/student", async (req, res) => {
  const { stdno, room_id, session_id } = req.body;
  console.log("received", req.body);
  let year;
  let sem;
  let student_cus = [];
  let registration_status = "Not Registered";
  const student = await database.select("*").from("students_biodata").where({
    stdno,
  });

  if (!student[0]) {
    return res.send({
      success: false,
      message: `Unknown Student ${stdno}`,
    });
  }

  year = student[0].study_yr;
  sem = student[0].current_sem;

  const payments = await database.select("*").from("student_paid_fess").where({
    stu_no: stdno,
  });

  payments.sort((a, b) => {
    // Sort by 'study_yr' first
    if (a.study_yr < b.study_yr) {
      return -1;
    }
    if (a.study_yr > b.study_yr) {
      return 1;
    }

    // If 'study_yr' is the same, sort by 'sem'
    if (a.sem < b.sem) {
      return -1;
    }
    if (a.sem > b.sem) {
      return 1;
    }

    // If both 'study_yr' and 'sem' are equal, maintain the original order
    return 0;
  });

  // active payments - pick the current yr and sem
  if (payments.length > 0) {
    year = payments[payments.length - 1].study_yr;
    sem = payments[payments.length - 1].sem;
    registration_status = payments[payments.length - 1].reg_status;
  }

  // booklet numbers for the student
  const course_units_did_by_student = await database
    .select("*")
    .from("students_in_exam_room")
    .join(
      "courseunits_in_exam_rooms",
      "students_in_exam_room.cu_in_ex_id",
      "=",
      "courseunits_in_exam_rooms.cunit_in_ex_room_id"
    )
    .join(
      "exam_details",
      "courseunits_in_exam_rooms.ed_id",
      "=",
      "exam_details.ed_id"
    )
    .andWhere("students_in_exam_room.stu_no", "=", stdno);
  // .groupBy("course_unit_code");
  //console.log("payments", payments)
  //exemptions
  const studentExemptions = await database
    .select("*")
    .from("exemptions")
    .where("stdno", "=", stdno);

  // console.log("course units did in room", course_units_did_by_student);

  // const enrolledModules = await database
  //   .select("*")
  //   .from("student_enrollment_categories")
  //   .join(
  //     "student_enrolled_modules",
  //     "student_enrollment_categories.sec_id",
  //     "student_enrolled_modules.cat_id"
  //   )
  //   .where("student_enrollment_categories.stdno", "=", stdno)
  //   .andWhere("student_enrollment_categories.study_yr", "=", year)
  //   .andWhere("student_enrollment_categories.sem", "=", sem);

  const exams = await database
    .select("course_unit_code", "course_unit_name")
    .from("exam_timetable")
    .where({
      room_id,
      session_id,
      date:
        new Date(req.body.date).getFullYear() +
        "-" +
        (new Date(req.body.date).getMonth() + 1) +
        "-" +
        new Date(req.body.date).getDate(),
    });

  // console.log("units in room", exams);

  const enrolledModules = await database
    // .orderBy("id")
    .select("*")
    .from("modules")
    .where({
      course_code: student[0].progcode,
    });

  let arr = [];

  // combine the two
  enrolledModules.forEach((m) => {
    exams.forEach((e) => {
      if (m.course_name == e.course_unit_name) {
        arr.push(m);
      }
    });
  });

  // console.log("supposed to do", arr);

  if (!course_units_did_by_student[0]) {
    //	console.log("year", year);
    //	console.log("sem", sem);
    return res.send({
      success: true,
      result: {
        biodata: student[0],
        payments,
        study_yr: year,
        current_sem: sem,
        registration_status,
        student_cus: studentExemptions,
        enrolledModules,
        supposed_to_do: arr,
      },
    });
  }

  const x = course_units_did_by_student.map(async (cu) => {
    const booklets = await database
      .select("*")
      .from("student_registered_booklets")
      .where({
        stu_in_ex_room_id: cu.se_id,
      });

    return student_cus.push({ ...cu, booklets });
  });

  Promise.all(x)
    .then(() => {
      res.send({
        success: true,
        result: {
          biodata: student[0],
          payments,
          study_yr: year,
          current_sem: sem,
          registration_status,
          student_cus: [...student_cus, ...studentExemptions],
          enrolledModules,
          supposed_to_do: arr,
        },
      });
    })
    .catch((err) => {
      res.send({
        success: false,
        message: "Error handling the request" + err,
      });
    });
});

router.get("/exam_report_reqs", async (req, res) => {
  const schools = await database("schools");
  const campus = await database("campus");
  const year_sem = await database("year_sem");

  res.send({
    success: true,
    result: {
      schools,
      campus,
      year_sem,
    },
  });
});

router.post("/exam_report", async (req, res) => {
  const { start_date, end_date, school_id, campus, yr_sem_id } = req.body;

  // First, am getting the examinations in the specified date based on the timetable
  const exams = await database("exam_timetable")
    .join(
      "exam_groups",
      "exam_timetable.exam_group_id",
      "=",
      "exam_groups.exam_group_id"
    )
    .leftJoin("exam_details", function () {
      this.on("exam_details.room_id", "=", "exam_timetable.room_id")
        .andOn("exam_details.session_id", "=", "exam_timetable.session_id")
        .andOn("exam_details.date", "=", "exam_timetable.date");
    })
    .where("exam_groups.school_id", 1)
    .andWhere("exam_groups.campus_id", "MAIN")
    .andWhere("exam_groups.yr_sem_id", 1)
    .whereBetween("exam_timetable.date", ["2023-05-16", "2023-05-18"])
    .select(
      "exam_timetable.*",
      "exam_details.assigned_by",
      "exam_details.started_at",
      "exam_details.ended_at",
      "exam_details.ended_by",
      "exam_groups.*"
    );

  // console.log("exams", exams);

  res.send(exams);
});

router.post("/end_room_session", async (req, res) => {
  const { ed_id, staff_id } = req.body;

  console.log("Receiving ", req.body);

  const d = new Date();
  const formatedDate =
    d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();

  console.log("Formated", formatedDate);
  console.log("Formated time", d.toLocaleTimeString());

  try {
    const room_details_update = await database
      .select("*")
      .from("exam_details")
      .where({
        ed_id,
      })
      .update({
        ended_at: d.toLocaleTimeString(),
        ended_by: staff_id,
      });

    res.send({
      success: true,
      message: "Successfully ended the session",
    });
  } catch (error) {
    res.send({
      success: false,
      message: "error updating the session data" + error,
    });
  }
});

router.post("/api/saveRegisteredModule", (req, res) => {
  // const { room, invigilators, session, date, status, assigned_by } = req.body;
  // console.log("Data Received", req.body);

  const d1 = new Date(req.body.assigned_date);
  const assignedDate =
    d1.getFullYear() + "-" + (d1.getMonth() + 1) + "-" + d1.getDate();

  const d = new Date();
  const formatedDate =
    d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();

  console.log("Formated", formatedDate);
  console.log("Formated time", d.toLocaleTimeString());

  database("modules_registered")
    .insert({
      module_code: req.body.module_code,
      module_title: req.body.module_title,
      module_sem: req.body.module_sem,
      module_status: req.body.module_status,
      module_year: req.body.module_year,
      yrsem: req.body.yrsem,
      credit_units: req.body.credit_units,
      stdno: req.body.stdno,
      registered_by: req.body.registered_by,
      time_in: d.toLocaleTimeString(),
      date_start: formatedDate,
    })
    .then((data) => {
      //checking if any student has already come for the specified unit
      database
        .select("*")
        .from("courseunits_in_exam_rooms")
        .where({
          course_code: req.body.module_code,
          course_name: req.body.module_title,
          room_id: req.body.room_id,
          session_id: req.body.session_id,
          assigned_date: assignedDate,
        })
        .then((data) => {
          if (data.length == 0) {
            database("courseunits_in_exam_rooms")
              .insert({
                course_code: req.body.module_code,
                course_name: req.body.module_title,
                room_id: req.body.room_id,
                session_id: req.body.session_id,
                assigned_date: assignedDate,
              })
              .then((data) => {
                console.log("Saved that course unit");
              });
          }
        });

      res.status(200).send("received the data");
    })
    .catch((err) => res.status(400).send("Failed to send the data " + err));
});

router.post("/examHandin", async (req, res) => {
  // const { room, invigilators, session, date, status, assigned_by } = req.body;
  console.log("Data Received for handin", req.body);
  const d = new Date();
  const formatedDate =
    d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();

  console.log("Formated", formatedDate);
  console.log("Formated time", d.toLocaleTimeString());

  try {
    const insert = await database("students_in_exam_room")
      .where({
        se_id: req.body.se_id,
      })
      .update({
        handed_in: 1,
        time_handin: d.toLocaleTimeString(),
        date_handin: formatedDate,
      });

    res.status(200).send({
      success: true,
      message: "received the data",
    });
  } catch (error) {
    res.status(400).send({
      success: false,
      message: "Failed to send the data " + error,
    });
  }
});

router.post("/addStudentBookletNos", async (req, res) => {
  console.log("Data Received", req.body);
  const { stu_no, bookletNos, course_unit_name, course_code, ed_id, staff_id } =
    req.body;
  let existingUnit_id;
  let existingStuInRoom_id;

  // want to add  a unit to the timetable if the user sends a new one.
  if (req.body.notIn2desExams) {
    // first am getting the group id
    const existingTimetableGroup = await database
      .select("*")
      .from("exam_timetable")
      .where({
        date: req.body.room_details.date,
        room_id: req.body.room_details.room_id,
        session_id: req.body.room_details.session_id,
      });

    const newModuleInTT = await database("exam_timetable").insert({
      exam_group_id: existingTimetableGroup[0].exam_group_id,
      date: req.body.room_details.date,
      session_id: req.body.room_details.session_id,
      room_id: req.body.room_details.room_id,
      course_unit_code: req.body.course_code,
      course_unit_name: req.body.course_unit_name,
    });
  }

  // first we are going to save the required data in course_units_in_exam_room
  const existingUnit = await database
    .select("*")
    .from("courseunits_in_exam_rooms")
    .where({
      ed_id,
      course_code: course_code,
      course_name: course_unit_name,
    });

  if (!existingUnit[0]) {
    const insertResult = await database("courseunits_in_exam_rooms").insert({
      ed_id,
      course_code: course_code,
      course_name: course_unit_name,
    });
    existingUnit_id = insertResult[0];
  } else {
    existingUnit_id = existingUnit[0].cunit_in_ex_room_id;
  }

  // then insert the student_no in the students_in_exam_room table
  // but let me first check if there is an existing exact record
  const existingStudentInRoom = await database
    .select("*")
    .from("students_in_exam_room")
    .where({
      stu_no,
      cu_in_ex_id: existingUnit_id,
      staff_id,
    });

  // console.log(existingStudentInRoom);

  if (!existingStudentInRoom[0]) {
    const insertStuResult = await database("students_in_exam_room").insert({
      stu_no,
      cu_in_ex_id: existingUnit_id,
      staff_id,
    });
    existingStuInRoom_id = insertStuResult[0];
  } else {
    existingStuInRoom_id = existingStudentInRoom[0].se_id;
  }

  // then insert the booklet numbers in student_registered_booklets table
  const x = bookletNos.map(async (b) => {
    const existingBooklet = await database
      .select("*")
      .from("student_registered_booklets")
      .where({
        stu_in_ex_room_id: existingStuInRoom_id,
        booklet_no: b.booklet_no,
      });

    if (existingBooklet.length == 0) {
      const insertBooklet = await database(
        "student_registered_booklets"
      ).insert({
        stu_in_ex_room_id: existingStuInRoom_id,
        booklet_no: b.booklet_no,
      });

      // const entireBooklet = await database
      // .select("*")
      // .from("student_registered_booklets")
      // .where({
      //   srb_id: insertBooklet[0],
      // });

      // .catch((err) =>
      //   res.status(400).send("Failed to send the data " + err)
      // );
    }
  });

  Promise.all(x)
    .then(() => {
      res.send({
        success: true,
        message: "Successfully Saved the data",
      });
    })
    .catch((err) => {
      res.send({
        success: false,
        message: "Error storing booklet number " + err,
      });
    });
});

router.get("/api/getStudentRegBookletNos/:moduleRegId", (req, res) => {
  // const { room, invigilators, session, date, status, assigned_by } = req.body;
  const { moduleRegId } = req.params;
  console.log("Data Received", req.params);
  const d = new Date();
  const formatedDate =
    d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();

  database
    .select("*")
    .from("student_registered_booklets")
    .where({
      module_reg_id: moduleRegId,
    })
    .then((data) => {
      res.send(data);
    });
});

router.get("/api/getStudentRegisteredModules/:studentNo", (req, res) => {
  const { studentNo } = req.params;

  console.log("Student data", studentNo);
  database
    .select("*")
    .from("modules_registered")
    .leftJoin(
      "students_handin",
      "modules_registered.cunit_reg_id",
      "=",
      "students_handin.module_reg_id"
    )

    .where("modules_registered.stdno", "=", studentNo)

    .then((data) => {
      database
        .select("*")
        .from("exemptions")
        .where({
          stdno: studentNo,
        })
        .then((data2) => {
          res.send([...data, ...data2]);
        });
    });
});

router.get("/examsDidInRoom/:ed_id", async (req, res) => {
  // const { room, invigilators, session, date, status, assigned_by } = req.body;
  // console.log("Data Received in room", req.body);

  const { ed_id } = req.params;
  let num_of_students = [];
  // first am using the `ed_id` to get all the course units did the room
  const courseUnitsDidInRoom = await database
    .select("*")
    .from("courseunits_in_exam_rooms")
    .where({
      ed_id,
    });

  if (courseUnitsDidInRoom.length == 0) {
    return res.send({
      success: true,
      result: [],
    });
  }

  // am using each each unit to get the students from the `students_in_exam_room`
  const x = courseUnitsDidInRoom.map(async (cu) => {
    const studentCount = await database
      // .count("cu")
      .from("students_in_exam_room")
      .where({
        cu_in_ex_id: cu.cunit_in_ex_room_id,
      })
      .count("cu_in_ex_id as num_of_students");

    num_of_students.push({
      id: cu.cunit_in_ex_room_id,
      module_title: cu.course_name,
      studentCount,
    });
  });

  Promise.all(x).then(() => {
    res.send({
      success: true,
      result: { courseUnitsDidInRoom, students: num_of_students },
    });
  });

  // database
  //   .select("*")
  //   .from("courseunits_in_exam_rooms")
  //   .where({
  //     room_id: req.body.room_id,
  //     session_id: req.body.session_id,
  //     assigned_date: assignedDate,
  //   })
  //   .then((data) => {
  //     console.log("ney data", data);
  //     let newArr = [];

  //     if (data.length == 0) {
  //       res.send(data);
  //     } else {
  //       data.forEach((exam, index) => {
  //         let d4 = async (callback) => {
  //           await database
  //             .select("*")
  //             .from("modules_registered")
  //             .where({
  //               module_title: exam.course_unit_name,
  //             })
  //             .then((data4) => {
  //               // res.send(data);
  //               let data = async (callback) => {
  //                 await database
  //                   .select("*")
  //                   .from("modules_registered")
  //                   .join(
  //                     "students_handin",
  //                     "modules_registered.cunit_reg_id",
  //                     "=",
  //                     "students_handin.module_reg_id"
  //                   )

  //                   .where(
  //                     "modules_registered.module_title",
  //                     "=",
  //                     exam.course_unit_name
  //                   )
  //                   .then((data2) => {
  //                     // return result;
  //                     // console.log("result ", result);
  //                     let obj = {
  //                       registered: data4.length,
  //                       handed_in: data2.length,
  //                       didnt_handin: data4.length - data2.length,
  //                     };
  //                     newArr.push({ ...exam, ...obj });
  //                     callback(newArr);
  //                     // res = result;
  //                   });
  //               };

  //               data(function (result) {
  //                 // console.log("Call back result", result);
  //                 callback(result);
  //               });
  //             });
  //         };

  //         d4(function (result) {
  //           if (data.length - 1 == index) {
  //             res.send(result);
  //           }
  //           // console.log("Call back in loop now", result);
  //           // callback(result)
  //         });
  //       });
  //     }
  //   });
});

router.get("/students_in_exam/:id", async (req, res) => {
  const { id } = req.params;
  let num_of_students = [];
  // getting the students in the specificied exam
  const students_in_ex_room = await database

    .from("students_in_exam_room")
    .join(
      "students_biodata",
      "students_in_exam_room.stu_no",
      "=",
      "students_biodata.stdno"
    )
    .select("students_biodata.name", "students_in_exam_room.*")
    .where({
      cu_in_ex_id: id,
    });

  if (students_in_ex_room.length == 0) {
    return res.send({
      success: true,
      result: [],
    });
  }

  res.send({
    success: true,
    result: students_in_ex_room,
  });

  // database
  //   .select("*")
  //   .from("courseunits_in_exam_rooms")
  //   .where({
  //     room_id: req.body.room_id,
  //     session_id: req.body.session_id,
  //     assigned_date: assignedDate,
  //   })
  //   .then((data) => {
  //     console.log("ney data", data);
  //     let newArr = [];

  //     if (data.length == 0) {
  //       res.send(data);
  //     } else {
  //       data.forEach((exam, index) => {
  //         let d4 = async (callback) => {
  //           await database
  //             .select("*")
  //             .from("modules_registered")
  //             .where({
  //               module_title: exam.course_unit_name,
  //             })
  //             .then((data4) => {
  //               // res.send(data);
  //               let data = async (callback) => {
  //                 await database
  //                   .select("*")
  //                   .from("modules_registered")
  //                   .join(
  //                     "students_handin",
  //                     "modules_registered.cunit_reg_id",
  //                     "=",
  //                     "students_handin.module_reg_id"
  //                   )

  //                   .where(
  //                     "modules_registered.module_title",
  //                     "=",
  //                     exam.course_unit_name
  //                   )
  //                   .then((data2) => {
  //                     // return result;
  //                     // console.log("result ", result);
  //                     let obj = {
  //                       registered: data4.length,
  //                       handed_in: data2.length,
  //                       didnt_handin: data4.length - data2.length,
  //                     };
  //                     newArr.push({ ...exam, ...obj });
  //                     callback(newArr);
  //                     // res = result;
  //                   });
  //               };

  //               data(function (result) {
  //                 // console.log("Call back result", result);
  //                 callback(result);
  //               });
  //             });
  //         };

  //         d4(function (result) {
  //           if (data.length - 1 == index) {
  //             res.send(result);
  //           }
  //           // console.log("Call back in loop now", result);
  //           // callback(result)
  //         });
  //       });
  //     }
  //   });
});

router.post("/start_room_session", async (req, res) => {
  const { ed_id, staff_id } = req.body;

  console.log("Receiving ", req.body);

  const d = new Date();
  const formatedDate =
    d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();

  console.log("Formated", formatedDate);
  console.log("Formated time", d.toLocaleTimeString());

  try {
    const room_details_update = await database
      .select("*")
      .from("exam_details")
      .where({
        ed_id,
      })
      .update({
        started_at: d.toLocaleTimeString(),
        started_by: staff_id,
      });

    res.send({
      success: true,
      message: "Successfully initialized the session",
    });
  } catch (error) {
    res.send({
      success: false,
      message: "error updating the session data" + error,
    });
  }
});

router.post("/save_evidence", async (req, res) => {
  // Access the uploaded image details through req.files
  console.log("Images received:", req.files);
  const { stdno, ed_id, description, staff_id } = req.body;
  console.log("the body", {
    stdno,
    ed_id,
    description,
    staff_id,
  });

  let me_id;

  if (!req.files || Object.keys(req.files).length === 0) {
    return res.status(400).send("No files were uploaded.");
  }

  const destinationDirectory = path.resolve(__dirname, "..", "upload/evidence");

  //first let me store the data that is in req.body
  const existingMalpractice = await database
    .select("*")
    .from("malpractice")
    .where({
      stdno,
      ed_id,
      description,
      staff_id,
    });

  console.log("existing id", existingMalpractice);

  if (!existingMalpractice[0]) {
    const insertResult = await database("malpractice").insert({
      stdno,
      ed_id,
      description,
      staff_id,
    });
    me_id = insertResult[0];
  } else {
    me_id = existingMalpractice[0].me_id;
  }

  console.log("desination", destinationDirectory);

  const x = Object.values(req.files).map(async (file) => {
    file.mv(
      path.join(destinationDirectory, `${Date.now()}-${file.name}`),
      (error) => {
        if (error) {
          console.error("Error moving file:", error);
        }
      }
    );

    return await database("malpractice_evidence").insert({
      me_id,
      image: `${Date.now()}-${file.name}`,
    });
  });

  // res.send("Images uploaded successfully!");
  Promise.all(x)
    .then(() => {
      res.send({
        success: true,
        message: "Images uploaded successfully!",
      });
    })
    .catch((err) => {
      console.log("Error", err);
      res.send({
        success: false,
        message: "error the images",
      });
    });
});

router.post("/exemption", async (req, res) => {
  const { stdno, module_code, module_title, exempted_by } = req.body;

  console.log("the body for exemption", req.body);

  // check for existing exemption
  const existingExemption = await database
    .select("*")
    .from("exemptions")
    .where({
      stdno,
      module_code,
      module_title,
      exempted_by,
    });

  if (existingExemption[0]) {
    return res.send({
      success: true,
      message: "Student already exempted!",
    });
  }

  if (!existingExemption[0]) {
    const insertResult = await database("exemptions").insert({
      stdno,
      module_code,
      module_title,
      exempted_by,
    });
  }

  res.send({
    success: true,
    message: "student exempted successfully",
  });
});

router.get("/students", async (req, res) => {
  let year;
  let sem;
  let arr = [];

  const allStudents = await database
    .select("stdno", "progcode", "study_yr", "current_sem")
    .limit(5)
    .offset(0)
    .from("students_biodata");

  const x = allStudents.map(async (stu) => {
    year = stu.study_yr;
    sem = stu.current_sem;
    const payments = await database
      .select("*")
      .from("student_paid_fess")
      .where({
        stu_no: stu.stdno,
      });

    payments.sort((a, b) => {
      // Sort by 'study_yr' first
      if (a.study_yr < b.study_yr) {
        return -1;
      }
      if (a.study_yr > b.study_yr) {
        return 1;
      }

      // If 'study_yr' is the same, sort by 'sem'
      if (a.sem < b.sem) {
        return -1;
      }
      if (a.sem > b.sem) {
        return 1;
      }

      // If both 'study_yr' and 'sem' are equal, maintain the original order
      return 0;
    });

    if (payments.length > 0) {
      year = payments[payments.length - 1].study_yr;
      sem = payments[payments.length - 1].sem;
    }

    arr.push({ ...stu, year, sem });
  });

  Promise.all(x)
    .then(() => {
      res.send({
        allStudents: arr,
      });
    })
    .catch((err) => {
      res.send({
        error: "Error" + err,
      });
    });
});

router.post("/save_enrolled_modules", async (req, res) => {
  const { stdno, current_sem, study_yr, modules } = req.body;
  // console.log("received this", req.body);
  const existingCategory = await database
    .select("*")
    .from("student_enrollment_categories")
    .where({
      stdno,
      study_yr,
      sem: current_sem,
    });

  if (existingCategory[0]) {
    console.log("already have the modules", stdno);
    return res.send({
      success: true,
      message: "already have the modules",
    });
  }

  const newCategory = await database("student_enrollment_categories").insert({
    stdno,
    study_yr,
    sem: current_sem,
  });

  if (modules[0]) {
    const fieldsToInsert = modules.map((field, index) => {
      return {
        cat_id: newCategory[0],
        module_code: field.module_code,
        module_title: field.module_title,
        module_level: field.module_level,
        credit_units: field.credit_units,
        module_year: field.module_year,
        module_sem: field.module_sem,
      };
    });
    await database("student_enrolled_modules").insert(fieldsToInsert);
    console.log("new group inserted", stdno);
  }
  res.send({
    success: true,
    message: "modules saved successfully",
  });
});

router.get("/active_session", async (req, res) => {
  // const existingSession = await database
  //   .select("*")
  //   .from("external_active_session");

  res.send({
    success: true,
    session: active_session,
  });
});

router.post("/save_active_session", async (req, res) => {
  console.log("the body", req.body);
  // const existingCategory = await database("external_active_session")
  //   .where({
  //     eas_id: req.body.eas_id,
  //   })
  //   .update({
  //     handed_in: 1,
  //     time_handin: d.toLocaleTimeString(),
  //     date_handin: formatedDate,
  //   });

  active_session = req.body;

  res.send({
    success: true,
    message: "updated successfully",
  });
});

module.exports = router;
