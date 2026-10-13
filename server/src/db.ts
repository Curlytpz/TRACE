import { PrismaClient } from '@prisma/client';
import { env } from './config.js';
import { AppError } from './errors.js';

let prisma: PrismaClient | undefined;

export function getPrisma(): PrismaClient {
  if (!env.DATABASE_URL) {
    throw new AppError(
      503,
      'Database is not configured. Set DATABASE_URL in server/.env and run the Prisma migration commands.',
    );
  }

  prisma ??= new PrismaClient();
  return prisma;
}

export async function disconnectPrisma(): Promise<void> {
  if (prisma) await prisma.$disconnect();
  prisma = undefined;
}
