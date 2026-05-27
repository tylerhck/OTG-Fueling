import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    // Try to include slotOverrides (new table — may not exist on older DB deployments)
    let schedules;
    try {
      schedules = await prisma.serviceSchedule.findMany({
        where: { isActive: true },
        include: {
          serviceArea: { select: { name: true } },
          slotOverrides: true,
        },
        orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
      });
    } catch {
      // Fallback: query without slotOverrides if the table doesn't exist yet
      schedules = await prisma.serviceSchedule.findMany({
        where: { isActive: true },
        include: { serviceArea: { select: { name: true } } },
        orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
      });
    }
    return NextResponse.json(schedules);
  } catch (error) {
    console.error("GET /api/service-schedules error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
