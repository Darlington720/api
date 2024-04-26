const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const _ = require("lodash");
const { database, baseIp, port } = require("../config");

const authenticateSession = async (req, res, next) => {
  const { sessionToken } = req.headers;

  if (!sessionToken) {
    return res.sendStatus(401);
  }

  //check to see if the session token is valid

  try {
    const active_token = await database
      .select("*")
      .from("active_user_session")
      .where({
        token: sessionToken,
      });

    if (active_token) {
      next();
    } else {
      // Session token is invalid, return 401 Unauthorized
      res.sendStatus(401);
    }
  } catch (error) {
    return res.sendStatus(500);
  }
};

router.post("/login", (req, res) => {
  const { username, password, token } = req.body;
  console.log(req.body);
  database
    .select("*")
    // .select(["-password", "-access_id", "-access_pwd", "-token"])
    .where({
      username: username,
      password: password,
    })
    .from("users")
    .then(async (u) => {
      // console.log(user);
      const user = u.map((row) => _.omit(row, ["password"]));
      if (!user[0]) {
        res.status(400).json({ error: "Invalid email or password" });
      } else {
        // Generate new session token
        const sessionToken = crypto.randomBytes(64).toString("hex");

        // console.log("token generated", sessionToken);

        //check if there are any existing tokens for this user and delete them
        const user_tokens = await database
          .select("*")
          .from("active_user_session")
          .where({
            username: user[0].username,
          })
          .del();

        // console.log("delete result", user_tokens);

        //store the new user token
        await database("active_user_session").insert({
          username: user[0].username,
          token: sessionToken,
        });

        if (user[0].role == "Student") {
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
              stu_no: user[0].stu_no,
              sem_half: currentSession.session_sem,
              year: currentSession.session_year,
            });

          // console.log("Enrollment", studentEnrollmentForTheCurrentSession);

          database
            // .orderBy("id")
            .select("*")
            .from("students_biodata")
            .where(function () {
              this.where("stdno", "=", user[0].stu_no);
            })
            .then((studentData) => {
              database
                // .orderBy("id")
                .select("*")
                .from("stu_selected_course_units")
                .join("modules", function () {
                  this.on(
                    "stu_selected_course_units.course_id",
                    "=",
                    "modules.course_id"
                  ).andOn(
                    "stu_selected_course_units.course",
                    "=",
                    "modules.course_code"
                  );
                })
                // .join(
                //   "course_units",
                //   "stu_selected_course_units.course_id",
                //   "=",
                //   "course_units.course_id"
                // )
                .where(function () {
                  this.where("stu_id", "=", user[0].stu_no);
                })
                .then((courseUnitsData) => {
                  res.send({
                    ...user[0],
                    otherData: studentData,
                    imageUrl: `http://${baseIp}:${port}/assets/${user[0].user_image}`,
                    enrollmentDetails: studentEnrollmentForTheCurrentSession[0],
                    studentCourseUnits: courseUnitsData,
                    active_auth: sessionToken,
                  });
                });
            });
        } else {
          const assignedRole = await database("staff_assigned_roles")
            .join(
              "staff_roles",
              "staff_assigned_roles.role",
              "staff_roles.role_id"
            )
            .where({
              staff_id: user[0].stu_no,
            })
            .select("*");
          // console.log("user", {
          //   ...user[0],
          //   assignedRole: assignedRole[0] ? assignedRole[0] : null,
          //   imageUrl: `http://${baseIp}:${port}/assets/${user[0].user_image}`,
          //   active_auth: sessionToken,
          // });
          res.send({
            ...user[0],
            assignedRole: assignedRole[0] ? assignedRole[0] : null,
            imageUrl: `http://${baseIp}:${port}/assets/${user[0].user_image}`,
            active_auth: sessionToken,
          });
        }
      }
    })
    .catch((err) => {
      console.log("Err", err);
      res.status(400).json({ error: "Invalid email or password" });
    });
});

router.post("/saveToken", (req, res) => {
  // console.log("Obj received", req.body);
  if (req.body.token) {
    database
      .select("*")
      .from("users")
      .where({
        id: req.body.user_id,
      })
      .update({
        token: req.body.token,
      })
      .then((data2) => {
        // console.log(`Updated ${req.body.name}'s push token`, data2);
        res.end();
      })
      .catch((err) => {
        console.log("error in storing token", err);
        res.end();
      });
  } else {
    res.end();
  }
});

router.post("/removeToken", (req, res) => {
  const { user_id, username, password, token } = req.body;
  // console.log("user info", req.body);
  database
    .select("*")
    .from("users")
    .where({
      id: user_id,
    })
    .update({
      token: null,
    })
    .then((data2) => {
      console.log(`removed ${user_id}'s push token`);
      res.end();
    })
    .catch((err) => {
      console.log("Error removing token", err);
      res.end();
    });
});

module.exports = router;
