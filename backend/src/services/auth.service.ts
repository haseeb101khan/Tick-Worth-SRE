import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomBytes } from 'node:crypto';
import { prisma } from '../prisma';
import { env } from '../config/env';
import { BadRequestError, UnauthorizedError } from '../utils/errors';
import { RegisterInput, LoginInput } from '../utils/validators';
import { sendVerificationEmail } from './email.service';
import { audit } from '../utils/logger';

function signToken(user: { id: string; role: string; email: string }) {
  return jwt.sign(
    { id: user.id, role: user.role, email: user.email },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'] },
  );
}

function newVerifyToken() {
  return {
    verifyToken: randomBytes(32).toString('hex'),
    verifyTokenExpiry: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h
  };
}

export async function register(input: RegisterInput) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw new BadRequestError('Email already registered');

  const passwordHash = await bcrypt.hash(input.password, 10);
  const { verifyToken, verifyTokenExpiry } = newVerifyToken();
  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      passwordHash,
      // Self-service registration is always a customer; staff are seeded/assigned.
      role: 'CUSTOMER',
      emailVerified: false,
      verifyToken,
      verifyTokenExpiry,
    },
  });

  await sendVerificationEmail(user.email, user.name, verifyToken);
  audit('user.register', { userId: user.id, email: user.email });

  // No JWT here — the user must verify their email before they can sign in.
  return { needsVerification: true, email: user.email };
}

export async function login(input: LoginInput) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) {
    audit('auth.login_failed', { email: input.email });
    throw new UnauthorizedError('Invalid credentials');
  }

  // Deactivated staff (or any disabled account) cannot sign in.
  if (!user.active) throw new UnauthorizedError('Account is deactivated — contact the owner');

  // Must have confirmed their email (owner-provisioned staff are created pre-verified).
  if (!user.emailVerified) {
    throw new UnauthorizedError('Please verify your email first — check your inbox for the link');
  }

  audit('auth.login', { userId: user.id, role: user.role });
  const token = signToken(user);
  return { token, user: { id: user.id, name: user.name, email: user.email, role: user.role } };
}

// Confirm an email from the link. On success the user is verified and signed in.
export async function verifyEmail(token: string) {
  const user = await prisma.user.findFirst({ where: { verifyToken: token } });
  if (!user) throw new BadRequestError('This verification link is invalid or has already been used');
  if (user.verifyTokenExpiry && user.verifyTokenExpiry < new Date()) {
    throw new BadRequestError('This verification link has expired — request a new one');
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { emailVerified: true, verifyToken: null, verifyTokenExpiry: null },
  });

  audit('auth.email_verified', { userId: updated.id });
  const jwtToken = signToken(updated);
  return {
    token: jwtToken,
    user: { id: updated.id, name: updated.name, email: updated.email, role: updated.role },
  };
}

// Re-send a verification link. Always responds the same way (don't reveal who exists).
export async function resendVerification(email: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (user && !user.emailVerified) {
    const { verifyToken, verifyTokenExpiry } = newVerifyToken();
    await prisma.user.update({ where: { id: user.id }, data: { verifyToken, verifyTokenExpiry } });
    await sendVerificationEmail(user.email, user.name, verifyToken);
  }
  return { ok: true };
}
