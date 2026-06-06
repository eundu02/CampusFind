const nodemailer = require("nodemailer");
require("dotenv").config();

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

// 인증코드 메모리 저장소 { email: { code, expiresAt } }
const verificationCodes = new Map();
const verifiedEmails = new Map();
const VERIFIED_EMAIL_TTL_MS = 10 * 60 * 1000;

function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function sendVerificationCode(email) {
  const code = generateCode();
  const expiresAt = Date.now() + 5 * 60 * 1000; // 5분

  verificationCodes.set(email, { code, expiresAt });

  await transporter.sendMail({
    from: `"CampusFind" <${process.env.GMAIL_USER}>`,
    to: email,
    subject: "[CampusFind] 이메일 인증 코드",
    html: `
      <div style="font-family: sans-serif; max-width: 400px; margin: 0 auto;">
        <h2>이메일 인증</h2>
        <p>아래 인증 코드를 입력해주세요. (5분 이내)</p>
        <div style="font-size: 32px; font-weight: bold; letter-spacing: 8px; text-align: center; padding: 20px; background: #f5f5f5; border-radius: 8px;">
          ${code}
        </div>
      </div>
    `,
  });
}

function verifyCode(email, inputCode) {
  const entry = verificationCodes.get(email);
  if (!entry) return { valid: false, reason: "인증코드를 먼저 요청해주세요." };
  if (Date.now() > entry.expiresAt) {
    verificationCodes.delete(email);
    return { valid: false, reason: "인증코드가 만료되었습니다." };
  }
  if (entry.code !== inputCode) {
    return { valid: false, reason: "인증코드가 일치하지 않습니다." };
  }
  verificationCodes.delete(email);
  verifiedEmails.set(email, Date.now() + VERIFIED_EMAIL_TTL_MS);
  return { valid: true };
}

function isEmailVerified(email) {
  const expiresAt = verifiedEmails.get(email);
  if (!expiresAt) return false;

  if (Date.now() > expiresAt) {
    verifiedEmails.delete(email);
    return false;
  }

  return true;
}

function consumeVerifiedEmail(email) {
  if (!isEmailVerified(email)) return false;
  verifiedEmails.delete(email);
  return true;
}

module.exports = { sendVerificationCode, verifyCode, isEmailVerified, consumeVerifiedEmail };
