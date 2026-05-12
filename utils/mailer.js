const nodemailer = require("nodemailer");

const hasMailConfig = () => Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

const getTransporter = () => {
  if (!hasMailConfig()) return null;

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
};

const sendPasswordResetEmail = async ({ to, resetUrl, username }) => {
  const transporter = getTransporter();
  if (!transporter) {
    console.warn("SMTP is not configured. Password reset link:", resetUrl);
    return false;
  }

  await transporter.sendMail({
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
    to,
    subject: "Reset your EduSocial password",
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111">
        <h2>Password reset request</h2>
        <p>Hello ${username || "learner"},</p>
        <p>Click the button below to reset your EduSocial password. This link expires in 15 minutes.</p>
        <p>
          <a href="${resetUrl}" style="display:inline-block;background:#111;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:700">
            Reset password
          </a>
        </p>
        <p>If you did not request this, you can ignore this email.</p>
      </div>
    `,
  });

  return true;
};

module.exports = {
  sendPasswordResetEmail,
};
