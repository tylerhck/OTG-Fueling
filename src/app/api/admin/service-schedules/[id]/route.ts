import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const TIME_RE = /^\d{2}:\d{2}$/;

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || (session.user as { role: string }).role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const body = await req.json();

  const existing = await prisma.serviceSchedule.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Schedule not found" }, { status: 404 });
  }

  const data: Record<string, unknown> = {};

  if (body.description !== undefined) data.description = body.description?.trim() || null;
  if (body.startTime !== undefined) {
    if (!TIME_RE.test(body.startTime)) return NextResponse.json({ error: "Invalid start time" }, { status: 400 });
    data.startTime = body.startTime;
  }
  if (body.endTime !== undefined) {
    if (!TIME_RE.test(body.endTime)) return NextResponse.json({ error: "Invalid end time" }, { status: 400 });
    data.endTime = body.endTime;
  }
  if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);
  if (body.slotMinutes !== undefined && typeof body.slotMinutes === "number" && body.slotMinutes > 0) {
    data.slotMinutes = body.slotMinutes;
  }
  if (body.capacityPerSlot !== undefined && typeof body.capacityPerSlot === "number" && body.capacityPerSlot > 0) {
    data.capacityPerSlot = body.capacityPerSlot;
  }

  const updated = await prisma.serviceSchedule.update({
    where: { id },
    data,
    include: {
      serviceArea: { select: { id: true, name: true } },
      slotOverrides: true,
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || (session.user as { role: string }).role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  await prisma.serviceSchedule.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
