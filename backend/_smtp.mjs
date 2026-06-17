import 'dotenv/config';
import nodemailer from 'nodemailer';
const t = nodemailer.createTransport({ host: 'smtp.gmail.com', port: 465, secure: true, auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } });
try {
  await t.verify();
  console.log('SMTP AUTH OK — Gmail accepted the app password.');
} catch (e) {
  console.log('SMTP AUTH FAILED:', e.message);
}
