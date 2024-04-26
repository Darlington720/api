const express = require("express");
const router = express.Router();
const moment = require("moment");
const { database, baseIp, port } = require("../config");
const _ = require("lodash");
const { convertDateFormat } = require("../convertDateFormat");

router.get("/staff_gate_attendance/:month/:year", async (req, res) => {
  const { month, year } = req.params;
  // const year = 2023;
  // const month = 6;

  console.log("params", {
    year,
    month,
  });
  const staff = await database("staff");
  const daysInMonth = new Date(year, month, 0).getDate();
  const formattedDates = [];

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month - 1, day);
    const formattedDate = convertDateFormat(date.toLocaleDateString());
    formattedDates.push(formattedDate);
  }

  const presenceData = await database("staff_signin")
    .whereIn("signin_date", formattedDates)
    .whereIn(
      "staff_id",
      staff.map((member) => member.staff_id)
    );

  const data = staff.map((member) => {
    const memberPresence = presenceData.filter(
      (presence) => presence.staff_id === member.staff_id
    );
    for (const presence of memberPresence) {
      presence.signin_date = convertDateFormat(
        new Date(presence.signin_date).toLocaleDateString()
      );
    }
    return { ...member, datesPresent: memberPresence };
  });

  res.send(data);
});

router.get("/lecture_report_reqs", async (req, res) => {
  const campus = await database("campus");
  const schools = await database("schools");

  res.send({
    success: true,
    result: {
      campus,
      schools,
    },
  });
});

router.post("/lecture_report/", async (req, res) => {
  const { school_id, campus, year, sem, month } = req.body;

  // const school_id = 2;
  // const campus = 1;
  // const sem = 1;
  // const year = 2023;
  // const month = 4;

  console.log("received this", req.body);
  // const year = 2023;
  // const month = 6;

  // console.log("params", {
  //   year,
  //   month,
  // });
  // const staff = await database("staff");
  const daysInMonth = new Date(year, month, 0).getDate();
  const formattedDates = [];
  const daysInFormattedDates = [];

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month - 1, day);
    const formattedDate = convertDateFormat(date.toLocaleDateString());
    formattedDates.push(formattedDate);
    daysInFormattedDates.push({ day: date.getDay(), date: formattedDate });
  }

  //all lectures in the specified month
  const tt_groups = await database("timetable_groups").where({
    school_id,
    campus,
    year,
    sem,
  });

  console.log("days in formatted dates", daysInFormattedDates);

  // console.log("the groups", tt_groups);

  // all lecturers that have lectures in the specified year, sem and school
  const lecturers = await database("lecture_timetable")
    .select("staff.*")
    .join("staff", "lecture_timetable.lecturer_id", "staff.staff_id")
    .whereIn(
      "day_id",
      daysInFormattedDates.map((_d) => _d.day)
    )
    .whereIn(
      "timetable_group_id",
      tt_groups.map((gr) => gr.tt_gr_id)
    )
    .groupBy("lecturer_id");

  // first get all the lectures
  const allLectures = await database("lecture_timetable")
    // .leftJoin("lectures", function () {
    //   this.on("lecture_timetable.tt_id", "=", "lectures.l_tt_id").andOn(
    //     "lectures.l_month",
    //     "=",
    //     month
    //   );
    // })
    .leftJoin(
      "lecture_sessions",
      "lecture_timetable.session_id",
      "lecture_sessions.ls_id"
    )
    .whereIn(
      "day_id",
      daysInFormattedDates.map((_d) => _d.day)
    )
    .whereIn(
      "timetable_group_id",
      tt_groups.map((gr) => gr.tt_gr_id)
    );
  // .select(
  //   "lecture_timetable.*",
  //   "lectures.*",
  //   "lecture_sessions.*",
  //   "daysInFormattedDates.date" // Include the date from the array
  // );

  // Attach the date to each row in the results
  const lecturesWithDate = daysInFormattedDates.map((formatedDate) => {
    // console.log("all lectures", allLectures);
    const lecs = _.filter(allLectures, { day_id: formatedDate.day.toString() });

    const lecsWithDate = lecs.map((lecture) => ({
      ...lecture,
      date: formatedDate.date,
    }));

    return lecsWithDate;
  });

  const mergedLectures = [].concat(...lecturesWithDate);

  // console.log("lectures with date", mergedLectures);

  // const startedLectures = await database("lectures").whereIn(
  //   "date",
  //   mergedLectures.map((ld) => ld.date)
  // );

  const startedLecturesWithStudents = await database("lectures")
    .whereIn(
      "date",
      mergedLectures.map((ld) => ld.date)
    )
    .select("*")
    .then(async (lectures) => {
      const lecturesWithStudents = await Promise.all(
        lectures.map(async (lecture) => {
          const enrolledStudents = await database("stu_selected_course_units")
            .count("stu_id as count")
            .where({ course_id: lecture.course_unit_id });

          const presentStudents = await database("lecture_members")
            .count("member_id as count")
            .where({ date: lecture.date, lecture_id: lecture.course_unit_id });

          return {
            ...lecture,
            presentStudents,
            enrolledStudents,
          };
        })
      );

      return lecturesWithStudents;
    });

  // console.log("started lectures", startedLectures.length);

  const joinedLectures = mergedLectures.map((lectureWithDate) => {
    const matchingStartedLecture = startedLecturesWithStudents.find(
      (startedLecture) =>
        startedLecture.l_tt_id === lectureWithDate.tt_id &&
        convertDateFormat(
          new Date(startedLecture.date).toLocaleDateString()
        ) === lectureWithDate.date
    );

    if (matchingStartedLecture) {
      return {
        ...lectureWithDate,
        ...matchingStartedLecture,
        date: lectureWithDate.date,
        // Replace with the actual field you want to add
      };
    }

    return lectureWithDate;
  });

  // console.log("joined lectures", joinedLectures);

  // const lecturesWithDate = allLectures.map((lecture) => {
  //   const matchingDayInfo = daysInFormattedDates.find(
  //     (dayInfo) => dayInfo.day === lecture.day_id
  //   );
  //   return {
  //     ...lecture,
  //     date: matchingDayInfo.date,
  //   };
  // });

  const data = lecturers.map((member) => {
    const lectures = joinedLectures.filter(
      (lecture) => lecture.lecturer_id === member.staff_id
    );

    // console.log("lectures", lectures);
    // for (const presence of memberPresence) {
    //   presence.signin_date = convertDateFormat(
    //     new Date(presence.signin_date).toLocaleDateString()
    //   );
    // }
    return { ...member, lectures: lectures };
  });

  res.send(data);
});

router.get("/main_dashboard/:campus_id", async (req, res) => {
  const { campus_id } = req.params;
  const d = new Date();
  const date = d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
  // const date = "2023-03-22";
  const currentTime = moment().format("HH:mm:ss");
  // const currentTime = moment("10:30", "h:mm A");
  // const currentTime = "11:00:00";
  console.log("date 2de", date);
  console.log("current time", currentTime);
  // number of students, staff and visitors 2de in the given campus

  const schools = await database.select("*").from("schools");
  const school_codes = schools.map((sch) => sch.alias);
  // console.log("the codes", school_codes);

  //constraints
  const constraints = await database
    .select("*")
    .from("constraints")
    .orderBy("c_id");

  //students 2de
  const studentsSignedIn2de = await database
    .select("*")
    .from("students_biodata")
    .join(
      "student_signin",
      "students_biodata.stdno",
      "=",
      "student_signin.stu_id"
    )
    .join("users", "student_signin.signed_in_by", "=", "users.id")
    .join("gates", "student_signin.gate_id", "=", "gates.id")
    .where("gates.campus_id", "=", campus_id)
    .andWhere("student_signin.signin_date", "=", date)
    .orderBy("signin_time");

  //staff 2de
  const staffSignedIN2de = await database
    .select("*")
    .from("staff_signin")
    .join(
      "staff",
      "staff.staff_id",

      "=",
      "staff_signin.staff_id"
    )
    .join("users", "staff_signin.signed_in_by", "=", "users.id")
    .join("gates", "staff_signin.gate_id", "=", "gates.id")
    .where("gates.campus_id", "=", campus_id)
    .where("staff_signin.signin_date", "=", date)
    .orderBy("signin_time");

  //visitors 2de
  const visitorsSignedIn2de = await database("users")
    .join(
      "visitors",
      "users.id",

      "=",
      "visitors.signed_in_by"
    )
    .join("gates", "visitors.gate_id", "=", "gates.id")
    .where("gates.campus_id", "=", campus_id)
    .where("visitors.date", "=", date)
    .orderBy("time")
    .select("*");

  // number of lectures 2de, -> ongoing, ended and not started per school
  //first am getting the day 2de
  const dayId = new Date(date).getDay();

  let lectures = [];
  let lecturersWithMissedLectures = [];

  const x = await schools.map(async (school) => {
    const started2de = await database("lectures")
      .join("lecture_timetable", "lectures.l_tt_id", "lecture_timetable.tt_id")
      .join(
        "timetable_groups",
        "lecture_timetable.timetable_group_id",
        "timetable_groups.tt_gr_id"
      )
      .join("schools", "timetable_groups.school_id", "schools.school_id")
      .join("campus", "timetable_groups.campus", "campus.cam_id")
      .join(
        "lecture_sessions",
        "lecture_timetable.session_id",
        "lecture_sessions.ls_id "
      )
      .join(
        "study_time",
        "timetable_groups.study_time_id",
        "study_time.study_time_code"
      )
      .leftJoin("rooms", "lecture_timetable.room_id", "rooms.room_id")

      .leftJoin("staff", "lecture_timetable.lecturer_id", "=", "staff.staff_id")

      .where("schools.alias", school.alias)
      // .andWhere("date", date)
      .where("lectures.date", date)
      .andWhere("campus.cam_id", campus_id)
      .select("*");

    // let ongoingLectures = []
    // let endedLectures = [];
    //ongoing lectures
    const ongoingLectures = started2de.filter(
      (lecture) => !lecture.has_ended && !lecture.ended_at
    );

    //ended lectures
    const endedLectures = started2de.filter(
      (lecture) => lecture.has_ended && lecture.ended_at
    );
    const lecturesForThatDay = await database("lecture_timetable")
      .join(
        "timetable_groups",
        "lecture_timetable.timetable_group_id",
        "timetable_groups.tt_gr_id"
      )

      .join("schools", "timetable_groups.school_id", "schools.school_id")
      .join("campus", "timetable_groups.campus", "campus.cam_id")
      .join(
        "lecture_sessions",
        "lecture_timetable.session_id",
        "lecture_sessions.ls_id "
      )
      .join(
        "study_time",
        "timetable_groups.study_time_id",
        "study_time.study_time_code"
      )
      .leftJoin("rooms", "lecture_timetable.room_id", "rooms.room_id")

      .leftJoin("staff", "lecture_timetable.lecturer_id", "=", "staff.staff_id")
      // .where("lecture_sessions.start_time", "<=", currentTime)
      .where("schools.alias", school.alias)
      .andWhere("day_id", dayId)
      .andWhere("campus.cam_id", campus_id)
      .select("*");

    const notYetStarted = [];
    const missedLectures = [];
    const now = moment();
    // const now = moment("10:30", "HH:mm:ss");

    const attendedLectureIds = started2de.map((startedLecture) => ({
      tt_id: startedLecture.l_tt_id,
      date: startedLecture.date,
    }));

    const notStartedLectures = lecturesForThatDay.filter((lecture) => {
      return !attendedLectureIds.some((attendedLecture) => {
        // console.log(
        //   "comparison",
        //   `${attendedLecture.tt_id} ${new Date(
        //     attendedLecture.date
        //   ).toDateString()}, ${new Date(lecture.date).toDateString()}`
        // );
        return attendedLecture.tt_id === lecture.tt_id;
      });
    });

    notStartedLectures.forEach((lecture) => {
      const startTime = moment(lecture.start_time, "h:mm A");
      const endTime = moment(lecture.end_time, "h:mm A");

      // console.log("start time", startTime);
      // console.log("end time", endTime);
      if (now.isBetween(startTime, endTime)) {
        notYetStarted.push(lecture);
      } else if (endTime.isBefore(now)) {
        missedLectures.push(lecture);
      }
    });

    if (missedLectures.length > 0) {
      const lecturers = [
        ...new Set(
          missedLectures.map((lecture) => ({
            lecturer_name: lecture.staff_name,
            course_unit: lecture.course_unit_name,
            session: lecture.session_name,
            room: lecture.room_name,
            school: lecture.alias,
          }))
        ),
      ];
      lecturersWithMissedLectures.push({
        school: school.alias,
        lecturers,
      });
    }

    const data = {
      school: school.alias,
      allLectures2de: lecturesForThatDay,
      notYetStarted,
      missedLectures,
      started2de,
      ongoingLectures,
      endedLectures,
    };

    lectures.push(data);
  });

  // students accessing the campus per school
  const result = await database
    .select("students_biodata.facultycode")
    .count("students_biodata.stdno as count")
    .from("students_biodata")
    // .join(
    //   "student_signin",
    //   "students_biodata.stdno",
    //   "=",
    //   "student_signin.stu_id"
    // )
    // .join("users", "student_signin.signed_in_by", "=", "users.id")
    .leftJoin(
      "student_signin",
      "students_biodata.stdno",
      "=",
      "student_signin.stu_id"
    )
    .leftJoin("users", "student_signin.signed_in_by", "=", "users.id")
    .join("gates", "student_signin.gate_id", "=", "gates.id")
    .where("gates.campus_id", "=", campus_id)
    .where("student_signin.signin_date", "=", date)
    .whereIn("students_biodata.facultycode", school_codes)
    .groupBy("students_biodata.facultycode");

  Promise.all(x).then((d) => {
    res.send({
      statistics: {
        students: studentsSignedIn2de.length,
        staff: staffSignedIN2de.length,
        visitors: visitorsSignedIn2de.length,
      },
      studentsAccessingCampus: result,
      lectures,
      lecturersWithMissedLectures,
      constraints,
      campus_id,
    });
  });

  // students in portions who are in campus

  //trend of students entering at the gate in the week
});
//dina
router.post("/saveDinaTableDetails", (req, res) => {
  // const { name, percentage } = req.body;
  console.log("Received Data", req.body);
  database("dina_taken_tables")
    .insert({
      name: req.body.name,
      payment_mode: req.body.paymentMode,
      table_no: req.body.tableNo,
      table_id: req.body.id,
    })
    .then((data) => {
      res.send("Received the data");
    })
    .catch((err) => res.send(err));
});

router.get(`/numOfStaffClockIn`, (req, res) => {
  database
    // .orderBy("id")
    .select("*")
    .from("staff")
    .leftJoin("staff_signin", "staff.staff_id", "staff_signin.staff_id")
    // .count("staff_signin.staff_id")
    .then((data) => {
      // console.log("result againt", data);
      res.send(data);
    });
});

router.get(`/studentsPerSchool/:school`, (req, res) => {
  const { school } = req.params;
  database
    // .orderBy("id")
    .select("*")
    .from("students_biodata")
    .where({
      facultycode: school,
    })
    .then((data) => {
      res.send(`${data.length}`);
    });
});

router.get("/getFees", (req, res) => {
  database
    // .orderBy("id")
    .select("*")
    .from("fees_structure")
    .join(
      "nationality",
      "fees_structure.nationality_id",
      "=",
      "nationality.nationality_id"
    )
    .join("sessions", "fees_structure.session_id", "=", "sessions.session_id")
    .join("schools", "fees_structure.school_id", "=", "schools.school_id")
    .join("levels", "fees_structure.levels_id", "=", "levels.level_id")
    .then((data) => {
      res.send(data);
    });
});

router.post("/addConstraint", (req, res) => {
  const { name, percentage } = req.body;
  database("constraints")
    .insert({
      c_name: name,
      c_percentage: percentage,
    })
    .then((data) => {
      res.send("Received the data");
    })
    .catch((err) => res.send(err));
});

router.post("/updateConstraint/", (req, res) => {
  const { c_id, c_name, c_percentage } = req.body;
  console.log(req.body);

  database("constraints")
    .where(function () {
      this.where("c_id", "=", c_id);
    })
    .update({
      c_name: c_name,
      c_percentage: c_percentage,
    })
    .then(async (data) => {
      const updatedObject = await database("constraints");

      res.send(updatedObject);

      // console.log("Data here", data);
    })
    .catch((err) => {
      console.log("the error", err);
      res.send(err);
    });
});

router.get("/weeklyChartData", (req, res) => {
  let arr = [];
  const d = new Date();
  const myDateToday = new Date();
  const firstDate = new Date(d.setDate(d.getDate() - d.getDay()));
  // console.log("Sunday", firstDate.getDate());
  const dateToday =
    d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
  const testDate = new Date("2022-09-22");
  // console.log(
  //   "The day is ",
  //   myDateToday.getDay() === 0 ? 7 : myDateToday.getDay()
  // );
  // console.log("full date today", myDateToday);
  let toady = myDateToday.getDay() === 0 ? 7 : myDateToday.getDay();
  let done = false;
  let count = toady;

  let date = new Date(myDateToday.setDate(myDateToday.getDate()));

  for (let i = toady; i > 0; i--) {
    let resDate =
      date.getFullYear() + "-" + (date.getMonth() + 1) + "-" + date.getDate();

    // setTimeout(() => {
    date = new Date(myDateToday.setDate(myDateToday.getDate() - 1));
    // }, 2);

    // console.log("Result date ", date);
    let ans;
    //to be changed for the dashboard
    let data = async (callback) => {
      await database

        .from("students_biodata")

        .join(
          "student_signin",
          "students_biodata.stdno",
          "=",
          "student_signin.stu_id"
        )
        .join("users", "student_signin.signed_in_by", "=", "users.id")
        // .where("students.stu_id", "=", studentNo)
        .andWhere("student_signin.signin_date", "=", resDate)
        .select("*")
        .then((result) => {
          // return result;
          // console.log("result ", result);
          callback(result);
          // res = result;
        });
      // return res;
      // .then((result) => {
      //   // console.log(result);
      //   return result;
      // });
      // return 0;
    };

    // .count("*")
    // .orderBy("signin_time")
    // .then((data) => {

    data(function (result) {
      // console.log("authenticated");

      result.map((item) => {
        const d2 = new Date(item.signin_date);
        const date2 = ` ${d2.getFullYear()}-${
          d2.getMonth() + 1
        }-${d2.getDate()}`;
        item.signin_date = date2;
      });

      // res.send(`${result.length}`);

      // comment 1
      arr[--count] = result.length;
      // console.log(`The count is  ${count}, ${i}, [${arr}], ${resDate}`);
      if (count === 0) res.send(arr);

      // console.log(`length for ${i} = ${result.length}`);
      // res.send(data);
      // count--;
      // date = new Date(myDateToday.setDate(myDateToday.getDate() - 1));
      // return 0;
      // console.log(result);
      // return res.send(`${result.length}`);
    });

    // console.log("arr", arr);
  }
});

router.get("/students-per-week", async (req, res) => {
  const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const currentDayOfWeek = moment().format("d");
  const currentWeek = [];

  for (let i = currentDayOfWeek; i < 7; i++) {
    currentWeek.push(daysOfWeek[i]);
  }

  for (let i = 0; i < currentDayOfWeek; i++) {
    currentWeek.push(daysOfWeek[i]);
  }

  const currentWeekStart = moment().startOf("week").format("YYYY-MM-DD");
  const currentWeekEnd = moment().endOf("week").format("YYYY-MM-DD");

  const results = await database
    .select(database.raw("DATE(signin_date) as signin_date, count(*) as count"))
    .from("student_signin")
    .whereBetween("signin_date", [currentWeekStart, currentWeekEnd])
    .groupBy("signin_date")
    .orderBy("signin_date");

  const data = Array(7).fill(0);
  const labels = currentWeek;

  results.forEach((result) => {
    const dayOfWeek = moment(result.signin_date).format("d");
    const index = currentWeek.indexOf(daysOfWeek[dayOfWeek]);
    data[index] = result.count;
  });

  res.json({ labels, data });
});

router.get("/weeklyLectureData", (req, res) => {
  const d = new Date();
  const currentDate =
    d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
  var first = d.getDate() - d.getDay();
  const firstDate = d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + first;
  let mon = 0;
  let tue = 0;
  let wed = 0;
  let thur = 0;
  let fri = 0;
  let sat = 0;
  let sun = 0;

  let days = [1, 2, 3, 4, 5, 6, 0];

  let chartData = [];
  let arr = [];

  //   console.log(num);

  database
    .select("*")
    .from("timetable")
    .whereBetween("day_id", [1, 2])
    .leftJoin("lectures", "timetable.c_unit_id", "=", "lectures.course_unit_id")
    // .leftJoin("staff", "timetable.lecturer_id", "=", "staff.staff_id")
    // .where("lectures.date", "=", "2022-09-21")
    // .where({
    //   day_id: 3,
    //   date: "2022-09-21",
    // })

    .then((result) => {
      range(1, 2).forEach((num) => {
        console.log(new Date(d.setDate(d.getDate() - (d.getDay() - num))));

        const weeklyDate = new Date(
          d.setDate(d.getDate() - (d.getDay() - num))
        );

        // if ()
        // res.send(result);
        arr.push(result);

        // console.log(result);
      });
      res.send(arr);
    });
});

router.post("/getCustomReports/", (req, res) => {
  // to be changed for the dashboard
  const { date, requiredData } = req.body;
  // console.log(req.body);
  if (requiredData && date) {
    if (requiredData == "students") {
      database
        .select("*")
        .from("students")

        .join("student_signin", "students.stu_id", "=", "student_signin.stu_id")
        .join("users", "student_signin.signed_in_by", "=", "users.id")
        // .where("students.stu_id", "=", studentNo)
        .andWhere("student_signin.signin_date", "=", date)
        .orderBy("signin_time")
        .then((data) => {
          data.map((item) => {
            const d2 = new Date(item.signin_date);
            const date2 = ` ${d2.getFullYear()}-0${
              d2.getMonth() + 1
            }-${d2.getDate()}`;
            item.signin_date = date2;
          });
          res.send(data);
        });
    } else if (requiredData == "visitors") {
      database("users")
        .join(
          "visitors",
          "users.id",

          "=",
          "visitors.signed_in_by"
        )
        .where("visitors.date", "=", date)
        .orderBy("time")
        .select("*")
        .then((data) => {
          data.map((item) => {
            const d2 = new Date(item.date);
            const date2 = ` ${d2.getFullYear()}-${
              d2.getMonth() + 1
            }-${d2.getDate()}`;
            item.date = date2;
          });
          res.send(data);
        });
    }
  }
});

router.get("/studentsToday", (req, res) => {
  const d = new Date();
  const date = d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
  //to be changed for the dashboard
  database
    .select("*")
    .from("students_biodata")

    .join(
      "student_signin",
      "students_biodata.stdno",
      "=",
      "student_signin.stu_id"
    )
    .join("users", "student_signin.signed_in_by", "=", "users.id")
    // .where("students.stu_id", "=", studentNo)
    .andWhere("student_signin.signin_date", "=", date)
    .orderBy("signin_time")
    .then((data) => {
      data.map((item) => {
        const d2 = new Date(item.signin_date);
        const date2 = ` ${d2.getFullYear()}-${
          d2.getMonth() + 1
        }-${d2.getDate()}`;
        item.signin_date = date2;
      });
      res.send(data);
    });
});

router.get("/studentsTotalBySchool/:school", (req, res) => {
  const { school } = req.params;
  const d = new Date();
  const date = d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
  //to be changed for the dashboard
  database
    .select("*")
    .from("students_biodata")

    .join(
      "student_signin",
      "students_biodata.stdno",
      "=",
      "student_signin.stu_id"
    )
    .join("users", "student_signin.signed_in_by", "=", "users.id")
    // .where("students.stu_id", "=", studentNo)
    .andWhere("student_signin.signin_date", "=", date)
    .andWhere("students_biodata.facultycode", "=", school)
    .orderBy("signin_time")
    .then((data) => {
      data.map((item) => {
        const d2 = new Date(item.signin_date);
        const date2 = ` ${d2.getFullYear()}-${
          d2.getMonth() + 1
        }-${d2.getDate()}`;
        item.signin_date = date2;
      });
      res.send(`${data.length}`);
    });
});

//dashboard
router.get("/todaysLectures/:school", (req, res) => {
  const { school } = req.params;
  const d = new Date();
  const date = d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
  console.log(`${d.getDay()}, ${school}`);

  database
    .select("*")
    .from("timetable")
    .leftJoin("lectures", "timetable.c_unit_id", "=", "lectures.course_unit_id")
    .leftJoin("staff", "timetable.lecturer_id", "=", "staff.staff_id")
    .where({
      day_id: d.getDay() === 0 ? 7 : d.getDay(),
      school: school,
    })
    .then((result) => {
      res.send(result);
    });
});

//dashboard
router.get("/numOftodaysLectures/:school", (req, res) => {
  const { school } = req.params;
  const d = new Date();
  const date = d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
  console.log(`${d.getDay()}, ${school}`);

  database
    .select("*")
    .from("timetable")
    .leftJoin("lectures", "timetable.c_unit_id", "=", "lectures.course_unit_id")
    .leftJoin("staff", "timetable.lecturer_id", "=", "staff.staff_id")
    .where({
      day_id: d.getDay() === 0 ? 7 : d.getDay(),
      school: school,
    })
    .then((result) => {
      res.send(`${result.length}`);
    });
});

router.get("/num0fstudentsToday", (req, res) => {
  const d = new Date();
  const date = d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
  //to be changed for the dashboard
  database
    .select("*")
    .from("students_biodata")

    .join(
      "student_signin",
      "students_biodata.stdno",
      "=",
      "student_signin.stu_id"
    )
    .join("users", "student_signin.signed_in_by", "=", "users.id")
    // .where("students.stu_id", "=", studentNo)
    .andWhere("student_signin.signin_date", "=", date)
    .orderBy("signin_time")
    .then((data) => {
      data.map((item) => {
        const d2 = new Date(item.signin_date);
        const date2 = ` ${d2.getFullYear()}-0${
          d2.getMonth() + 1
        }-${d2.getDate()}`;
        item.signin_date = date2;
      });
      res.send(`${data.length}`);
    });
});

router.get("/staffToday", (req, res) => {
  const d = new Date();
  const date = d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
  //to be changed for the dashboard
  database
    .select("*")
    .from("staff_signin")
    .join(
      "staff",
      "staff.staff_id",

      "=",
      "staff_signin.staff_id"
    )
    .join("users", "staff_signin.signed_in_by", "=", "users.id")
    .where("staff_signin.signin_date", "=", date)
    .orderBy("signin_time")
    .then((data) => {
      data.map((item) => {
        const d2 = new Date(item.signin_date);
        const date2 = ` ${d2.getFullYear()}-${
          d2.getMonth() + 1
        }-${d2.getDate()}`;
        item.signin_date = date2;
      });
      res.send(data);
    });
});

router.post("/staffByDate", (req, res) => {
  const { selectedDate } = req.body;
  // console.log("THe received date", selectedDate);
  const d = new Date(selectedDate);
  const date = d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
  //to be changed for the dashboard
  database
    .select("*")
    .from("staff_signin")
    .join(
      "staff",
      "staff.staff_id",

      "=",
      "staff_signin.staff_id"
    )
    .join("users", "staff_signin.signed_in_by", "=", "users.id")
    .where("staff_signin.signin_date", "=", date)
    .orderBy("signin_time")
    .then((data) => {
      data.map((item) => {
        const d2 = new Date(item.signin_date);
        const date2 = ` ${d2.getFullYear()}-${
          d2.getMonth() + 1
        }-${d2.getDate()}`;
        item.signin_date = date2;
      });
      res.send(data);
    });
});

router.get("/numOfstaffToday", (req, res) => {
  const d = new Date();
  const date = d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
  //to be changed for the dashboard
  database
    .select("*")
    .from("staff_signin")
    .join(
      "staff",
      "staff.staff_id",

      "=",
      "staff_signin.staff_id"
    )
    .join("users", "staff_signin.signed_in_by", "=", "users.id")
    .where("staff_signin.signin_date", "=", date)
    .orderBy("signin_time")
    .then((data) => {
      data.map((item) => {
        const d2 = new Date(item.signin_date);
        const date2 = ` ${d2.getFullYear()}-${
          d2.getMonth() + 1
        }-${d2.getDate()}`;
        item.signin_date = date2;
      });
      res.send(`${data.length}`);
    });
});

router.get("/allstaffdetails/:staff_id", (req, res) => {
  const { staff_id } = req.params;
  const userId = 1;
  // console.log(studentNo);
  const d = new Date();
  const date = d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
  let modifiedData = [];
  let modifiedObj = {};

  // database
  //   .select("*")
  //   .from("stu_signin")
  //   .join("students", "stu_signin.stu_id", "=", "students.stu_id")

  //to be changed for the dashboard
  database
    .select("*")
    .from("staff")

    .join("staff_signin", "staff.staff_id", "=", "staff_signin.staff_id")
    // .join("users", "staff_signin.signed_in_by", "=", "users.id")

    .where("staff_signin.staff_id", "=", staff_id)
    .andWhere("staff_signin.signin_date", "=", date)

    .then((data) => {
      // res.send(data3);
      database
        .select("*")
        .from("staff")
        .join(
          "staff_signin_details",
          "staff.staff_id",
          "=",
          "staff_signin_details.staff_id"
        )
        // .join("users", "stu_signin.signin_user_id", "=", "users.id")
        // .join("assigned_gates", "users.id", "=", "assigned_gates.user_id")
        .where("staff.staff_id", "=", staff_id)
        .andWhere("staff_signin_details.signin_date", "=", date)
        .then((data3) => {
          var m1 = moment(`${data3[0].signin_time}`, "h:mm");
          const date5 = new Date(m1);
          var m2 = null;

          if (data3[0].signout_time) {
            m2 = moment(`${data3[0].signout_time}`, "h:mm");
          }
          const date6 = new Date(m2);
          res.send([
            ...data3,
            // {
            //   // modifiedSigninTime: date5.toLocaleTimeString(),
            //   // modifiedSignoutTime: m2 ? date6.toLocaleTimeString() : null,
            // },

            // {
            //   imageUrl: data3[0]
            //     ? `http://${baseIp}:${port}/assets/${data3[0].image}`
            //     : "http://${baseIp}:${port}/assets/jacket.jpg",
            // },
          ]);

          // res.send(modifiedData);
          // if (data3.length > 0) {
          //   // res.send(data);
          //   if (data3[data3.length - 1].signout_time !== null) {
          //     // res.send("Already registered");
          //     database
          //       .select("*")
          //       .from("students")
          //       .where({
          //         stu_id: studentNo,
          //       })
          //       .then((data2) => {
          //         res.send([
          //           ...data2,
          //           {
          //             todaysStatus: "not new",
          //             imageUrl: data2[0]
          //               ? `http://${baseIp}:${port}/assets/${data2[0].image}`
          //               : "http://${baseIp}:${port}/assets/jacket.jpg",
          //           },
          //         ]);
          //       });
          //   } else {
          //     res.send([
          //       data3[data3.length - 1],
          //       {
          //         todaysStatus: true,
          //         imageUrl: `http://${baseIp}:${port}/assets/${data3[0].image}`,
          //       },
          //     ]);
          //   }
          // } else {
          //   database
          //     .select("*")
          //     .from("students")
          //     .where({
          //       stu_id: studentNo,
          //     })
          //     .then((data2) => {
          //       res.send([
          //         ...data2,
          //         {
          //           todaysStatus: false,
          //           imageUrl: data2[0]
          //             ? `http://${baseIp}:${port}/assets/${data2[0].image}`
          //             : "http://${baseIp}:${port}/assets/jacket.jpg",
          //         },
          //       ]);
          //     });
          // }
        });
    });

  // database("students")
  //   .join(
  //     "students_signin_book",
  //     "students.stu_id",
  //     "=",
  //     "students_signin_book.stu_id"
  //   )
  //   .select("*")
  //   // .where("quantity", ">", 0)

  //   .then((data) => {
  //     res.send(data);
  //   });
});

router.get("/studentData", (req, res) => {
  const d = new Date();
  const date = d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
  // to be changed for the dashboard

  database("students")
    .join(
      "students_signin_book",
      "students.stu_id",

      "=",
      "students_signin_book.stu_id"
    )

    .join(
      "students_signout_book",
      "students_signin_book.signin_date",
      "=",
      "students_signout_book.signin_date"
    )
    .where("students_signin_book.signin_date", "=", date)

    .select("*")
    .then((data) => {
      res.send(data);
    });
});

router.post("/allstudentdetails/", (req, res) => {
  const { studentNo, date } = req.body;
  // console.log(req.body);
  const userId = 1;
  //console.log(studentNo);
  // const d = new Date();
  // const date = d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
  // let modifiedData = [];
  // let modifiedObj = {};

  // database
  //   .select("*")
  //   .from("stu_signin")
  //   .join("students", "stu_signin.stu_id", "=", "students.stu_id")

  //To be changed for the dashboard
  database
    .select("*")
    .from("students")

    .join("student_signin", "students.stu_id", "=", "student_signin.stu_id")

    .where("students.stu_id", "=", studentNo)
    .andWhere("student_signin.signin_date", "=", date)

    .then((data) => {
      // res.send(data3);
      database
        .select("*")
        .from("students")

        .join("stu_signin", "students.stu_id", "=", "stu_signin.stu_id")
        // .join("users", "stu_signin.signin_user_id", "=", "users.id")
        // .join("assigned_gates", "users.id", "=", "assigned_gates.user_id")
        .where("students.stu_id", "=", studentNo)
        .andWhere("stu_signin.signin_date", "=", date)
        .then((data3) => {
          res.send([
            ...data3,
            {
              imageUrl: data3[0]
                ? `http://${baseIp}:${port}/assets/${data3[0].image}`
                : "http://${baseIp}:${port}/assets/jacket.jpg",
            },
          ]);

          // res.send(modifiedData);
          // if (data3.length > 0) {
          //   // res.send(data);
          //   if (data3[data3.length - 1].signout_time !== null) {
          //     // res.send("Already registered");
          //     database
          //       .select("*")
          //       .from("students")
          //       .where({
          //         stu_id: studentNo,
          //       })
          //       .then((data2) => {
          //         res.send([
          //           ...data2,
          //           {
          //             todaysStatus: "not new",
          //             imageUrl: data2[0]
          //               ? `http://${baseIp}:${port}/assets/${data2[0].image}`
          //               : "http://${baseIp}:${port}/assets/jacket.jpg",
          //           },
          //         ]);
          //       });
          //   } else {
          //     res.send([
          //       data3[data3.length - 1],
          //       {
          //         todaysStatus: true,
          //         imageUrl: `http://${baseIp}:${port}/assets/${data3[0].image}`,
          //       },
          //     ]);
          //   }
          // } else {
          //   database
          //     .select("*")
          //     .from("students")
          //     .where({
          //       stu_id: studentNo,
          //     })
          //     .then((data2) => {
          //       res.send([
          //         ...data2,
          //         {
          //           todaysStatus: false,
          //           imageUrl: data2[0]
          //             ? `http://${baseIp}:${port}/assets/${data2[0].image}`
          //             : "http://${baseIp}:${port}/assets/jacket.jpg",
          //         },
          //       ]);
          //     });
          // }
        });
    });

  // database("students")
  //   .join(
  //     "students_signin_book",
  //     "students.stu_id",
  //     "=",
  //     "students_signin_book.stu_id"
  //   )
  //   .select("*")
  //   // .where("quantity", ">", 0)

  //   .then((data) => {
  //     res.send(data);
  //   });
});

router.get("/allstudentdetails/:studentNo", (req, res) => {
  const { studentNo } = req.params;
  const userId = 1;
  // console.log(studentNo);
  const d = new Date();
  const date = d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
  let modifiedData = [];
  let modifiedObj = {};

  // database
  //   .select("*")
  //   .from("stu_signin")
  //   .join("students", "stu_signin.stu_id", "=", "students.stu_id")

  //to be changed for the dashboard
  database
    .select("*")
    .from("students_biodata")

    .join(
      "student_signin",
      "students_biodata.stdno",
      "=",
      "student_signin.stu_id"
    )

    .where("students_biodata.stdno", "=", studentNo)
    .andWhere("student_signin.signin_date", "=", date)

    .then((data) => {
      // res.send(data3);
      database
        .select("*")
        .from("students_biodata")

        .join("stu_signin", "students_biodata.stdno", "=", "stu_signin.stu_id")
        // .join("users", "stu_signin.signin_user_id", "=", "users.id")
        // .join("assigned_gates", "users.id", "=", "assigned_gates.user_id")
        .where("students_biodata.stdno", "=", studentNo)
        .andWhere("stu_signin.signin_date", "=", date)
        .then((data3) => {
          var m1 = moment(`${data3[0].signin_time}`, "h:mm");
          const date5 = new Date(m1);
          var m2 = null;

          if (data3[0].signout_time) {
            m2 = moment(`${data3[0].signout_time}`, "h:mm");
          }
          const date6 = new Date(m2);
          res.send([
            ...data3,
            // {
            //   // modifiedSigninTime: date5.toLocaleTimeString(),
            //   // modifiedSignoutTime: m2 ? date6.toLocaleTimeString() : null,
            // },

            // {
            //   imageUrl: data3[0]
            //     ? `http://${baseIp}:${port}/assets/${data3[0].image}`
            //     : "http://${baseIp}:${port}/assets/jacket.jpg",
            // },
          ]);

          // res.send(modifiedData);
          // if (data3.length > 0) {
          //   // res.send(data);
          //   if (data3[data3.length - 1].signout_time !== null) {
          //     // res.send("Already registered");
          //     database
          //       .select("*")
          //       .from("students")
          //       .where({
          //         stu_id: studentNo,
          //       })
          //       .then((data2) => {
          //         res.send([
          //           ...data2,
          //           {
          //             todaysStatus: "not new",
          //             imageUrl: data2[0]
          //               ? `http://${baseIp}:${port}/assets/${data2[0].image}`
          //               : "http://${baseIp}:${port}/assets/jacket.jpg",
          //           },
          //         ]);
          //       });
          //   } else {
          //     res.send([
          //       data3[data3.length - 1],
          //       {
          //         todaysStatus: true,
          //         imageUrl: `http://${baseIp}:${port}/assets/${data3[0].image}`,
          //       },
          //     ]);
          //   }
          // } else {
          //   database
          //     .select("*")
          //     .from("students")
          //     .where({
          //       stu_id: studentNo,
          //     })
          //     .then((data2) => {
          //       res.send([
          //         ...data2,
          //         {
          //           todaysStatus: false,
          //           imageUrl: data2[0]
          //             ? `http://${baseIp}:${port}/assets/${data2[0].image}`
          //             : "http://${baseIp}:${port}/assets/jacket.jpg",
          //         },
          //       ]);
          //     });
          // }
        });
    });

  // database("students")
  //   .join(
  //     "students_signin_book",
  //     "students.stu_id",
  //     "=",
  //     "students_signin_book.stu_id"
  //   )
  //   .select("*")
  //   // .where("quantity", ">", 0)

  //   .then((data) => {
  //     res.send(data);
  //   });
});

/**
 * You first need to create a formatting function to pad numbers to two digits…
 **/
function twoDigits(d) {
  if (0 <= d && d < 10) return "0" + d.toString();
  if (-10 < d && d < 0) return "-0" + (-1 * d).toString();
  return d.toString();
}

/**
 * …and then create the method to output the date string as desired.
 * Some people hate using prototypes this way, but if you are going
 * to apply this to more than one Date object, having it as a prototype
 * makes sense.
 **/
Date.prototype.toMysqlFormat = function () {
  return (
    this.getUTCFullYear() +
    "-" +
    twoDigits(1 + this.getUTCMonth()) +
    "-" +
    twoDigits(this.getUTCDate()) +
    " " +
    twoDigits(this.getUTCHours()) +
    ":" +
    twoDigits(this.getUTCMinutes()) +
    ":" +
    twoDigits(this.getUTCSeconds())
  );
};

router.post("/addRoom", (req, res) => {
  const { roomName } = req.body;
  // console.log("Data", req.body);
  const d = new Date();
  const date = d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();

  //console.log(req.body);
  database("rooms")
    .insert({
      room_name: roomName,
    })
    .then((data) => res.status(200).send("success"))
    .catch((err) => res.status(400).send("Failed to send the data " + err));
});

router.post("/api/exams", (req, res) => {
  const { date, room, session } = req.body;
  // console.log("Data got", req.body);
  database
    .select("course_unit_code", "course_unit_name")
    .where({
      date:
        new Date(date).getFullYear() +
        "-" +
        (new Date(date).getMonth() + 1) +
        "-" +
        new Date(date).getDate(),
      room_id: room.value,
      session_id: session.value,
    })
    .from("exam_timetable")
    .then((data) => {
      res.send(data);
    })
    .catch((err) => console.log("error ", err));
});

router.post("/api/invigilatorData", (req, res) => {
  const { date, room, session } = req.body;

  const d =
    new Date(date).getFullYear() +
    "-" +
    (new Date(date).getMonth() + 1) +
    "-" +
    new Date(date).getDate();
  console.log("Data got", req.body);
  database
    .select("*")
    // .where({
    //   assigned_date: date,
    //   room_id: room,
    //   session_id: session,
    // })
    .from("invigilators")
    .join("staff", "invigilators.lecturer_id", "=", "staff.staff_id")
    .join("rooms", "invigilators.room_id", "=", "rooms.room_id")
    .join("exam_sessions", "invigilators.session_id", "=", "exam_sessions.s_id")

    .where("invigilators.room_id", "=", room)
    .andWhere("invigilators.assigned_date", "=", d)
    .andWhere("invigilators.session_id", "=", session)
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
    .then((invData) => {
      database
        .select("*")
        .where({
          date: d,
          room_id: room,
          session_id: session,
        })
        .from("exam_timetable")
        .then((exData) => {
          const data = {
            invigilators: invData,
            exams: exData,
          };
          res.send(data);
        });
    })
    .catch((err) => console.log("error ", err));
});

router.post("/api/updateRoomStatus", (req, res) => {
  const { lecturerId, roomId, assignedDate, sessionId } = req.body;

  const d = new Date(assignedDate);
  const date = d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
  console.log("Room DATA", req.body);

  const currentDate = new Date();
  database
    .select("*")
    .from("invigilators")
    .where({
      room_id: roomId,
      assigned_date: date,
      session_id: sessionId,
      // lecturer_id: lecturerId,
    })
    .update({
      status: 1,
      time_start: currentDate.toLocaleTimeString(),
    })
    .then((data2) => {
      database
        .select("*")
        .from("invigilators_sammary")
        .where({
          room_id: roomId,
          assigned_date: date,
          session_id: sessionId,
        })
        .update({
          status: 1,
          time_start: currentDate.toLocaleTimeString(),
        })
        .then((data) => {
          console.log("Updated the sammary as well");
        });
      res.send(`updated room id ${roomId} status to started`);
    });
});

router.post("/api/saveExemption", (req, res) => {
  database
    .select("*")
    .from("exemptions")
    .where({
      module_code: req.body.courseCode,
      module_title: req.body.courseName,
      stdno: req.body.stuNo,
      exemption_status: req.body.exemptionStatus,
    })
    .then((data) => {
      if (data.length == 0) {
        database("exemptions")
          .insert({
            module_code: req.body.courseCode,
            module_title: req.body.courseName,
            exemption_status: req.body.exemptionStatus,
            stdno: req.body.stuNo,
            exempted_by: "AR",
          })
          .then((data) => {
            console.log("Saved that course unit");
            res.status(200).send("received the data");
          });
      }
    })
    .catch((err) => res.status(400).send("Failed to send the data " + err));
});

router.get("/api/getExamInfo/:course_unit_name", (req, res) => {
  const { course_unit_name } = req.params;

  databaseß
    .select("*")
    .from("modules_registered")
    .where({
      module_title: course_unit_name,
    })
    .then((data) => {
      // res.send(data);
      database
        .select("*")
        .from("modules_registered")
        .join(
          "students_handin",
          "modules_registered.cunit_reg_id",
          "=",
          "students_handin.module_reg_id"
        )

        .where("modules_registered.module_title", "=", course_unit_name)
        .then((data2) => {
          let obj = {
            registered: data.length,
            handed_in: data2.length,
            didnt_handin: data.length - data2.length,
          };

          newArr.p;

          res.send(obj);
        });
    });
});

router.post("/addInvigilator", async (req, res) => {
  const { room, invigilators, session, date, assigned_by } = req.body;
  // console.log("Date received", date);
  console.log("data got here", req.body);
  const d = new Date(date);
  const formatedDate =
    d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();

  // const d2 = new Date();
  // const time = d2.getHours() + ":" + d2.getMinutes() + ":" + d2.getSeconds();

  // first let me check if there is an existing exam

  let examId;

  const existingExam = await database
    .select("*")
    .where({
      room_id: room.value,
      date: formatedDate,
      session_id: session.value,
    })
    .from("exam_details");

  if (!existingExam[0]) {
    const result = await database("exam_details").insert({
      room_id: room.value,
      date: formatedDate,
      session_id: session.value,
    });

    console.log("new exam", result);

    examId = result[0];
  } else {
    // console.log("existing exam", existingExam);
    examId = existingExam[0].ed_id;
  }

  // check for the existance of a staff_member

  const x = await invigilators.map(async (inv) => {
    const existingInv = await database
      .select("*")
      .where({
        exam_details_id: examId,
        staff_id: inv.value,
      })
      .from("invigilators");

    if (!existingInv[0]) {
      const result = await database("invigilators").insert({
        exam_details_id: examId,
        staff_id: inv.value,
      });
    }
  });

  Promise.all(x).then(() => {
    res.send({
      success: true,
      message: "Invigilators assigned successfully",
    });
  });
});

router.post("/api/removeInvigilator", (req, res) => {
  // const { room, invigilators, session, date, status, assigned_by } = req.body;
  // console.log("Date received", date);
  console.log("data got here remove", req.body);
  // const d = new Date(date);
  // const formatedDate =
  //   d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();

  // console.log("Formated", formatedDate);

  // const d2 = new Date();

  database("invigilators")
    .where("i_id", req.body.i_id)
    .del()
    .then((data) => {
      res.send("success");
    });
});

router.get("/invigilators/", (req, res) => {
  const userId = 1;
  //console.log("number", lecture_id);
  const d = new Date();
  const date = d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();

  database
    .select("*")
    .from("invigilators")
    .join("staff", "invigilators.lecturer_id", "=", "staff.id")
    .join("rooms", "invigilators.room_id", "=", "rooms.room_id")
    .join("exam_sessions", "invigilators.session_id", "=", "exam_sessions.s_id")

    // .andWhere("student_signin.signin_date", "=", date)

    .then((data) => {
      res.send(data);
    });
});

router.get("/invigilator_sammary/", (req, res) => {
  database
    .select(
      "staff_name",
      "room_name",
      "assigned_date",
      "session_name",
      "status",
      "assigned_by",
      "invigilators_sammary.room_id",
      "invigilators_sammary.session_id"
    )
    .from("invigilators_sammary")
    .join("staff", "invigilators_sammary.lecturer_id", "=", "staff.staff_id")
    .join("rooms", "invigilators_sammary.room_id", "=", "rooms.room_id")
    .join(
      "exam_sessions",
      "invigilators_sammary.session_id",
      "=",
      "exam_sessions.s_id"
    )
    .orderBy("i_id")

    // .andWhere("student_signin.signin_date", "=", date)

    .then((data) => {
      res.send(data);
    });
});

router.get("/invigilator_details/", (req, res) => {
  const { room_id, date, session_id } = req.body;
  const userId = 1;
  //console.log("number", lecture_id);
  const d = new Date();
  // const date = d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();

  database
    .select("*")
    .from("invigilators")
    // .where({
    //   // room_id: room_id,
    //   assigned_date: date,
    //   session_id: session_id,
    // })
    .join("staff", "invigilators.lecturer_id", "=", "staff.staff_id")
    .join("rooms", "invigilators.room_id", "=", "rooms.room_id")
    .join("exam_sessions", "invigilators.session_id", "=", "exam_sessions.s_id")

    .where("invigilators.room_id", "=", room_id)
    .andWhere("invigilators.assigned_date", "=", date)

    .then((data) => {
      res.send(data);
    });
});

module.exports = router;
