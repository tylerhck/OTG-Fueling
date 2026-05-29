import { PrismaClient } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

const rawUrl = process.env.DATABASE_URL!;
const dbUrl = new URL(rawUrl);

// If the ssl param is a JSON object like {"rejectUnauthorized":true}, replace with simple ssl=true
// The JSON format causes pool timeouts with the PrismaMariaDb adapter on TiDB
const sslParam = dbUrl.searchParams.get("ssl");
if (sslParam && sslParam.startsWith("{")) {
  dbUrl.searchParams.set("ssl", "true");
}

dbUrl.searchParams.set("allowPublicKeyRetrieval", "true");

const adapter = new PrismaMariaDb(dbUrl.toString());

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
