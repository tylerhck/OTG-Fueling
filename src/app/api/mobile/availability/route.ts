import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  let serviceAreaId = searchParams.get("serviceAreaId");
  const dateStr = searchParams.get("date"); // YYYY-MM-DD

  // If no serviceAreaId provided, use the first active service area
  if (!serviceAreaId) {
    const defaultArea = await prisma.serviceArea.findFirst({
      where: { isActive: true },
      select: { id: true },
    });
    if (!defaultArea) {
      return NextResponse.json({ schedules: [] });
    }
    serviceAreaId = defaultArea.id;
  }

  const schedules = await prisma.serviceSchedule.findMany({
    where: { serviceAreaId, isActive: true },
    include: { slotOverrides: true },
  });

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
    const filtered = schedules.filter((s) => s.dayOfWeek === dayOfWeek);
    return NextResponse.json({ schedules: filtered, date: dateStr, dayOfWeek });
  }

  return NextResponse.json({ schedules });
}
