import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { notifyOrderActive } from "@/lib/orderActiveSms";

/**
 * Cron job: Activate scheduled orders on their day and send SMS.
 * 
 * Should be called at 6 AM Central daily (same time as recurring orders cron).
 * Finds all orders with scheduledAt = today that are still in PENDING/AWAITING_PAYMENT/CONFIRMED
 * and haven't been SMS-notified yet, then fires the SMS.
 * 
 * This moves scheduled orders from "Pending" to "Active" in the admin view.
 */
export async function GET(req: NextRequest) {
  // Verify cron secret
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();

  // Get today's date range in Central Time
  const centralOffset = getCentralUtcOffset(now);
  const centralNow = new Date(now.getTime() - centralOffset * 60 * 60 * 1000);
  const todayStr = centralNow.toISOString().split("T")[0]; // YYYY-MM-DD

  // Start and end of today in UTC
  const todayStart = new Date(`${todayStr}T00:00:00.000Z`);
  todayStart.setTime(todayStart.getTime() + centralOffset * 60 * 60 * 1000); // Convert Central midnight to UTC
  const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

  // Find scheduled orders for today that haven't been SMS-notified
  const orders = await prisma.order.findMany({
    where: {
      scheduledAt: {
        gte: todayStart,
        lt: todayEnd,
      },
      status: { in: ["PENDING", "AWAITING_PAYMENT", "CONFIRMED"] },
      smsNotifiedAt: null,
    },
    select: { id: true },
  });

  let sent = 0;

  for (const order of orders) {
    try {
      // Move order to ACTIVE status (this is what shows up in the Active tab)
      await prisma.order.update({
        where: { id: order.id },
        data: { status: "ACTIVE" },
      });
      // Send SMS notification
      await notifyOrderActive(order.id, "Scheduled");
      sent++;
    } catch (err) {
      console.error(`Failed to activate/notify order ${order.id}:`, err);
    }
  }

  return NextResponse.json({
    success: true,
    found: orders.length,
    sent,
    date: todayStr,
    timestamp: now.toISOString(),
  });
}

// Also support POST for consistency with other cron routes
export async function POST(req: NextRequest) {
  return GET(req);
}

/**
 * Get the UTC offset for America/Chicago (Central Time) on a given date.
 */
function getCentralUtcOffset(date: Date): number {
  const year = date.getUTCFullYear();
  const marchFirst = new Date(Date.UTC(year, 2, 1));
  const marchFirstDay = marchFirst.getUTCDay();
  const dstStart = new Date(Date.UTC(year, 2, 8 + (7 - marchFirstDay) % 7, 8, 0, 0));
  const novFirst = new Date(Date.UTC(year, 10, 1));
  const novFirstDay = novFirst.getUTCDay();
  const dstEnd = new Date(Date.UTC(year, 10, 1 + (7 - novFirstDay) % 7, 7, 0, 0));
  if (date >= dstStart && date < dstEnd) return 5;
  return 6;
}
