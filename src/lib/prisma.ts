import { PrismaClient } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

const rawUrl = process.env.DATABASE_URL!;
// Strip existing query params and use ssl=true (the JSON ssl format causes pool timeouts with TiDB)
const baseUrl = rawUrl.split("?")[0];
const dbUrl = baseUrl + "?ssl=true&allowPublicKeyRetrieval=true";

const adapter = new PrismaMariaDb(dbUrl);

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
