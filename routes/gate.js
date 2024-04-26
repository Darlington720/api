const express = require("express");
const router = express.Router();
const { database, baseIp, port } = require("../config");
const authenticateSession = require("../middleware/authenticateSession");

//new update of acquiring student entirely on tredumo
router.get("/student/:studentNo", authenticateSession, (req, res) => {
  const { studentNo } = req.params;
  const d = new Date();
  const date = d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();

  database
    .select("*")
    .from("students_biodata")

    .join("stu_signin", "students_biodata.stdno", "=", "stu_signin.stu_id")

    .where("students_biodata.stdno", "=", studentNo)
    .andWhere("stu_signin.signin_date", "=", date)

    .then(async (data3) => {
      // console.log("data3", data3);

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
          stu_no: studentNo,
          sem_half: currentSession.session_sem,
          year: currentSession.session_year,
        });

      if (data3.length > 0) {
        if (data3[data3.length - 1].signout_time !== null) {
          // res.send("Already registered");
          database
            .select("*")
            .from("students_biodata")
            // .join("finance", "students.stu_id", "=", "finance.stu_no")
            .where({
              stdno: studentNo,
            })
            .then((data2) => {
              database
                .select("*")
                .from("student_paid_fess")
                .where({
                  stu_no: studentNo,
                })
                .then((payment_percentages) => {
                  let regStatus = "Not Registered";

                  payment_percentages.sort((a, b) => {
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

                  // if (
                  //   payment_percentages.length === 0 ||
                  //   payment_percentages[payment_percentages.length - 1]
                  //     .paid_percentage < 100
                  // ) {
                  //   regStatus = "Not Registered";
                  // } else if (
                  //   payment_percentages[payment_percentages.length - 1]
                  //     .paid_percentage >= 100
                  // ) {
                  //   regStatus = "Registered";
                  // }

                  payment_percentages.map((payment) => {
                    if (studentEnrollmentForTheCurrentSession[0]) {
                      if (
                        payment.study_yr ===
                          studentEnrollmentForTheCurrentSession[0].study_yr &&
                        payment.sem ===
                          studentEnrollmentForTheCurrentSession[0].sem &&
                        payment.paid_percentage < 100
                      ) {
                        regStatus = "Not Registered";
                      } else if (
                        payment.study_yr ===
                          studentEnrollmentForTheCurrentSession[0].study_yr &&
                        payment.sem ===
                          studentEnrollmentForTheCurrentSession[0].sem &&
                        payment.paid_percentage >= 100
                      ) {
                        regStatus = "Registered";
                      }
                    } else {
                      if (
                        payment.study_yr === data2[0].study_yr &&
                        payment.sem === data2[0].current_sem &&
                        payment.paid_percentage < 100
                      ) {
                        regStatus = "Not Registered";
                      } else if (
                        payment.study_yr === data2[0].study_yr &&
                        payment.sem === data2[0].current_sem &&
                        payment.paid_percentage >= 100
                      ) {
                        regStatus = "Registered";
                      }
                    }
                  });

                  database
                    .select("*")
                    .from("constraints")
                    .then((data6) => {
                      res.send({
                        success: true,
                        result: {
                          biodata: data2[0],
                          percentages: payment_percentages,
                          registration_status: regStatus,
                          enrollmentDetails:
                            studentEnrollmentForTheCurrentSession[0],
                          otherDetails: {
                            todaysStatus: "not new",

                            imageUrl: data2[0]
                              ? `http://${baseIp}:${port}/assets/${data2[0].image}`
                              : "http://${baseIp}:${port}/assets/jacket.jpg",
                            requiredPercentage: data6[0].c_percentage,
                          },
                        },
                      });
                    });
                });
            });
        } else {
          database
            .select("*")
            .from("student_paid_fess")
            .where({
              stu_no: studentNo,
            })
            .then((payment_percentages) => {
              let regStatus = "Not Registered";

              payment_percentages.sort((a, b) => {
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
              // if (
              //   payment_percentages.length === 0 ||
              //   payment_percentages[payment_percentages.length - 1]
              //     .paid_percentage < 100
              // ) {
              //   regStatus = "Not Registered";
              // } else if (
              //   payment_percentages[payment_percentages.length - 1]
              //     .paid_percentage >= 100
              // ) {
              //   regStatus = "Registered";
              // }

              payment_percentages.map((payment) => {
                if (studentEnrollmentForTheCurrentSession[0]) {
                  if (
                    payment.study_yr ===
                      studentEnrollmentForTheCurrentSession[0].study_yr &&
                    payment.sem ===
                      studentEnrollmentForTheCurrentSession[0].sem &&
                    payment.paid_percentage < 100
                  ) {
                    regStatus = "Not Registered";
                  } else if (
                    payment.study_yr ===
                      studentEnrollmentForTheCurrentSession[0].study_yr &&
                    payment.sem ===
                      studentEnrollmentForTheCurrentSession[0].sem &&
                    payment.paid_percentage >= 100
                  ) {
                    regStatus = "Registered";
                  }
                } else {
                  if (
                    payment.study_yr === data2[0].study_yr &&
                    payment.sem === data2[0].current_sem &&
                    payment.paid_percentage < 100
                  ) {
                    regStatus = "Not Registered";
                  } else if (
                    payment.study_yr === data2[0].study_yr &&
                    payment.sem === data2[0].current_sem &&
                    payment.paid_percentage >= 100
                  ) {
                    regStatus = "Registered";
                  }
                }
              });

              database
                .select("*")
                .from("constraints")
                .then((data6) => {
                  res.send({
                    success: true,

                    result: {
                      biodata: data3[data3.length - 1],
                      percentages: payment_percentages,
                      registration_status: regStatus,
                      enrollmentDetails:
                        studentEnrollmentForTheCurrentSession[0],
                      otherDetails: {
                        todaysStatus: true,
                        imageUrl: `http://${baseIp}:${port}/assets/${data3[0].image}`,
                        requiredPercentage: data6[0].c_percentage,
                      },
                    },
                  });
                });
            });
        }
      } else {
        database
          .select("*")
          .from("students_biodata")
          // .join("finance", "students.stu_id", "=", "finance.stu_no")
          .where({
            stdno: studentNo,
          })
          .then((data2) => {
            if (data2[0]) {
              database
                .select("*")
                .from("student_paid_fess")
                .where({
                  stu_no: studentNo,
                })
                .then((payment_percentages) => {
                  let regStatus = "Not Registered";

                  payment_percentages.sort((a, b) => {
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

                  payment_percentages.map((payment) => {
                    if (studentEnrollmentForTheCurrentSession[0]) {
                      if (
                        payment.study_yr ===
                          studentEnrollmentForTheCurrentSession[0].study_yr &&
                        payment.sem ===
                          studentEnrollmentForTheCurrentSession[0].sem &&
                        payment.paid_percentage < 100
                      ) {
                        regStatus = "Not Registered";
                      } else if (
                        payment.study_yr ===
                          studentEnrollmentForTheCurrentSession[0].study_yr &&
                        payment.sem ===
                          studentEnrollmentForTheCurrentSession[0].sem &&
                        payment.paid_percentage >= 100
                      ) {
                        regStatus = "Registered";
                      }
                    } else {
                      if (
                        payment.study_yr === data2[0].study_yr &&
                        payment.sem === data2[0].current_sem &&
                        payment.paid_percentage < 100
                      ) {
                        regStatus = "Not Registered";
                      } else if (
                        payment.study_yr === data2[0].study_yr &&
                        payment.sem === data2[0].current_sem &&
                        payment.paid_percentage >= 100
                      ) {
                        regStatus = "Registered";
                      }
                    }
                  });

                  database
                    .select("*")
                    .from("constraints")
                    .then((data6) => {
                      res.send({
                        success: true,
                        result: {
                          biodata: data2[0],
                          percentages: payment_percentages,
                          registration_status: regStatus,
                          enrollmentDetails:
                            studentEnrollmentForTheCurrentSession[0],
                          otherDetails: {
                            todaysStatus: false,
                            imageUrl: data2[0]
                              ? `http://${baseIp}:${port}/assets/${data2[0].image}`
                              : "http://${baseIp}:${port}/assets/jacket.jpg",

                            requiredPercentage: data6[0].c_percentage,
                          },
                        },
                      });
                    });
                });
            } else {
              database
                .select("*")
                .from("constraints")
                .then((data6) => {
                  res.send({
                    success: false,
                    message: `Failed to locate the student with student Number ${studentNo}`,
                    // {
                    //   todaysStatus: false,
                    //   imageUrl: data2[0]
                    //     ? `http://${baseIp}:${port}/assets/${data2[0].image}`
                    //     : "http://${baseIp}:${port}/assets/jacket.jpg",
                    //   requiredPercentage: data6[0].c_percentage,
                    // },
                  });
                });
            }
          });
      }
    });
});

router.get("/constraintList", authenticateSession, async (req, res) => {
  const constraints = await database
    .select("*")
    .from("constraints")
    .orderBy("c_id");

  res.send(constraints);
});

router.get("/staff/:staffNo", authenticateSession, (req, res) => {
  const { staffNo } = req.params;
  const userId = 1;
  //console.log("staff number", staffNo);
  const d = new Date();
  const date = d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();

  database
    .select("*")
    .from("staff")

    .join(
      "staff_signin_details",
      "staff.staff_id",
      "=",
      "staff_signin_details.staff_id"
    )

    .where("staff.staff_id", "=", staffNo)
    .andWhere("staff_signin_details.signin_date", "=", date)

    .then((data3) => {
      if (data3.length > 0) {
        // res.send(data3);
        if (data3[data3.length - 1].signout_time !== null) {
          // res.send("Already registered");
          database
            .select("*")
            .from("staff")
            // .join("finance", "students.stu_id", "=", "finance.stu_no")
            .where({
              staff_id: `${staffNo}`,
            })
            .then((data2) => {
              res.send([
                ...data2,
                {
                  todaysStatus: "not new",
                  imageUrl: data2[0]
                    ? `http://${baseIp}:${port}/image/${data2[0].staff_id.replace(
                        /\s/g,
                        ""
                      )}`
                    : "http://${baseIp}:${port}/assets/jacket.jpg",
                },
              ]);
            });
        } else {
          database
            .select("*")
            .from("staff")
            // .join("finance", "students.stu_id", "=", "finance.stu_no")
            .where({
              staff_id: `${staffNo}`,
            })
            .then((data2) => {
              res.send([
                data3[data3.length - 1],
                {
                  todaysStatus: true,
                  imageUrl: data2[0]
                    ? `http://${baseIp}:${port}/image/${data2[0].staff_id.replace(
                        /\s/g,
                        ""
                      )}`
                    : "http://${baseIp}:${port}/assets/jacket.jpg",
                },
              ]);
            });
        }
      } else {
        database
          .select("*")
          .from("staff")
          // .join("finance", "students.stu_id", "=", "finance.stu_no")
          .where({
            staff_id: `${staffNo}`,
          })
          .then((data2) => {
            //console.log("shdgghsdghd", data2);
            if (data2[0]) {
              res.send([
                ...data2,
                {
                  todaysStatus: false,
                  imageUrl: data2[0]
                    ? `http://${baseIp}:${port}/image/${data2[0].staff_id.replace(
                        /\s/g,
                        ""
                      )}`
                    : "http://10.7.0.22:9000/image/NUA083",
                },
              ]);
            } else {
              res.send([
                {
                  todaysStatus: false,
                  imageUrl: data2[0]
                    ? `http://${baseIp}:${port}/image/${data2[0].staff_id.replace(
                        /\s/g,
                        ""
                      )}`
                    : "http://${baseIp}:${port}/assets/jacket.jpg",
                },
              ]);
            }
          });
      }
      // });
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

router.post("/studentReg", (req, res) => {
  const {
    stu_id,
    temp,
    signed_in_by,
    signed_in,
    signin_gate,
    studentBioData,
    gate_id,
  } = req.body;
  //console.log("reg data", req.body);
  const d = new Date();
  const date = d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
  const time = d.getHours() + ":" + d.getMinutes() + ":" + d.getSeconds();
  // console.log(
  //   "time",
  //   d.getHours() + ":" + d.getMinutes() + ":" + d.getSeconds()
  // );

  database
    .select("*")
    .from("students")

    .join("student_signin", "students.stu_id", "=", "student_signin.stu_id")

    .where("students.stu_id", "=", stu_id)
    .andWhere("student_signin.signin_date", "=", date)
    .then((data) => {
      if (data.length > 0) {
        database("stu_signin")
          .insert({
            stu_id: stu_id,
            temperature: temp,
            signin_date: date,
            signin_time: time,
            signined_in_by: signed_in,
            signin_gate,
          })
          .then((data) => {
            database("users")
              .where(function () {
                this.where("stu_no", "=", stu_id);
              })
              .update({
                stu_status: 1,
              })
              .then((data) => {
                // res.send("updated the data");
              })
              .catch(
                (err) => {}
                // res.send(err)
              );
            res.send("Received the data");
            // database("students_signout_book")
            //   .insert({
            //     stu_id: stu_id,
            //     signin_date: date,
            //   })
            //   .then((data2) => {
            //     res.send("Received the data");
            //   });
          })
          .catch((err) => {
            console.log("incurred an error", err);
            res.send(err);
          });
      } else {
        database("student_signin")
          .insert({
            stu_id: stu_id,
            temperature: temp,
            signin_date: date,
            signin_time: time,
            signed_in_by,
            gate_id: gate_id,
          })
          .then((data) => {
            database("stu_signin")
              .insert({
                stu_id: stu_id,
                temperature: temp,
                signin_date: date,
                signin_time: time,
                signined_in_by: signed_in,
                signin_gate,
              })
              .then((data) => {
                res.send("Received the data");

                database
                  .select("*")
                  .from("users")
                  .where("users.stu_no", "=", stu_id)
                  .then((data) => {
                    // res.send(data);
                    if (data.length == 0) {
                      database("users")
                        .insert({
                          userfull_name: studentBioData.name,
                          username: stu_id,
                          password: stu_id,
                          email: `${studentBioData.name.replace(
                            /\s/g,
                            ""
                          )}@gmail.com`,
                          gendar: studentBioData.sex,
                          phoneNo: stu_id,
                          DOB: null,
                          Address: null,
                          user_image: "jacket.jpg",
                          role: "Student",
                          stu_no: stu_id,
                          stu_status: 1,
                          is_class_rep: 0,
                        })
                        .then((data4) => {});
                    }
                  });

                // database("students_signout_book")
                //   .insert({
                //     stu_id: stu_id,
                //     signin_date: date,
                //   })
                //   .then((data2) => {
                //     res.send("Received the data");
                //   });
              })
              .catch((err) => {
                console.log("incurred an error", err);
                res.send(err);
              });

            // database("students_signout_book")
            //   .insert({
            //     stu_id: stu_id,
            //     signin_date: date,
            //   })
            //   .then((data2) => {
            //     res.send("Received the data");
            //   });
          })
          .catch((err) => {
            console.log("incurred an error", err);
            res.send(err);
          });
      }
    });

  database
    .select("*")
    .from("students_biodata")
    .where("students_biodata.stdno", "=", stu_id)
    .then((stuData) => {
      if (stuData.length == 0) {
        database("students_biodata")
          .insert({
            stdno: studentBioData.stdno,
            regno: studentBioData.regno,
            name: studentBioData.name,
            admissions_form_no: studentBioData.admissions_form_no,
            sex: studentBioData.sex,
            telno: studentBioData.telno,
            entry_ac_yr: studentBioData.entry_ac_yr,
            entry_study_yr: studentBioData.entry_study_yr,
            nationality: studentBioData.nationality,
            facultycode: studentBioData.facultycode,
            progtitle: studentBioData.progtitle,
            progcode: studentBioData.progcode,
            prog_alias: studentBioData.prog_alias,

            programlevel: studentBioData.programlevel,
            progduration: studentBioData.progduration,
            facultytitle: studentBioData.facultytitle,
            intake: studentBioData.intake,
            campus: studentBioData.campus,
            sponsorship: studentBioData.sponsorship,
            residence_status: studentBioData.residence_status,
            current_sem: studentBioData.current_sem,
            study_yr: studentBioData.study_yr,
            study_time: studentBioData.study_time,
            collegetitle: studentBioData.collegetitle,
            std_status: studentBioData.std_status,
            progversion: studentBioData.progversion,
          })
          .then((result) => {
            console.log("Added a new student to our db");
          });
      }
    });
});

router.post("/staffReg", (req, res) => {
  const { staff_id, temp, signed_in_by, signed_in, signin_gate, gate_id } =
    req.body;
  console.log("reg data", req.body);
  const d = new Date();
  const date = d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
  const time = d.getHours() + ":" + d.getMinutes() + ":" + d.getSeconds();
  // console.log(
  //   "time",
  //   d.getHours() + ":" + d.getMinutes() + ":" + d.getSeconds()
  // );

  database
    .select("*")
    .from("staff")

    .join("staff_signin", "staff.staff_id", "=", "staff_signin.staff_id")

    .where("staff.staff_id", "=", staff_id)
    .andWhere("staff_signin.signin_date", "=", date)
    .then((data) => {
      //console.log("Joined User", data);
      if (data.length > 0) {
        database("staff_signin_details")
          .insert({
            staff_id: staff_id,
            temperature: temp,
            signin_date: date,
            signin_time: time,
            signed_in_by: signed_in,
            signin_gate,
          })
          .then((data) => {
            database("users")
              .where(function () {
                this.where("stu_no", "=", staff_id);
              })
              .update({
                stu_status: 1,
              })
              .then((data) => {
                res.send("updated the data");
              })
              .catch(
                (err) => {
                  console.log("err", err);
                }
                // res.send(err)
              );
            // res.send("Received the data");
            // database("students_signout_book")
            //   .insert({
            //     stu_id: stu_id,
            //     signin_date: date,
            //   })
            //   .then((data2) => {
            //     res.send("Received the data");
            //   });
          })
          .catch((err) => console.log("eror", err));
      } else {
        database("staff_signin")
          .insert({
            staff_id: staff_id,
            temperature: temp,
            signin_date: date,
            signin_time: time,
            gate_id,
            signed_in_by,
          })
          .then((data) => {
            console.log("Recevid staff members");
            database("staff_signin_details")
              .insert({
                staff_id: staff_id,
                temperature: temp,
                signin_date: date,
                signin_time: time,
                signed_in_by: signed_in,
                signin_gate,
              })
              .then((data) => {
                res.send("Received the data");
                console.log("Received the data");

                database
                  .select("*")
                  .from("staff")
                  // .join("finance", "students.stu_id", "=", "finance.stu_no")
                  .where({
                    staff_id: `${staff_id}`,
                  })
                  .then((data8) => {
                    database
                      .select("*")
                      .from("users")
                      .where("users.stu_no", "=", staff_id)
                      .then((data) => {
                        // res.send(data);
                        if (data.length == 0) {
                          const staffID = data8[0].staff_id.replace(/\s/g, "");
                          database("users")
                            .insert({
                              userfull_name: data8[0].staff_name,
                              username: staffID,
                              password: staffID,
                              email: `${data8[0].staff_name.replace(
                                /\s/g,
                                ""
                              )}@gmail.com`,
                              gendar: null,
                              phoneNo: null,
                              DOB: null,
                              Address: null,
                              user_image: staffID,
                              role: data8[0].role,
                              stu_no: staffID,
                              stu_status: 1,
                              is_class_rep: 0,
                            })
                            .then((data4) => {});
                        }
                      });
                  });
              })
              .catch((err) => console.log("errrr", err));
          })
          .catch((err) => res.send(err));
      }
    });
});

router.post("/addVisitor", authenticateSession, (req, res) => {
  const { full_name, reason, office, signed_in_by, signin_gate, gate_id } =
    req.body;
  const d = new Date();
  const date = d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();

  //console.log(req.body);
  database("visitors")
    .insert({
      v_full_name: full_name,
      reason,
      office,
      signed_in_by,
      date,
      gate_id,
      signin_gate,
    })
    .then((data) => res.status(200).send("Received the data"))
    .catch((err) => res.status(400).send("Failed to send the data " + err));
});

router.post("/studentSignout/", (req, res) => {
  const { studentNo, signed_in_by, signed_out_by, signin_time, signout_gate } =
    req.body;
  console.log(req.body);
  const d = new Date();
  const date = d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
  const time = d.getHours() + ":" + d.getMinutes() + ":" + d.getSeconds();

  database("stu_signin")
    // .where("stu_id", "=", studentNo)
    .where(function () {
      this.where("stu_id", "=", studentNo);
    })
    .andWhere(function () {
      this.where("signin_date", "=", date);
    })
    .andWhere(function () {
      this.where("signined_in_by", "=", signed_in_by);
    })
    .andWhere(function () {
      this.where("signin_time", "=", signin_time);
    })
    .select("*")
    .update({
      signed_out_by: signed_out_by,
      signout_time: time,
      signout_gate,
    })
    .then((data) => {
      database("users")
        .where(function () {
          this.where("stu_no", "=", studentNo);
        })
        .update({
          stu_status: 0,
        })
        .then((data) => {
          // res.send("updated the data");
        })
        .catch(
          (err) => {}
          // res.send(err)
        );
      res.send("received the data");
    });
});

router.post("/staffSignout/", (req, res) => {
  const { staff_id, signed_in_by, signed_out_by, signin_time, signout_gate } =
    req.body;
  //console.log(req.body);
  const d = new Date();
  const date = d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
  const time = d.getHours() + ":" + d.getMinutes() + ":" + d.getSeconds();

  database("staff_signin_details")
    // .where("stu_id", "=", studentNo)
    .where(function () {
      this.where("staff_id", "=", staff_id);
    })
    .andWhere(function () {
      this.where("signin_date", "=", date);
    })
    .andWhere(function () {
      this.where("signed_in_by", "=", signed_in_by);
    })
    .andWhere(function () {
      this.where("signin_time", "=", signin_time);
    })
    .select("*")
    .update({
      signed_out_by: signed_out_by,
      signout_time: time,
      signout_gate,
    })
    .then((data) => {
      database("users")
        .where(function () {
          this.where("stu_no", "=", staff_id);
        })
        .update({
          stu_status: 0,
        })
        .then((data) => {
          // res.send("updated the data");
        })
        .catch(
          (err) => {}
          // res.send(err)
        );
      res.send("received the data");
    });
});

router.post("/gateReg", (req, res) => {
  const { gate_id, user_id } = req.body;
  // console.log(req.body);
  const d = new Date();
  const date = d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
  const time = d.getHours() + ":" + d.getMinutes() + ":" + d.getSeconds();
  // console.log(
  //   "time",
  //   d.getHours() + ":" + d.getMinutes() + ":" + d.getSeconds()
  // );

  database("assigned_gates")
    .insert({
      gate_id,
      user_id,
      date,
      time,
    })
    .then((data) => {
      res.send("Received the data");
    })
    .catch((err) => res.send(err));
});

router.get("/numOfvisitors2de", (req, res) => {
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
      res.send(`${data.length}`);
    });
});

router.get("/myVisitors/:user_id", (req, res) => {
  const { user_id } = req.params;
  console.log(user_id);
  const d = new Date();
  const date = d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();

  database("visitors")
    .join(
      "users",
      "visitors.signed_in_by",

      "=",
      "users.id"
    )
    .where("visitors.date", "=", date)
    .select("*")
    .where({
      signed_in_by: user_id,
      date: date,
    })
    .then((data) => {
      res.send(data);
    });
});

router.get("/myStudents/:user_id", (req, res) => {
  const { user_id } = req.params;
  //console.log(user_id);
  const d = new Date();
  const date = d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();

  database("student_signin")
    // .join(
    //   "users",
    //   "students_signin_book.signed_in_by",

    //   "=",
    //   "users.id"
    // )
    // .where("student_signin.signin_date", "=", date)
    .select("*")
    .where({
      signed_in_by: user_id,
      signin_date: date,
    })
    .then((data) => {
      res.send(data);
    });
});

router.get("/myStaffMembers/:user_id", (req, res) => {
  const { user_id } = req.params;
  //console.log(user_id);
  const d = new Date();
  const date = d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();

  database("staff_signin")
    // .join(
    //   "users",
    //   "students_signin_book.signed_in_by",

    //   "=",
    //   "users.id"
    // )
    // .where("student_signin.signin_date", "=", date)
    .select("*")
    .where({
      signed_in_by: user_id,
      signin_date: date,
    })
    .then((data) => {
      res.send(data);
    });
});

router.get("/studentGateStatus/:studentNo", async (req, res) => {
  const { studentNo } = req.params;
  const d = new Date();
  const date = d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
  let todaysStatus;
  const student = await database
    .select("*")
    .from("students_biodata")
    .where({
      stdno: studentNo,
    })
    .first();

  const gateInfo = await database
    .select("*")
    .from("students_biodata")

    .join("stu_signin", "students_biodata.stdno", "=", "stu_signin.stu_id")
    .where("students_biodata.stdno", "=", studentNo)
    .andWhere("stu_signin.signin_date", "=", date);
  if (student) {
    // console.log("gate info", gateInfo);
    if (gateInfo.length > 0) {
      if (gateInfo[gateInfo.length - 1].signout_time !== null) {
        //not new
        todaysStatus = false;
      } else {
        todaysStatus = true;
      }
    } else {
      todaysStatus = false;
    }
  } else {
    todaysStatus = "invalid";
  }

  if (todaysStatus === "invalid") {
    res.send({
      success: false,
      message: "NO student with that student number",
    });
  } else {
    res.send({
      success: true,
      result: {
        status: todaysStatus,
        signed_in_by: todaysStatus
          ? gateInfo[gateInfo.length - 1].signined_in_by
          : null,
        signin_time: todaysStatus
          ? gateInfo[gateInfo.length - 1].signin_time
          : null,
        stu_no: studentNo,
        name: student.name,
      },
    });
  }
});
module.exports = router;
