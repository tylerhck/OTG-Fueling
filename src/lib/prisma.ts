import { PrismaClient } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

// Parse DATABASE_URL into an object config to avoid the mariadb driver's
// inability to parse JSON in the ?ssl= query parameter.
const dbUrl = new URL(process.env.DATABASE_URL!);
const config = {
  host: dbUrl.hostname,
  port: parseInt(dbUrl.port || "3306"),
  user: decodeURIComponent(dbUrl.username),
  password: decodeURIComponent(dbUrl.password),
  database: dbUrl.pathname.slice(1),
  allowPublicKeyRetrieval: true,
  connectTimeout: 10000,
};

const adapter = new PrismaMariaDb(config);

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
