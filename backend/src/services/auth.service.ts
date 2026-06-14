import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../prisma';
import { BadRequestError, UnauthorizedError } from '../utils/errors';
import { RegisterInput, LoginInput } from '../utils/validators';

function signToken(user: { id: string; role: string; email: string }) {
  return jwt.sign(
    { id: user.id, role: user.role, email: user.email },
    process.env.JWT_SECRET as string,
    { expiresIn: '7d' },
  );
}

export async function register(input: RegisterInput) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw new BadRequestError('Email already registered');

  const passwordHash = await bcrypt.hash(input.password, 10);
  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      passwordHash,
      // Self-service registration is always a customer; staff are seeded/assigned.
      role: 'CUSTOMER',
    },
  });

  const token = signToken(user);
  return { token, user: { id: user.id, name: user.name, email: user.email, role: user.role } };
}

export async function login(input: LoginInput) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user) throw new UnauthorizedError('Invalid credentials');

  const ok = await bcrypt.compare(input.password, user.passwordHash);
  if (!ok) throw new UnauthorizedError('Invalid credentials');

  // Deactivated staff (or any disabled account) cannot sign in.
  if (!user.active) throw new UnauthorizedError('Account is deactivated — contact the owner');

  const token = signToken(user);
  return { token, user: { id: user.id, name: user.name, email: user.email, role: user.role } };
}
