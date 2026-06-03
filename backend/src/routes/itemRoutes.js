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
 *         description: 게시글 등록 실패
 */
router.post("/", async (req, res) => {
  const client = await pool.connect();

  try {
    const {
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

    const author_id = req.user.id;

    if (
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
      RETURNING
        id,
        author_id,
        category_id,
        building_id,
        type,
        title,
        description,
        location_detail,
        ST_Y(location::geometry) AS latitude,
        ST_X(location::geometry) AS longitude,
        reward_amount,
        status,
        created_at,
        updated_at
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
        RETURNING
          id,
          item_id,
          storage_url,
          public_id,
          order_index,
          created_at
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

/**
 * @swagger
 * /api/items:
 *   get:
 *     summary: 게시글 목록 조회
 *     description: 게시글 목록을 최신순으로 조회합니다. 대표 이미지, 카테고리명, 건물명, 좌표를 함께 반환합니다.
 *     tags: [Items]
 *     parameters:
 *       - in: query
 *         name: type
 *         required: false
 *         schema:
 *           type: string
 *           enum: [LOST, FOUND]
 *           example: LOST
 *         description: 분실물/습득물 유형
 *       - in: query
 *         name: status
 *         required: false
 *         schema:
 *           type: string
 *           enum: [OPEN, MATCHED, RETURNED]
 *           example: OPEN
 *         description: 게시글 상태
 *       - in: query
 *         name: category_id
 *         required: false
 *         schema:
 *           type: integer
 *           example: 2
 *         description: 카테고리 ID
 *       - in: query
 *         name: building_id
 *         required: false
 *         schema:
 *           type: integer
 *           example: 1
 *         description: 건물 ID
 *       - in: query
 *         name: keyword
 *         required: false
 *         schema:
 *           type: string
 *           example: 에어팟
 *         description: 제목 또는 설명 검색어
 *       - in: query
 *         name: has_reward
 *         required: false
 *         schema:
 *           type: boolean
 *           example: true
 *         description: 사례금 입력 여부
 *     responses:
 *       200:
 *         description: 게시글 목록 조회 성공
 *       500:
 *         description: 게시글 목록 조회 실패
 */
router.get("/", async (req, res) => {
  try {
    const {
      type,
      status,
      category_id,
      building_id,
      keyword,
      has_reward,
    } = req.query;

    const allowedTypes = ["LOST", "FOUND"];
    const allowedStatuses = ["OPEN", "MATCHED", "RETURNED"];
    const whereClauses = [];
    const values = [];

    if (type !== undefined) {
      if (!allowedTypes.includes(type)) {
        return res.status(400).json({
          message: "type은 LOST 또는 FOUND만 가능합니다.",
        });
      }

      values.push(type);
      whereClauses.push(`i.type = $${values.length}`);
    }

    if (status !== undefined) {
      if (!allowedStatuses.includes(status)) {
        return res.status(400).json({
          message: "status는 OPEN, MATCHED, RETURNED만 가능합니다.",
        });
      }

      values.push(status);
      whereClauses.push(`i.status = $${values.length}`);
    }

    if (category_id !== undefined) {
      const categoryId = Number(category_id);

      if (!Number.isInteger(categoryId) || categoryId <= 0) {
        return res.status(400).json({
          message: "category_id는 1 이상의 정수여야 합니다.",
        });
      }

      values.push(categoryId);
      whereClauses.push(`i.category_id = $${values.length}`);
    }

    if (building_id !== undefined) {
      const buildingId = Number(building_id);

      if (!Number.isInteger(buildingId) || buildingId <= 0) {
        return res.status(400).json({
          message: "building_id는 1 이상의 정수여야 합니다.",
        });
      }

      values.push(buildingId);
      whereClauses.push(`i.building_id = $${values.length}`);
    }

    if (keyword !== undefined && String(keyword).trim()) {
      const keywordValue = String(keyword).trim();

      values.push(keywordValue);
      const titleParamIndex = values.length;
      values.push(keywordValue);
      const descriptionParamIndex = values.length;

      whereClauses.push(
        `(i.title ILIKE '%' || $${titleParamIndex} || '%' OR i.description ILIKE '%' || $${descriptionParamIndex} || '%')`
      );
    }

    if (has_reward !== undefined) {
      const hasRewardValue = String(has_reward);

      if (!["true", "false"].includes(hasRewardValue)) {
        return res.status(400).json({
          message: "has_reward는 true 또는 false만 가능합니다.",
        });
      }

      if (hasRewardValue === "true") {
        whereClauses.push("i.reward_amount > 0");
      } else {
        whereClauses.push("(i.reward_amount IS NULL OR i.reward_amount = 0)");
      }
    }

    const whereSql =
      whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

    const result = await pool.query(`
      SELECT
        i.id,
        i.type,
        i.title,
        i.description,
        i.location_detail,
        i.reward_amount,
        i.status,
        i.created_at,
        i.updated_at,
        u.nickname AS author_nickname,
        c.name AS category_name,
        b.name AS building_name,
        ST_Y(i.location::geometry) AS latitude,
        ST_X(i.location::geometry) AS longitude,
        (
          SELECT ii.storage_url
          FROM item_images ii
          WHERE ii.item_id = i.id
          ORDER BY ii.order_index ASC
          LIMIT 1
        ) AS thumbnail_url
      FROM items i
      JOIN users u ON i.author_id = u.id
      JOIN categories c ON i.category_id = c.id
      JOIN buildings b ON i.building_id = b.id
      ${whereSql}
      ORDER BY i.created_at DESC
    `, values);

    res.status(200).json({
      message: "게시글 목록 조회 성공",
      items: result.rows,
    });
  } catch (error) {
    console.error("게시글 목록 조회 실패:", error);

    res.status(500).json({
      message: "게시글 목록 조회 실패",
      error: error.message,
    });
  }
});

/**
 * @swagger
 * /api/items/nearby:
 *   get:
 *     summary: 위치 기반 반경 검색
 *     description: 기준 좌표와 반경을 받아 반경 안의 게시글을 거리순으로 조회합니다.
 *     tags: [Items]
 *     parameters:
 *       - in: query
 *         name: latitude
 *         required: true
 *         schema:
 *           type: number
 *           example: 35.8622
 *         description: 기준 위도
 *       - in: query
 *         name: longitude
 *         required: true
 *         schema:
 *           type: number
 *           example: 129.1951
 *         description: 기준 경도
 *       - in: query
 *         name: radius
 *         required: true
 *         schema:
 *           type: number
 *           example: 500
 *         description: 검색 반경(미터)
 *     responses:
 *       200:
 *         description: 위치 기반 반경 검색 성공
 *       400:
 *         description: 필수 query 값 누락 또는 잘못된 값
 *       500:
 *         description: 위치 기반 반경 검색 실패
 */
router.get("/nearby", async (req, res) => {
  try {
    const { latitude, longitude, radius } = req.query;

    if (
      latitude === undefined ||
      longitude === undefined ||
      radius === undefined
    ) {
      return res.status(400).json({
        message: "latitude, longitude, radius query 값이 필요합니다.",
      });
    }

    const latitudeNumber = Number(latitude);
    const longitudeNumber = Number(longitude);
    const radiusNumber = Number(radius);

    if (
      Number.isNaN(latitudeNumber) ||
      Number.isNaN(longitudeNumber) ||
      Number.isNaN(radiusNumber)
    ) {
      return res.status(400).json({
        message: "latitude, longitude, radius는 숫자여야 합니다.",
      });
    }

    if (
      latitudeNumber < -90 ||
      latitudeNumber > 90 ||
      longitudeNumber < -180 ||
      longitudeNumber > 180 ||
      radiusNumber <= 0
    ) {
      return res.status(400).json({
        message:
          "latitude는 -90~90, longitude는 -180~180, radius는 0보다 큰 값이어야 합니다.",
      });
    }

    const result = await pool.query(
      `
      WITH search_point AS (
        SELECT ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography AS point
      )
      SELECT
        i.id,
        i.type,
        i.title,
        i.description,
        i.location_detail,
        i.reward_amount,
        i.status,
        i.created_at,
        i.updated_at,
        u.nickname AS author_nickname,
        c.name AS category_name,
        b.name AS building_name,
        ST_Y(i.location::geometry) AS latitude,
        ST_X(i.location::geometry) AS longitude,
        ST_Distance(i.location, sp.point) AS distance_meter,
        (
          SELECT ii.storage_url
          FROM item_images ii
          WHERE ii.item_id = i.id
          ORDER BY ii.order_index ASC
          LIMIT 1
        ) AS thumbnail_url
      FROM items i
      JOIN users u ON i.author_id = u.id
      JOIN categories c ON i.category_id = c.id
      JOIN buildings b ON i.building_id = b.id
      CROSS JOIN search_point sp
      WHERE ST_DWithin(i.location, sp.point, $3)
      ORDER BY distance_meter ASC
      `,
      [latitudeNumber, longitudeNumber, radiusNumber]
    );

    res.status(200).json({
      message: "위치 기반 반경 검색 성공",
      items: result.rows,
    });
  } catch (error) {
    console.error("위치 기반 반경 검색 실패:", error);

    res.status(500).json({
      message: "위치 기반 반경 검색 실패",
      error: error.message,
    });
  }
});

/**
 * @swagger
 * /api/items/{id}:
 *   patch:
 *     summary: 게시글 수정
 *     description: 요청 body의 author_id로 작성자 본인 여부를 확인한 뒤 게시글 정보를 수정합니다. 좌표 수정 시 latitude와 longitude를 함께 전달해야 합니다.
 *     tags: [Items]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: 게시글 ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - author_id
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
 *                 enum: [LOST, FOUND]
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
 *               status:
 *                 type: string
 *                 enum: [OPEN, MATCHED, RETURNED]
 *                 example: OPEN
 *     responses:
 *       200:
 *         description: 게시글 수정 성공
 *       400:
 *         description: 잘못된 요청 또는 수정 값 누락
 *       403:
 *         description: 작성자 본인이 아님
 *       404:
 *         description: 게시글을 찾을 수 없음
 *       500:
 *         description: 게시글 수정 실패
 */
router.patch("/:id", async (req, res) => {
  try {
    const itemId = Number(req.params.id);
    const {
      category_id,
      building_id,
      type,
      title,
      description,
      location_detail,
      latitude,
      longitude,
      reward_amount,
      status,
    } = req.body;

    if (!Number.isInteger(itemId) || itemId <= 0) {
      return res.status(400).json({
        message: "id는 1 이상의 정수여야 합니다.",
      });
    }

    const authorId = Number(req.user.id);

    if (
      (latitude === undefined && longitude !== undefined) ||
      (latitude !== undefined && longitude === undefined)
    ) {
      return res.status(400).json({
        message: "latitude와 longitude는 함께 입력해야 합니다.",
      });
    }

    const allowedTypes = ["LOST", "FOUND"];
    const allowedStatuses = ["OPEN", "MATCHED", "RETURNED"];

    if (type !== undefined && !allowedTypes.includes(type)) {
      return res.status(400).json({
        message: "type은 LOST 또는 FOUND만 가능합니다.",
      });
    }

    if (status !== undefined && !allowedStatuses.includes(status)) {
      return res.status(400).json({
        message: "status는 OPEN, MATCHED, RETURNED만 가능합니다.",
      });
    }

    if (latitude !== undefined && longitude !== undefined) {
      const latitudeNumber = Number(latitude);
      const longitudeNumber = Number(longitude);

      if (
        Number.isNaN(latitudeNumber) ||
        Number.isNaN(longitudeNumber) ||
        latitudeNumber < -90 ||
        latitudeNumber > 90 ||
        longitudeNumber < -180 ||
        longitudeNumber > 180
      ) {
        return res.status(400).json({
          message: "latitude 또는 longitude 값이 올바르지 않습니다.",
        });
      }
    }

    const itemResult = await pool.query(
      `
      SELECT id, author_id
      FROM items
      WHERE id = $1
      `,
      [itemId]
    );

    if (itemResult.rows.length === 0) {
      return res.status(404).json({
        message: "게시글을 찾을 수 없습니다.",
      });
    }

    if (Number(itemResult.rows[0].author_id) !== authorId) {
      return res.status(403).json({
        message: "게시글 작성자만 수정할 수 있습니다.",
      });
    }

    const setClauses = [];
    const values = [];

    const addField = (column, value) => {
      values.push(value);
      setClauses.push(`${column} = $${values.length}`);
    };

    if (category_id !== undefined) addField("category_id", category_id);
    if (building_id !== undefined) addField("building_id", building_id);
    if (type !== undefined) addField("type", type);
    if (title !== undefined) addField("title", title);
    if (description !== undefined) addField("description", description);
    if (location_detail !== undefined) {
      addField("location_detail", location_detail);
    }
    if (reward_amount !== undefined) addField("reward_amount", reward_amount);
    if (status !== undefined) addField("status", status);

    if (latitude !== undefined && longitude !== undefined) {
      values.push(`POINT(${longitude} ${latitude})`);
      setClauses.push(`location = ST_GeogFromText($${values.length})`);
    }

    if (setClauses.length === 0) {
      return res.status(400).json({
        message: "수정할 값을 1개 이상 입력해야 합니다.",
      });
    }

    values.push(itemId);

    const updateResult = await pool.query(
      `
      UPDATE items
      SET
        ${setClauses.join(",\n        ")},
        updated_at = NOW()
      WHERE id = $${values.length}
      RETURNING
        id,
        author_id,
        category_id,
        building_id,
        type,
        title,
        description,
        location_detail,
        ST_Y(location::geometry) AS latitude,
        ST_X(location::geometry) AS longitude,
        reward_amount,
        status,
        created_at,
        updated_at
      `,
      values
    );

    res.status(200).json({
      message: "게시글 수정 성공",
      item: updateResult.rows[0],
    });
  } catch (error) {
    console.error("게시글 수정 실패:", error);

    res.status(500).json({
      message: "게시글 수정 실패",
      error: error.message,
    });
  }
});

/**
 * @swagger
 * /api/items/{id}:
 *   delete:
 *     summary: 게시글 삭제
 *     description: 요청 body의 author_id로 작성자 본인 여부를 확인한 뒤 게시글과 게시글 이미지 정보를 삭제합니다.
 *     tags: [Items]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: 게시글 ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - author_id
 *             properties:
 *               author_id:
 *                 type: integer
 *                 example: 1
 *     responses:
 *       200:
 *         description: 게시글 삭제 성공
 *       400:
 *         description: 잘못된 요청
 *       403:
 *         description: 작성자 본인이 아님
 *       404:
 *         description: 게시글을 찾을 수 없음
 *       409:
 *         description: 연결된 데이터가 있어 삭제할 수 없음
 *       500:
 *         description: 게시글 삭제 실패
 */
router.delete("/:id", async (req, res) => {
  const client = await pool.connect();

  try {
    const itemId = Number(req.params.id);
    const authorId = Number(req.user.id);

    if (!Number.isInteger(itemId) || itemId <= 0) {
      return res.status(400).json({
        message: "id는 1 이상의 정수여야 합니다.",
      });
    }

    await client.query("BEGIN");

    const itemResult = await client.query(
      `
      SELECT id, author_id
      FROM items
      WHERE id = $1
      `,
      [itemId]
    );

    if (itemResult.rows.length === 0) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        message: "게시글을 찾을 수 없습니다.",
      });
    }

    if (Number(itemResult.rows[0].author_id) !== authorId) {
      await client.query("ROLLBACK");

      return res.status(403).json({
        message: "게시글 작성자만 삭제할 수 있습니다.",
      });
    }

    await client.query("DELETE FROM item_images WHERE item_id = $1", [itemId]);

    const deleteResult = await client.query(
      `
      DELETE FROM items
      WHERE id = $1
      RETURNING id
      `,
      [itemId]
    );

    await client.query("COMMIT");

    res.status(200).json({
      message: "게시글 삭제 성공",
      deleted_item_id: deleteResult.rows[0].id,
    });
  } catch (error) {
    await client.query("ROLLBACK");

    if (error.code === "23503") {
      return res.status(409).json({
        message: "연결된 데이터가 있어 게시글을 삭제할 수 없습니다.",
        error: error.message,
      });
    }

    console.error("게시글 삭제 실패:", error);

    res.status(500).json({
      message: "게시글 삭제 실패",
      error: error.message,
    });
  } finally {
    client.release();
  }
});

/**
 * @swagger
 * /api/items/{id}:
 *   get:
 *     summary: 게시글 상세 조회
 *     description: 게시글 상세 정보와 이미지 목록을 조회합니다.
 *     tags: [Items]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: 게시글 ID
 *     responses:
 *       200:
 *         description: 게시글 상세 조회 성공
 *       404:
 *         description: 게시글을 찾을 수 없음
 *       500:
 *         description: 게시글 상세 조회 실패
 */
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const itemResult = await pool.query(
      `
      SELECT
        i.id,
        i.author_id,
        i.category_id,
        i.building_id,
        i.type,
        i.title,
        i.description,
        i.location_detail,
        i.reward_amount,
        i.status,
        i.created_at,
        i.updated_at,
        u.nickname AS author_nickname,
        c.name AS category_name,
        b.name AS building_name,
        ST_Y(i.location::geometry) AS latitude,
        ST_X(i.location::geometry) AS longitude
      FROM items i
      JOIN users u ON i.author_id = u.id
      JOIN categories c ON i.category_id = c.id
      JOIN buildings b ON i.building_id = b.id
      WHERE i.id = $1
      `,
      [id]
    );

    if (itemResult.rows.length === 0) {
      return res.status(404).json({
        message: "게시글을 찾을 수 없습니다.",
      });
    }

    const imageResult = await pool.query(
      `
      SELECT
        id,
        item_id,
        storage_url,
        public_id,
        order_index,
        created_at
      FROM item_images
      WHERE item_id = $1
      ORDER BY order_index ASC
      `,
      [id]
    );

    res.status(200).json({
      message: "게시글 상세 조회 성공",
      item: {
        ...itemResult.rows[0],
        images: imageResult.rows,
      },
    });
  } catch (error) {
    console.error("게시글 상세 조회 실패:", error);

    res.status(500).json({
      message: "게시글 상세 조회 실패",
      error: error.message,
    });
  }
});

module.exports = router;
