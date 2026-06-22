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
    include: { subscriptions: true, recurringOrders: true },
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

  // 2. Deactivate all recurring orders
  await prisma.recurringOrder.updateMany({
    where: { userId: id, isActive: true },
    data: { isActive: false },
  });

  // 3. Cancel all pending/confirmed/active orders (keep completed history)
  await prisma.order.updateMany({
    where: {
      userId: id,
      status: { in: ["PENDING", "CONFIRMED", "ACTIVE", "IN_PROGRESS", "AWAITING_PAYMENT"] },
    },
    data: { status: "CANCELLED" },
  });

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

  return NextResponse.json({
    success: true,
    message: "User deleted: Stripe cancelled, recurring orders deactivated, pending orders cancelled, credentials wiped. Order history preserved.",
  });
}
