const express = require("express");
const router = express.Router();
const { database } = require("../config");

router.get("/graduation_cards/:acc_yr", async (req, res) => {
  const { acc_yr } = req.params;
  const grad_cards = await database("graduation_cards").where({
    ac_yr: acc_yr,
  });

  res.send({
    success: true,
    result: grad_cards,
  });
});

router.get("/graduation_card_report/:acc_yr", async (req, res) => {
  const { acc_yr } = req.params;
  const grad_cards = await database("graduation_cards")
    .leftJoin(
      "students_biodata",
      "graduation_cards.stu_no",
      "students_biodata.stdno"
    )
    .leftJoin("staff", "graduation_cards.assigned_by", "staff.staff_id")
    .where({
      ac_yr: acc_yr,
      // "graduation_cards.stu_no": "IS NOT NULL",
    })
    .whereNotNull("graduation_cards.stu_no")
    .select(
      "graduation_cards.id",
      "graduation_cards.stu_no",
      "students_biodata.name",
      "graduation_cards.card_no",
      "staff.staff_name",
      "staff.title"
    );

  const total_grad_cards = await database("graduation_cards")
    .where({
      ac_yr: acc_yr,
    })
    .count("* as card_count")
    .first();

  res.send({
    success: true,
    result: {
      cards: grad_cards,
      total_grad_cards: total_grad_cards.card_count,
    },
  });
});

router.get("/student_autocomplete/:query", async (req, res) => {
  const { query } = req.params;

  try {
    const results = await database("students_biodata")
      .where("stdno", "like", `%${query}%`)
      .orWhere("name", "like", `%${query}%`);

    // console.log("results", results);

    const suggestions = results.map((result) => ({
      name: result.name,
      stdno: result.stdno,
      program_level: result.programlevel,
    }));

    res.send({ suggestions });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/save_student_card", async (req, res) => {
  const { stu_no, card_no, assigned_by } = req.body;
  try {
    const existingCard = await database("graduation_cards")
      .where({
        card_no,
      })

      .first();

    const existingStd = await database("graduation_cards")
      .where({
        stu_no,
      })

      .first();

    if (existingCard.stu_no) {
      return res.status(400).send({
        success: false,
        message: `Graduation Card with Number ${card_no} is already assigned to a student`,
      });
    }

    if (existingStd) {
      return res.status(400).send({
        success: false,
        message: `Student is already assigned to a card with number ${existingStd.card_no}. Kindly select another student`,
      });
    }

    const update = await database("graduation_cards")
      .update({
        stu_no,
        assigned_by,
      })
      .where({
        card_no,
      });

    res.send({
      success: true,
      message: `Graduation Card saved successfully`,
    });
  } catch (error) {
    console.log("the error", error);
    res.status(500).send({
      success: false,
      message: "error updating the card",
    });
  }
});
module.exports = router;
