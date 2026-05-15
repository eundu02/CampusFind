const express = require("express");
const pool = require("../config/db");

const router = express.Router();

router.get("/db", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW() AS current_time");

    res.status(200).json({
      message: "Supabase PostgreSQL 연결 성공",
      time: result.rows[0].current_time,
    });
  } catch (error) {
    console.error("DB 연결 실패:", error);
    res.status(500).json({
      message: "DB 연결 실패",
      error: error.message,
    });
  }
});

module.exports = router;