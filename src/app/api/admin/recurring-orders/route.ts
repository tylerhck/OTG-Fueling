import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check admin role
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const recurringOrders = await prisma.recurringOrder.findMany({
    include: {
      user: { select: { name: true, email: true } },
      vehicle: { select: { make: true, model: true, year: true, nickname: true } },
      address: { select: { street: true, city: true, state: true, zip: true } },
    },
    orderBy: [{ isActive: "desc" }, { dayOfWeek: "asc" }],
  });

  return NextResponse.json(recurringOrders);
}
