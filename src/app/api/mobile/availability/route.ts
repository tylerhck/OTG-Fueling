import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const dateStr = searchParams.get("date"); // YYYY-MM-DD

  // Get the first active service area
  const defaultArea = await prisma.serviceArea.findFirst({
    where: { isActive: true },
    select: { id: true },
  });
  if (!defaultArea) {
    return NextResponse.json({ schedules: [] });
  }

  const schedules = await prisma.serviceSchedule.findMany({
    where: { serviceAreaId: defaultArea.id, isActive: true },
  });

  // Transform to simplified day-level format
  const daySchedules = schedules.map((s) => ({
    dayOfWeek: s.dayOfWeek,
    isOpen: true,
    startTime: s.startTime,
    endTime: s.endTime,
  }));

  // If a specific date is requested, filter to that day of week
  if (dateStr) {
    const date = new Date(dateStr + "T12:00:00Z");
    const days = [
      "SUNDAY",
      "MONDAY",
      "TUESDAY",
      "WEDNESDAY",
      "THURSDAY",
      "FRIDAY",
      "SATURDAY",
    ];
    const dayOfWeek = days[date.getUTCDay()];
    const filtered = daySchedules.filter((s) => s.dayOfWeek === dayOfWeek);
    return NextResponse.json({ schedules: filtered, date: dateStr, dayOfWeek });
  }

  return NextResponse.json({ schedules: daySchedules });
}
