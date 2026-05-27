import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const DAY_NAMES = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"] as const;

function generateSlotStarts(
  startTime: string,
  endTime: string,
  slotMinutes: number
): string[] {
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  const startMins = sh * 60 + sm;
  const endMins = eh * 60 + em;
  const slots: string[] = [];
  for (let t = startMins; t < endMins; t += slotMinutes) {
    const h = Math.floor(t / 60);
    const m = t % 60;
    slots.push(`${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`);
  }
  return slots;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const dateStr = searchParams.get("date"); // YYYY-MM-DD

  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return NextResponse.json({ error: "date parameter required (YYYY-MM-DD)" }, { status: 400 });
  }

  const date = new Date(dateStr + "T00:00:00");
  const dayOfWeek = DAY_NAMES[date.getDay()];

  const schedules = await prisma.serviceSchedule.findMany({
    where: { dayOfWeek, isActive: true },
    include: { slotOverrides: true },
  });

  if (schedules.length === 0) {
    return NextResponse.json([]);
  }

  // Gather all orders scheduled on this date
  const dayStart = new Date(dateStr + "T00:00:00.000Z");
  const dayEnd = new Date(dateStr + "T23:59:59.999Z");

  const bookedOrders = await prisma.order.findMany({
    where: {
      scheduledAt: { gte: dayStart, lte: dayEnd },
      status: { notIn: ["CANCELLED"] },
    },
    select: { scheduledAt: true },
  });

  // Count bookings per 15-min slot start
  function toSlotKey(dt: Date): string {
    const h = dt.getUTCHours();
    const m = dt.getUTCMinutes();
    // Round down to nearest slot boundary (assume 15)
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
  }

  const bookingCounts = new Map<string, number>();
  for (const o of bookedOrders) {
    if (o.scheduledAt) {
      const key = toSlotKey(o.scheduledAt);
      bookingCounts.set(key, (bookingCounts.get(key) ?? 0) + 1);
    }
  }

  const result: {
    slotStart: string;
    isClosed: boolean;
    isFull: boolean;
    remaining: number;
  }[] = [];

  for (const schedule of schedules) {
    const overrideMap = new Map(schedule.slotOverrides.map((o) => [o.slotStart, o]));
    const slotStarts = generateSlotStarts(schedule.startTime, schedule.endTime, schedule.slotMinutes);

    for (const slotStart of slotStarts) {
      const override = overrideMap.get(slotStart);
      const isClosed = override?.isClosed ?? false;
      const capacity = override?.capacityOverride ?? schedule.capacityPerSlot;
      const booked = bookingCounts.get(slotStart) ?? 0;
      const remaining = Math.max(0, capacity - booked);
      const isFull = remaining === 0;

      // Dedupe — if multiple schedules produce the same slot, merge
      const existing = result.find((r) => r.slotStart === slotStart);
      if (existing) {
        existing.isClosed = existing.isClosed && isClosed;
        existing.remaining = existing.remaining + remaining;
        existing.isFull = existing.remaining === 0;
      } else {
        result.push({ slotStart, isClosed, isFull, remaining });
      }
    }
  }

  result.sort((a, b) => a.slotStart.localeCompare(b.slotStart));
  return NextResponse.json(result);
}
