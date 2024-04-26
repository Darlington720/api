const express = require("express");
const router = express.Router();
const { database } = require("../config");

router.get("/visitorData", (req, res) => {
  const d = new Date();
  const date = d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();

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
});

//Number of students all for the given campus
router.get("/numOfStudentsByCampus/:campus", (req, res) => {
  // let camp = "Main campus";
  const { campus } = req.params;
  database
    .select("*")
    .from("students_biodata")
    .join("campus", "campus.campus_name", "=", "students_biodata.campus")
    .where("campus.cam_id", "=", campus)
    .then((data) => {
      res.send(`${data.length}`);
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
      res.send(data);
    });
});

router.get("/studentsTodayTotal", (req, res) => {
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

//Number of students 2de for the given campus
router.get("/studentsTodayTotalByCampus/:campus", async (req, res) => {
  const d = new Date();
  const date = d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
  const { campus } = req.params;

  console.log("the campus", campus);
  //to be changed for the dashboard

  if (campus == 0) {
    const d = new Date();
    const date = d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
    //to be changed for the dashboard
    const data = await database
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
      .orderBy("signin_time");

    return res.send(data);
  }

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
    .join("gates", "student_signin.gate_id", "=", "gates.id")
    .where("gates.campus_id", "=", campus)
    .andWhere("student_signin.signin_date", "=", date)
    .orderBy("signin_time")
    .then((data) => {
      console.log("the data from campus", data);
      res.send(data);
    });
});

router.get("/staff2deByCampus/:campus", async (req, res) => {
  const d = new Date();
  const date = d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
  const { campus } = req.params;
  //to be changed for the dashboard

  if (campus == 0) {
    const data = await database
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
      .orderBy("signin_time");

    return res.send(data);
  }
  const staffSignedIN2de = await database
    .select("*")
    .from("staff_signin")
    .join("staff", "staff.staff_id", "=", "staff_signin.staff_id")
    .join("users", "staff_signin.signed_in_by", "=", "users.id")
    .join("gates", "staff_signin.gate_id", "=", "gates.id")
    .where("gates.campus_id", "=", campus)
    .where("staff_signin.signin_date", "=", date)
    .orderBy("signin_time");

  res.send(staffSignedIN2de);
});

module.exports = router;
