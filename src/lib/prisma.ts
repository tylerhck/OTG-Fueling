import { PrismaClient } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
const dbUrl = new URL(process.env.DATABASE_URL!);
dbUrl.searchParams.set("allowPublicKeyRetrieval", "true");
const adapter = new PrismaMariaDb(dbUrl.toString());
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({ adapter });
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
