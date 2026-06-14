import { PrismaClient } from '@prisma/client';

// Single shared client for the whole app.
export const prisma = new PrismaClient();
