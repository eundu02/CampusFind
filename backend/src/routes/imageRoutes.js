const express = require("express");
const upload = require("../middlewares/upload");

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Images
 *   description: 이미지 업로드 API
 */

/**
 * @swagger
 * /api/images/upload:
 *   post:
 *     summary: 이미지 업로드
 *     description: Cloudinary에 이미지 파일을 업로드하고 업로드 결과 URL과 public_id를 반환합니다.
 *     tags: [Images]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               images:
 *                 type: array
 *                 description: 업로드할 이미지 파일 목록, 최대 5장
 *                 items:
 *                   type: string
 *                   format: binary
 *     responses:
 *       201:
 *         description: 이미지 업로드 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: 이미지 업로드 성공
 *                 images:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       storage_url:
 *                         type: string
 *                         example: https://res.cloudinary.com/de9fnsvbf/image/upload/v123/campusfind/items/example.jpg
 *                       public_id:
 *                         type: string
 *                         example: campusfind/items/example
 *                       order_index:
 *                         type: integer
 *                         example: 0
 *       500:
 *         description: 이미지 업로드 실패
 */
router.post("/upload", upload.array("images", 5), (req, res) => {
  try {
    const images = req.files.map((file, index) => ({
      storage_url: file.path,
      public_id: file.filename,
      order_index: index,
    }));

    res.status(201).json({
      message: "이미지 업로드 성공",
      images,
    });
  } catch (error) {
    res.status(500).json({
      message: "이미지 업로드 실패",
      error: error.message,
    });
  }
});

module.exports = router;