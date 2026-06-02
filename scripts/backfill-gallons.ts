import { PrismaClient } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

const dbUrl = new URL(process.env.DATABASE_URL!);
dbUrl.searchParams.set("allowPublicKeyRetrieval", "true");
dbUrl.searchParams.set("ssl", JSON.stringify({ rejectUnauthorized: true }));
const adapter = new PrismaMariaDb(dbUrl.toString());
const prisma = new PrismaClient({ adapter });

async function main() {
  // Find all completed orders that have gallons set
  const completedOrders = await prisma.order.findMany({
    where: {
      status: { in: ["COMPLETED", "CONFIRMED", "IN_PROGRESS"] },
      gallons: { not: null, gt: 0 },
    },
    select: { id: true, gallons: true, pricePerGallonCents: true, deliveryFeeCents: true },
  });

  console.log(`Found ${completedOrders.length} completed orders to backfill`);

  for (const order of completedOrders) {
    const updated = await prisma.orderItem.updateMany({
      where: { orderId: order.id },
      data: {
        gallons: order.gallons || 0,
        pricePerGallonCents: order.pricePerGallonCents || 0,
        serviceFeeCents: order.deliveryFeeCents || 0,
      },
    });
    console.log(`Order ${order.id}: synced ${order.gallons} gallons to ${updated.count} items`);
  }

  console.log("Done!");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
