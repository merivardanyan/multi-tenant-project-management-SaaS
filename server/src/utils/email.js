const nodemailer = require('nodemailer');

let transporter;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: false,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  return transporter;
}

async function sendVerificationEmail(email, token) {
  const url = `${process.env.CLIENT_URL}/verify-email?token=${token}`;
  await getTransporter().sendMail({
    from: `"ProjectFlow" <${process.env.SMTP_USER}>`,
    to: email,
    subject: 'Verify your email - ProjectFlow',
    html: `
      <h2>Welcome to ProjectFlow!</h2>
      <p>Click the link below to verify your email:</p>
      <a href="${url}">${url}</a>
      <p>This link expires in 24 hours.</p>
    `,
  });
}

async function sendResetPasswordEmail(email, token) {
  const url = `${process.env.CLIENT_URL}/reset-password?token=${token}`;
  await getTransporter().sendMail({
    from: `"ProjectFlow" <${process.env.SMTP_USER}>`,
    to: email,
    subject: 'Reset your password - ProjectFlow',
    html: `
      <h2>Password Reset</h2>
      <p>Click the link below to reset your password:</p>
      <a href="${url}">${url}</a>
      <p>This link expires in 1 hour.</p>
    `,
  });
}

async function sendWorkspaceInviteEmail(email, workspaceName, inviterName, token) {
  const url = `${process.env.CLIENT_URL}/invite?token=${token}`;
  await getTransporter().sendMail({
    from: `"ProjectFlow" <${process.env.SMTP_USER}>`,
    to: email,
    subject: `You're invited to ${workspaceName} - ProjectFlow`,
    html: `
      <h2>Workspace Invitation</h2>
      <p>${inviterName} invited you to join <strong>${workspaceName}</strong> on ProjectFlow.</p>
      <a href="${url}">Accept Invitation</a>
      <p>This invite expires in 7 days.</p>
    `,
  });
}

module.exports = {
  sendVerificationEmail,
  sendResetPasswordEmail,
  sendWorkspaceInviteEmail,
};
