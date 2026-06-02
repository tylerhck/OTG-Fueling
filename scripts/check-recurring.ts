import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

const dbUrl = new URL(process.env.DATABASE_URL!);
dbUrl.searchParams.set("allowPublicKeyRetrieval", "true");
const adapter = new PrismaMariaDb(dbUrl.toString());
const prisma = new PrismaClient({ adapter });

async function main() {
  // Get all recurring orders
  const recurringOrders = await prisma.recurringOrder.findMany({
    include: {
      user: {
        select: {
          id: true,
          email: true,
          subscriptions: {
            where: { status: "ACTIVE" },
            take: 1,
          },
        },
      },
      vehicle: { select: { id: true, make: true, model: true } },
      address: { select: { id: true, street: true } },
    },
  });

  console.log(`\n=== Found ${recurringOrders.length} recurring orders ===\n`);

  for (const ro of recurringOrders) {
    console.log(`ID: ${ro.id}`);
    console.log(`  User: ${ro.user.email} (${ro.user.id})`);
    console.log(`  Day: ${ro.dayOfWeek}`);
    console.log(`  Active: ${ro.isActive}`);
    console.log(`  Fuel: ${ro.fuelType}`);
    console.log(`  Vehicle: ${ro.vehicle?.make} ${ro.vehicle?.model}`);
    console.log(`  Address: ${ro.address?.street}`);
    console.log(`  Last Order ID: ${ro.lastOrderId}`);
    console.log(`  Last Order Date: ${ro.lastOrderDate}`);
    console.log(`  Has Active Subscription: ${ro.user.subscriptions.length > 0}`);
    if (ro.user.subscriptions.length > 0) {
      console.log(`  Subscription: ${JSON.stringify(ro.user.subscriptions[0])}`);
    }
    console.log("");
  }

  await prisma.$disconnect();
}

main().catch(console.error);
