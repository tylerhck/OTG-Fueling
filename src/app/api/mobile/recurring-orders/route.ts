import { NextRequest, NextResponse } from "next/server";
import { getMobileSession } from "@/lib/mobileAuth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const recurringOrders = await prisma.recurringOrder.findMany({
    where: { userId: session.user.id },
    include: {
      vehicle: { select: { id: true, make: true, model: true, year: true, nickname: true } },
      address: { select: { id: true, street: true, city: true, state: true, zip: true, label: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // Map to include dayOfWeek and preferredTime for display
  const mapped = recurringOrders.map((ro) => ({
    ...ro,
    dayOfWeek: ro.dayOfWeek,
    preferredTime: ro.preferredTime,
  }));

  return NextResponse.json(mapped);
}

export async function DELETE(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "ID is required" }, { status: 400 });
  }

  const existing = await prisma.recurringOrder.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!existing) {
    return NextResponse.json({ error: "Recurring order not found" }, { status: 404 });
  }

  await prisma.recurringOrder.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
