import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notifyOrderStatus } from "@/lib/notifications";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const { id } = await params;

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      vehicle: true,
      address: true,
      user: { select: { name: true, email: true, phone: true } },
    },
  });

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  // Guest orders (no userId) can be accessed by order ID directly
  if (!order.userId) {
    return NextResponse.json(order);
  }

  // Authenticated orders require auth and ownership (or admin)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isAdmin = (session.user as { role: string }).role === "ADMIN";
  if (!isAdmin && order.userId !== session.user.id) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  return NextResponse.json(order);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id || (session.user as { role: string }).role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const { status, etaMinutes } = body;

  const validStatuses = [
    "PENDING",
    "CONFIRMED",
    "ACTIVE",
    "IN_PROGRESS",
    "COMPLETED",
    "CANCELLED",
  ];
  if (!validStatuses.includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const data: Record<string, unknown> = { status };
  if (etaMinutes !== undefined) {
    data.etaMinutes = etaMinutes === null ? null : Math.max(0, Math.round(Number(etaMinutes)));
  }

  const order = await prisma.order.update({
    where: { id },
    data,
    include: {
      vehicle: true,
      address: true,
      user: { select: { name: true, email: true } },
    },
  });

  // Fire-and-forget notification
  notifyOrderStatus(order.id, status).catch(() => {});

  return NextResponse.json(order);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();

  // Customers can only cancel their own orders that are in AWAITING_PAYMENT or PENDING
  if (body.status !== "CANCELLED") {
    return NextResponse.json({ error: "Only cancellation is allowed" }, { status: 400 });
  }

  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const isAdmin = (session.user as { role: string }).role === "ADMIN";
  if (!isAdmin && order.userId !== session.user.id) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  if (!isAdmin && order.status !== "AWAITING_PAYMENT" && order.status !== "PENDING" && order.status !== "ACTIVE") {
    return NextResponse.json({ error: "Cannot cancel an order that is already in progress" }, { status: 400 });
  }

  const updated = await prisma.order.update({
    where: { id },
    data: { status: "CANCELLED" },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id || (session.user as { role: string }).role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  // Fetch the order to check for Stripe payment intent
  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  // Release Stripe hold if there's an uncaptured payment intent
  if (order.stripePaymentIntentId) {
    try {
      const { stripe } = await import("@/lib/stripe");
      const pi = await stripe.paymentIntents.retrieve(order.stripePaymentIntentId);
      if (pi.status === "requires_capture") {
        await stripe.paymentIntents.cancel(order.stripePaymentIntentId);
      }
    } catch (e) {
      // Log but don't block deletion if Stripe call fails
      console.error("Failed to cancel Stripe PaymentIntent:", e);
    }
  }

  // Clear lastOrderId references in recurring orders
  await prisma.recurringOrder.updateMany({
    where: { lastOrderId: id },
    data: { lastOrderId: null },
  });

  // Delete related records, then the order
  await prisma.notification.deleteMany({ where: { orderId: id } });
  await prisma.orderItem.deleteMany({ where: { orderId: id } });
  await prisma.order.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
