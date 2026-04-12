import { PrismaClient } from '@prisma/client';
import { createRequire } from 'node:module';

type PrismaGlobal = typeof globalThis & {
  prisma?: PrismaClient;
};

function createPrismaClient(): PrismaClient {
  if (typeof window !== 'undefined') {
    throw new Error('Prisma client is server-only.');
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set.');
  }

  try {
    // Load adapter dependencies lazily so browser bundles do not pull server-only deps.
    const runtimeRequire = createRequire(import.meta.url);
    const { PrismaPg } = runtimeRequire('@prisma/adapter-pg') as {
      PrismaPg: new (pool: unknown) => unknown;
    };
    const { Pool } = runtimeRequire('pg') as {
      Pool: new (options: { connectionString: string }) => unknown;
    };

    const pool = new Pool({ connectionString: databaseUrl });
    const PrismaCtor = PrismaClient as unknown as new (options?: Record<string, unknown>) => PrismaClient;

    return new PrismaCtor({ adapter: new PrismaPg(pool) });
  } catch {
    return new PrismaClient();
  }
}

const globalForPrisma = globalThis as PrismaGlobal;

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
