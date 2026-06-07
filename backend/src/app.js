const express = require("express");
const cors = require("cors");
const pool = require("./config/db");

const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("./config/swagger");

const imageRoutes = require("./routes/imageRoutes");
const itemRoutes = require("./routes/itemRoutes");
const messageRoutes = require("./routes/messageRoutes");
const buildingRoutes = require("./routes/buildingRoutes");
const authRoutes = require("./routes/authRoutes");
const authMiddleware = require("./middlewares/auth");

const app = express();

app.use(cors({
  origin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
}));
app.use(express.json());

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use("/api/auth", authRoutes);
app.use("/api/buildings", buildingRoutes);
app.use("/api/images", authMiddleware, imageRoutes);

app.use("/api/items", (req, res, next) => {
  if (["POST", "PATCH", "DELETE"].includes(req.method)) {
    return authMiddleware(req, res, next);
  }
  next();
}, itemRoutes);

app.use("/api/images", authMiddleware, imageRoutes);
app.use("/api/rooms", authMiddleware, messageRoutes);

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
