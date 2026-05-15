const express = require("express");
const pool = require("./config/db");

const app = express();

app.use(express.json());

app.get("/", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW()");

    res.json({
      message: "DB 연결 성공",
      time: result.rows[0],
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "DB 연결 실패",
      error: error.message,
    });
  }
});

module.exports = app;