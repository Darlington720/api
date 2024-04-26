const express = require("express");
const path = require("path");
const router = express.Router();
const fs = require("fs");
const moment = require("moment");
const { database, getCurrentSession } = require("../config");

router.get("/image/:id", (req, res) => {
  const { id } = req.params;
  //console.log("Id", id);
  console.log(
    "Current directory",
    path.resolve(__dirname, "..", "public/assets")
  );
  const desination = path.resolve(__dirname, "..", "public/assets");
  // res.send("http://10.7.0.22:9000/assets/jacket.jpg");

  fs.readFile(desination + `/${id.toUpperCase()}.jpg`, (err, data) => {
    if (err) {
      res.sendFile(desination + `/ph2.jpg`);
    } else {
      res.sendFile(desination + `/${id.toUpperCase()}.jpg`);
    }
  });
});

router.post("/lecturerCourseunits/", async (req, res) => {
  const { lecturer_id, day, l_date } = req.body;

  const currentSession = await getCurrentSession();

  // console.log("current session", currentSession);
  // console.log("the details", req.body);
  //console.log("data from ", req.params);
  const d = new Date();
  const date = d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
  //  console.log(req.body);
  let newArr = [];
  let lectureDetails = [];
  let counter2 = 0;

  let currentTime = new Date().toLocaleTimeString();

  var m1 = moment(`${date} 7:00AM`, "YYYY-MM--DD h:mmA");
  // var m1 = moment(`2023-02-01 7:00AM`, "YYYY-MM--DD h:mmA");

  // var m1 = moment();

  var moment1 = moment(`${date}`, "YYYY-MM--DD");
  // var moment1 = moment(`2023-02-01`, "YYYY-MM--DD");
  // var moment1 = moment();

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
    .where({
      day_id: day,
    })
    .where("s_id", currentSession.us_id)

    //.join("course_units", "timetable.c_unit_id", "=", "course_units.course_id")

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
      "lectures.*"
    )
    // .where("lectures.date", "=", req.body.date)
    // .andWhere("stu_selected_course_units.stu_id", "=", req.body.stu_no)
    .orderBy("lecture_sessions.start_time")
    .then((lec) => {
      console.log("the lecs", lec);
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

      // console.log("Receiveing this", data);

      // database
      //   .select("*")
      //   .from("timetable")
      //   .where({
      //     day_id: day,
      //     // lecturer_id,
      //   })
      //   //.join("course_units", "timetable.c_unit_id", "=", "course_units.course_id")
      //   //.join("lecturers", "timetable.lecturer_id", "=", "lecturers.lecturer_id")
      //   .join("staff", "timetable.lecturer_id", "=", "staff.staff_id")
      //   .join("schools", "timetable.school_id", "=", "schools.school_id")
      //   // .leftJoin("users", "timetable.c_unit_id", "=", "users.for_wc_cu")
      //   // .leftJoin("lectures", "timetable.tt_id", "lectures.l_tt_id")
      //   .leftJoin("lectures", function () {
      //     this.on("timetable.tt_id", "=", "lectures.l_tt_id")
      //       .andOn(
      //         "lectures.l_year",
      //         "=",
      //         parseInt(
      //           req.body.selectedYear ? req.body.selectedYear : d.getFullYear()
      //         )
      //       )
      //       .andOn(
      //         "lectures.l_month",
      //         "=",
      //         parseInt(
      //           req.body.selectedMonth ? req.body.selectedMonth : d.getMonth() + 1
      //         )
      //       )
      //       .andOn(
      //         "lectures.l_date",
      //         "=",
      //         parseInt(req.body.selected ? req.body.selected : d.getDate())
      //       );
      //   })
      //   .orderBy("start_time")

      //   .then((data) => {
      // console.log("lectures of teacher", data);
      database
        .select("*")
        .from("staff")
        .where({
          // day_id: 1,
          staff_id: lecturer_id,
        })
        .then((lecturer) => {
          // console.log("lecturer", lecturer);
          data.forEach((lecture) => {
            try {
              if (lecturer[0].staff_id == lecture.lecturer_id) {
                var m2 = moment(
                  `${req.body.l_date} ${lecture.end_time}`,
                  "YYYY-MM--DD h:mmA"
                );

                var moment2 = moment(
                  `${req.body.l_date} ${lecture.end_time}`,
                  "YYYY-MM--DD"
                );

                if (moment.duration(moment2.diff(moment1))._data.days > 0) {
                  // console.log(moment.duration(moment2.diff(moment1))._data.days);
                  // console.log("Lecture is not supposed to be taught now");
                  newArr.push({ ...lecture, status: "not now" });
                  // console.log({ ...item, status: "not now" });
                } else {
                  if (m1.isBefore(m2)) {
                    // console.log({ ...item, status: "on" });
                    newArr.push({ ...lecture, status: "on" });
                    // console.log("Lecture is still on");
                  } else {
                    // console.log({ ...item, status: "off" });
                    newArr.push({ ...lecture, status: "off" });
                    // console.log("Lecture is supposed to have ended");
                  }
                }
                // newArr.push(lecture);
              }
            } catch (error) {}
          });
          // res.send(newArr);
          // console.log("REsult", newArr);

          // if (newArr.length === 0) {
          //   res.send(newArr);
          // }
          const fetch = newArr.map((lecture, index) => {
            return (
              database
                .select("*")
                .from("users")
                .join(
                  "class_reps",
                  "users.stu_no",
                  "=",
                  "class_reps.class_rep_id"
                )
                // .where({
                //   // day_id: 1,
                //   for_wc_cu: lecture.c_unit_id,
                // })
                .where("class_reps.for_wc_cu", "=", lecture.c_unit_id)
                .orderBy("id")
                .then((classRepInfo) => {
                  counter2++;
                  //  console.log("lecture class Reps", classRepInfo);

                  lectureDetails.push({ ...lecture, classRepInfo });
                  // return { ...lecture, classRepInfo };

                  // return lectureDetails;
                })
            );
            // .then((data) => {
            //   // console.log(`loop through ${counter2}, ${newArr.length}`);
            //   if (newArr.length === counter2) {
            //     const sortedAsc = data.sort(
            //       (objA, objB) =>
            //         moment(objA.start_time, "h:mmA") -
            //         moment(objB.start_time, "h:mmA")
            //     );
            //     res.send(sortedAsc);
            //     // console.log("new arr", sortedAsc);
            //     // res.send(sortedAsc);
            //   }
            // });
          });

          Promise.all(fetch).then(() => {
            // console.log("Resulting data", lectureDetails);
            const sortedAsc = lectureDetails.sort(
              (objA, objB) =>
                moment(objA.start_time, "h:mmA") -
                moment(objB.start_time, "h:mmA")
            );
            res.send(sortedAsc);
          });

          // console.log(newArr);
          // res.send(newArr);
        });

      // });
    });

  // res.send(newArr);
});

router.get("/myAssignedRooms/:staff_id/:date", async (req, res) => {
  const { date, staff_id } = req.params;

  const d = new Date();
  const d1 = d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
  console.log(req.params);
  console.log(d1);

  var m2 = moment(`${date}`, "YYYY-MM--DD h:mmA");

  var moment2 = moment(`${date}`, "YYYY-MM--DD");

  let currentTime = new Date().toLocaleTimeString();

  var m1 = moment(`${d1} 7:00AM`, "YYYY-MM--DD h:mmA");
  // var m1 = moment(`2023-02-01 7:00AM`, "YYYY-MM--DD h:mmA");

  // var m1 = moment();

  var moment1 = moment(`${d1}`, "YYYY-MM--DD");

  // console.log("Params", req.params);

  let newArr = [];

  // first lets get all the occurences of this lecturer
  const invigilatorData = await database
    .select("*")
    .where({
      staff_id,
    })
    .from("invigilators")
    .join(
      "exam_details",
      "invigilators.exam_details_id",
      "=",
      "exam_details.ed_id"
    )
    .where("exam_details.date", "=", date)
    .join("rooms", "exam_details.room_id", "=", "rooms.room_id")
    .join("exam_sessions", "exam_details.session_id", "=", "exam_sessions.s_id")
    // .groupBy("rooms.room_id",)
    .orderBy("exam_sessions.start_time");

  if (invigilatorData.length == 0) {
    return res.send({
      success: true,
      data: [],
      message: "You have no allocations",
      result: [],
    });
  }

  // other invigilators that are given the same room
  const f = await invigilatorData.map(async (data, index) => {
    let status;
    const id = invigilatorData[index].exam_details_id;
    const room = invigilatorData[index].room_id;
    const otherInvigilators = await database
      .select("*")
      .where({
        exam_details_id: id,
      })
      .andWhereNot("invigilators.staff_id", staff_id)
      .from("invigilators")
      .join("staff", "invigilators.staff_id", "=", "staff.staff_id");

    const course_units_in_room = await database
      .select("course_unit_code", "course_unit_name")
      .from("exam_timetable")
      .where({
        room_id: room,
        session_id: invigilatorData[index].session_id,
        date: invigilatorData[index].date,
      });

    if (moment.duration(moment2.diff(moment1))._data.days > 0) {
      // console.log(moment.duration(moment2.diff(moment1))._data.days);
      // console.log("Lecture is not supposed to be taught now");
      // newArr.push({ ...lecture, status: "not now" });
      status = "not now";
      // console.log({ ...item, status: "not now" });
    } else {
      if (moment2.isSame(moment1)) {
        // console.log({ ...item, status: "on" });
        // newArr.push({ ...lecture, status: "on" });
        status = "on";
        // console.log("Lecture is still on");
      } else {
        // console.log({ ...item, status: "off" });
        // newArr.push({ ...lecture, status: "off" });
        status = "off";
        // console.log("Lecture is supposed to have ended");
      }
    }

    let x = {
      room_data: data,
      otherInvigilators,
      course_units_in_room,
      status,
    };

    newArr.push(x);
  });

  Promise.all(f).then(() => {
    // console.log("new arr", newArr);
    res.send({
      success: true,
      result: newArr,
    });
  });

  //   const d =
  //     new Date(date).getFullYear() +
  //     "-" +
  //     (new Date(date).getMonth() + 1) +
  //     "-" +
  //     new Date(date).getDate();

  //   let newArr = [];

  //   console.log("Data got", req.body);
  //   const dd = new Date("2022-11-24");
  //   const current_date =
  //     dd.getFullYear() + "-" + (dd.getMonth() + 1) + "-" + dd.getDate();

  //   console.log("Today is ", current_date);
  //   var m1 = moment(`${current_date} 7:00AM`, "YYYY-MM--DD h:mmA");
  //   // var m1 = moment();

  //   var moment1 = moment(`${current_date}`, "YYYY-MM--DD");
  //   // var moment1 = moment();
  //   database
  //     .select("*")
  //     // .where({
  //     //   assigned_date: date,
  //     //   room_id: room,
  //     //   session_id: session,
  //     // })
  //     .from("invigilators")
  //     .join("staff", "invigilators.lecturer_id", "=", "staff.staff_id")
  //     .join("rooms", "invigilators.room_id", "=", "rooms.room_id")
  //     .join("exam_sessions", "invigilators.session_id", "=", "exam_sessions.s_id")

  //     .where("invigilators.lecturer_id", "=", lecturer_id)
  //     .andWhere("invigilators.assigned_date", "=", d)
  //     // .andWhere("invigilators.session_id", "=", session)
  //     // .join("exam_timetable", function () {
  //     //   this.on("invigilators.assigned_date", "=", "exam_timetable.date")
  //     //     .andOn("invigilators.room_id", "=", "exam_timetable.room_id")
  //     //     .andOn("invigilators.session_id", "=", "exam_timetable.session_id");
  //     // })
  //     // .where(function () {
  //     //   this.where("invigilators.assigned_date", "=", date)
  //     //     .andWhere("invigilators.room_id", "=", room)
  //     //     .andWhere("invigilators.session_id", "=", session);
  //     // })
  //     .then((invData) => {
  //       invData.forEach((invigilatorData, index) => {
  //         var m2 = moment(`${d} `, "YYYY-MM--DD h:mmA");

  //         var moment2 = moment(`${d}`, "YYYY-MM--DD");
  //         console.log(
  //           "duration here",
  //           moment.duration(moment2.diff(moment1))._data.days
  //         );

  //         if (moment.duration(moment2.diff(moment1))._data.days > 0) {
  //           // console.log(moment.duration(moment2.diff(moment1))._data.days);
  //           // console.log("Lecture is not supposed to be taught now");
  //           newArr.push({ ...invigilatorData, inv_status: "not now" });
  //           // console.log({ ...item, status: "not now" });
  //         } else {
  //           if (moment.duration(moment2.diff(moment1))._data.days == 0) {
  //             newArr.push({ ...invigilatorData, inv_status: "on" });
  //           } else if (m1.isBefore(m2)) {
  //             // console.log({ ...item, status: "on" });
  //             newArr.push({ ...invigilatorData, inv_status: "off" });
  //             // console.log("Lecture is still on");
  //           } else {
  //             // console.log({ ...item, status: "off" });
  //             newArr.push({ ...invigilatorData, inv_status: "off" });
  //             // console.log("Lecture is supposed to have ended");
  //           }
  //         }

  //         // newArr.push(item);

  //         // console.log({ ...item, ...data3[0] });

  //         // console.log(item.c_unit_id, reqItem);
  //       });

  //       console.log("invData", newArr);

  //       res.send(newArr);
  //     })
  //     .catch((err) => console.log("error ", err));
  // });
});

// router.get("/image/:id", (req, res) => {
//   const { id } = req.params;
//   //console.log("Id", id);
//   console.log("Current directory", __dirname);
//   // res.send("http://10.7.0.22:9000/assets/jacket.jpg");

//   try {
//     fs.readFile(
//       path.join(__dirname, "..", "public", "assets", `${id.toUpperCase()}.jpg`),
//       (err, data) => {
//         if (err) {
//           console.log("An identified error", err);
//           res.sendFile(
//             path.join(__dirname, "..", "public", "assets", `ph2.jpg`)
//           );
//         } else {
//           res.sendFile(
//             path.join(
//               __dirname,
//               "..",
//               "public",
//               "assets",
//               `${id.toUpperCase()}.jpg`
//             )
//           );
//         }
//       }
//     );
//   } catch (error) {
//     console.log("Error getting image ", error);
//   }

//   // try {
//   //   res.sendFile(__dirname + `/public/assets/${id}.jpg`);
//   // } catch (error) {
//   //   res.sendFile(__dirname + `/public/assets/akampa.jpg`);
//   // }
// });

router.post("/addStaff", async (req, res) => {
  const { staff_id, staff_name, title, role } = req.body;

  const existingStaff = await database("staff")
    .where({
      staff_id,
    })
    .first();

  if (existingStaff) {
    return res.send({
      success: false,
      message: `Staff Member with id ${staff_id} already exists`,
    });
  }

  database("staff")
    .insert({
      staff_id,
      staff_name,
      title: title.value,
      role,
    })
    .then((result) => {
      res.send({
        success: true,
        message: "Staff Member saved successfully",
      });
    })
    .catch((err) => {
      console.log("err adding new staff", err);
    });
});

router.post("/assignStaffRole", async (req, res) => {
  const { staff, school, role, campus } = req.body;

  const existingStaff = await database("staff_assigned_roles")
    .where({
      staff_id: staff.value,
    })
    .first();

  if (existingStaff) {
    return res.send({
      success: false,
      message: `Staff Member with id ${staff.value} already has a role`,
    });
  }

  database("staff_assigned_roles")
    .insert({
      staff_id: staff.value,
      for_wc_sch: school.value,
      role: role.value,
      campus_id: campus.value,
    })
    .then((result) => {
      res.send({
        success: true,
        message: "Staff member assigned to role successfully",
      });
    })
    .catch((err) => {
      console.log("err adding new staff", err);
    });
});

router.get("/staff_assignment_reqs", async (req, res) => {
  const staff = await database("staff").select("staff_id", "staff_name");
  const roles = await database("staff_roles").select("*");
  const schools = await database("schools").select("*");

  res.send({
    success: true,
    result: {
      staff,
      roles,
      schools,
    },
  });
});
module.exports = router;
