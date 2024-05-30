const baseIp = "localhost";
var knex = require("knex");
const port = 9000;

// const database = knex({
//   client: "mysql",
//   connection: {
//     host: "199.241.139.118",
//     user: "darlington",
//     password: "darlington720",
//     database: "nkumba",
//   },
//   pool: { min: 0, max: 1000 },
//   acquireConnectionTimeout: 120000,
// });

const database = knex({
  client: "mysql",
  connection: {
    host: "localhost",
    user: "root",
    password: "",
    database: "nkumba",
  },
});

const getCurrentSession = async () => {
  const allSessions = await database
    .select("*")
    .from("university_sessions")
    .orderBy("us_id", "desc")
    .limit(1);

  const currentSession = allSessions[0];

  return currentSession;
};

module.exports = {
  baseIp,
  port,
  database,
  getCurrentSession,
};
