const express = require("express");
const router = express.Router();
const { database } = require("../config");

const cleanTextField = (field) => {
  return field.replace(/[^a-zA-Z0-9 ]/g, "");
};

const cleanNumField = (field) => {
  return field.replace(/[^a-zA-Z0-9. ]/g, "");
};

//upload
router.post("/uploadImage", (req, res) => {
  try {
    // console.log(req);
    if (!req.files) {
      req.send({
        status: false,
        message: "No files Uploaded",
      });
    } else {
      let image = req.files.image;

      console.log("path ", __dirname);
      image.mv(__dirname + "/upload/" + image.name);

      res.send({
        status: true,
        message: "File is uploaded",
        data: {
          name: image.name,
          mimetype: image.mimetype,
          size: image.size,
        },
      });
    }
  } catch (error) {
    res.status(500).send(error);
  }
});

//upload-multiple
router.post("/upload-photos", async (req, res) => {
  try {
    // console.log("Here is what i got ", req.files.image);
    // console.log("Here is what i got ", req.files);
    if (!req.files) {
      res.send({
        status: false,
        message: "No file uploaded",
      });
    } else {
      let data = [];

      //loop all files
      if (Array.isArray(req.files.image)) {
        req.files.image.forEach((photo) => {
          photo.mv(__dirname + "/public/assets/" + photo.name);

          //push file details
          data.push({
            name: photo.name,
            mimetype: photo.mimetype,
            size: photo.size,
          });
        });
        res.send({
          status: true,
          message: "Files are uploaded",
          data: data,
        });
      } else {
        let image = req.files.image;

        // console.log("path ", __dirname);
        image.mv(__dirname + "/public/assets/" + image.name);

        res.send({
          status: true,
          message: "File is uploaded",
          data: {
            name: image.name,
            mimetype: image.mimetype,
            size: image.size,
          },
        });
      }

      // forEach(keysIn(req.files.photo), (key) => {
      //   let photo = req.files.image[key];
      //   console.log("Keyyyy", key);

      //   //move photo to uploads directory
      //   photo.mv("./uploads/" + image.name);

      //   //push file details
      //   data.push({
      //     name: image.name,
      //     mimetype: image.mimetype,
      //     size: image.size,
      //   });
      // });

      //return response
    }
  } catch (err) {
    res.status(500).send(err);
  }
});

router.post("/importExceltodb", (req, res) => {
  // console.log("res body", req.body);
  try {
    const fieldsToInsertBiodata = req.body.students
      .map((field, index) => {
        // const noSpecialChars = str.replace(/[^a-zA-Z0-9 ]/g, "");
        if (index == 0) return;
        return {
          stdno: cleanTextField(field.stdno),
          regno: cleanTextField(field.regno),
          name: cleanTextField(field.name),
          admissions_form_no: "",
          sex: cleanTextField(field.sex),
          telno: cleanTextField(field.telno),
          entry_ac_yr: cleanTextField(field.entry_ac_yr),
          entry_study_yr: cleanTextField(field.study_yr),
          nationality: cleanTextField(field.nationality),
          facultycode: cleanTextField(field.facultycode),
          progtitle: cleanTextField(field.progtitle),
          progcode: cleanTextField(field.progcode),
          prog_alias: cleanTextField(field.prog_alias),

          programlevel: cleanTextField(field.programlevel),
          progduration: "",
          facultytitle: cleanTextField(field.facultytitle),
          intake: cleanTextField(field.intake),
          campus: cleanTextField(field.campus),
          sponsorship: cleanTextField(field.sponsorship),
          residence_status: field.residence_status.replace(
            /[^a-zA-Z0-9 ]/g,
            ""
          ),
          current_sem: cleanTextField(field.sem),
          study_yr: cleanTextField(field.study_yr),
          study_time: cleanTextField(field.study_time),
          collegetitle: cleanTextField(field.collegetitle),
          std_status: 0,
          progversion: "",
        };
      })
      .filter((row) => {
        return row !== undefined;
      });

    const fieldsToInsert = req.body
      .map((field, index) => {
        const noWhiteSpace = field.total_bill.replace(/\s/g, "");
        var cleanTotalBill = cleanNumField(noWhiteSpace);

        const noWhiteSpace2 = field.total_paid.replace(/\s/g, "");
        var cleanTotalPaid = cleanNumField(noWhiteSpace2);

        const noWhiteSpace3 = field.total_credit.replace(/\s/g, "");
        var cleanTotalCredit = cleanNumField(noWhiteSpace3);

        const noWhiteSpace4 = field.total_due.replace(/\s/g, "");
        var cleanTotalDue = noWhiteSpace4.replace(/[^\d]+/g, "");

        // const noSpecialChars = str;
        // if (index == 0) return;

        // res.send(field);
        return {
          stu_no: cleanTextField(field.stdno),
          acc_yr: cleanTextField(field.accyr),
          study_yr: cleanTextField(field.study_yr),
          sem: cleanTextField(field.sem),
          reg_status: cleanTextField(field.reg_status),
          total_bill: cleanTotalBill,
          total_credit: cleanTotalCredit,
          tatal_paid: cleanTotalPaid,
          paid_percentage: isNaN(
            parseInt(
              ((parseInt(cleanTotalPaid) + parseInt(cleanTotalCredit)) /
                parseInt(cleanTotalBill)) *
                100
            )
          )
            ? 0
            : parseInt(
                ((parseInt(cleanTotalPaid) + parseInt(cleanTotalCredit)) /
                  parseInt(cleanTotalBill)) *
                  100
              ),
          total_due: cleanTotalDue,
        };
      })
      .filter((row) => {
        return row !== undefined;
      });

    database.transaction((trx) => {
      const inserts = fieldsToInsert.map((stu) => {
        return database
          .select("*")
          .where({
            stu_no: stu.stu_no,
            study_yr: stu.study_yr,
            sem: stu.sem,
          })
          .from("student_paid_fess")
          .transacting(trx)
          .then((result) => {
            //the stu number is not there
            if (result.length == 0) {
              return database("student_paid_fess")
                .insert(stu)
                .transacting(trx)
                .then((data) => {
                  // res.status(200).send("Success");
                  // console.log("Data", data);
                })
                .catch((err) => {
                  console.log("Failed to save the data", err);
                  // res.status(400).send("fail");
                });
            } else {
              //the stu no id there
              return database("student_paid_fess")
                .where(function () {
                  this.where("stu_no", "=", stu.stu_no);
                })

                .andWhere(function () {
                  this.where("study_yr", "=", stu.study_yr);
                })
                .andWhere(function () {
                  this.where("sem", "=", stu.sem);
                })
                .update({
                  acc_yr: stu.acc_yr,
                  paid_percentage: stu.paid_percentage,
                  reg_status: stu.reg_status,
                  total_bill: stu.total_bill,
                  total_credit: stu.total_credit,
                  tatal_paid: stu.tatal_paid,
                  total_due: stu.total_due,
                  acc_yr_id: req.body.acc_yr_id,
                  sem_half: req.body.sem,
                })
                .transacting(trx)
                .then((data) => {
                  // res.send("updated the data");
                  // console.log("Data here", data);
                })
                .catch((err) => console.log("Error in updating the data", err));
            }
          });
      });

      const insert2 = fieldsToInsertBiodata.map((student) => {
        return database
          .select("*")
          .from("students_biodata")
          .where("students_biodata.stdno", "=", student.stdno)
          .transacting(trx)
          .then((stuData) => {
            if (stuData.length == 0) {
              return database("students_biodata")
                .insert({
                  stdno: student.stdno,
                  regno: student.regno,
                  name: student.name,
                  admissions_form_no: student.admissions_form_no,
                  sex: student.sex,
                  telno: student.telno,
                  entry_ac_yr: student.entry_ac_yr,
                  entry_study_yr: student.entry_study_yr,
                  nationality: student.nationality,
                  facultycode: student.facultycode,
                  progtitle: student.progtitle,
                  progcode: student.progcode,
                  prog_alias: student.prog_alias,
                  programlevel: student.programlevel,
                  progduration: student.progduration,
                  facultytitle: student.facultytitle,
                  intake: student.intake,
                  campus: student.campus,
                  sponsorship: student.sponsorship,
                  residence_status: student.residence_status,
                  current_sem: student.current_sem,
                  study_yr: student.study_yr,
                  study_time: student.study_time,
                  collegetitle: student.collegetitle,
                  std_status: student.std_status,
                  progversion: student.progversion,
                })
                .transacting(trx)
                .then((result) => {
                  console.log("Added a new student to our db ", student.stdno);
                });
            }
          });
      });

      // Wait for all the inserts to complete
      Promise.all([...insert2, ...inserts])
        .then(() => {
          // Send the response when the inserts are done
          trx
            .commit()
            .then(() => {
              database("uploaded_excel_forms_fees")
                .insert({
                  file_name: "new file",
                  upload_date: new Date(),
                })
                .then(async (result) => {
                  const currentElection = await database("election_categories")
                    // .leftJoin("elections", "election_categories.id", "elections.category_id")
                    .orderBy("id", "desc")
                    .limit(1)
                    .first();

                  // looking for the exact election taking place
                  const currentElectionDate = await database("elections")
                    .where({
                      category_id: currentElection.id,
                    })
                    .orderBy("id", "desc")
                    .limit(1)
                    .first();

                  const requiredPercentage = await database
                    .select("*")
                    .from("constraints")
                    .where("c_name", "=", "Voting")
                    .first();

                  // return all students that are exempted
                  // const exemptedStudents = await database("vote_exemptions")
                  //   .join(
                  //     "students_biodata",
                  //     "vote_exemptions.stu_no",
                  //     "students_biodata.stdno"
                  //   )
                  //   .select("vote_exemptions.*", "students_biodata.name")
                  //   .count();
                  const exemptedStudents = await database("vote_exemptions")
                    .where({
                      election_category_id: currentElection.id,
                      date: currentElectionDate.date,
                      // date: new Date(),
                    })
                    .count();

                  //lets get the elible voters
                  // const elligibleVoters = await database("student_paid_fess")
                  //   .join(
                  //     "students_biodata",
                  //     "student_paid_fess.stu_no",
                  //     "students_biodata.stdno"
                  //   )
                  //   .where(
                  //     "student_paid_fess.acc_yr",
                  //     "=",
                  //     requiredPercentage.acc_yr
                  //   )
                  //   .andWhere("students_biodata.campus", "=", "main")
                  //   .andWhere(
                  //     "student_paid_fess.paid_percentage",
                  //     ">=",
                  //     requiredPercentage.c_percentage
                  //   )
                  //   .count();

                  const elligibleVoters = await database("student_paid_fess")
                    .join(
                      "students_biodata",
                      "student_paid_fess.stu_no",
                      "students_biodata.stdno"
                    )
                    .where({
                      acc_yr_id: currentSession.acc_yr_id,
                      sem_half: currentSession.sem_half,
                    })
                    .andWhere("students_biodata.campus", "=", campus)
                    .andWhere(
                      "student_paid_fess.paid_percentage",
                      ">=",
                      requiredPercentage.c_percentage
                    )
                    .count();

                  res.send({
                    success: true,
                    message: "Excel sheet uploaded successfully",
                    result: {
                      elligibleVoters: elligibleVoters[0]["count(*)"],
                      exemptedStudents: exemptedStudents[0]["count(*)"],
                    },
                  });
                });
            })
            .catch((err) => {
              console.error(err);
              // res.send(`Error ${err}`);
              res.send({
                success: false,
                message: `Theres a problem with the sent file ${err}`,
              });
            });
        })
        .catch((err) => {
          console.error(err);
          res.send({
            success: false,
            message: "Theres a problem with the sent file",
          });
        });
    });
  } catch (error) {
    res.send({
      success: false,
      message: "Error in file provided",
    });
  }
});

router.post("/votersUpload", (req, res) => {
  try {
    // console.log("the body", req.body);

    const fieldsToInsertBiodata = req.body
      .map((field, index) => {
        // const noSpecialChars = str.replace(/[^a-zA-Z0-9 ]/g, "");
        if (index == 0) return;
        return {
          stdno: field.stdno.replace(/[^a-zA-Z0-9 ]/g, ""),
          regno: field.regno.replace(/[^a-zA-Z0-9/ ]/g, ""),
          name: field.name.replace(/[^a-zA-Z0-9 ]/g, ""),
          admissions_form_no: "",
          sex: field.sex.replace(/[^a-zA-Z0-9 ]/g, ""),
          telno: field.telno.replace(/[^a-zA-Z0-9 ]/g, ""),
          entry_ac_yr: field.entry_ac_yr.replace(/[^a-zA-Z0-9 ]/g, ""),
          entry_study_yr: field.study_yr.replace(/[^a-zA-Z0-9 ]/g, ""),
          nationality: field.nationality.replace(/[^a-zA-Z0-9 ]/g, ""),
          facultycode: field.facultycode.replace(/[^a-zA-Z0-9 ]/g, ""),
          progtitle: field.progtitle.replace(/[^a-zA-Z0-9 ]/g, ""),
          progcode: field.progcode.replace(/[^a-zA-Z0-9 ]/g, ""),
          prog_alias: field.prog_alias.replace(/[^a-zA-Z0-9 ]/g, ""),

          programlevel: field.programlevel.replace(/[^a-zA-Z0-9 ]/g, ""),
          progduration: "",
          facultytitle: field.facultytitle.replace(/[^a-zA-Z0-9 ]/g, ""),
          intake: field.intake.replace(/[^a-zA-Z0-9 ]/g, ""),
          campus: field.campus.replace(/[^a-zA-Z0-9 ]/g, ""),
          sponsorship: field.sponsorship.replace(/[^a-zA-Z0-9 ]/g, ""),
          residence_status: field.residence_status.replace(
            /[^a-zA-Z0-9 ]/g,
            ""
          ),
          current_sem: field.sem.replace(/[^a-zA-Z0-9 ]/g, ""),
          study_yr: field.study_yr.replace(/[^a-zA-Z0-9 ]/g, ""),
          study_time: field.study_time.replace(/[^a-zA-Z0-9 ]/g, ""),
          collegetitle: field.collegetitle.replace(/[^a-zA-Z0-9 ]/g, ""),
          std_status: 0,
          progversion: "",
        };
      })
      .filter((row) => {
        return row !== undefined;
      });

    const fieldsToInsert = req.body
      .map((field, index) => {
        const noWhiteSpace = field.total_bill.replace(/\s/g, "");
        var cleanTotalBill = noWhiteSpace.replace(/[^a-zA-Z0-9. ]/g, "");

        const noWhiteSpace2 = field.total_paid.replace(/\s/g, "");
        var cleanTotalPaid = noWhiteSpace2.replace(/[^a-zA-Z0-9. ]/g, "");

        const noWhiteSpace3 = field.total_credit.replace(/\s/g, "");
        var cleanTotalCredit = noWhiteSpace3.replace(/[^a-zA-Z0-9. ]/g, "");

        const noWhiteSpace4 = field.total_due.replace(/\s/g, "");
        var cleanTotalDue = noWhiteSpace4.replace(/[^\d]+/g, "");

        // const noSpecialChars = str.replace(/[^a-zA-Z0-9 ]/g, "");
        // if (index == 0) return;

        // res.send(field);
        return {
          stu_no: field.stdno.replace(/[^a-zA-Z0-9 ]/g, ""),
          acc_yr: field.accyr.replace(/[^a-zA-Z0-9 ]/g, ""),
          study_yr: field.study_yr.replace(/[^a-zA-Z0-9 ]/g, ""),
          sem: field.sem.replace(/[^a-zA-Z0-9 ]/g, ""),
          reg_status: field.reg_status.replace(/[^a-zA-Z0-9 ]/g, ""),
          total_bill: cleanTotalBill,
          total_credit: cleanTotalCredit,
          total_paid: cleanTotalPaid,
          paid_percentage: isNaN(
            parseInt(
              ((parseInt(cleanTotalPaid) + parseInt(cleanTotalCredit)) /
                parseInt(cleanTotalBill)) *
                100
            )
          )
            ? 0
            : parseInt(
                ((parseInt(cleanTotalPaid) + parseInt(cleanTotalCredit)) /
                  parseInt(cleanTotalBill)) *
                  100
              ),
          total_due: cleanTotalDue,
        };
      })
      .filter((row) => {
        return row !== undefined;
      });

    database.transaction((trx) => {
      const inserts = fieldsToInsert.map((stu) => {
        // database("student_paid_fess")
        //   .where("stu_no", stu.stu_no)
        //   .andWhere("study_yr", stu.study_yr)
        //   .andWhere("sem", stu.sem)
        return database
          .select("*")
          .where({
            stu_no: stu.stu_no,
            study_yr: stu.study_yr,
            sem: stu.sem,
          })
          .from("elligible_voters")
          .transacting(trx)
          .then((result) => {
            //the stu number is not there
            if (result.length == 0) {
              return database("elligible_voters")
                .insert(stu)
                .transacting(trx)
                .then((data) => {
                  // res.status(200).send("Success");
                  // console.log("Data", data);
                })
                .catch((err) => {
                  console.log("Failed to save the data", err);
                  // res.status(400).send("fail");
                });
            } else {
              //the stu no id there
              return database("elligible_voters")
                .where(function () {
                  this.where("stu_no", "=", stu.stu_no);
                })

                .andWhere(function () {
                  this.where("study_yr", "=", stu.study_yr);
                })
                .andWhere(function () {
                  this.where("sem", "=", stu.sem);
                })
                .update({
                  acc_yr: stu.acc_yr,
                  paid_percentage: stu.paid_percentage,
                  reg_status: stu.reg_status,
                  total_bill: stu.total_bill,
                  total_credit: stu.total_credit,
                  total_paid: stu.tatal_paid,
                  total_due: stu.total_due,
                })
                .transacting(trx)
                .then((data) => {
                  // res.send("updated the data");
                  // console.log("Data here", data);
                })
                .catch((err) => console.log("Error in updating the data", err));
            }
          });
      });

      const insert2 = fieldsToInsertBiodata.map((student) => {
        return database
          .select("*")
          .from("students_biodata")
          .where("students_biodata.stdno", "=", student.stdno)
          .transacting(trx)
          .then((stuData) => {
            if (stuData.length == 0) {
              return database("students_biodata")
                .insert({
                  stdno: student.stdno,
                  regno: student.regno,
                  name: student.name,
                  admissions_form_no: student.admissions_form_no,
                  sex: student.sex,
                  telno: student.telno,
                  entry_ac_yr: student.entry_ac_yr,
                  entry_study_yr: student.entry_study_yr,
                  nationality: student.nationality,
                  facultycode: student.facultycode,
                  progtitle: student.progtitle,
                  progcode: student.progcode,
                  prog_alias: student.prog_alias,
                  programlevel: student.programlevel,
                  progduration: student.progduration,
                  facultytitle: student.facultytitle,
                  intake: student.intake,
                  campus: student.campus,
                  sponsorship: student.sponsorship,
                  residence_status: student.residence_status,
                  current_sem: student.current_sem,
                  study_yr: student.study_yr,
                  study_time: student.study_time,
                  collegetitle: student.collegetitle,
                  std_status: student.std_status,
                  progversion: student.progversion,
                })
                .transacting(trx)
                .then((result) => {
                  console.log("Added a new student to our db ", student.stdno);
                });
            }
          });
      });

      // Wait for all the inserts to complete
      Promise.all([...insert2, ...inserts])
        .then(() => {
          // Send the response when the inserts are done
          trx
            .commit()
            .then(() => {
              database("uploaded_excel_forms_fees")
                .insert({
                  file_name: "new file",
                  upload_date: new Date(),
                })
                .then((result) => {
                  res.send({
                    success: true,
                    message: "Excel sheet uploaded successfully",
                  });
                });
            })
            .catch((err) => {
              console.error(err);
              // res.send(`Error ${err}`);
              res.send({
                success: false,
                message: `Theres a problem with the sent file ${err}`,
              });
            });
        })
        .catch((err) => {
          console.error(err);
          // res.send(`Error ${err}`);
          res.send({
            success: false,
            message: "Theres a problem with the sent file",
          });
        });
    });
  } catch (error) {
    res.status(500).send(error);
  }
});

router.get("/lastUploadDateForFees", (req, res) => {
  database
    // .orderBy("id")
    .select("*")
    .from("uploaded_excel_forms_fees")
    .then((data) => {
      res.send({
        success: true,
        data: data[data.length - 1],
      });
    })
    .catch((err) =>
      res.status(500).send({
        success: false,
        data: err,
      })
    );
});

module.exports = router;
