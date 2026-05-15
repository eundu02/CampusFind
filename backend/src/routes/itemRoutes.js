const express = require("express");
const pool = require("../config/db");

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Items
 *   description: 분실물/습득물 게시글 API
 */

/**
 * @swagger
 * /api/items:
 *   post:
 *     summary: 분실물/습득물 게시글 등록
 *     description: 게시글 정보, 위치 좌표, 이미지 정보를 DB에 저장합니다.
 *     tags: [Items]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - author_id
 *               - category_id
 *               - building_id
 *               - type
 *               - title
 *               - latitude
 *               - longitude
 *             properties:
 *               author_id:
 *                 type: integer
 *                 example: 1
 *               category_id:
 *                 type: integer
 *                 example: 1
 *               building_id:
 *                 type: integer
 *                 example: 1
 *               type:
 *                 type: string
 *                 example: LOST
 *               title:
 *                 type: string
 *                 example: 검은색 지갑을 잃어버렸습니다
 *               description:
 *                 type: string
 *                 example: 학생회관 근처에서 잃어버렸습니다.
 *               location_detail:
 *                 type: string
 *                 example: 학생회관 1층 로비
 *               latitude:
 *                 type: number
 *                 example: 35.8622
 *               longitude:
 *                 type: number
 *                 example: 129.1951
 *               reward_amount:
 *                 type: integer
 *                 example: 10000
 *               images:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     storage_url:
 *                       type: string
 *                       example: https://res.cloudinary.com/example/image/upload/example.jpg
 *                     public_id:
 *                       type: string
 *                       example: campusfind/items/example
 *                     order_index:
 *                       type: integer
 *                       example: 0
 *     responses:
 *       201:
 *         description: 게시글 등록 성공
 *       400:
 *         description: 필수값 누락
 *       500:
 *         description: 서버 오류
 */
router.post("/", async (req, res) => {
  const client = await pool.connect();

  try {
    const {
      author_id,
      category_id,
      building_id,
      type,
      title,
      description,
      location_detail,
      latitude,
      longitude,
      reward_amount = 0,
      images = [],
    } = req.body;

    if (
      !author_id ||
      !category_id ||
      !building_id ||
      !type ||
      !title ||
      latitude === undefined ||
      longitude === undefined
    ) {
      return res.status(400).json({
        message: "필수 입력값이 누락되었습니다.",
      });
    }

    await client.query("BEGIN");

    const itemResult = await client.query(
      `
      INSERT INTO items (
        author_id,
        category_id,
        building_id,
        type,
        title,
        description,
        location_detail,
        location,
        reward_amount
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        ST_GeogFromText($8),
        $9
      )
      RETURNING id, title, type, status, created_at
      `,
      [
        author_id,
        category_id,
        building_id,
        type,
        title,
        description,
        location_detail,
        `POINT(${longitude} ${latitude})`,
        reward_amount,
      ]
    );

    const item = itemResult.rows[0];

    const savedImages = [];

    for (const image of images) {
      const imageResult = await client.query(
        `
        INSERT INTO item_images (
          item_id,
          storage_url,
          public_id,
          order_index
        )
        VALUES ($1, $2, $3, $4)
        RETURNING id, storage_url, public_id, order_index, created_at
        `,
        [
          item.id,
          image.storage_url,
          image.public_id,
          image.order_index ?? 0,
        ]
      );

      savedImages.push(imageResult.rows[0]);
    }

    await client.query("COMMIT");

    res.status(201).json({
      message: "게시글 등록 성공",
      item,
      images: savedImages,
    });
  } catch (error) {
    await client.query("ROLLBACK");

    console.error("게시글 등록 실패:", error);

    res.status(500).json({
      message: "게시글 등록 실패",
      error: error.message,
    });
  } finally {
    client.release();
  }
});

module.exports = router;