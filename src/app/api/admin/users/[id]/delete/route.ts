import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id || (session.user as { role: string }).role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const { reason } = body;

  const user = await prisma.user.findUnique({
    where: { id },
    include: { subscriptions: true },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  if (user.role === "ADMIN") {
    return NextResponse.json({ error: "Cannot delete an admin" }, { status: 400 });
  }

  // 1. Cancel all active Stripe subscriptions immediately
  for (const sub of user.subscriptions) {
    if (sub.status === "ACTIVE") {
      try {
        await stripe.subscriptions.cancel(sub.stripeSubscriptionId);
      } catch (err) {
        console.error(`Failed to cancel Stripe subscription ${sub.stripeSubscriptionId}:`, err);
      }
      await prisma.subscription.update({
        where: { id: sub.id },
        data: { status: "CANCELLED" },
      });
    }
  }

  // 2. Cancel all pending/confirmed/scheduled orders (keep completed history)
  await prisma.order.updateMany({
    where: {
      userId: id,
      status: { in: ["PENDING", "CONFIRMED", "IN_PROGRESS", "AWAITING_PAYMENT"] },
    },
    data: { status: "CANCELLED" },
  });

  // 3. Cancel any Stripe payment intents for those orders
  const pendingOrders = await prisma.order.findMany({
    where: { userId: id, status: "CANCELLED", stripePaymentIntentId: { not: null } },
    select: { stripePaymentIntentId: true },
  });
  for (const order of pendingOrders) {
    if (order.stripePaymentIntentId) {
      try {
        const intent = await stripe.paymentIntents.retrieve(order.stripePaymentIntentId);
        if (intent.status !== "canceled" && intent.status !== "succeeded") {
          await stripe.paymentIntents.cancel(order.stripePaymentIntentId);
        }
      } catch {
        // Non-fatal
      }
    }
  }

  // 4. Anonymize user credentials (can't log in) but keep record for history
  const timestamp = Date.now();
  await prisma.user.update({
    where: { id },
    data: {
      email: `deleted_${id}_${timestamp}@removed.otgfueling.com`,
      passwordHash: "DELETED",
      name: `[Deleted User]`,
      phone: null,
      deletedAt: new Date(),
      adminNotes: reason
        ? `[DELETED ${new Date().toLocaleDateString()}] ${reason}${user.adminNotes ? "\n" + user.adminNotes : ""}`
        : `[DELETED ${new Date().toLocaleDateString()}]${user.adminNotes ? "\n" + user.adminNotes : ""}`,
    },
  });

  // 5. Soft-delete vehicles and boats
  await prisma.vehicle.updateMany({
    where: { userId: id },
    data: { deletedAt: new Date() },
  });
  await prisma.boat.updateMany({
    where: { userId: id },
    data: { deletedAt: new Date() },
  });

  return NextResponse.json({
    success: true,
    message: "User deleted: Stripe cancelled, orders cancelled, credentials wiped. Order history preserved.",
  });
}
