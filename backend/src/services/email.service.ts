import nodemailer from 'nodemailer';
import { logger } from '../utils/logger';

// Gmail SMTP, configured from the environment (never hard-code the app password):
//   SMTP_USER=haseeb.khanasghar100@gmail.com
//   SMTP_PASS=<16-char Google App Password>   (requires 2-Step Verification on the account)
//   APP_URL=http://localhost:5173             (front-end base for the verification link)
// If SMTP is not configured we fall back to logging the link to the server console, so the
// flow is fully testable before the real credential is in place.
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
export const APP_URL = process.env.APP_URL ?? 'http://localhost:5173';

const transporter =
  SMTP_USER && SMTP_PASS
    ? nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        auth: { user: SMTP_USER, pass: SMTP_PASS },
      })
    : null;

export function isEmailConfigured(): boolean {
  return !!transporter;
}

export async function sendVerificationEmail(to: string, name: string, token: string): Promise<void> {
  const link = `${APP_URL}/verify-email?token=${encodeURIComponent(token)}`;

  if (!transporter) {
    // Dev fallback — no SMTP creds yet. Log the link so sign-up can still be verified.
    logger.warn(`[email] SMTP not configured. Verification link for ${to}: ${link}`);
    return;
  }

  await transporter.sendMail({
    from: `"Tick Worth" <${SMTP_USER}>`,
    to,
    subject: 'Verify your Tick Worth account',
    html: `
      <div style="font-family:Georgia,serif;max-width:520px;margin:auto;color:#1a1a1a">
        <h2 style="font-weight:400;letter-spacing:2px">TICK WORTH</h2>
        <p>Hello ${name},</p>
        <p>Thanks for joining Tick Worth. Please confirm your email address to activate your account:</p>
        <p style="text-align:center;margin:28px 0">
          <a href="${link}" style="background:#c2a063;color:#0c0c0e;padding:12px 28px;text-decoration:none;letter-spacing:1px;text-transform:uppercase;font-size:13px">Verify my email</a>
        </p>
        <p style="font-size:13px;color:#777">Or paste this link into your browser:<br>${link}</p>
        <p style="font-size:13px;color:#777">This link expires in 24 hours. If you didn't create an account, you can ignore this email.</p>
      </div>`,
  });
  logger.info(`[email] Verification email sent to ${to}`);
}
