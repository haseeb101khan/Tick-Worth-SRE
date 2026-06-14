import { prisma } from '../prisma';
import { NotFoundError } from '../utils/errors';
import { CreateCourierInput, UpdateCourierInput } from '../utils/validators';

/** Couriers are delivery contacts (not login accounts). */
export async function listCouriers(activeOnly = false) {
  return prisma.courier.findMany({
    where: activeOnly ? { active: true } : undefined,
    orderBy: { name: 'asc' },
  });
}

export async function createCourier(input: CreateCourierInput) {
  return prisma.courier.create({ data: input });
}

export async function updateCourier(id: string, input: UpdateCourierInput) {
  const existing = await prisma.courier.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('Courier not found');
  return prisma.courier.update({ where: { id }, data: input });
}
