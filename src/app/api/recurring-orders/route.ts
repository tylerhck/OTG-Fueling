import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod/v4";
import { isBanned } from "@/lib/banCheck";

const recurringOrderSchema = z.object({
  vehicleId: z.string().optional(),
  boatId: z.string().optional(),
  addressId: z.string().min(1, "Address is required"),
  fuelType: z.enum(["REGULAR_87", "PREMIUM_93", "DIESEL"]).default("REGULAR_87"),
  isFillUp: z.boolean().default(true),
  gallons: z.number().positive().max(50).optional(),
  dayOfWeek: z.enum(["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"]),
  preferredTime: z.string().regex(/^\d{2}:\d{2}$/, "Time must be in HH:MM format").optional(),
  windowFrom: z.string().regex(/^\d{2}:\d{2}$/, "Time must be in HH:MM format"),
  windowTo: z.string().regex(/^\d{2}:\d{2}$/, "Time must be in HH:MM format"),
  notes: z.string().max(500).optional(),
});

export async function GET() {
  const session = await auth();
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

  return NextResponse.json(recurringOrders);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Ban check
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { email: true, phone: true } });
  if (user) {
    const banned = await isBanned({ email: user.email, phone: user.phone });
    if (banned) {
      return NextResponse.json({ error: "Unable to process your order. Please contact support." }, { status: 403 });
    }
  }

  const body = await req.json();
  const parsed = recurringOrderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const { vehicleId, boatId, addressId, fuelType, isFillUp, gallons, dayOfWeek, preferredTime, windowFrom, windowTo, notes } = parsed.data;

  // Verify address belongs to user
  const address = await prisma.address.findFirst({
    where: { id: addressId, userId: session.user.id },
  });
  if (!address) {
    return NextResponse.json({ error: "Address not found" }, { status: 404 });
  }

  // Verify vehicle belongs to user (if provided)
  if (vehicleId) {
    const vehicle = await prisma.vehicle.findFirst({
      where: { id: vehicleId, userId: session.user.id, deletedAt: null },
    });
    if (!vehicle) {
      return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });
    }
  }

  // Check user has active subscription (recurring orders require subscription)
  const subscription = await prisma.subscription.findFirst({
    where: { userId: session.user.id, status: "ACTIVE" },
  });
  if (!subscription) {
    return NextResponse.json(
      { error: "Recurring orders require an active subscription" },
      { status: 403 }
    );
  }

  const recurringOrder = await prisma.recurringOrder.create({
    data: {
      userId: session.user.id,
      vehicleId: vehicleId || null,
      boatId: boatId || null,
      addressId,
      fuelType,
      isFillUp,
      gallons: isFillUp ? null : gallons,
      dayOfWeek,
      preferredTime: windowFrom,
      windowFrom,
      windowTo,
      notes: notes || null,
    },
    include: {
      vehicle: { select: { id: true, make: true, model: true, year: true, nickname: true } },
      address: { select: { id: true, street: true, city: true, state: true, zip: true, label: true } },
    },
  });

  return NextResponse.json(recurringOrder, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
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

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { id, isActive, ...updateData } = body;

  if (!id) {
    return NextResponse.json({ error: "ID is required" }, { status: 400 });
  }

  const existing = await prisma.recurringOrder.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!existing) {
    return NextResponse.json({ error: "Recurring order not found" }, { status: 404 });
  }

  // If just toggling active status
  if (typeof isActive === "boolean" && Object.keys(updateData).length === 0) {
    const updated = await prisma.recurringOrder.update({
      where: { id },
      data: { isActive },
      include: {
        vehicle: { select: { id: true, make: true, model: true, year: true, nickname: true } },
        address: { select: { id: true, street: true, city: true, state: true, zip: true, label: true } },
      },
    });
    return NextResponse.json(updated);
  }

  // Full update
  const parsed = recurringOrderSchema.safeParse(updateData);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const { windowFrom: wf, windowTo: wt, ...restData } = parsed.data;
  const updated = await prisma.recurringOrder.update({
    where: { id },
    data: {
      ...restData,
      preferredTime: wf,
      windowFrom: wf,
      windowTo: wt,
      isActive: isActive ?? existing.isActive,
    },
    include: {
      vehicle: { select: { id: true, make: true, model: true, year: true, nickname: true } },
      address: { select: { id: true, street: true, city: true, state: true, zip: true, label: true } },
    },
  });

  return NextResponse.json(updated);
}
