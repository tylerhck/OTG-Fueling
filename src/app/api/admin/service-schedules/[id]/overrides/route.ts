import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const TIME_RE = /^\d{2}:\d{2}$/;

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as { role?: string })?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const overrides = await prisma.scheduleSlotOverride.findMany({
    where: { scheduleId: id },
    orderBy: { slotStart: "asc" },
  });
  return NextResponse.json(overrides);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as { role?: string })?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const body = await req.json();
  const { slotStart, isClosed, capacityOverride } = body;

  if (!slotStart || !TIME_RE.test(slotStart)) {
    return NextResponse.json({ error: "Invalid slotStart (HH:MM)" }, { status: 400 });
  }

  const override = await prisma.scheduleSlotOverride.upsert({
    where: { scheduleId_slotStart: { scheduleId: id, slotStart } },
    update: {
      isClosed: isClosed !== false,
      capacityOverride: capacityOverride ?? null,
    },
    create: {
      scheduleId: id,
      slotStart,
      isClosed: isClosed !== false,
      capacityOverride: capacityOverride ?? null,
    },
  });

  return NextResponse.json(override);
}
