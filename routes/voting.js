const express = require("express");
const router = express.Router();
const { database } = require("../config");
const { join } = require("lodash");
const { convertDateFormat } = require("../convertDateFormat");

router.get(`/voters/:campus_id`, (req, res) => {
  const { campus_id } = req.params;
  database
    // .orderBy("id")
    .select(
      "name",
      "stdno",
      "r_time",
      "campus.campus_name",
      "voter_stdno",
      "userfull_name",
      "cam_id"
    )
    .from("voters")
    .leftJoin(
      "students_biodata",
      "voters.voter_stdno",
      "students_biodata.stdno"
    )
    .join("users", "voters.registered_by", "users.id")
    .join("campus", "voters.campus", "campus.campus_name")
    .where("campus.cam_id", "=", campus_id)
    .then((data) => {
      // console.log("result againt", data);
      res.send(data);
    });
});

router.get("/myRegisteredStudents/:user_id", (req, res) => {
  const { user_id } = req.params;
  console.log(user_id);
  const d = new Date();
  const date = d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();

  database("voters")
    .select("*")
    .where({
      registered_by: user_id,
      r_date: date,
    })
    .then((data) => {
      res.send(`${data.length}`);
    });
});

router.get("/law_voter/:studentNo", async (req, res) => {
  const { studentNo } = req.params;
  const userId = 1;
  let regStatus = "Not Registered";
  let currentStudyYr = "";
  let currentSem = "";
  // console.log("number", studentNo);
  const date = new Date();

  const faculty_code = "SLAW";

  // first let's focus on the biodata
  const biodata = await database("students_biodata")
    .where({
      stdno: studentNo,
    })
    .first();

  if (!biodata) {
    return res.status(400).send({
      success: false,
      message: "Unknown Student",
    });
  }

  if (biodata.facultycode != faculty_code) {
    return res.status(400).send({
      success: false,
      message: `${biodata.name} does not belong to LAW school`,
    });
  }

  //current election category
  const currentElection = await database("election_categories")
    .orderBy("id", "desc")
    .limit(1)
    .first();

  // student enrollment
  const allSessions = await database
    .select("*")
    .from("university_sessions")
    .orderBy("us_id", "desc")
    .limit(1);

  const currentSession = allSessions[0];

  // console.log("current session", currentSession)

  const studentEnrollmentForTheCurrentSession = await database
    .select("*")
    .from("student_enrollment")
    .where({
      stu_no: studentNo,
      sem_half: currentSession.session_sem,
      year: currentSession.session_year,
    });

  // console.log("student enrollment", studentEnrollmentForTheCurrentSession)

  // invoices
  const payment_percentages = await database("student_paid_fess").where({
    stu_no: studentNo,
  });

  payment_percentages.sort((a, b) => {
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

  let last_payment = payment_percentages[payment_percentages.length - 1];
  if (!studentEnrollmentForTheCurrentSession[0]) {
    if (last_payment) {
      if (parseInt(last_payment.paid_percentage) < 100) {
        regStatus = "Not Registered";
      } else if (parseInt(last_payment.paid_percentage) >= 100) {
        regStatus = "Registered";
      }
    }
  }

  if (last_payment) {
    currentStudyYr = last_payment.study_yr;
    currentSem = last_payment.sem;
  } else {
    currentStudyYr = biodata.study_yr;
    currentSem = biodata.sem;
  }

  payment_percentages.map((payment) => {
    if (studentEnrollmentForTheCurrentSession[0]) {
      if (
        payment.study_yr ===
          studentEnrollmentForTheCurrentSession[0].study_yr &&
        payment.sem === studentEnrollmentForTheCurrentSession[0].sem &&
        payment.paid_percentage < 100
      ) {
        regStatus = "Not Registered";
      } else if (
        payment.study_yr ===
          studentEnrollmentForTheCurrentSession[0].study_yr &&
        payment.sem === studentEnrollmentForTheCurrentSession[0].sem &&
        payment.paid_percentage >= 100
      ) {
        regStatus = "Registered";
      } else {
        regStatus = "Not Registered";
      }
    }
    //  else {
    //   if (
    //     payment.paid_percentage < 100
    //   ) {
    //     regStatus = "Not Registered";
    //   } else if (
    //     payment.paid_percentage >= 100
    //   ) {
    //     regStatus = "Registered";
    //   }
    // }
  });

  // if not enrolled, then lets check the sem that he last paid
  // console.log("last payment", payment_percentages[payment_percentages.length - 1])

  // voting status
  const votingStatus = await database("voters").where({
    voter_stdno: studentNo,
    election_category_id: currentElection.id,
  });

  const requiredPercentage = await database
    .select("*")
    .from("constraints")
    .where("c_name", "=", "Voting")
    .first();

  // plus the exemptions
  const exemption = await database("vote_exemptions")
    .where({
      stu_no: studentNo,
    })
    .first();

  res.send({
    success: true,
    result: {
      biodata,
      invoices: payment_percentages,
      registration_status: regStatus,
      alreadyVoted: votingStatus,
      currentStudyYr,
      currentSem,
      requiredPercentage,
      currentElection,
      exemption,
    },
  });
});

router.get("/law_voter/:studentNo", async (req, res) => {
  const { studentNo } = req.params;
  const userId = 1;
  let regStatus = "Not Registered";
  let currentStudyYr = "";
  let currentSem = "";
  // console.log("number", studentNo);
  const date = new Date();
  const faculty_code = "SLAW";

  //current election category
  const currentElection = await database("election_categories")
    .orderBy("id", "desc")
    .limit(1)
    .first();

  // student enrollment
  const allSessions = await database
    .select("*")
    .from("university_sessions")
    .orderBy("us_id", "desc")
    .limit(1);

  const currentSession = allSessions[0];

  // console.log("current session", currentSession)

  const studentEnrollmentForTheCurrentSession = await database
    .select("*")
    .from("student_enrollment")
    .where({
      stu_no: studentNo,
      sem_half: currentSession.session_sem,
      year: currentSession.session_year,
    });

  // console.log("student enrollment", studentEnrollmentForTheCurrentSession)

  // first let's focus on the biodata
  const biodata = await database("students_biodata")
    .where({
      stdno: studentNo,
    })
    .first();

  if (!biodata) {
    return res.status(400).send({
      success: false,
      message: "Unknown Student",
    });
  }

  if (biodata.facultycode != faculty_code) {
    return res.status(400).send({
      success: false,
      message: `${biodata.name} does not belong to LAW school - Belongs to ${biodata.facultycode}`,
    });
  }

  // invoices
  const payment_percentages = await database("student_paid_fess").where({
    stu_no: studentNo,
  });

  payment_percentages.sort((a, b) => {
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

  let last_payment = payment_percentages[payment_percentages.length - 1];
  if (!studentEnrollmentForTheCurrentSession[0]) {
    if (last_payment) {
      if (parseInt(last_payment.paid_percentage) < 100) {
        regStatus = "Not Registered";
      } else if (parseInt(last_payment.paid_percentage) >= 100) {
        regStatus = "Registered";
      }
    }
  }

  if (last_payment) {
    currentStudyYr = last_payment.study_yr;
    currentSem = last_payment.sem;
  } else {
    currentStudyYr = biodata.study_yr;
    currentSem = biodata.sem;
  }

  payment_percentages.map((payment) => {
    if (studentEnrollmentForTheCurrentSession[0]) {
      if (
        payment.study_yr ===
          studentEnrollmentForTheCurrentSession[0].study_yr &&
        payment.sem === studentEnrollmentForTheCurrentSession[0].sem &&
        payment.paid_percentage < 100
      ) {
        regStatus = "Not Registered";
      } else if (
        payment.study_yr ===
          studentEnrollmentForTheCurrentSession[0].study_yr &&
        payment.sem === studentEnrollmentForTheCurrentSession[0].sem &&
        payment.paid_percentage >= 100
      ) {
        regStatus = "Registered";
      } else {
        regStatus = "Not Registered";
      }
    }
    //  else {
    //   if (
    //     payment.paid_percentage < 100
    //   ) {
    //     regStatus = "Not Registered";
    //   } else if (
    //     payment.paid_percentage >= 100
    //   ) {
    //     regStatus = "Registered";
    //   }
    // }
  });

  // if not enrolled, then lets check the sem that he last paid
  // console.log("last payment", payment_percentages[payment_percentages.length - 1])

  // voting status
  const votingStatus = await database("voters").where({
    voter_stdno: studentNo,
    election_category_id: currentElection.id,
  });

  const requiredPercentage = await database
    .select("*")
    .from("constraints")
    .where("c_name", "=", "Voting")
    .first();

  // plus the exemptions
  const exemption = await database("vote_exemptions")
    .where({
      stu_no: studentNo,
    })
    .first();

  res.send({
    success: true,
    result: {
      biodata,
      invoices: payment_percentages,
      registration_status: regStatus,
      alreadyVoted: votingStatus,
      currentStudyYr,
      currentSem,
      requiredPercentage,
      currentElection,
      exemption,
    },
  });
});

router.get("/check_voter/:studentNo", async (req, res) => {
  const { studentNo } = req.params;
  const userId = 1;
  let regStatus = "Not Registered";
  let enrollmentStatus = "";
  let currentStudyYr = "";
  let currentSem = "";
  const currentDate = new Date();
  // console.log("number", studentNo);
  const date = new Date();

  //current election category
  const currentElection = await database("election_categories")
    .orderBy("id", "desc")
    .limit(1)
    .first();

  // console.log("current election", currentElection);

  // student enrollment
  const allSessions = await database
    .select("*")
    .from("university_sessions")
    .orderBy("us_id", "desc")
    .limit(1);

  const currentSession = allSessions[0];

  // console.log("current session", currentSession);

  // first let's focus on the biodata
  const biodata = await database("students_biodata")
    .where({
      stdno: studentNo,
    })
    .first();

  if (!biodata) {
    return res.status(400).send({
      success: false,
      message: "Unknown Student",
    });
  }

  // based on the current session, lets fetch only the invoices in the current session
  // invoices
  const payment_percentages = await database("student_paid_fess").where({
    stu_no: studentNo,
    acc_yr_id: currentSession.acc_yr_id,
    sem_half: currentSession.sem_half,
  });

  // if student has no payment, it means he/she has not yet enrolled
  if (payment_percentages.length == 0) {
    enrollmentStatus = "Not enrolled in current sem";
    regStatus = "Not Registered";

    // lets try to get the prev semesters
    const payment_percentages = await database("student_paid_fess").where({
      stu_no: studentNo,
    });

    // sort the invoices
    payment_percentages.sort((a, b) => {
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

    let last_payment = payment_percentages[payment_percentages.length - 1];

    if (last_payment) {
      currentStudyYr = last_payment.study_yr;
      currentSem = last_payment.sem;
    } else {
      currentStudyYr = biodata.study_yr;
      currentSem = biodata.current_sem;
    }
  } else {
    enrollmentStatus = "Enrolled";
    regStatus = payment_percentages[0].reg_status;
    currentStudyYr = payment_percentages[0].study_yr;
    currentSem = payment_percentages[0].sem;
  }

  // voting status
  const votingStatus = await database("voters").where({
    voter_stdno: studentNo,
    election_category_id: currentElection.id,
    r_date: convertDateFormat(currentDate.toLocaleDateString()),
  });

  const requiredPercentage = await database
    .select("*")
    .from("constraints")
    .where("c_name", "=", "Voting")
    .first();

  // plus the exemptions
  const exemption = await database("vote_exemptions")
    .where({
      stu_no: studentNo,
      date: convertDateFormat(currentDate.toLocaleDateString()),
    })
    .first();

  // console.log("exemptions", exemption);

  res.send({
    success: true,
    result: {
      biodata,
      invoices: payment_percentages,
      registration_status: regStatus,
      enrollmentStatus,
      alreadyVoted: votingStatus,
      currentStudyYr,
      currentSem,
      requiredPercentage,
      currentElection,
      exemption,
    },
  });
});

router.get("/election_statistics/:campus", async (req, res) => {
  const { campus } = req.params;

  const requiredPercentage = await database
    .select("*")
    .from("constraints")
    .where("c_name", "=", "Voting")
    .first();

  //current election category
  const currentElection = await database("election_categories")
    .orderBy("id", "desc")
    .limit(1)
    .first();

  // console.log("current elections", currentElection);

  // university sessions
  const allSessions = await database
    .select("*")
    .from("university_sessions")
    .orderBy("us_id", "desc")
    .limit(1);

  const currentSession = allSessions[0];

  //lets first get the elible voters
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

  // plus the exemptions
  const exemptions = await database("vote_exemptions")
    .where({
      election_category_id: currentElection.id,
      // date: new Date(),
    })
    .count();

  //now let's see the total voters
  const voters = await database("voters")
    .where({
      election_category_id: currentElection.id,
      campus: campus,
    })
    .count();

  res.send({
    success: true,
    result: {
      elligibleVoters: elligibleVoters[0]["count(*)"],
      voters: voters[0]["count(*)"],
      exemptions: exemptions[0]["count(*)"],
    },
  });
});

router.post("/addVoter", async (req, res) => {
  const { studentNo, registered_by, campus, election_cat } = req.body;
  const d = new Date();
  const date = d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
  const time = d.getHours() + ":" + d.getMinutes() + ":" + d.getSeconds();
  //console.log(req.body);

  const currentElection = await database("election_categories")
    .orderBy("id", "desc")
    .limit(1)
    .first();

  try {
    //first checking if voter exists
    const existingVoter = await database("voters")
      .where({
        voter_stdno: studentNo,
        r_date: date,
      })
      .first();

    if (existingVoter) {
      return res
        .status(400)
        .send(
          `Student with student number ${existingVoter.voter_stdno} has already voted`
        );
    }

    // insert the voter
    const insert = await database("voters").insert({
      voter_stdno: studentNo,
      registered_by,
      r_time: time,
      r_date: date,
      campus: campus,
      election_category_id: election_cat,
    });

    const voters = await database("voters")
      .where({
        election_category_id: currentElection.id,
        campus: campus,
      })
      .count();

    // console.log("insert", insert);

    return res.status(200).send({
      success: true,
      result: {
        voters: voters[0]["count(*)"],
      },
      message: "Voter Saved Successfully",
    });
  } catch (error) {
    console.log("error", error);
    res
      .status(500)
      .send(
        "Failed to save the voter, Please head on to the technical support team for help!!! "
      );
  }
});

router.post("/election_categories", async (req, res) => {
  const { acc_yr_id, campus } = req.body;

  const election_categories = await database("elections").where({
    category_id: acc_yr_id,
    campus_id: campus,
  });

  res.send({
    success: true,
    result: {
      election_categories,
    },
  });
});

router.post("/election_contestants", async (req, res) => {
  const { election, campus, school } = req.body;

  // console.log("body", req.body);
  let contestants;

  //current election category
  const currentElection = await database("election_categories")
    .orderBy("id", "desc")
    .limit(1)
    .first();

  // guild presidents
  if (election.position === "guild") {
    contestants = await database("election_contestants")
      .join(
        "students_biodata",
        "election_contestants.stu_no",
        "students_biodata.stdno"
      )
      .leftJoin(
        "election_vote_allocation",
        "election_contestants.stu_no",
        "election_vote_allocation.contestant_id"
      )
      .where("election_contestants.election_id", "=", election.id)
      .select(
        "election_contestants.*",
        "students_biodata.name",
        "election_vote_allocation.total_votes"
      );
  }

  if (election.position === "mp") {
    // console.log("running mp", req.body)
    contestants = await database("election_mp_contestants")
      .join(
        "students_biodata",
        "election_mp_contestants.stu_no",
        "students_biodata.stdno"
      )
      .leftJoin(
        "election_vote_allocation",
        "election_mp_contestants.stu_no",
        "election_vote_allocation.contestant_id"
      )
      .where("election_mp_contestants.election_id", "=", election.id)
      .where({
        school_id: school,
      })
      .select(
        "election_mp_contestants.*",
        "students_biodata.name",
        "election_vote_allocation.total_votes"
      );
  }

  if (election.position === "law_president") {
    // console.log("running law", election)
    contestants = await database("election_mp_contestants")
      .join(
        "students_biodata",
        "election_mp_contestants.stu_no",
        "students_biodata.stdno"
      )
      .leftJoin(
        "election_vote_allocation",
        "election_mp_contestants.stu_no",
        "election_vote_allocation.contestant_id"
      )
      .where("election_mp_contestants.election_id", "=", election.id)
      .where({
        school_id: 3,
      })
      .select(
        "election_mp_contestants.*",
        "students_biodata.name",
        "election_vote_allocation.total_votes"
      );
  }

  //total votes
  const voters = await database("voters")
    .where({
      election_category_id: currentElection.id,
      campus: campus.label,
    })
    .count();

  //invalid votes

  let invalidVotes;
  if (election.position == "guild") {
    invalidVotes = await database("election_invalid_votes")
      .where({
        election_id: election.id,
      })
      .first();
  } else {
    invalidVotes = await database("election_invalid_votes")
      .where({
        election_id: election.id,
        school_id: school,
      })
      .first();
  }

  // console.log("contestants", contestants);

  return res.send({
    success: true,
    result: {
      contestants,
      total_votes: voters[0]["count(*)"],
      invalidVotes:
        typeof invalidVotes !== "undefined" ? invalidVotes : { total: 0 },
    },
  });
});

router.post("/vote_allocations", async (req, res) => {
  const { election, allocations, school } = req.body;

  const studentNos = Object.keys(allocations);

  const x = await studentNos.map(async (stdno) => {
    if (stdno == "invalid_vote") {
      // existing invalid vote
      let existingInvalidVote;

      if (election.position == "guild") {
        existingInvalidVote = await database("election_invalid_votes")
          .where({
            election_id: election.id,
          })
          .first();
      } else {
        existingInvalidVote = await database("election_invalid_votes")
          .where({
            election_id: election.id,
            school_id: school,
          })
          .first();
      }

      if (existingInvalidVote) {
        // update
        if (election.position == "guild") {
          await database("election_invalid_votes")
            .update({
              total: allocations["invalid_vote"],
            })
            .where({
              election_id: election.id,
            });
        } else {
          await database("election_invalid_votes")
            .update({
              total: allocations["invalid_vote"],
              school_id: school,
            })
            .where({
              election_id: election.id,
            });
        }
      } else {
        // insert
        if (election.position == "guild") {
          await database("election_invalid_votes").insert({
            election_id: election.id,
            total: allocations["invalid_vote"],
          });
        } else {
          await database("election_invalid_votes").insert({
            election_id: election.id,
            total: allocations["invalid_vote"],
            school_id: school,
          });
        }
      }
    } else {
      const existingAllocation = await database("election_vote_allocation")
        .where({
          contestant_id: stdno,
        })
        .first();

      if (existingAllocation) {
        // update the data
        await database("election_vote_allocation")
          .update({
            total_votes: allocations[stdno],
          })
          .where({
            id: existingAllocation.id,
          });
      } else {
        // insert the data
        await database("election_vote_allocation").insert({
          election_id: election.id,
          contestant_id: stdno,
          total_votes: allocations[stdno],
        });
      }
    }
  });
  // .filter((field) => field !== null);

  Promise.all(x)
    .then(() => {
      res.send("Successfully saved the votes");
    })
    .catch((err) => {
      res.status(500).send("Error saving the contestants");
    });
});

router.post("/save_vote_exemptions", async (req, res) => {
  const { stu_no, reason, exempted_by } = req.body;

  console.log("the body", req.body);
  const currentDate = new Date();
  const requiredPercentage = await database
    .select("*")
    .from("constraints")
    .where("c_name", "=", "Voting")
    .first();

  //current election category
  const currentElection = await database("election_categories")
    .orderBy("id", "desc")
    .limit(1)
    .first();

  // university sessions
  const allSessions = await database
    .select("*")
    .from("university_sessions")
    .orderBy("us_id", "desc")
    .limit(1);

  const currentSession = allSessions[0];

  // am hardcoding '2' coz the current election is 2023-2024

  // check for existing

  const existingStuExemption = await database("vote_exemptions")
    .where({
      stu_no,
      election_category_id: currentElection.id,
    })
    .first();

  if (existingStuExemption) {
    return res.status(400).send({
      success: false,
      message: "student has already been exempted",
    });
  }

  await database("vote_exemptions").insert({
    stu_no,
    reason,
    election_category_id: currentElection.id,
    exempted_by,
  });

  // return all students that are exempted
  const exemptedStudents = await database("vote_exemptions")
    .join(
      "students_biodata",
      "vote_exemptions.stu_no",
      "students_biodata.stdno"
    )
    .join("users", "vote_exemptions.exempted_by", "users.id")
    .select("vote_exemptions.*", "students_biodata.name", "users.username")
    .where({
      date: convertDateFormat(currentDate.toLocaleDateString()),
    });

  //lets get the elible voters
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
    // .andWhere("students_biodata.campus", "=", campus)
    .andWhere(
      "student_paid_fess.paid_percentage",
      ">=",
      requiredPercentage.c_percentage
    )
    .count();

  res.send({
    success: true,
    result: {
      exemptedStudents,
      elligibleVoters: elligibleVoters[0]["count(*)"],
    },
  });
});

router.get("/exempted_students", async (req, res) => {
  // return all students that are exempted
  const currentDate = new Date();
  const currentElection = await database("election_categories")
    .orderBy("id", "desc")
    .limit(1)
    .first();

  // console.log("exemption", currentElection);

  const exemptedStudents = await database("vote_exemptions")
    .join(
      "students_biodata",
      "vote_exemptions.stu_no",
      "students_biodata.stdno"
    )
    .join("users", "vote_exemptions.exempted_by", "users.id")
    .select("vote_exemptions.*", "students_biodata.name", "users.username")
    .where({
      date: convertDateFormat(currentDate.toLocaleDateString()),
    });

  res.send({
    success: true,
    result: {
      exemptedStudents,
    },
  });
});

router.post("/my_registered_voters", async (req, res) => {
  const { ec_id, campus } = req.body;

  console.log("the body", req.body);
  //current election category
  const currentElection = await database("election_categories")
    .orderBy("id", "desc")
    .limit(1)
    .first();

  //now let's see the total voters
  const voters = await database("voters")
    .where({
      election_category_id: currentElection.id,
      campus: campus,
    })
    .count();

  //now let's see the voters for a specific ec person
  const myVoters = await database("voters")
    .where({
      election_category_id: currentElection.id,
      campus: campus,
      registered_by: ec_id,
    })
    .count();

  res.send({
    success: true,
    result: {
      total_voters: voters[0]["count(*)"],
      myVoters: myVoters[0]["count(*)"],
    },
  });
});

module.exports = router;
