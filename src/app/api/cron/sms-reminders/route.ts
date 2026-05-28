import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendOrderNotifications } from "@/lib/sms";

/**
 * Cron job: Send SMS reminders for scheduled orders 1 hour before delivery.
 * 
 * Should be called every 15 minutes (e.g., via Railway cron or external cron service).
 * It finds orders with scheduledAt between now and 1 hour from now that haven't been notified yet.
 * 
 * We use the `smsNotifiedAt` field to avoid sending duplicate notifications.
 */
export async function GET(req: NextRequest) {
  // Verify cron secret
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);

  // Find scheduled orders that:
  // 1. Have a scheduledAt within the next hour
  // 2. Are still in PENDING or AWAITING_PAYMENT or CONFIRMED status
  // 3. Haven't been SMS-notified yet (smsNotifiedAt is null)
  const orders = await prisma.order.findMany({
    where: {
      scheduledAt: {
        gte: now,
        lte: oneHourFromNow,
      },
      status: { in: ["PENDING", "AWAITING_PAYMENT", "CONFIRMED"] },
      smsNotifiedAt: null,
    },
    include: {
      user: { select: { name: true } },
      address: { select: { street: true, city: true, state: true, zip: true } },
      items: true,
    },
  });

  let sent = 0;

  for (const order of orders) {
    // Build customer name
    const customerName = order.user?.name || order.guestName || "Customer";
    const isGuest = !order.userId;

    // Build address
    let address = "Unknown";
    if (order.address) {
      address = `${order.address.street}, ${order.address.city}, ${order.address.state} ${order.address.zip}`;
    } else if (order.guestAddress) {
      try {
        const ga = JSON.parse(order.guestAddress);
        address = `${ga.street}, ${ga.city}, ${ga.state} ${ga.zip}`;
      } catch {}
    }

    // Check for DEF addon
    const defItem = order.items.find((i) => i.kind === "DEF_ADDON" || i.kind === "DEF_ONLY");

    await sendOrderNotifications({
      orderId: order.id,
      customerName,
      fuelType: (order.fuelType || "REGULAR").replace("_", " "),
      gallons: order.isFillUp ? undefined : order.gallons,
      isFillUp: order.isFillUp,
      address,
      scheduledAt: order.scheduledAt,
      notes: order.notes,
      isGuest,
      defAddon: defItem ? { gallons: defItem.gallons || 2.5 } : null,
    });

    // Mark as notified
    await prisma.order.update({
      where: { id: order.id },
      data: { smsNotifiedAt: new Date() },
    });

    sent++;
  }

  return NextResponse.json({
    success: true,
    checked: orders.length,
    sent,
    timestamp: now.toISOString(),
  });
}
