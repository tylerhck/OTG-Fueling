import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { pushDeliveryReminder } from "@/lib/pushNotifications";

/**
 * Cron job: Activate scheduled orders on their delivery day.
 * 
 * Should be called at 6 AM Central daily.
 * Finds all PENDING orders with scheduledAt = today and moves them to ACTIVE.
 * Also sends push notification reminders for upcoming deliveries.
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

  // Find PENDING scheduled orders for today
  const orders = await prisma.order.findMany({
    where: {
      scheduledAt: {
        gte: todayStart,
        lt: todayEnd,
      },
      status: "PENDING",
    },
    select: { id: true },
  });

  let activated = 0;

  for (const order of orders) {
    try {
      // Move to ACTIVE status
      await prisma.order.update({
        where: { id: order.id },
        data: { status: "ACTIVE" },
      });
      activated++;
    } catch (err) {
      console.error(`Failed to activate order ${order.id}:`, err);
    }
  }

  // --- Push notification reminders (24h and 1h before delivery) ---
  let reminders24h = 0;
  let reminders1h = 0;

  // Find orders scheduled ~24 hours from now (23-25h window)
  const in23h = new Date(now.getTime() + 23 * 60 * 60 * 1000);
  const in25h = new Date(now.getTime() + 25 * 60 * 60 * 1000);
  const orders24h = await prisma.order.findMany({
    where: {
      scheduledAt: { gte: in23h, lt: in25h },
      status: { in: ["PENDING", "CONFIRMED", "ACTIVE"] },
      userId: { not: null },
    },
    select: { id: true, userId: true },
  });

  for (const o of orders24h) {
    if (o.userId) {
      await pushDeliveryReminder(o.userId, o.id, "24h").catch(() => {});
      reminders24h++;
    }
  }

  // Find orders scheduled ~1 hour from now (45min-75min window)
  const in45m = new Date(now.getTime() + 45 * 60 * 1000);
  const in75m = new Date(now.getTime() + 75 * 60 * 1000);
  const orders1h = await prisma.order.findMany({
    where: {
      scheduledAt: { gte: in45m, lt: in75m },
      status: { in: ["PENDING", "CONFIRMED", "ACTIVE"] },
      userId: { not: null },
    },
    select: { id: true, userId: true },
  });

  for (const o of orders1h) {
    if (o.userId) {
      await pushDeliveryReminder(o.userId, o.id, "1h").catch(() => {});
      reminders1h++;
    }
  }

  return NextResponse.json({
    success: true,
    found: orders.length,
    activated,
    reminders24h,
    reminders1h,
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
