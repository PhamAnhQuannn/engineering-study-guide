import { PrismaClient } from "../generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

// Single-user local app: one SQLite file. Prisma 7 requires a driver adapter.
// Relative import (not the @/ alias) so this is usable from tsx scripts too.
export function createPrismaClient(): PrismaClient {
  const adapter = new PrismaBetterSqlite3({
    url: process.env.DATABASE_URL ?? "file:./dev.db",
  });
  return new PrismaClient({ adapter });
}
