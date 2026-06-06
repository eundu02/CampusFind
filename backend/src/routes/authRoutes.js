const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const pool = require("../config/db");
const { sendVerificationCode, verifyCode } = require("../config/emailService");

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: 회원가입/로그인 인증 API
 */

/**
 * @swagger
 * /api/auth/send-code:
 *   post:
 *     summary: 이메일 인증코드 발송
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email:
 *                 type: string
 *                 example: 2021000001@dongguk.ac.kr
 *     responses:
 *       200:
 *         description: 인증코드 발송 성공
 *       400:
 *         description: 이메일 형식 오류 또는 이미 가입된 이메일
 */
router.post("/send-code", async (req, res) => {
  const { email } = req.body;

  if (!email || !email.endsWith("@dongguk.ac.kr")) {
    return res.status(400).json({ message: "동국대 이메일(@dongguk.ac.kr)만 사용 가능합니다." });
  }

  const existing = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
  if (existing.rows.length > 0) {
    return res.status(400).json({ message: "이미 가입된 이메일입니다." });
  }

  try {
    await sendVerificationCode(email);
    res.json({ message: "인증코드가 발송되었습니다." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "이메일 발송에 실패했습니다." });
  }
});

/**
 * @swagger
 * /api/auth/verify-code:
 *   post:
 *     summary: 이메일 인증코드 확인
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, code]
 *             properties:
 *               email:
 *                 type: string
 *               code:
 *                 type: string
 *                 example: "123456"
 *     responses:
 *       200:
 *         description: 인증 성공
 *       400:
 *         description: 인증 실패
 */
router.post("/verify-code", (req, res) => {
  const { email, code } = req.body;

  if (!email || !code) {
    return res.status(400).json({ message: "이메일과 인증코드를 입력해주세요." });
  }

  const result = verifyCode(email, code);
  if (!result.valid) {
    return res.status(400).json({ message: result.reason });
  }

  res.json({ message: "이메일 인증이 완료되었습니다." });
});

/**
 * @swagger
 * /api/auth/signup:
 *   post:
 *     summary: 회원가입
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password, nickname, student_id]
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *               nickname:
 *                 type: string
 *               student_id:
 *                 type: string
 *     responses:
 *       201:
 *         description: 회원가입 성공
 *       400:
 *         description: 입력값 오류 또는 중복
 */
router.post("/signup", async (req, res) => {
  const { email, password, nickname, student_id } = req.body;

  if (!email || !password || !nickname || !student_id) {
    return res.status(400).json({ message: "모든 필드를 입력해주세요." });
  }

  if (!email.endsWith("@dongguk.ac.kr")) {
    return res.status(400).json({ message: "동국대 이메일(@dongguk.ac.kr)만 사용 가능합니다." });
  }

  if (password.length < 8) {
    return res.status(400).json({ message: "비밀번호는 8자 이상이어야 합니다." });
  }

  try {
    const existing = await pool.query(
      "SELECT id FROM users WHERE email = $1 OR student_id = $2 OR nickname = $3",
      [email, student_id, nickname]
    );
    if (existing.rows.length > 0) {
      return res.status(400).json({ message: "이미 사용 중인 이메일, 학번, 또는 닉네임입니다." });
    }

    const password_hash = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO users (email, password_hash, nickname, student_id, email_verified)
       VALUES ($1, $2, $3, $4, true)
       RETURNING id, email, nickname, student_id, created_at`,
      [email, password_hash, nickname, student_id]
    );

    const user = result.rows[0];
    const token = jwt.sign(
      { id: user.id, email: user.email, nickname: user.nickname },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.status(201).json({ message: "회원가입이 완료되었습니다.", token, user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "서버 오류가 발생했습니다." });
  }
});

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: 로그인
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 example: cms2001a@dongguk.ac.kr
 *               password:
 *                 type: string
 *                 example: "12341234"
 *     responses:
 *       200:
 *         description: 로그인 성공, JWT 토큰 반환
 *       401:
 *         description: 이메일 또는 비밀번호 불일치
 */
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "이메일과 비밀번호를 입력해주세요." });
  }

  try {
    const result = await pool.query(
      "SELECT id, email, nickname, student_id, password_hash FROM users WHERE email = $1 AND is_active = true",
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ message: "이메일 또는 비밀번호가 올바르지 않습니다." });
    }

    const user = result.rows[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
      return res.status(401).json({ message: "이메일 또는 비밀번호가 올바르지 않습니다." });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, nickname: user.nickname },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    const { password_hash, ...userInfo } = user;
    res.json({ message: "로그인 성공", token, user: userInfo });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "서버 오류가 발생했습니다." });
  }
});

module.exports = router;
