const express = require("express");
const pool = require("./config/db");

const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("./config/swagger");

const imageRoutes = require("./routes/imageRoutes");
const itemRoutes = require("./routes/itemRoutes");
const buildingRoutes = require("./routes/buildingRoutes");

const app = express();

app.use(express.json());

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use("/api/images", imageRoutes);
app.use("/api/items", itemRoutes);
app.use("/api/buildings", buildingRoutes);

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
