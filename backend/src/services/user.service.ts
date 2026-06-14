import bcrypt from 'bcryptjs';
import { prisma } from '../prisma';
import { BadRequestError, ConflictError, NotFoundError } from '../utils/errors';
import { CreateStaffInput, UpdateStaffInput } from '../utils/validators';

// Never leak passwordHash to the client.
const SAFE_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  active: true,
  createdBy: true,
  createdAt: true,
} as const;

/** Owner view: all internal/staff accounts (customers are excluded). */
export async function listStaff() {
  return prisma.user.findMany({
    where: { role: { in: ['SHOPKEEPER', 'WAREHOUSE_MANAGER', 'OWNER'] } },
    select: SAFE_SELECT,
    orderBy: { createdAt: 'asc' },
  });
}

/** Owner provisions a staff account. */
export async function createStaff(input: CreateStaffInput, ownerId: string) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw new BadRequestError('Email already registered');

  const passwordHash = await bcrypt.hash(input.password, 10);
  return prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      passwordHash,
      role: input.role,
      createdBy: ownerId,
    },
    select: SAFE_SELECT,
  });
}

/** Owner updates a staff member's role and/or active flag. */
export async function updateStaff(id: string, input: UpdateStaffInput, ownerId: string) {
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) throw new NotFoundError('User not found');
  if (target.role === 'CUSTOMER') throw new BadRequestError('Cannot manage customer accounts here');

  // An owner cannot deactivate or demote themselves (avoid locking the org out).
  if (id === ownerId) {
    if (input.active === false) throw new ConflictError('You cannot deactivate your own account');
    if (input.role && input.role !== 'OWNER') {
      throw new ConflictError('You cannot change your own role');
    }
  }

  return prisma.user.update({
    where: { id },
    data: {
      ...(input.role !== undefined ? { role: input.role } : {}),
      ...(input.active !== undefined ? { active: input.active } : {}),
    },
    select: SAFE_SELECT,
  });
}
