const baseIp = "localhost";
const knex = require("knex");
const port = 9400;

const db = knex({
  client: "mysql",
  connection: {
    host: "127.0.0.1",
    user: "root",
    password: "",
    database: "university",
  },
});

module.exports = {
  baseIp,
  port,
  db,
};
