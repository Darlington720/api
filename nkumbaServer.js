const express = require("express");
const path = require("path");
const multer = require("multer");
const morgan = require("morgan");
const bodyParser = require("body-parser");
const socketio = require("socket.io");
const jwt = require("jsonwebtoken");
const XLSX = require("xlsx");
const gate = require("./routes/gate");
const auth = require("./routes/auth");
const student = require("./routes/student");
const dashboard = require("./routes/dashboard");
const lecturer = require("./routes/lecturer");
const admin = require("./routes/admin");
const voting = require("./routes/voting");
const lectures = require("./routes/lectures");
const exams = require("./routes/exams");
const uploadRouter = require("./routes/upload");
const timetable = require("./routes/timetable");
const graduation = require("./routes/graduation");
const cors = require("cors");
const moment = require("moment");
const {
  sendPushNotifications,
  sendMultiplePushNotifications,
} = require("./pushNotifications");
var { baseIp, port, database } = require("./config");

const fileUpload = require("express-fileupload");

const upload = multer();
const app = express();
const secret = "mySecret";
app.use(express.json({ limit: "10mb" }));
app.use(cors());
app.use(express.static(__dirname + "/public"));
app.use(express.static(path.join(__dirname, "build")));
app.use(fileUpload());
app.use(
  bodyParser.urlencoded({
    extended: true,
  })
);
app.use(bodyParser.json());

if (app.get("env") === "development") {
  app.use(morgan("tiny"));
  console.log("Morgan Enabled...");
}
app.use("/api/gate", gate);
app.use("/api/auth", auth);
app.use("/api/student", student);
app.use("/api/lecturer", lecturer);
app.use("/api/admin", admin);
app.use("/api/voting", voting);
app.use("/api/lecture", lectures);
app.use("/api/upload", uploadRouter);
app.use("/api/timetable", timetable);
app.use("/api/dashboard", dashboard);
app.use("/api/exams", exams);
app.use("/api/graduation", graduation);
// console.log("my name is", new Date("2022-12-04T23:31:53.000Z").getDate());

let cookies = "";

var range = function (start, end, step) {
  var range = [];
  var typeofStart = typeof start;
  var typeofEnd = typeof end;

  if (step === 0) {
    throw TypeError("Step cannot be zero.");
  }

  if (typeofStart == "undefined" || typeofEnd == "undefined") {
    throw TypeError("Must pass start and end arguments.");
  } else if (typeofStart != typeofEnd) {
    throw TypeError("Start and end arguments must be of same type.");
  }

  typeof step == "undefined" && (step = 1);

  if (end < start) {
    step = -step;
  }

  if (typeofStart == "number") {
    while (step > 0 ? end >= start : end <= start) {
      range.push(start);
      start += step;
    }
  } else if (typeofStart == "string") {
    if (start.length != 1 || end.length != 1) {
      throw TypeError("Only strings with one character are supported.");
    }

    start = start.charCodeAt(0);
    end = end.charCodeAt(0);

    while (step > 0 ? end >= start : end <= start) {
      range.push(String.fromCharCode(start));
      start += step;
    }
  } else {
    throw TypeError("Only string and number types are supported");
  }

  return range;
};

//Each member should have a name, room, user_id, status_if_logged_in
let members = [];

const data = [
  "students",
  "students_biodata",
  "gates",
  "students_signin_book",
  "visitors",
  "campus",
  "staff_signin",
  "non_teaching_staff",
  "stu_signin",
  "constraints",
  "staff",
  "timetable",
  "lectures",
  "course_units",
  "users",
  "voters",
  "rooms",
  "exam_sessions",
  "modules",
  "study_time",
  "schools",
  "acc_yrs",
];

app.get("/", function (req, res) {
  res.sendFile(path.join(__dirname, "build", "index.html"));
});

app.post("/storeCookie/", (req, res) => {
  console.log(req.body);

  cookies = req.body.cookie;

  res.send({
    success: true,
    message: "cookies updated successfully",
  });
});

app.get("/get_cookies/", (req, res) => {
  res.send({
    cookies: `${cookies}`,
  });
});

data.forEach((item) =>
  app.get(`/${item}`, (req, res) => {
    database
      .select("*")
      .from(item)
      .then((data) => {
        res.send(data);
      });
  })
);

data.map((item) =>
  app.get(`/numof${item}`, (req, res) => {
    database
      // .orderBy("id")
      .select("*")
      .from(item)
      .then((data) => {
        res.send(`${data.length}`);
      });
  })
);

app.post("/api/importExceltodb", async (req, res) => {
  try {
    // console.log("received This ", req.body.excelObj);
    if (!req.files) {
      res.send({
        status: false,
        message: "No files Uploaded",
      });
    } else {
      let xlsFile = [];
      // xlsFile = req.files.excelFile;
      // console.log("Files i got ", Array.isArray(req.files.excelFile));
      if (!Array.isArray(req.files.excelFile)) {
        xlsFile.push(req.files.excelFile);
      } else {
        xlsFile = req.files.excelFile;
      }

      console.log("Files i got ", xlsFile);
      const worksheets = [];

      const x = await xlsFile.map(async (csvFile) => {
        // Save all the sent files
        await csvFile.mv(__dirname + "/upload/excel_sheets/" + csvFile.name);

        // Read each of the saved files
        const workbook = XLSX.readFile(
          `${__dirname}/upload/excel_sheets/${csvFile.name}`
        );

        // Get the first worksheet in the workbook
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];

        // Convert the worksheet to a JSON object
        const json = XLSX.utils.sheet_to_json(worksheet);

        // console.log("Extracted json", json);

        // console.log("Json data gen", json);
        worksheets.push(json);
      });

      Promise.all(x).then(async () => {
        const combinedWorksheet = worksheets.reduce((result, worksheet) => {
          return result.concat(worksheet);
        }, []);
        console.log("Final worksheet", combinedWorksheet.length);
        const arr = combinedWorksheet.map((obj) => {
          const newObj = {};
          for (const key in obj) {
            // let filteredKey = key.replace(/"/g, "");
            // let filteredKey = key.replace(/("|""|""")/g, "");
            let filteredKey = key.replace(/("|""|"""|\\\\)/g, "");
            newObj[filteredKey] = obj[key].replace(/"/g, "");
          }
          return newObj;
        });

        // filter out the header rows in each excel file provided
        const modifiedArray = arr.filter((s) => s.stdno !== "stdno");

        // console.log("Modified Arr", modifiedArray);
        // res.send({
        //   data: mod,
        // });

        // try {
        // } catch (error) {
        //   console.log("error", error);
        //   res.send({
        //     success: false,
        //     message:
        //       "The files sent contain an unknown error, This error is related to the columns of the files sent",
        //   });
        // }

        try {
          const fieldsToInsertBiodata = modifiedArray
            .map((field, index) => {
              // const noSpecialChars = str.replace(/[^a-zA-Z0-9 ]/g, "");
              // if (index == 0) return;
              // console.log(field);
              // res.send(field);

              return {
                stdno: field.stdno.replace(/[^a-zA-Z0-9 ]/g, ""),
                regno: field.regno.replace(/[^a-zA-Z0-9/ ]/g, ""),
                name: field.name.replace(/[^a-zA-Z0-9 ]/g, ""),
                email: `${field.email.replace(/[^a-zA-Z0-9 ]/g, "")}`,
                admissions_form_no: "",
                sex: field.sex.replace(/[^a-zA-Z0-9 ]/g, ""),
                telno: field.telno
                  ? field.telno.replace(/[^a-zA-Z0-9 ]/g, "")
                  : "",
                entry_ac_yr: field.entry_ac_yr
                  ? field.entry_ac_yr.replace(/[^a-zA-Z0-9 ]/g, "")
                  : "",
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

          // console.log("Bio data", fieldsToInsertBiodata);

          const fieldsToInsert = modifiedArray
            .map((field, index) => {
              const noWhiteSpace = field.total_bill.replace(/\s/g, "");
              var cleanTotalBill = noWhiteSpace.replace(/[^a-zA-Z0-9. ]/g, "");

              const noWhiteSpace2 = field.total_paid.replace(/\s/g, "");
              var cleanTotalPaid = noWhiteSpace2.replace(/[^a-zA-Z0-9. ]/g, "");

              const noWhiteSpace3 = field.total_credit.replace(/\s/g, "");
              var cleanTotalCredit = noWhiteSpace3.replace(
                /[^a-zA-Z0-9. ]/g,
                ""
              );

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

          const newStudents = await database("students_biodata")
            .insert(fieldsToInsertBiodata)
            .onConflict("stdno")
            .ignore();

          await database("uploaded_excel_forms_fees").insert({
            file_name: xlsFile[0].name,
            upload_date: new Date(),
          });

          database("student_paid_fess")
            .whereIn(
              "stu_no",
              fieldsToInsert.map((d) => d.stu_no)
            )
            .whereIn(
              "study_yr",
              fieldsToInsert.map((d) => d.study_yr)
            )
            .whereIn(
              "sem",
              fieldsToInsert.map((d) => d.sem)
            )
            .then(async (result) => {
              console.log("result", result.length);
              console.log("Modified Arr", modifiedArray.length);
              if (result.length == 0) {
                database("student_paid_fess")
                  .insert(fieldsToInsert)
                  .then((data) => {
                    res.status(200).send({
                      success: true,
                      message: "Excel Sheets Uploded Successfully",
                    });
                    // console.log("Data", data);
                  })
                  .catch((err) => {
                    console.log("Failed to save the data", err);
                    // res.status(400).send("fail");
                  });
              }
              //  else if (modifiedArray.length > result.length) {
              //   return await database("student_paid_fess")
              //     .insert(fieldsToInsert)
              //     // .onConflict(["stu_no", "study_yr", "sem"])
              //     // .merge()
              //     .whereNotExists(function () {
              //       this.select("*")
              //         .from("student_paid_fess")
              //         .whereIn(
              //           "stu_no",
              //           fieldsToInsert.map((row) => row.stu_no)
              //         )
              //         .whereIn(
              //           "study_yr",
              //           fieldsToInsert.map((row) => row.study_yr)
              //         )
              //         .whereIn(
              //           "sem",
              //           fieldsToInsert.map((row) => row.sem)
              //         );
              //     });
              // }
              else {
                // const newStu = fieldsToInsert.filter(
                //   (student) =>
                //     !result.some(
                //       (existingStu) =>
                //         student.stu_no === existingStu.stu_no &&
                //         student.study_yr === existingStu.study_yr &&
                //         student.sem === existingStu.sem
                //     )
                // );

                // const existingStudents = fieldsToInsert.filter((student) =>
                //   result.some(
                //     (existingStu) =>
                //       student.stu_no === existingStu.stu_no &&
                //       student.study_yr === existingStu.study_yr &&
                //       student.sem === existingStu.sem
                //   )
                // );

                // Filter out the new students from the already existing ones
                const { newStudents, existingStudents } = fieldsToInsert.reduce(
                  (acc, student) => {
                    const isExisting = result.some(
                      (existingStu) =>
                        student.stu_no === existingStu.stu_no &&
                        student.study_yr === existingStu.study_yr &&
                        student.sem === existingStu.sem
                    );

                    if (isExisting) {
                      acc.existingStudents.push(student);
                    } else {
                      acc.newStudents.push(student);
                    }

                    return acc;
                  },
                  { newStudents: [], existingStudents: [] }
                );

                // Insert the new students first
                // console.log("new students", newStudents)
                if (newStudents.length > 0) {
                  await database("student_paid_fess").insert(newStudents);
                }

                // After, go for the existing ones
                // const updatePromises = existingStudents.map(
                //   async (existingRow) => {
                //     return await database("student_paid_fess")
                //       .where({
                //         stu_no: existingRow.stu_no,
                //         study_yr: existingRow.study_yr,
                //         sem: existingRow.sem,
                //       })
                //       .update(existingRow);
                //   }
                // );

                // const updatePromises = existingStudents.map(
                //   async (existingRow) => {
                //     console.log("Working on this", existingRow);
                //     return database.transaction(async (trx) => {
                //       await trx("student_paid_fess")
                //         .where({
                //           stu_no: existingRow.stu_no,
                //           study_yr: existingRow.study_yr,
                //           sem: existingRow.sem,
                //         })
                //         .update(existingRow);
                //     });
                //   }
                // );

                // Promise.all(updatePromises)
                //   .then(() => {
                //     res.status(200).send({
                //       success: true,
                //       message: "Updated the fields Successfully",
                //     });
                //   })
                //   .catch((err) => {
                //     res.status(500).send({
                //       success: false,
                //       message: "An error occurred during the updates",
                //       error: err.message,
                //     });
                //   });

                const updatePromises = [];

                for (const existingRow of existingStudents) {
                  updatePromises.push(
                    database.transaction(async (trx) => {
                      await trx("student_paid_fess")
                        .where({
                          stu_no: existingRow.stu_no,
                          study_yr: existingRow.study_yr,
                          sem: existingRow.sem,
                        })
                        .update(existingRow);
                    })
                  );
                }

                Promise.all(updatePromises)
                  .then(() => {
                    res.status(200).send({
                      success: true,
                      message: "Updated the fields successfully",
                    });
                  })
                  .catch((err) => {
                    res.status(500).send({
                      success: false,
                      message: "An error occurred during the updates",
                      error: err.message,
                    });
                  });
              }
            });
        } catch (error) {
          console.log("error", error);
          res.send({
            success: false,
            message:
              "The files sent are too many, kindly remove some files and try again",
            error: error.message,
          });
        }

        // Promise.all([...insert2, ...inserts])
        //   .then(() => {
        //     // Send the response when the inserts are done
        //     database("uploaded_excel_forms_fees")
        //       .insert({
        //         file_name: xlsFile[0].name,
        //         upload_date: new Date(),
        //       })
        //       .then((result) => {
        //         res.send({
        //           success: true,
        //           message: "Excel sheets uploaded successfully",
        //         });
        //       });
        //   })
        //   .catch((err) => {
        //     console.error(err);
        //     // res.send(`Error ${err}`);
        //     res.send({
        //       success: false,
        //       message: `Theres a problem with the sent files: ${err}`,
        //     });
        //   });
        // res.send({ data: modifiedArray });
      });

      // xlsFile
      //   .mv(__dirname + "/upload/excel_sheets/" + xlsFile.name)
      //   .then(() => {
      //     try {
      //       const workbook = XLSX.readFile(
      //         `${__dirname}/upload/excel_sheets/${xlsFile.name}`
      //       );

      //       // Get the first worksheet in the workbook
      //       const worksheet = workbook.Sheets[workbook.SheetNames[0]];

      //       // Convert the worksheet to a JSON object
      //       const json = XLSX.utils.sheet_to_json(worksheet);

      //       console.log("Extracted json", json);

      //       const modifiedArray = json.map((obj) => {
      //         const newObj = {};
      //         for (const key in obj) {
      //           let filteredKey = key.replace(/"/g, "");
      //           newObj[filteredKey] = obj[key].replace(/"/g, "");
      //         }
      //         return newObj;
      //       });

      //       // console.log("The final object", modifiedArray);
      //       // res.send(modifiedArray);

      //       const fieldsToInsertBiodata = modifiedArray
      //         .map((field, index) => {
      //           // const noSpecialChars = str.replace(/[^a-zA-Z0-9 ]/g, "");
      //           if (index == 0) return;
      //           return {
      //             stdno: field.stdno.replace(/[^a-zA-Z0-9 ]/g, ""),
      //             regno: field.regno.replace(/[^a-zA-Z0-9/ ]/g, ""),
      //             name: field.name.replace(/[^a-zA-Z0-9 ]/g, ""),
      //             admissions_form_no: "",
      //             sex: field.sex.replace(/[^a-zA-Z0-9 ]/g, ""),
      //             telno: field.telno.replace(/[^a-zA-Z0-9 ]/g, ""),
      //             entry_ac_yr: field.entry_ac_yr.replace(/[^a-zA-Z0-9 ]/g, ""),
      //             entry_study_yr: field.study_yr.replace(/[^a-zA-Z0-9 ]/g, ""),
      //             nationality: field.nationality.replace(/[^a-zA-Z0-9 ]/g, ""),
      //             facultycode: field.facultycode.replace(/[^a-zA-Z0-9 ]/g, ""),
      //             progtitle: field.progtitle.replace(/[^a-zA-Z0-9 ]/g, ""),
      //             progcode: field.progcode.replace(/[^a-zA-Z0-9 ]/g, ""),
      //             prog_alias: field.prog_alias.replace(/[^a-zA-Z0-9 ]/g, ""),

      //             programlevel: field.programlevel.replace(
      //               /[^a-zA-Z0-9 ]/g,
      //               ""
      //             ),
      //             progduration: "",
      //             facultytitle: field.facultytitle.replace(
      //               /[^a-zA-Z0-9 ]/g,
      //               ""
      //             ),
      //             intake: field.intake.replace(/[^a-zA-Z0-9 ]/g, ""),
      //             campus: field.campus.replace(/[^a-zA-Z0-9 ]/g, ""),
      //             sponsorship: field.sponsorship.replace(/[^a-zA-Z0-9 ]/g, ""),
      //             residence_status: field.residence_status.replace(
      //               /[^a-zA-Z0-9 ]/g,
      //               ""
      //             ),
      //             current_sem: field.sem.replace(/[^a-zA-Z0-9 ]/g, ""),
      //             study_yr: field.study_yr.replace(/[^a-zA-Z0-9 ]/g, ""),
      //             study_time: field.study_time.replace(/[^a-zA-Z0-9 ]/g, ""),
      //             collegetitle: field.collegetitle.replace(
      //               /[^a-zA-Z0-9 ]/g,
      //               ""
      //             ),
      //             std_status: 0,
      //             progversion: "",
      //           };
      //         })
      //         .filter((row) => {
      //           return row !== undefined;
      //         });

      //       const fieldsToInsert = modifiedArray
      //         .map((field, index) => {
      //           const noWhiteSpace = field.total_bill.replace(/\s/g, "");
      //           var cleanTotalBill = noWhiteSpace.replace(
      //             /[^a-zA-Z0-9. ]/g,
      //             ""
      //           );

      //           const noWhiteSpace2 = field.total_paid.replace(/\s/g, "");
      //           var cleanTotalPaid = noWhiteSpace2.replace(
      //             /[^a-zA-Z0-9. ]/g,
      //             ""
      //           );

      //           const noWhiteSpace3 = field.total_credit.replace(/\s/g, "");
      //           var cleanTotalCredit = noWhiteSpace3.replace(
      //             /[^a-zA-Z0-9. ]/g,
      //             ""
      //           );

      //           const noWhiteSpace4 = field.total_due.replace(/\s/g, "");
      //           var cleanTotalDue = noWhiteSpace4.replace(/[^\d]+/g, "");

      //           // const noSpecialChars = str.replace(/[^a-zA-Z0-9 ]/g, "");
      //           // if (index == 0) return;

      //           // res.send(field);
      //           return {
      //             stu_no: field.stdno.replace(/[^a-zA-Z0-9 ]/g, ""),
      //             acc_yr: field.accyr.replace(/[^a-zA-Z0-9 ]/g, ""),
      //             study_yr: field.study_yr.replace(/[^a-zA-Z0-9 ]/g, ""),
      //             sem: field.sem.replace(/[^a-zA-Z0-9 ]/g, ""),
      //             reg_status: field.reg_status.replace(/[^a-zA-Z0-9 ]/g, ""),
      //             total_bill: cleanTotalBill,
      //             total_credit: cleanTotalCredit,
      //             tatal_paid: cleanTotalPaid,
      //             paid_percentage: isNaN(
      //               parseInt(
      //                 ((parseInt(cleanTotalPaid) + parseInt(cleanTotalCredit)) /
      //                   parseInt(cleanTotalBill)) *
      //                   100
      //               )
      //             )
      //               ? 0
      //               : parseInt(
      //                   ((parseInt(cleanTotalPaid) +
      //                     parseInt(cleanTotalCredit)) /
      //                     parseInt(cleanTotalBill)) *
      //                     100
      //                 ),
      //             total_due: cleanTotalDue,
      //           };
      //         })
      //         .filter((row) => {
      //           return row !== undefined;
      //         });

      //       const inserts = fieldsToInsert.map((stu) => {
      //         // database("student_paid_fess")
      //         //   .where("stu_no", stu.stu_no)
      //         //   .andWhere("study_yr", stu.study_yr)
      //         //   .andWhere("sem", stu.sem)
      //         return database
      //           .select("*")
      //           .where({
      //             stu_no: stu.stu_no,
      //             study_yr: stu.study_yr,
      //             sem: stu.sem,
      //           })
      //           .from("student_paid_fess")
      //           .then((result) => {
      //             //the stu number is not there
      //             if (result.length == 0) {
      //               return database("student_paid_fess")
      //                 .insert(stu)
      //                 .then((data) => {
      //                   // res.status(200).send("Success");
      //                   // console.log("Data", data);
      //                 })
      //                 .catch((err) => {
      //                   console.log("Failed to save the data", err);
      //                   // res.status(400).send("fail");
      //                 });
      //             } else {
      //               //the stu no id there
      //               return database("student_paid_fess")
      //                 .where(function () {
      //                   this.where("stu_no", "=", stu.stu_no);
      //                 })

      //                 .andWhere(function () {
      //                   this.where("study_yr", "=", stu.study_yr);
      //                 })
      //                 .andWhere(function () {
      //                   this.where("sem", "=", stu.sem);
      //                 })
      //                 .update({
      //                   acc_yr: stu.acc_yr,
      //                   paid_percentage: stu.paid_percentage,
      //                   reg_status: stu.reg_status,
      //                   total_bill: stu.total_bill,
      //                   total_credit: stu.total_credit,
      //                   tatal_paid: stu.tatal_paid,
      //                   total_due: stu.total_due,
      //                 })
      //                 .then((data) => {
      //                   // res.send("updated the data");
      //                   // console.log("Data here", data);
      //                 })
      //                 .catch((err) =>
      //                   console.log("Error in updating the data", err)
      //                 );
      //             }
      //           });
      //       });

      //       const insert2 = fieldsToInsertBiodata.map((student) => {
      //         return database
      //           .select("*")
      //           .from("students_biodata")
      //           .where("students_biodata.stdno", "=", student.stdno)
      //           .then((stuData) => {
      //             if (stuData.length == 0) {
      //               return database("students_biodata")
      //                 .insert({
      //                   stdno: student.stdno,
      //                   regno: student.regno,
      //                   name: student.name,
      //                   admissions_form_no: student.admissions_form_no,
      //                   sex: student.sex,
      //                   telno: student.telno,
      //                   entry_ac_yr: student.entry_ac_yr,
      //                   entry_study_yr: student.entry_study_yr,
      //                   nationality: student.nationality,
      //                   facultycode: student.facultycode,
      //                   progtitle: student.progtitle,
      //                   progcode: student.progcode,
      //                   prog_alias: student.prog_alias,
      //                   programlevel: student.programlevel,
      //                   progduration: student.progduration,
      //                   facultytitle: student.facultytitle,
      //                   intake: student.intake,
      //                   campus: student.campus,
      //                   sponsorship: student.sponsorship,
      //                   residence_status: student.residence_status,
      //                   current_sem: student.current_sem,
      //                   study_yr: student.study_yr,
      //                   study_time: student.study_time,
      //                   collegetitle: student.collegetitle,
      //                   std_status: student.std_status,
      //                   progversion: student.progversion,
      //                 })
      //                 .then((result) => {
      //                   console.log(
      //                     "Added a new student to our db ",
      //                     student.stdno
      //                   );
      //                 });
      //             }
      //           });
      //       });

      //       // Wait for all the inserts to complete
      //       Promise.all([...insert2, ...inserts])
      //         .then(() => {
      //           // Send the response when the inserts are done
      //           database("uploaded_excel_forms_fees")
      //             .insert({
      //               file_name: xlsFile.name,
      //               upload_date: new Date(),
      //             })
      //             .then((result) => {
      //               res.send({
      //                 success: true,
      //                 message: "Excel sheet uploaded successfully",
      //               });
      //             });
      //         })
      //         .catch((err) => {
      //           console.error(err);
      //           // res.send(`Error ${err}`);
      //           res.send({
      //             success: false,
      //             message: "Theres a problem with the sent file",
      //           });
      //         });
      //     } catch (error) {
      //       console.log("Error", error);
      //       res.send({
      //         success: false,
      //         message: "Error in file provided",
      //       });
      //     }
      //   });
    }
  } catch (error) {
    console.log("error", error);
    res.status(500).send({ "error processing request": error });
  }
});

app.get(`/gates/:campus`, (req, res) => {
  const { campus } = req.params;
  console.log(req.params);
  database
    // .orderBy("id")
    .select("*")
    .from("gates")
    .join("campus", "gates.campus_id", "=", "campus.cam_id")
    .where({
      campus_id: campus,
    })
    .then((data) => {
      res.send(data);
    });
});

app.post("/api/sendNotificationsToEnrolledStudents", async (req, res) => {
  const { lecture_id, date } = req.body;
  //console.log(req.params);

  const data = await database("stu_selected_course_units")
    .join("users", "stu_selected_course_units.stu_id", "=", "users.stu_no")
    // .where({
    //   course_id: lecture_id.includes("-")
    //     ? lecture_id
    //     : lecture_id ||
    //       `${lecture_id}-DAY` ||
    //       `${lecture_id}-WEEKEND` ||
    //       `${lecture_id}-DISTANCE`,
    // })
    .select("*");

  let enrolledStudents = [];

  data.map((cu) => {
    if (lecture_id.includes("-")) {
      // we need the students for the specific study time
      if (lecture_id === cu.course_id) {
        enrolledStudents.push(cu);
      }
    } else {
      if (cu.course_id.includes("-")) {
        // console.log("Contains the dash", data.course_id);
        let char_index = cu.course_id.lastIndexOf("-");
        let trimmedStr = cu.course_id.slice(0, char_index);
        // console.log("The rimmed version ---- ", trimmedStr);
        if (lecture_id === trimmedStr) {
          enrolledStudents.push(cu);
        }
      } else {
        if (lecture_id === cu.course_id) {
          enrolledStudents.push(cu);
        }
      }

      // console.log("trimmed???", trimmedStr);
    }
  });

  const lectureDetails = await getLectureDetails(req.body, date);

  //console.log("All the enrolled students", enrolledStudents);

  let pushTokens = [];

  enrolledStudents.map((student) => {
    if (student.token) {
      pushTokens.push(student.token);
      // sendPushNotifications(
      //   `${student.token}`,
      //   `The lecture has started`,
      //   `${student.course_name}`,
      //   { ...lectureDetails[0], navigateTo: "todaysLectures" }
      // );
    }
  });

  console.log("THe push tokens", pushTokens);

  if (enrolledStudents.length > 0) {
    sendMultiplePushNotifications(
      pushTokens,
      enrolledStudents[0].course_name,
      `The lecture has started`,
      { ...lectureDetails[0], navigateTo: "todaysLectures" }
    );
  }

  res.send("success");
});

app.get("/api/currentUniversitySession", async (req, res) => {
  const allSessions = await database
    .select("*")
    .from("university_sessions")
    .orderBy("us_id", "desc")
    .limit(1);

  // console.log("all the sessions", allSessions);
  res.send({
    success: true,
    result: allSessions[0],
  });
  //i want to return the latest
});

const expressServer = app.listen(port, baseIp, () =>
  console.log(`App is running on port ${port}`)
);

const io = socketio(expressServer, {
  cors: {
    origin: "*",
  },
});

io.on("connection", (socket) => {
  // console.log(`[${socket.id}] socket connected`);

  // io.emit("welcome", "Welcome to the socket io server");

  socket.on("hello", (data) => {
    console.log("data from client", data);
  });

  socket.on("update_voters", (data) => {
    console.log("request to update voters", data);
    io.emit("update_voters_from_server", data);
  });

  socket.on("update_elligible_voters", (data) => {
    // console.log("request to update elligible voters", data);
    io.emit("update_elligible_voters_from_server", data);
  });

  socket.on("update_elligible_voters_from_upload", (data) => {
    // console.log("request to update elligible voters", data);
    io.emit("update_elligible_voters_from_upload_server", data);
  });

  // const clients = await io.in("9").allSockets();
  // console.log("Clients", clients);

  socket.on("thanks", (msg) => {
    console.log(msg);
  });

  socket.on("lectureHasEnded", (msg) => {
    const d = new Date();
    const date = msg.year + "-" + msg.month + "-" + data.selectedDate;

    console.log("lecture has ended", msg);

    database
      .select("*")
      .from("lectures")
      .where({
        //lecture_id: msg.lecture_id,
        l_tt_id: msg.timetable_id,
        course_unit_id: msg.course_unit_id,
        l_day_id: msg.day_id,
        date: msg.fullDate,
      })
      .update({
        has_ended: 1,
        ended_At: new Date().toLocaleTimeString(),
      })
      .then((data2) => {
        console.log("Updated lecture ended");
      })
      .then((result) => {
        database
          .select("*")
          .from("lectures")
          .where({
            //lecture_id: msg.lecture_id,
            l_tt_id: msg.timetable_id,
            course_unit_id: msg.course_unit_id,
            l_day_id: msg.day_id,
            date: msg.fullDate,
          })
          .then((res) => {
            io.in(`${msg.course_unit_id}`).emit("lectureHasEndedToClients", {
              course_id: msg.course_unit_id,
              lecture_id: msg.lecture_id,
              ended: true,
              timetable_id: msg.timetable_id,
              lecturer_id: msg.lecturer_id,
              lectureData: res[0],
            });
          });

        // database
        //   .select("*")
        //   .from("timetable")
        //   // .join("lectures", "timetable.tt_id", "=", "lectures.tt_id")
        //   .where("day_id", "=", msg.day_id)
        //   .andWhere("timetable.tt_id", "=", msg.timetable_id)
        //   // .andWhere("timetable.study_time", "=", req.body.study_time)
        //   // .where("day_id", "=", req.body.day)

        //   //.join("course_units", "timetable.c_unit_id", "=", "course_units.course_id")
        //   .join(
        //     "stu_selected_course_units",
        //     "timetable.c_unit_id",
        //     "=",
        //     "stu_selected_course_units.course_id"
        //   )
        //   .leftJoin("staff", "timetable.lecturer_id", "=", "staff.staff_id")
        //   .join("schools", "timetable.school_id", "=", "schools.school_id")
        //   .leftJoin("lectures", function () {
        //     this.on("timetable.tt_id", "=", "lectures.l_tt_id")
        //       .andOn("lectures.l_year", "=", parseInt(d.getFullYear()))
        //       .andOn("lectures.l_month", "=", parseInt(d.getMonth() + 1))
        //       .andOn("lectures.l_date", "=", parseInt(d.getDate()));
        //   })
        //   // .where("lectures.date", "=", req.body.date)
        //   .andWhere("stu_selected_course_units.stu_id", "=", msg.stdno)
        //   .andWhere("timetable.c_unit_id", "=", msg.course_unit_id)
        //   .orderBy("start_time")

        database
          .from("lecture_timetable")
          .where("day_id", "=", msg.day_id)
          .andWhere("lecture_timetable.tt_id", "=", msg.timetable_id)
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

          .leftJoin(
            "staff",
            "lecture_timetable.lecturer_id",
            "=",
            "staff.staff_id"
          )
          .join(
            "stu_selected_course_units",
            "lecture_timetable.c_unit_id",
            "=",
            "stu_selected_course_units.course_id"
          )
          .leftJoin("lectures", function () {
            this.on("lecture_timetable.tt_id", "=", "lectures.l_tt_id")
              .andOn("lectures.l_year", "=", parseInt(d.getFullYear()))
              .andOn("lectures.l_month", "=", parseInt(d.getMonth() + 1))
              .andOn("lectures.l_date", "=", parseInt(d.getDate()));
          })
          // .where("lectures.date", "=", req.body.date)
          .andWhere("stu_selected_course_units.stu_id", "=", msg.stdno)
          .andWhere("lecture_timetable.c_unit_id", "=", msg.course_unit_id)
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
          .then((myData) => {
            // newArr.push(data);
            // console.log("another response herer", data);
            let lectureDetails = [];
            const fetch_3 = myData.map((lecture, index) => {
              return database
                .select("*")
                .from("users")
                .join(
                  "class_reps",
                  "users.stu_no",
                  "=",
                  "class_reps.class_rep_id"
                )
                .where("class_reps.for_wc_cu", "=", msg.course_unit_id)
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
                  moment(objA.start_time, "h:mmA") -
                  moment(objB.start_time, "h:mmA")
              );

              let finalArr = [];

              sortedAsc.map((l) => {
                finalArr.push({
                  ...l,
                  fullSelectedDate: date,
                });
              });

              // res.send(finalArr);
              //send notifications

              if (msg.course_unit_id.includes("-")) {
                database("stu_selected_course_units")
                  .join(
                    "users",
                    "stu_selected_course_units.stu_id",
                    "=",
                    "users.stu_no"
                  )
                  .select("*")

                  .where({
                    course_id: msg.course_unit_id,
                  })
                  .then((stuData) => {
                    // console.log("Enrolled students here", stuData);
                    let c_data = [];
                    stuData.forEach((student) => {
                      if (student.token) {
                        sendPushNotifications(
                          `${student.token}`,
                          `The lecture has ended, Would you wish to rate this lecture?`,
                          `${student.course_name}`,
                          {
                            ...finalArr[0],
                            navigateTo: "lectureDetails",
                            endLecture: true,
                          }
                        );
                      }
                      // });
                    });

                    //res.send(data);
                  });
              } else {
                database("stu_selected_course_units")
                  .join(
                    "users",
                    "stu_selected_course_units.stu_id",
                    "=",
                    "users.stu_no"
                  )
                  .select("*")

                  // .where({
                  //   course_id: msg.course_unit_id,
                  // })
                  .then((data) => {
                    // console.log("Enrolled students here", stuData);
                    let stuData = [];
                    data.map((cu) => {
                      if (cu.course_id.includes("-")) {
                        // console.log("Contains the dash", student.course_id);
                        let char_index = cu.course_id.lastIndexOf("-");
                        let trimmedStr = cu.course_id.slice(0, char_index);
                        // console.log("The rimmed version ---- ", trimmedStr);
                        if (msg.course_unit_id === trimmedStr) {
                          stuData.push(cu);
                        }
                      } else {
                        if (msg.course_unit_id === cu.course_id) {
                          stuData.push(cu);
                        }
                      }

                      // console.log("trimmed???", trimmedStr);
                    });

                    let c_data = [];
                    stuData.forEach((student) => {
                      if (student.token) {
                        sendPushNotifications(
                          `${student.token}`,
                          `The lecture has ended, Would you wish to rate this lecture?`,
                          `${student.course_name}`,
                          {
                            ...finalArr[0],
                            navigateTo: "lectureDetails",
                            endLecture: true,
                          }
                        );
                      }
                      // });
                    });

                    //res.send(data);
                  });
              }
            });
          });
      })
      .catch((err) => {
        console.log("Error in updating lecture ended", err);
      });
  });

  socket.on("rateTheLecture", (msg) => {
    console.log("Rate the lecture", msg);

    io.in(`${socket.id}`).emit("rateTheLectureToClient", "rate please");
  });

  socket.on("saveMyRating", (data) => {
    // console.log("My rating", data);
    // console.log(socket.id);
    // console.log([...socket.rooms]);
    io.in(socket.id).emit("testingToMeOnly", "Am send as me ");
    database
      .select("*")
      .from("lecture_members")
      .where({
        member_id: data.stdno,
        date: data.date,
        lecture_id: data.lecture_id,
        // day_id: msg.day_id,
      })
      .update({
        rating: data.rating,
        // ended_At: new Date().toLocaleTimeString(),
      })
      .then((data2) => {
        console.log("Updated lecture rating for ", data.stdno);
        database
          .select("*")
          .from("lecture_members")
          .where({
            member_id: data.stdno,
            date: data.date,
            lecture_id: data.lecture_id,
            // day_id: msg.day_id,
          })
          .then((memberData) => {
            database
              .select("*")
              .from("lectures")
              .where({
                // lecture_id: data.lecture_id,
                l_tt_id: data.tt_id,
                course_unit_id: data.lecture_id,
                l_day_id: data.day_id,
                date: data.date,
              })
              .then((lectureData) => {
                // console.log({
                //   memberData: memberData[0],
                //   lectureData: lectureData[0],
                // });

                database("stu_selected_course_units")
                  .join(
                    "users",
                    "stu_selected_course_units.stu_id",
                    "=",
                    "users.stu_no"
                  )
                  .select("*")

                  .where({
                    course_id: data.lecture_id,
                    stu_id: data.stdno,
                  })
                  .then((student) => {
                    // console.log("Enrolled students here", stuData);
                    let c_data = [];
                    // stuData.forEach((student) => {
                    if (student.token) {
                      sendPushNotifications(
                        `${student[0].token}`,
                        `Thank you for rating this lecture!!`,
                        `${student[0].course_name}`,
                        { navigateTo: "todaysLectures" }
                      );
                    }
                    // });
                    // });

                    //res.send(data);
                    // res.end();
                  });

                io.in(`${socket.id}`).emit("endedLectureDetails", {
                  memberData: memberData[0],
                  lectureData: lectureData[0],
                });
              });
          })
          .catch((err) => {
            console.log("Error in updating lecture rating", err);
          });
      })
      .catch((err) => {
        console.log("Error in updating lecture rating", err);
      });
  });

  socket.on("replyToSserver", (data) => {
    console.log("Just received a message from a happy client", data);
  });

  socket.on("addStudentToClass", (data) => {
    const d = new Date();
    const date = data.year + "-" + data.month + "-" + data.selectedDate;
    console.log(`Adding ${data.stu_no} to class ${data.course_id}`);

    database("students_biodata")
      .where(function () {
        this.where("stdno", "=", data.stu_no);
      })

      .then((data2) => {
        // const normalStudent = addUser(
        //   data2[0].stu_no,
        //   data2[0].userfull_name,
        //   `${data.course_id}`,
        //   "true",
        //   data2[0].role,
        //   `${data2[0].is_class_rep}`,
        //   new Date().toLocaleTimeString()
        // );

        // //check in the database to see if the student is already there

        database("lecture_members")
          .where(function () {
            this.where("member_id", "=", data.stu_no);
          })
          // .andWhere("course_id", course_id)
          .andWhere("lecture_id", data.course_id)
          .andWhere("date", data.date)
          .then(async (data10) => {
            // console.log("Member in database", data10);
            if (data10.length == 0) {
              //user is not there, so we a adding the student
              await addMember(
                data2[0].stdno,
                data.day_id,
                date,
                data.course_id,
                1,
                0,
                new Date().toLocaleTimeString()
              );
            }

            database("lecture_members")
              .join("users", "lecture_members.member_id", "=", "users.stu_no")
              .select(
                "users.id",
                "lecture_members.*",
                "users.userfull_name",
                "users.username",
                "users.token",
                "users.role",
                "users.stu_no"
              )

              .where({
                lecture_id: data.course_id,
                day_id: data.day_id,
                date: data.date,
              })
              .orderBy("joined_at")
              .then((data8) => {
                //res.send([...data, data8]);
                //  console.log("updatedMembersList", data8);
                // io.in(`${room}`).emit("updatedMembersList", data8);
                //console.log("Members now", data8);
                io.in(`${data.course_id}`).emit("updatedMembersList", data8);
                io.in(`${data.course_id}`).emit("addStudentToClassFromServer", {
                  stu_no: data.stu_no,
                });
              });
          })
          .catch((err) => {
            console.log("Error in adding student to class", err);
          });
      })

      .catch((err) => {
        console.log("Error in updating lecture rating", err);
      });
  });

  socket.on("joinRoom", (roomToJoin) => {
    const user2 = socket.handshake.query;
    console.log("user query", user2);
    // database
    //   .select("*")
    //   .from("users")
    //   .where({
    //     stu_no: user2.user_id,
    //   })
    //   .then((userInfo) => {
    //     console.log("user info", userInfo);
    //     sendPushNotifications(
    //       `${userInfo[0].token}`,
    //       `${userInfo[0].userfull_name}, We are happy to walk to see you here`,
    //       "Nkumba University"
    //     );
    //   });
    let user;
    // console.log("handshake", socket.handshake.query);
    //console.log("Socket data", roomToJoin);
    database("lecture_members")
      .where(function () {
        this.where("member_id", "=", socket.handshake.query.user_id);
      })
      .then((data10) => {
        //  console.log("Member in database", data10);
        if (data10.length == 0) {
          //user is not there, so we a adding the student
          user = addUser(
            socket.handshake.query.user_id,
            socket.handshake.query.name,
            roomToJoin,
            "false",
            socket.handshake.query.role,
            socket.handshake.query.isClassRep,
            new Date().toLocaleTimeString()
          );
        } else {
          user = addUser(
            socket.handshake.query.user_id,
            socket.handshake.query.name,
            roomToJoin,
            "true",
            socket.handshake.query.role,
            socket.handshake.query.isClassRep,
            new Date().toLocaleTimeString()
          );
        }
        //  console.log("User ", user);

        const indexOfObject = members.findIndex((object) => {
          return object.id === socket.handshake.query.user_id;
        });

        if (indexOfObject !== -1) members.splice(indexOfObject, 1);
        const roomToLeave = [...socket.rooms][1];
        if (roomToLeave) {
          socket.leave(roomToLeave);
        }

        //   console.log("Joining room");
        socket.join(roomToJoin);
        // console.log([...socket.rooms]);

        members.push(user);
        checkMembers("/", roomToJoin);
        // console.log("members so far", members);
      })
      .catch((err) => {
        console.log("Error in updating lecture rating", err);
      });

    // members.splice(indexOfObject, 1);
  });

  socket.on("joinRoomStudent", (roomToJoin) => {
    const roomToLeave = [...socket.rooms][1];
    if (roomToLeave) {
      socket.leave(roomToLeave);
    }
    // console.log("Joining room");
    socket.join(roomToJoin);
    // console.log([...socket.rooms]);
  });

  socket.on("joinAdminRoom", (roomToJoin) => {
    const roomToLeave = [...socket.rooms][1];
    if (roomToLeave) {
      socket.leave(roomToLeave);
    }
    //   console.log("Joining Admin Room");
    socket.join(roomToJoin);
    //console.log([...socket.rooms]);
  });

  socket.on("updateStudentsLoggedIn", (data) => {
    // console.log("REceiving updates");
    // console.log(data);

    // const roomToLeave = [...socket.rooms][1];
    // if (roomToLeave) {
    //   socket.leave(roomToLeave);
    // }
    // socket.join(data.stu_no);
    // const room = [...socket.rooms][1];
    // console.log("rooms", room);
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
        // res.send(data);
        io.in("admin").emit("updateStudentsLoggedIn", data);
      });

    database
      // .orderBy("id")
      .select("*")
      .from("students_biodata")
      .then((data) => {
        // res.send(data);
        io.in("admin").emit("updateAllStudentsInDB", data.length);
      });

    // io.emit("updateStudentStatus", data);
  });

  socket.on("updateStaffLoggedIn", (data) => {
    // console.log("REceiving updates");
    // console.log(data);

    // const roomToLeave = [...socket.rooms][1];
    // if (roomToLeave) {
    //   socket.leave(roomToLeave);
    // }
    // socket.join(data.stu_no);
    // const room = [...socket.rooms][1];
    // console.log("rooms", room);
    const d = new Date();
    const date = d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
    //to be changed for the dashboard
    database
      .select("*")
      .from("staff_signin")
      .where("staff_signin.signin_date", "=", date)
      .orderBy("signin_time")
      .then((data) => {
        data.map((item) => {
          const d2 = new Date(item.signin_date);
          const date2 = ` ${d2.getFullYear()}-0${
            d2.getMonth() + 1
          }-${d2.getDate()}`;
          item.signin_date = date2;
        });
        // res.send(data);
        io.in("admin").emit("updateStaffLoggedIn", data);
      });

    database
      // .orderBy("id")
      .select("*")
      .from("staff")
      .then((data) => {
        // res.send(data);
        io.in("admin").emit("updateAllStaffInDB", data.length);
      });

    // io.emit("updateStudentStatus", data);
  });

  socket.on("updateStudentStatusToServer", (data) => {
    // console.log("REceiving updates");
    // console.log(data);

    database("users")
      .where(function () {
        this.where("stu_no", "=", data.stu_no);
      })
      .update({
        stu_status: data.status ? 1 : 0,
      })
      .then((data) => {
        // res.send("updated the data");
      })
      .catch(
        (err) => {}
        // res.send(err)
      );
    const roomToLeave = [...socket.rooms][1];
    if (roomToLeave) {
      socket.leave(roomToLeave);
    }
    socket.join(data.stu_no);
    const room = [...socket.rooms][1];
    // console.log("rooms", room);
    io.in(`${room}`).emit("updateStudentStatus", data);
    // io.emit("updateStudentStatus", data);
  });

  socket.on("updateClassRep", (data) => {
    console.log("Requesting to change classRep", data);
    io.in(`${data.courseUnit}`).emit("updateClassRep", data);
  });

  socket.on("lectureHasStarted", async (data) => {
    const d = new Date();
    const date = `${data.l_year}-${data.l_month}-${data.selectedDate}`;
    console.log("lectureHasStarted", data);
    let room;

    await database
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
      .where("lecture_timetable.tt_id", "=", data.timetable_id)
      .then(async (lec) => {
        const data2 = lec.map((obj) => {
          const newObj = Object.assign({}, obj, {
            school: obj.alias,
            study_time: obj.study_time_name,
          });

          delete newObj.alias;
          delete newObj.study_time_name;
          return newObj;
        });

        const roomToLeave = [...socket.rooms][1];
        if (roomToLeave) {
          socket.leave(roomToLeave);
        }
        console.log("room", data2[0].c_unit_id);
        socket.join(`${data2[0].c_unit_id}`);

        room = [...socket.rooms][1];

        const lecture = await addLecture(data, data2, date);

        const membersInLecture = await updateLectureMembers(
          data,
          data2,
          members,
          date
        );
        //console.log("THe lecture", lecture);
        // console.log("members", membersInLecture);
        membersInLecture.map((m) => {
          // if (m.is_class_rep) {
          io.in(`${room}`).emit("lectureHasStartedFromServer", {
            start_time: lecture.started_at,
            course_id: lecture.c_unit_id,
            started: true,
            class_rep_id: m.is_class_rep ? m.stu_no : null,
            lectureMode: data.lectureMode,
            link: data.link,
            meetingId: data.meetingId,
            passcode: data.passcode,
          });
          // }
        });

        io.in(`${room}`).emit("updatedMembersList", membersInLecture);

        //send a push notification to the students
        // const { lecture_id, date } = req.body;
        //console.log(req.params);

        const enrolledCUs = await database("stu_selected_course_units")
          .join(
            "users",
            "stu_selected_course_units.stu_id",
            "=",
            "users.stu_no"
          )
          // .where({
          //   course_id: lecture_id.includes("-")
          //     ? lecture_id
          //     : lecture_id ||
          //       `${lecture_id}-DAY` ||
          //       `${lecture_id}-WEEKEND` ||
          //       `${lecture_id}-DISTANCE`,
          // })
          .select("*");

        let enrolledStudents = [];

        enrolledCUs.map((cu) => {
          if (data.lecture_id.includes("-")) {
            // we need the students for the specific study time
            if (data.lecture_id === cu.course_id) {
              enrolledStudents.push(cu);
            }
          } else {
            if (cu.course_id.includes("-")) {
              // console.log("Contains the dash", data.course_id);
              let char_index = cu.course_id.lastIndexOf("-");
              let trimmedStr = cu.course_id.slice(0, char_index);
              // console.log("The rimmed version ---- ", trimmedStr);
              if (data.lecture_id === trimmedStr) {
                enrolledStudents.push(cu);
              }
            } else {
              if (data.lecture_id === cu.course_id) {
                enrolledStudents.push(cu);
              }
            }

            // console.log("trimmed???", trimmedStr);
          }
        });

        const lectureDetails = await getLectureDetails(data, date);

        //console.log("All the enrolled students", enrolledStudents);

        let pushTokens = [];

        enrolledStudents.map((student) => {
          if (student.token) {
            pushTokens.push(student.token);
            // sendPushNotifications(
            //   `${student.token}`,
            //   `The lecture has started`,
            //   `${student.course_name}`,
            //   { ...lectureDetails[0], navigateTo: "todaysLectures" }
            // );
          }
        });

        console.log("THe push tokens", pushTokens);

        if (enrolledStudents.length > 0) {
          sendMultiplePushNotifications(
            pushTokens,
            enrolledStudents[0].course_name,
            `The lecture has started`,
            { ...lectureDetails[0], navigateTo: "todaysLectures" }
          );
        }

        //console.log("lecture details", lectureDetails);
      });

    // const lectureDetails = await getLectureDetails(data, date);

    // const enrolledStudents = await database("stu_selected_course_units")
    //   .join("users", "stu_selected_course_units.stu_id", "=", "users.stu_no")
    //   .where({
    //     course_id: data.lecture_id,
    //   })
    //   .select("*");

    //console.log("All the enrolled students", enrolledStudents);

    // enrolledStudents.map((student) => {
    //   if (student.token) {
    //     sendPushNotifications(
    //       `${student.token}`,
    //       `The lecture has started`,
    //       `${student.course_name}`,
    //       { ...lectureDetails[0], navigateTo: "todaysLectures" }
    //     );
    //   }
    // });
  });
});

// io.of("/students").on("connection", (nsSocket) => {
//   console.log(`${nsSocket.id} has joined students namespace`);
// });

const getMembersInRoom = (data) => {
  let customList = [];
  // members.forEach((member) => {
  //   if (member.room == `${room}` && member.status == "true") {
  //     customList.push(member);
  //   }
  // });
  // return customList;
  // database("lecture_members")
  //   .join("users", "lecture_members.member_id", "=", "users.stu_no")
  //   .select("*")

  //   .where({
  //     lecture_id: data.course_id,
  //     day_id: data.day_id,
  //     date: data.date,
  //   })
  //   .then((data8) => {
  //     //res.send([...data, data8]);
  //     console.log("updatedMembersList", data8);
  //     // io.in(`${room}`).emit("updatedMembersList", data8);

  //     io.in(`${data.course_id}`).emit("updatedMembersList", data8);
  //     io.in(`${data.course_id}`).emit("addStudentToClassFromServer", data);
  //   });

  // console.log("custom list here", customList);

  // return customList;
};

const checkMembers = async (namespace, roomToJoin) => {
  const clients = await io.of(namespace.endpoint).in(roomToJoin).allSockets();
  // console.log("Clients connected", clients);
  // io.of(namespace.endpoint)
  //   .to(roomToJoin)
  //   .emit("currNumOfClients", clients.size);
};

const addMember = async (
  member_id,
  day_id,
  date,
  lecture_id,
  status,
  is_class_rep,
  joinedAt
) => {
  let res;
  await database("lecture_members")
    .insert({
      member_id,
      day_id,
      date,
      lecture_id,
      status,
      is_class_rep,
      joined_at: joinedAt,
    })
    .then(async (data8) => {
      console.log("Member added sucessfully", data8);
      // await database("lecture_members")
      //   .join("users", "lecture_members.member_id", "=", "users.stu_no")
      //   .select("*")

      //   .where({
      //     lecture_id: lecture_id,
      //     day_id: day_id,
      //     date: date,
      //   })
      //   .then((data) => {
      //     //res.send([...data, data8]);
      //     // console.log("updatedMembersListfromLecturer", data);
      //     io.in(`${lecture_id}`).emit("updatedMembersList", data);
      //   })
      // .catch((err) => console.log(err));
    });

  return res;
};

const addUser = (id, name, room, status, role, isClassRep, joinedAt) => {
  const user = {
    id,
    stu_no: id,
    userfull_name: name,
    room,
    status,
    role,
    is_class_rep: isClassRep,
    joined_at: joinedAt,
  };

  return user;
};

async function addLecture(data, data2, date) {
  const existingLecture = await database("lectures")
    .where("l_tt_id", "=", data.timetable_id)
    .andWhere("l_date", "=", data.l_date)
    .andWhere("l_month", "=", data.l_month)
    .andWhere("l_year", "=", data.l_year)
    .first();

  if (!existingLecture) {
    try {
      const newLecture = {
        l_tt_id: data.timetable_id,
        l_day_id: data.day_id,
        course_unit_id: data2[0].c_unit_id,
        date,
        l_date: data.l_date,
        l_month: data.l_month,
        l_year: data.l_year,
        has_started: data.started,
        lecture_mode: data.lectureMode,
        lecture_link: data.link,
        meeting_id: data.meetingId,
        passcode: data.passcode,
        started_at: new Date().toLocaleTimeString(),
      };
      await database("lectures").insert(newLecture);
      console.log("Lecture added successfully");
      const lecture = await database("lectures")
        .select("*")
        .where({
          course_unit_id: data.lecture_id,
          l_year: data.l_year,
          date,
        })
        .first();

      return lecture;
    } catch (err) {
      console.error("Error adding lecture", err);
    }
  } else {
    return existingLecture;
  }
}

async function updateLectureMembers(data, data2, members, date) {
  const lectureData = await database("lectures")
    .where({
      l_tt_id: data.timetable_id,
      l_date: data.l_date,
      l_month: data.l_month,
      l_year: data.l_year,
    })
    .first();

  if (!lectureData) return;

  const updateMembers = async (member) => {
    if (member.room !== `${data2[0].c_unit_id}`) return;
    if (member.role === "Student") return;

    member.status = "true";
    let memberData = await database("lecture_members")
      .where({ member_id: member.id, lecture_id: member.room, date: date })
      .first();
    if (!memberData) {
      await addMember(
        member.id,
        data.day_id,
        date,
        data2[0].c_unit_id,
        1,
        0,
        new Date().toLocaleTimeString()
      );
    }
    // const updatedMembersList = await database("lecture_members")
    //   .join("users", "lecture_members.member_id", "=", "users.stu_no")
    //   .select("*")
    //   .where({ lecture_id: data.lecture_id, day_id: data.day_id, date: date });

    // io.in(`${room}`).emit("updatedMembersList", updatedMembersList);
  };

  await Promise.all(members.map(updateMembers));

  if (data.lectureMode == 1) {
    let memberData = await database("lecture_members")
      .where({
        member_id: data.stu_no,
        lecture_id: data.lecture_id,
        date: date,
      })
      .first();
    if (!memberData) {
      await addMember(
        data.stu_no,
        data.day_id,
        date,
        data.lecture_id,
        1,
        1,
        new Date().toLocaleTimeString()
      );
    }
  }
  const updatedMembersList = await database("lecture_members")
    .join("users", "lecture_members.member_id", "=", "users.stu_no")
    .select(
      "users.id",
      "lecture_members.*",
      "users.userfull_name",
      "users.username",
      "users.token",
      "users.role",
      "users.stu_no"
    )
    .where({ lecture_id: data.lecture_id, day_id: data.day_id, date: date });

  return updatedMembersList;
}

async function getLectureDetails(data, date) {
  const myData = await database
    .from("lecture_timetable")
    .where("day_id", "=", data.day_id)
    .andWhere("lecture_timetable.tt_id", "=", data.timetable_id)
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
    .join(
      "stu_selected_course_units",
      "lecture_timetable.c_unit_id",
      "=",
      "stu_selected_course_units.course_id"
    )
    .leftJoin("lectures", function () {
      this.on("lecture_timetable.tt_id", "=", "lectures.l_tt_id")
        .andOn("lectures.l_year", "=", parseInt(new Date().getFullYear()))
        .andOn("lectures.l_month", "=", parseInt(new Date().getMonth() + 1))
        .andOn("lectures.l_date", "=", parseInt(new Date().getDate()));
    })
    // .where("lectures.date", "=", req.body.date)
    .andWhere("lecture_timetable.c_unit_id", "=", data.lecture_id)
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
    );

  let lectureDetails = [];

  const fetchData = myData.map(async (lecture, index) => {
    const classRepInfo = await database
      .select("*")
      .from("users")
      .join("class_reps", "users.stu_no", "=", "class_reps.class_rep_id")
      .where("class_reps.for_wc_cu", "=", data.lecture_id);

    lectureDetails.push({ ...lecture, classRepInfo });
  });

  await Promise.all(fetchData);

  const sortedAsc = lectureDetails.sort((objA, objB) =>
    moment(objA.start_time, "h:mmA").diff(moment(objB.start_time, "h:mmA"))
  );

  let finalArr = [];

  sortedAsc.map((l) => {
    finalArr.push({
      ...l,
      fullSelectedDate: date,
    });
  });

  return [{ ...finalArr[0] }];
}

const getStudentGateStatus2de = async (stuNo) => {
  const d = new Date();
  const date = d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();

  const data3 = await database
    .select("*")
    .from("students_biodata")
    .join("stu_signin", "students_biodata.stdno", "=", "stu_signin.stu_id")
    .where("students_biodata.stdno", "=", stuNo)
    .andWhere("stu_signin.signin_date", "=", date);

  let todaysStatus;

  if (data3.length > 0) {
    if (data3[data3.length - 1].signout_time !== null) {
      todaysStatus = "not new";
    } else {
      todaysStatus = true;
    }
  } else {
    const data2 = await database.select("*").from("students_biodata").where({
      stdno: stuNo,
    });

    if (data2[0]) {
      todaysStatus = false;
    } else {
      todaysStatus = "invalid";
    }
  }

  return todaysStatus;
};
