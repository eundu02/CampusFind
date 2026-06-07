const express = require("express");
const pool = require("../config/db");

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Messages
 *   description: 쪽지(채팅) API
 */

/**
 * @swagger
 * /api/rooms:
 *   post:
 *     summary: 채팅방 생성
 *     description: 게시글에 대한 채팅방을 생성합니다. 동일한 item_id + sender_id 조합이 존재하면 기존 방을 반환합니다.
 *     tags: [Messages]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - item_id
 *               - sender_id
 *             properties:
 *               item_id:
 *                 type: integer
 *                 example: 1
 *               sender_id:
 *                 type: integer
 *                 example: 2
 *     responses:
 *       201:
 *         description: 채팅방 생성 성공
 *       200:
 *         description: 기존 채팅방 반환
 *       400:
 *         description: 필수 입력값 누락
 *       403:
 *         description: 본인 게시글에 쪽지 불가
 *       404:
 *         description: 게시글을 찾을 수 없음
 *       500:
 *         description: 채팅방 생성 실패
 */
router.post("/", async (req, res) => {
  try {
    const { item_id } = req.body ?? {};
    const senderId = Number(req.user?.id);

    if (!item_id || !Number.isInteger(senderId)) {
      return res.status(400).json({ message: "필수 입력값이 누락되었습니다." });
    }

    const itemResult = await pool.query(
      "SELECT id, author_id FROM items WHERE id = $1",
      [item_id]
    );

    if (itemResult.rows.length === 0) {
      return res.status(404).json({ message: "게시글을 찾을 수 없습니다." });
    }

    const item = itemResult.rows[0];

      return res.status(403).json({ message: "본인 게시글에는 쪽지를 보낼 수 없습니다." });
    }

    const existingRoom = await pool.query(
      "SELECT id FROM message_rooms WHERE item_id = $1 AND contact_id = $2",
      [item_id, senderId]
    );

    if (existingRoom.rows.length > 0) {
      return res.status(200).json({
        message: "기존 채팅방 반환",
        room_id: existingRoom.rows[0].id,
        is_new: false,
      });
    }

    const newRoom = await pool.query(
      `INSERT INTO message_rooms (item_id, author_id, contact_id)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [item_id, item.author_id, senderId]
    );

    res.status(201).json({
      message: "채팅방 생성 성공",
      room_id: newRoom.rows[0].id,
      is_new: true,
    });
  } catch (error) {
    console.error("채팅방 생성 실패:", error);
    res.status(500).json({ message: "채팅방 생성 실패", error: error.message });
  }
});

/**
 * @swagger
 * /api/rooms/unread-count:
 *   get:
 *     summary: 전체 안읽은 메시지 수 조회
 *     description: 내가 수신자인 메시지 중 읽지 않은 전체 개수를 반환합니다.
 *     tags: [Messages]
 *     parameters:
 *       - in: query
 *         name: user_id
 *         required: true
 *         schema:
 *           type: integer
 *           example: 1
 *         description: 사용자 ID
 *     responses:
 *       200:
 *         description: 안읽은 메시지 수 조회 성공
 *       400:
 *         description: 필수 입력값 누락
 *       500:
 *         description: 안읽은 메시지 수 조회 실패
 */
router.get("/unread-count", async (req, res) => {
  try {
    const { user_id } = req.query;

    if (!user_id) {
      return res.status(400).json({ message: "필수 입력값이 누락되었습니다." });
    }

    const result = await pool.query(
      `SELECT COUNT(*) AS unread_count
       FROM messages m
       JOIN message_rooms mr ON m.room_id = mr.id
       WHERE m.is_read = false
         AND m.sender_id != $1
         AND (mr.author_id = $1 OR mr.contact_id = $1)`,
      [user_id]
    );

    res.status(200).json({
      message: "안읽은 메시지 수 조회 성공",
      unread_count: parseInt(result.rows[0].unread_count),
    });
  } catch (error) {
    console.error("안읽은 메시지 수 조회 실패:", error);
    res.status(500).json({ message: "안읽은 메시지 수 조회 실패", error: error.message });
  }
});

/**
 * @swagger
 * /api/rooms:
 *   get:
 *     summary: 내 채팅방 목록 조회
 *     description: 내가 참여한 채팅방 목록을 최신 메시지 순으로 반환합니다. 상대방 닉네임, 마지막 메시지, 안읽은 메시지 수 포함.
 *     tags: [Messages]
 *     parameters:
 *       - in: query
 *         name: user_id
 *         required: true
 *         schema:
 *           type: integer
 *           example: 1
 *         description: 사용자 ID
 *     responses:
 *       200:
 *         description: 채팅방 목록 조회 성공
 *       400:
 *         description: 필수 입력값 누락
 *       500:
 *         description: 채팅방 목록 조회 실패
 */
router.get("/", async (req, res) => {
  try {
    const { user_id } = req.query;

    if (!user_id) {
      return res.status(400).json({ message: "필수 입력값이 누락되었습니다." });
    }

    const result = await pool.query(
      `SELECT
         mr.id,
         mr.item_id,
         mr.author_id,
         mr.contact_id,
         mr.last_message_at,
         mr.created_at,
         i.title AS item_title,
         i.type AS item_type,
         CASE
           WHEN mr.author_id = $1 THEN cu.nickname
           ELSE au.nickname
         END AS other_nickname,
         (
           SELECT content FROM messages
           WHERE room_id = mr.id
           ORDER BY created_at DESC LIMIT 1
         ) AS last_message,
         (
           SELECT COUNT(*) FROM messages
           WHERE room_id = mr.id AND sender_id != $1 AND is_read = false
         ) AS unread_count
       FROM message_rooms mr
       JOIN items i ON mr.item_id = i.id
       JOIN users au ON mr.author_id = au.id
       JOIN users cu ON mr.contact_id = cu.id
       WHERE mr.author_id = $1 OR mr.contact_id = $1
       ORDER BY mr.last_message_at DESC NULLS LAST`,
      [user_id]
    );

    res.status(200).json({
      message: "채팅방 목록 조회 성공",
      rooms: result.rows,
    });
  } catch (error) {
    console.error("채팅방 목록 조회 실패:", error);
    res.status(500).json({ message: "채팅방 목록 조회 실패", error: error.message });
  }
});

/**
 * @swagger
 * /api/rooms/{id}/messages:
 *   get:
 *     summary: 메시지 목록 조회
 *     description: 채팅방의 메시지 목록을 조회합니다. after 파라미터로 특정 시각 이후 메시지만 필터링 가능.
 *     tags: [Messages]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: 채팅방 ID
 *       - in: query
 *         name: user_id
 *         required: true
 *         schema:
 *           type: integer
 *           example: 1
 *         description: 사용자 ID
 *       - in: query
 *         name: after
 *         required: false
 *         schema:
 *           type: string
 *           format: date-time
 *           example: 2025-01-01T00:00:00Z
 *         description: 이 시각 이후 메시지만 반환 (ISO8601)
 *     responses:
 *       200:
 *         description: 메시지 목록 조회 성공
 *       400:
 *         description: 필수 입력값 누락
 *       403:
 *         description: 채팅방 접근 권한 없음
 *       404:
 *         description: 채팅방을 찾을 수 없음
 *       500:
 *         description: 메시지 목록 조회 실패
 */
router.get("/:id/messages", async (req, res) => {
  try {
    const { id } = req.params;
    const { user_id, after } = req.query;

    if (!user_id) {
      return res.status(400).json({ message: "필수 입력값이 누락되었습니다." });
    }

    const roomResult = await pool.query(
      "SELECT id, author_id, contact_id FROM message_rooms WHERE id = $1",
      [id]
    );

    if (roomResult.rows.length === 0) {
      return res.status(404).json({ message: "채팅방을 찾을 수 없습니다." });
    }

    const room = roomResult.rows[0];
    if (Number(room.author_id) !== Number(user_id) && Number(room.contact_id) !== Number(user_id)) {
      return res.status(403).json({ message: "채팅방 접근 권한이 없습니다." });
    }

    let query = `
      SELECT id, room_id, sender_id, content, is_read, created_at
      FROM messages
      WHERE room_id = $1`;
    const params = [id];

    if (after) {
      params.push(after);
      query += ` AND created_at > $${params.length}`;
    }

    query += " ORDER BY created_at ASC";

    const result = await pool.query(query, params);

    res.status(200).json({
      message: "메시지 목록 조회 성공",
      messages: result.rows,
    });
  } catch (error) {
    console.error("메시지 목록 조회 실패:", error);
    res.status(500).json({ message: "메시지 목록 조회 실패", error: error.message });
  }
});

/**
 * @swagger
 * /api/rooms/{id}/messages:
 *   post:
 *     summary: 메시지 전송
 *     description: 채팅방에 메시지를 전송합니다. 전송 후 채팅방의 last_message_at이 갱신됩니다.
 *     tags: [Messages]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: 채팅방 ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - sender_id
 *               - content
 *             properties:
 *               sender_id:
 *                 type: integer
 *                 example: 1
 *               content:
 *                 type: string
 *                 example: 혹시 아직 가지고 계신가요?
 *     responses:
 *       201:
 *         description: 메시지 전송 성공
 *       400:
 *         description: 필수 입력값 누락
 *       403:
 *         description: 채팅방 접근 권한 없음
 *       404:
 *         description: 채팅방을 찾을 수 없음
 *       500:
 *         description: 메시지 전송 실패
 */
router.post("/:id/messages", async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const { content } = req.body ?? {};
    const senderId = Number(req.user?.id);

    if (!Number.isInteger(senderId) || !content) {
      return res.status(400).json({ message: "필수 입력값이 누락되었습니다." });
    }

    const roomResult = await pool.query(
      "SELECT id, author_id, contact_id FROM message_rooms WHERE id = $1",
      [id]
    );

    if (roomResult.rows.length === 0) {
      return res.status(404).json({ message: "채팅방을 찾을 수 없습니다." });
    }

    const room = roomResult.rows[0];

      return res.status(403).json({ message: "채팅방 접근 권한이 없습니다." });
    }

    await client.query("BEGIN");

    const msgResult = await client.query(
      `INSERT INTO messages (room_id, sender_id, content)
       VALUES ($1, $2, $3)
       RETURNING id, sender_id, content, created_at`,
      [id, senderId, content]
    );

    await client.query(
      "UPDATE message_rooms SET last_message_at = NOW() WHERE id = $1",
      [id]
    );

    await client.query("COMMIT");

    res.status(201).json({
      message: "메시지 전송 성공",
      data: msgResult.rows[0],
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("메시지 전송 실패:", error);
    res.status(500).json({ message: "메시지 전송 실패", error: error.message });
  } finally {
    client.release();
  }
});

/**
 * @swagger
 * /api/rooms/{id}/read:
 *   put:
 *     summary: 메시지 읽음 처리
 *     description: 채팅방에서 내가 수신한 메시지를 일괄 읽음 처리합니다.
 *     tags: [Messages]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: 채팅방 ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - user_id
 *             properties:
 *               user_id:
 *                 type: integer
 *                 example: 1
 *     responses:
 *       200:
 *         description: 읽음 처리 성공
 *       400:
 *         description: 필수 입력값 누락
 *       403:
 *         description: 채팅방 접근 권한 없음
 *       404:
 *         description: 채팅방을 찾을 수 없음
 *       500:
 *         description: 읽음 처리 실패
 */
router.put("/:id/read", async (req, res) => {
  try {
    const { id } = req.params;
    const { user_id } = req.body;

    if (!user_id) {
      return res.status(400).json({ message: "필수 입력값이 누락되었습니다." });
    }

    const roomResult = await pool.query(
      "SELECT id, author_id, contact_id FROM message_rooms WHERE id = $1",
      [id]
    );

    if (roomResult.rows.length === 0) {
      return res.status(404).json({ message: "채팅방을 찾을 수 없습니다." });
    }

    const room = roomResult.rows[0];
    if (Number(room.author_id) !== Number(user_id) && Number(room.contact_id) !== Number(user_id)) {
      return res.status(403).json({ message: "채팅방 접근 권한이 없습니다." });
    }

    const result = await pool.query(
      `UPDATE messages
       SET is_read = true
       WHERE room_id = $1 AND sender_id != $2 AND is_read = false`,
      [id, user_id]
    );

    res.status(200).json({
      message: "읽음 처리 성공",
      updated_count: result.rowCount,
    });
  } catch (error) {
    console.error("읽음 처리 실패:", error);
    res.status(500).json({ message: "읽음 처리 실패", error: error.message });
  }
});

module.exports = router;
