const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

pool.query("SELECT NOW()")
  .then(() => {
    console.log("PostgreSQL 연결 성공");
  })
  .catch((err) => {
    console.error("PostgreSQL 연결 실패", err);
  });

module.exports = pool;
