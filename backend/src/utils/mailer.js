import nodemailer from 'nodemailer';
import logger from '../config/logger.js';

function appError(status, code, message) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendInviteEmail({ to, inviteToken, firstName }) {
  const link = `${process.env.CLIENT_URL}/register/${inviteToken}`;

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to,
      subject: 'Приглашение в CleverLog',
      html: `
        <p>Здравствуйте, ${firstName}!</p>
        <p>Вас пригласили в систему CleverLog.</p>
        <p><a href="${link}">Завершить регистрацию</a></p>
        <p>Ссылка действительна 72 часа.</p>
      `,
    });
  } catch (error_) {
    logger.error('Failed to send invite email', { to, error: error_.message });
    throw appError(500, 'EMAIL_SEND_FAILED', 'Не удалось отправить инвайт');
  }
}

export const mailer = transporter;
