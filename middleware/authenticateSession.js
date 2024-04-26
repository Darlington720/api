const { database, baseIp, port } = require("../config");

const authenticateSession = async (req, res, next) => {
  const { session_token } = req.headers;

  // console.log("token from header", session_token);

  if (!session_token) {
    return res.status(500).send({
      success: false,
      result: "You are not authorized to perform this!!!",
    });
  }

  //check to see if the session token is valid

  try {
    const active_token = await database
      .select("*")
      .from("active_user_session")
      .where({
        token: session_token,
      })
      .first();

    // console.log("acuive token", active_token);

    if (active_token) {
      next();
    } else {
      // Session token is invalid, return 401 Unauthorized
      //   res.sendStatus(401);
      return res.status(401).send({
        success: false,
        result: "your session is expired, please logout and login again",
      });
    }
  } catch (error) {
    return res.sendStatus(500);
  }
};

module.exports = authenticateSession;
