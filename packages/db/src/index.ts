import { PrismaClient } from '@prisma/client';

export * from '@prisma/client';

let prisma: PrismaClient | undefined;

/** Singleton Prisma client (safe for Next.js hot reload and long-running bot). */
export function getPrisma(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient();
  }
  return prisma;
}
