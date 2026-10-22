import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Ensure database URL uses Supabase transaction pooler (port 6543) with PgBouncer
// to eliminate PostgreSQL connection pool exhaustion (port 5432 limit) under parallel queries.
let connectionUrl = process.env.DATABASE_URL || "";
if (connectionUrl && connectionUrl.includes("supabase.co:5432")) {
  connectionUrl = connectionUrl.replace(":5432", ":6543");
  if (!connectionUrl.includes("pgbouncer=true")) {
    const separator = connectionUrl.includes("?") ? "&" : "?";
    connectionUrl += `${separator}pgbouncer=true&connection_limit=10&pool_timeout=20`;
  }
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: connectionUrl ? { db: { url: connectionUrl } } : undefined,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

// Always maintain a single singleton client across all requests in the process
globalForPrisma.prisma = prisma;
