var moment = require("moment");

// var m = moment("2022-08-08", "YYYY-MM--DD");

// // m.add(2, "h");

// var m2 = moment("2022-08-8", "YYYY-MM--DD");
// // moment("2010-10-20").isBefore("2010-10-21");
// console.log(moment.duration(m2.diff(m))._data);
// // console.log(m2.is);

// console.log(m2.toString());

// var stu_id = "hfhfhdghxgh cghghjhdghdgh2100101531";

// var enhanced = stu_id.replace("http://", "");

// var enhanced2 = stu_id.replace(/[^\d]+/g, "");

// console.log(stu_id);
// console.log("Enhanced2", enhanced2);

// var a = moment("11:31:04PM", "h:mm:ssA");
// var b = moment("4:50:41PM", "h:mm:ssA");

// const result = b.diff(a, "minutes");

// console.log("result =", result);
// const result2 = b.diff(a);
// console.log("result2 =", moment.duration(result2).humanize());

const arrayOfObjects = [
  {
    stdno: '"2200100540"',
    regno: '"2022/AUG/HCBM/C231025/DAY/KLA"',
    accesscode: '"2200100540"',
    name: '"KUNGU ABDULRWAHUMAN"',
    sex: '"M"',
  },
  {
    stdno: '"2200100540"',
    regno: '"2022/AUG/HCBM/C231025/DAY/KLA"',
    accesscode: '"2200100540"',
    name: '"KUNGU ABDULRWAHUMAN"',
    sex: '"M"',
  },
];

const modifiedArray = arrayOfObjects.map((obj) => {
  const newObj = {};
  for (const key in obj) {
    newObj[key] = obj[key].replace(/"/g, "");
  }
  return newObj;
});

// console.log(modifiedArray[0].name);
/* Output:
[
  { stdno: '2200100540', regno: '2022/AUG/HCBM/C231025/DAY/KLA', accesscode: '2200100540', name: 'KUNGU ABDULRWAHUMAN', sex: 'M' },
  { stdno: '2200100540', regno: '2022/AUG/HCBM/C231025/DAY/KLA', accesscode: '2200100540', name: 'KUNGU ABDULRWAHUMAN', sex: 'M' }
]
*/
