function convertDateFormat(inputDate) {
  const parts = inputDate.split("/");
  const year = parts[2];
  const month = parts[0].padStart(2, "0");
  const day = parts[1].padStart(2, "0");

  return `${year}-${month}-${day}`;
}

module.exports = { convertDateFormat };
