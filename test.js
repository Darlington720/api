const { convertDateFormat } = require("./convertDateFormat");
const { database } = require("./config");

function generateWeeksAndDatesInMonth(year, month) {
  const weeks = [];
  const firstDayOfMonth = new Date(year, month - 1, 1);
  const lastDayOfMonth = new Date(year, month, 0);

  let currentWeek = [];
  let currentDate = new Date(firstDayOfMonth);

  while (currentDate <= lastDayOfMonth) {
    currentWeek.push(
      convertDateFormat(new Date(currentDate).toLocaleDateString())
    );

    if (currentDate.getDay() === 6) {
      // Saturday
      weeks.push([...currentWeek]);
      currentWeek = [];
    }

    currentDate.setDate(currentDate.getDate() + 1);
  }

  if (currentWeek.length > 0) {
    weeks.push([...currentWeek]);
  }

  return weeks;
}

// Example usage
const year = 2023;
const month = 8; // August

const weeksAndDatesInMonth = generateWeeksAndDatesInMonth(year, month);

// console.log(weeksAndDatesInMonth);

const startYear = 2023;
const startMonth = 1;

let data = [];

function generateFormattedNumber(number) {
  const year = new Date().getFullYear();
  const formattedNumber = `23${number.toString().padStart(4, "0")}`;
  return formattedNumber;
}

for (let i = 1; i <= 2600; i++) {
  const formattedNumber = generateFormattedNumber(i);
  data.push(formattedNumber);
}

const fieldsToInsert = data.map((field) => ({
  department: field,
}));

console.log("final result", fieldsToInsert);

try {
  database("staff")
    .insert(fieldsToInsert)
    .then((result) => {
      console.log("result", result);
    });
} catch (error) {
  console.log("error", error);
}
