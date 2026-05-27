import { PrismaClient } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { hash } from "bcryptjs";

const adapter = new PrismaMariaDb(process.env.DATABASE_URL!);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding database...");

  // Create admin user
  const adminPassword = await hash("admin123", 12);
  const admin = await prisma.user.upsert({
    where: { email: "admin@otgfueling.com" },
    update: { passwordHash: adminPassword },
    create: {
      email: "admin@otgfueling.com",
      name: "OTG Admin",
      passwordHash: adminPassword,
      role: "ADMIN",
    },
  });
  console.log(`Admin user: ${admin.email}`);

  // Create service area (Fort Worth)
  const serviceArea = await prisma.serviceArea.upsert({
    where: { id: "default-fort-worth" },
    update: {},
    create: {
      id: "default-fort-worth",
      name: "Fort Worth Metro",
      centerLat: 32.7555,
      centerLng: -97.3308,
      radiusMiles: 15,
      isActive: true,
    },
  });
  console.log(`Service area: ${serviceArea.name} (${serviceArea.radiusMiles} mi radius)`);

  // Create fuel prices
  const fuels = [
    { fuelType: "REGULAR_87" as const, basePriceCents: 299, markupPercent: 10 },
    { fuelType: "PREMIUM_93" as const, basePriceCents: 379, markupPercent: 10 },
    { fuelType: "DIESEL" as const, basePriceCents: 349, markupPercent: 10 },
  ];

  for (const fuel of fuels) {
    const effectivePriceCents = Math.round(
      fuel.basePriceCents * (1 + fuel.markupPercent / 100)
    );
    await prisma.fuelPrice.upsert({
      where: { fuelType: fuel.fuelType },
      update: {
        basePriceCents: fuel.basePriceCents,
        markupPercent: fuel.markupPercent,
        effectivePriceCents,
      },
      create: {
        fuelType: fuel.fuelType,
        basePriceCents: fuel.basePriceCents,
        markupPercent: fuel.markupPercent,
        effectivePriceCents,
      },
    });
    console.log(
      `Fuel price: ${fuel.fuelType} = $${(effectivePriceCents / 100).toFixed(2)}/gal`
    );
  }

  console.log("Seeding complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
