const { Resend } = require('resend');

function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error('RESEND_API_KEY is not set');
  }
  return new Resend(apiKey);
}

function getEmailFrom() {
  const from = process.env.EMAIL_FROM;
  if (!from) {
    throw new Error('EMAIL_FROM is not set');
  }
  return from;
}

function getFrontendUrl() {
  const url = process.env.FRONTEND_URL;
  if (!url) {
    throw new Error('FRONTEND_URL is not set');
  }
  return url.replace(/\/$/, '');
}

async function sendVerificationEmail({ to, token }) {
  const resend = getResendClient();
  const from = getEmailFrom();
  const frontendUrl = getFrontendUrl();

  const verifyLink = `${frontendUrl}/verify-email?token=${encodeURIComponent(token)}&email=${encodeURIComponent(
    to
  )}`;

  await resend.emails.send({
    from,
    to,
    subject: 'Verify your email',
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.5;">
        <h2>Verify your email</h2>
        <p>Click the button below to verify your email address.</p>
        <p style="margin: 24px 0;">
          <a href="${verifyLink}" style="background:#4f46e5;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none;display:inline-block;">Verify Email</a>
        </p>
        <p>If the button doesn't work, copy and paste this link:</p>
        <p><a href="${verifyLink}">${verifyLink}</a></p>
      </div>
    `
  });
}

async function sendPasswordResetEmail({ to, token }) {
  const resend = getResendClient();
  const from = getEmailFrom();
  const frontendUrl = getFrontendUrl();

  const resetLink = `${frontendUrl}/reset-password?token=${encodeURIComponent(token)}&email=${encodeURIComponent(
    to
  )}`;

  await resend.emails.send({
    from,
    to,
    subject: 'Reset your password',
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.5;">
        <h2>Reset your password</h2>
        <p>Click the button below to reset your password. This link expires in 1 hour.</p>
        <p style="margin: 24px 0;">
          <a href="${resetLink}" style="background:#4f46e5;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none;display:inline-block;">Reset Password</a>
        </p>
        <p>If the button doesn't work, copy and paste this link:</p>
        <p><a href="${resetLink}">${resetLink}</a></p>
      </div>
    `
  });
}

module.exports = { sendVerificationEmail, sendPasswordResetEmail };
