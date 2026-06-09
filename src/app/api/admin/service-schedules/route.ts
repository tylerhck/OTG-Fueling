import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const VALID_DAYS = [
  "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY",
] as const;

const TIME_RE = /^\d{2}:\d{2}$/;

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as { role?: string })?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const schedules = await prisma.serviceSchedule.findMany({
      include: {
        serviceArea: { select: { id: true, name: true } },
        slotOverrides: true,
      },
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
    });
    return NextResponse.json(schedules);
  } catch (error) {
    console.error("GET /api/admin/service-schedules error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as { role?: string })?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json();
  const { dayOfWeek, serviceAreaId, description, startTime, endTime, isActive, slotMinutes, capacityPerSlot } = body;

  if (!dayOfWeek || !VALID_DAYS.includes(dayOfWeek)) {
    return NextResponse.json({ error: "Invalid day of week" }, { status: 400 });
  }
  if (!serviceAreaId || typeof serviceAreaId !== "string") {
    return NextResponse.json({ error: "Service area is required" }, { status: 400 });
  }
  const area = await prisma.serviceArea.findUnique({ where: { id: serviceAreaId } });
  if (!area) {
    return NextResponse.json({ error: "Service area not found" }, { status: 404 });
  }
  if (!startTime || !TIME_RE.test(startTime)) {
    return NextResponse.json({ error: "Invalid start time (HH:MM)" }, { status: 400 });
  }
  if (!endTime || !TIME_RE.test(endTime)) {
    return NextResponse.json({ error: "Invalid end time (HH:MM)" }, { status: 400 });
  }

  const schedule = await prisma.serviceSchedule.create({
    data: {
      dayOfWeek,
      serviceAreaId,
      description: description?.trim() || null,
      startTime,
      endTime,
      isActive: isActive !== false,
      slotMinutes: typeof slotMinutes === "number" && slotMinutes > 0 ? slotMinutes : 15,
      capacityPerSlot: typeof capacityPerSlot === "number" && capacityPerSlot > 0 ? capacityPerSlot : 1,
    },
    include: {
      serviceArea: { select: { id: true, name: true } },
      slotOverrides: true,
    },
  });

  return NextResponse.json(schedule, { status: 201 });
}
