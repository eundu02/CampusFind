const express = require("express");
const pool = require("../config/db");

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Buildings
 *   description: 건물 검색 및 위치 조회 API
 */

/**
 * @swagger
 * /api/buildings:
 *   get:
 *     summary: 건물 전체 목록 조회
 *     description: buildings 테이블에 저장된 모든 건물 목록과 좌표를 조회합니다.
 *     tags: [Buildings]
 *     responses:
 *       200:
 *         description: 건물 전체 목록 조회 성공
 *       500:
 *         description: 건물 전체 목록 조회 실패
 */
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        id,
        name,
        latitude::double precision AS latitude,
        longitude::double precision AS longitude
      FROM buildings
      ORDER BY name ASC, id ASC
    `);

    res.status(200).json({
      message: "건물 전체 목록 조회 성공",
      buildings: result.rows,
    });
  } catch (error) {
    console.error("건물 전체 목록 조회 실패:", error);

    res.status(500).json({
      message: "건물 전체 목록 조회 실패",
      error: error.message,
    });
  }
});

/**
 * @swagger
 * /api/buildings/search:
 *   get:
 *     summary: 건물명 검색
 *     description: keyword query로 건물명을 검색하고 건물 좌표를 함께 반환합니다.
 *     tags: [Buildings]
 *     parameters:
 *       - in: query
 *         name: keyword
 *         required: true
 *         schema:
 *           type: string
 *           example: 학생회관
 *         description: 검색할 건물명 키워드
 *     responses:
 *       200:
 *         description: 건물명 검색 성공
 *       400:
 *         description: keyword query 값 누락
 *       500:
 *         description: 건물명 검색 실패
 */
router.get("/search", async (req, res) => {
  try {
    const { keyword } = req.query;

    if (!keyword || !String(keyword).trim()) {
      return res.status(400).json({
        message: "keyword query 값이 필요합니다.",
      });
    }

    const result = await pool.query(
      `
      SELECT
        id,
        name,
        latitude::double precision AS latitude,
        longitude::double precision AS longitude
      FROM buildings
      WHERE name ILIKE '%' || $1 || '%'
      ORDER BY name ASC, id ASC
      `,
      [String(keyword).trim()]
    );

    res.status(200).json({
      message: "건물명 검색 성공",
      buildings: result.rows,
    });
  } catch (error) {
    console.error("건물명 검색 실패:", error);

    res.status(500).json({
      message: "건물명 검색 실패",
      error: error.message,
    });
  }
});

/**
 * @swagger
 * /api/buildings/{id}/location:
 *   get:
 *     summary: 건물 좌표 조회
 *     description: 건물 ID를 기준으로 지도 중심 이동에 사용할 latitude와 longitude를 조회합니다.
 *     tags: [Buildings]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           example: 1
 *         description: 건물 ID
 *     responses:
 *       200:
 *         description: 건물 좌표 조회 성공
 *       400:
 *         description: 잘못된 건물 ID
 *       404:
 *         description: 건물을 찾을 수 없음
 *       500:
 *         description: 건물 좌표 조회 실패
 */
router.get("/:id/location", async (req, res) => {
  try {
    const { id } = req.params;
    const buildingId = Number(id);

    if (!Number.isInteger(buildingId) || buildingId <= 0) {
      return res.status(400).json({
        message: "id는 1 이상의 정수여야 합니다.",
      });
    }

    const result = await pool.query(
      `
      SELECT
        id,
        name,
        latitude::double precision AS latitude,
        longitude::double precision AS longitude
      FROM buildings
      WHERE id = $1
      `,
      [buildingId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "건물을 찾을 수 없습니다.",
      });
    }

    res.status(200).json({
      message: "건물 좌표 조회 성공",
      building: result.rows[0],
    });
  } catch (error) {
    console.error("건물 좌표 조회 실패:", error);

    res.status(500).json({
      message: "건물 좌표 조회 실패",
      error: error.message,
    });
  }
});

module.exports = router;
