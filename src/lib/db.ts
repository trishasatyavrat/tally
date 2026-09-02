// Single shared PrismaClient.
//
// Two things happen here. First, Prisma 7 requires an explicit driver
// adapter: the client no longer bundles its own database driver, so we
// hand it a Postgres connection pool. Second, Next.js hot-reloads
// modules in development, which would create a new pool on every save
// until Postgres refuses connections - caching the client on globalThis
// survives reloads. In production the module evaluates once, so the
// guard is a no-op.
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  return new PrismaClient({ adapter });
}

export const db = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
