import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

const dbUrl = new URL(process.env.DATABASE_URL!);
const needsSsl =
  dbUrl.hostname.includes("ondigitalocean.com") ||
  dbUrl.searchParams.get("ssl") === "true" ||
  dbUrl.searchParams.get("sslmode") === "REQUIRED";
const config: Record<string, unknown> = {
  host: dbUrl.hostname,
  port: parseInt(dbUrl.port || "3306"),
  user: decodeURIComponent(dbUrl.username),
  password: decodeURIComponent(dbUrl.password),
  database: dbUrl.pathname.slice(1),
  allowPublicKeyRetrieval: true,
  connectTimeout: 10000,
};
// Always use SSL — the DB requires secure connections
config.ssl = { rejectUnauthorized: false };
const adapter = new PrismaMariaDb(config);
const prisma = new PrismaClient({ adapter });

async function main() {
  // Get ALL areas — active and inactive
  const allAreas = await (prisma.serviceArea.findMany as any)({ where: {} });
  
  console.log(`Found ${allAreas.length} total service areas:`);
  for (const area of allAreas) {
    console.log(`  - ${area.name} | lat:${area.centerLat} lng:${area.centerLng} | active:${area.isActive} | id:${area.id}`);
  }

  // Delete ALL of them — they're all fake from the hackers
  // User will re-create real ones after
  console.log(`\nDeleting ALL ${allAreas.length} service areas and their schedules...`);
  
  // Delete all schedules first
  const deletedSchedules = await prisma.serviceSchedule.deleteMany({});
  console.log(`  Deleted ${deletedSchedules.count} schedules`);
  
  // Delete all service areas
  const deletedAreas = await prisma.serviceArea.deleteMany({});
  console.log(`  Deleted ${deletedAreas.count} service areas`);

  console.log("\nDone! All fake service areas and schedules removed.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
