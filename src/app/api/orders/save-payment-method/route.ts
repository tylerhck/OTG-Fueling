import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const { orderId, paymentMethodId } = await request.json();

    if (!orderId || !paymentMethodId) {
      return NextResponse.json({ error: "Missing orderId or paymentMethodId" }, { status: 400 });
    }

    // Look up the order
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, status: true, scheduledAt: true, stripePaymentMethodId: true },
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Only save if not already set
    if (order.stripePaymentMethodId) {
      return NextResponse.json({ ok: true, message: "Already saved" });
    }

    // Determine the correct status
    let newStatus = order.status;
    if (order.status === "AWAITING_PAYMENT") {
      if (order.scheduledAt) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const scheduledDate = new Date(order.scheduledAt);
        scheduledDate.setHours(0, 0, 0, 0);
        newStatus = scheduledDate <= today ? "ACTIVE" : "PENDING";
      } else {
        newStatus = "ACTIVE";
      }
    }

    await prisma.order.update({
      where: { id: orderId },
      data: {
        stripePaymentMethodId: paymentMethodId,
        status: newStatus,
      },
    });

    return NextResponse.json({ ok: true, status: newStatus });
  } catch (err) {
    console.error("[save-payment-method] Error:", err);
    return NextResponse.json({ error: "Failed to save payment method" }, { status: 500 });
  }
}
