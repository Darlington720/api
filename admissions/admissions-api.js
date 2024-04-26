const express = require("express");
const fs = require("fs");
const { baseIp, port, db } = require("./config");
const cors = require("cors");
const bodyParser = require("body-parser");
const { sendEmail } = require("./email-otp");

const app = express();

app.use(express.static(__dirname + "/public"));
app.use(bodyParser.json());
app.use(cors());

app.get("/", (req, res) => {
  db.select("*")
    .from("admission-users")
    .then((result) => res.send(result));
});

app.post("/online_applications/auth/user_profile", (req, res) => {
  console.log("Am receiving ", req.body);
  const { email, phoneNo } = req.body;

  //check if the given email exists
  db.select("*")
    .from("admission-users")
    .where({
      email,
      phone_no: phoneNo,
    })
    .then((result) => {
      if (result.length > 0) {
        //check if the given phone number already exists
        // console.log("user", result);

        res.send({
          success: true,
          message: "User data fetched successfully",
          data: {
            surname: result[0].surname,
            other_names: result[0].other_names,
            email: result[0].email,
            phone_no: result[0].phone_no,
            gender: result[0].gender,
            completed: result[0].pwd === null ? false : true,
          },
        });
      } else {
        res.send({
          success: false,
          message: "Invalid User",
        });
      }
    });
});

app.post("/online_applications/auth/register", (req, res) => {
  console.log("Am receiving ", req.body);
  const { surname, otherNames, email, phoneNo, gender } = req.body;

  //check if the given email exists
  db.select("*")
    .from("admission-users")
    .where({
      email,
    })
    .then((result) => {
      if (result.length == 0) {
        //check if the given phone number already exists
        db.select("*")
          .from("admission-users")
          .where({
            phone_no: phoneNo,
          })
          .then(async (result2) => {
            if (result2.length == 0) {
              //we need to send an otp to the user's email and phone number
              const otp = Math.floor(100000 + Math.random() * 900000);
              const time = Date.now();

              try {
                let emailRes = await sendEmail(email, otp).then((result3) => {
                  db("admission-users")
                    .insert({
                      surname,
                      other_names: otherNames,
                      email,
                      phone_no: phoneNo,
                      gender,
                      otp,
                      otp_date_sent: time,
                    })
                    .then((data) => {
                      res.send({
                        success: true,
                        message: `An otp has been sent to ${email} and ${phoneNo}`,
                      });
                    })
                    .catch((err) => {
                      res.status(400).send({
                        success: false,
                        message: "Error in storing user",
                      });

                      console.log("Error", err);
                    });
                });
              } catch (error) {
                res.send({
                  success: false,
                  message: "Failed to send otp",
                });
                console.log("Otp error", error);
              }
            } else {
              res.send({
                success: false,
                message: "A user with a given phone number already exists",
              });
            }
          });
      } else {
        res.send({
          success: false,
          message: "A user with a given email address already exists",
        });
      }
    });
});

app.post("/online_applications/auth/verify_otp", (req, res) => {
  console.log("Am receiving this", req.body);
  const { email, phoneNo, otp } = req.body;

  //check if the user exists
  db.select("*")
    .from("admission-users")
    .where({
      email,
      phone_no: phoneNo,
    })
    .then((result) => {
      if (result.length > 0) {
        //check if the otp is correct
        if (result[0].otp === otp) {
          //Check if the otp is expired
          const OTP_EXPIRATION_TIME_MINUTES = 5;

          // check if the OTP has expired
          if (
            Date.now() - result[0].otp_date_sent >
            OTP_EXPIRATION_TIME_MINUTES * 60 * 1000
          ) {
            // OTP has expired
            // alert("OTP has expired");

            res.send({
              success: false,
              message: "Otp is already expired",
            });
          } else {
            res.send({
              success: true,
              message: "User Verified Successfully",
            });
          }
        } else {
          res.send({
            success: false,
            message: "Invalid OTP",
          });
        }
      } else {
        res.send({
          success: false,
          message: "User not registered",
        });
      }
    });
});

app.put("/online_applications/auth/resend_otp", (req, res) => {
  console.log("Am receiving this", req.body);
  const { email, phoneNo, otp } = req.body;

  //check if otp is correct
  db.select("*")
    .from("admission-users")
    .where({
      email,
      phone_no: phoneNo,
    })
    .then(async (result) => {
      if (result.length > 0) {
        //we need to send an otp to the user's email and phone number
        const otp = Math.floor(100000 + Math.random() * 900000);
        const time = Date.now();

        try {
          let emailRes = await sendEmail(email, otp).then((result3) => {
            db("admission-users")
              .where(function () {
                this.where("email", "=", email);
              })

              .andWhere(function () {
                this.where("phone_no", "=", phoneNo);
              })

              .update({
                otp,
                otp_date_sent: time,
              })
              .then((data) => {
                res.send({
                  success: true,
                  message: `An otp has been sent to ${email} and ${phoneNo}`,
                });
              })
              .catch((err) => {
                res.status(400).send({
                  success: false,
                  message: "Error in storing user",
                });

                console.log("Error", err);
              });
          });
        } catch (error) {
          res.send({
            success: false,
            message: "Failed to send otp",
          });
          console.log("Otp error", error);
        }
      } else {
        res.send({
          success: false,
          message: "User Not registered",
        });
      }
    });
});

app.put("/online_applications/auth/change_pwd", (req, res) => {
  console.log("Am receiving this on change", req.body);
  const { email, phoneNo, pwd } = req.body;

  //check if otp is correct
  db.select("*")
    .from("admission-users")
    .where({
      email,
      phone_no: phoneNo,
    })
    .then(async (result) => {
      if (result.length > 0) {
        //update the user pwd

        db("admission-users")
          .where(function () {
            this.where("email", "=", email);
          })

          .andWhere(function () {
            this.where("phone_no", "=", phoneNo);
          })

          .update({
            pwd,
          })
          .then((data) => {
            res.send({
              success: true,
              message: `User Password Saved successfully`,
            });
          })
          .catch((err) => {
            res.status(400).send({
              success: false,
              message: "Error in storing user pwd",
            });

            console.log("Error", err);
          });
      } else {
        res.send({
          success: false,
          message: "User Not registered",
        });
      }
    });
});

app.listen(port, baseIp, () => console.log(`App is running on port ${port}`));
