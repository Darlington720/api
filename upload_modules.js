const { create } = require("apisauce");
const { database } = require("./config");

const api = create({
  baseURL: "https://student.nkumbauniversity.ac.ug/",
  headers: {
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
      "ai=37396536636639393133393561343262636138393836366261663032643130317C7C6E6B756D6261; as=35653536656266326138623033313137303866303939626434636665663039367C7C31363030313033313333; asc=2114803ac245054b100ee0cfe6d01b3e; ast=b88984e6-e3a9-4e3c-ae1a-14a2da89e499-1685213806; dp=38376432306461312D323436632D343830662D383431642D6437633730373233636335337C7C323032332D30352D32367E323032332D30352D32377E323032332D30352D3238; inst=6E6B756D6261; rt=38376432306461312D323436632D343830662D383431642D643763373037323363633533; st=31363030313033313333; tk=d0e238e83279b8f786a162a39050112841ca8299581e7e99edf68972b8560b9c",
  },
  // You can set other configuration options here, such as headers, timeouts, etc.
});

// api
//   .get("/some-endpoint")
//   .then((response) => {
//     // Handle the API response data
//     console.log(response.data);
//   })
//   .catch((error) => {
//     // Handle any errors that occurred during the API call
//     console.error(error);
//   });

const getModules = async (stdno, study_yr, sem, progcode) =>
  await api.post("/bridge", {
    action: "portal",
    method: "load_modules",
    data: [
      {
        stdno,
        study_yr,
        sem,
        progcode,
        // progvsn: "V2020",
        page: 1,
        start: 0,
        limit: 25,
      },
    ],
    type: "rpc",
    tid: 25,
  });

const getStudents = async (skip, number) => {
  let year;
  let sem;
  let arr = [];

  const allStudents = await database
    .select("stdno", "progcode", "study_yr", "current_sem")
    .limit(number)
    .offset(skip)
    .from("students_biodata")
    .orderBy("stdno");

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
      //   res.send({
      //     allStudents: arr,
      //   });
      //   console.log("the students", arr);
      arr.map((stu) => {
        getModules(stu.stdno, stu.year, stu.sem).then(async (res) => {
          //   console.log(res.data);

          let myCourseUnits = [];

          if (res.data.result.error) {
            console.log("an error on stdno", stu.stdno, res.data.result.error);
            // continue
          } else {
            if (res.data.result.data) {
              res.data.result.data.map((module) => {
                if (module.selected) {
                  myCourseUnits.push(module);
                }
              });
            }

            // console.log(myCourseUnits);

            const existingCategory = await database
              .select("*")
              .from("student_enrollment_categories")
              .where({
                stdno: stu.stdno,
                study_yr: stu.year,
                sem: stu.sem,
              });

            if (existingCategory[0]) {
              return console.log("already have the modules", stu.stdno);
              //   return res.send({
              //     success: true,
              //     message: "already have the modules",
              //   });
            }

            const newCategory = await database(
              "student_enrollment_categories"
            ).insert({
              stdno: stu.stdno,
              study_yr: stu.year,
              sem: stu.sem,
            });

            if (myCourseUnits[0]) {
              const fieldsToInsert = myCourseUnits.map((field, index) => {
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
              console.log("new group inserted", stu.stdno);
            }
          }
        });
      });
    })
    .catch((err) => {
      //   res.send({
      //     error: "Error" + err,
      //   });
      console.log("err", err);
    });
};

getStudents(20, 10);
