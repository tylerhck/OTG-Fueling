import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import Stripe from "stripe";
import { notifyOrderStatus } from "@/lib/notifications";
import { notifyOrderActive } from "@/lib/orderActiveSms";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json({ error: "No signature" }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // ALL orders now use manual capture. When the pre-auth hold is confirmed,
  // this event fires. Move the order to ACTIVE (ASAP) or PENDING (scheduled).
  if (event.type === "payment_intent.amount_capturable_updated") {
    const paymentIntent = event.data.object as Stripe.PaymentIntent;
    const orderId = paymentIntent.metadata.orderId;
    if (orderId) {
      const order = await prisma.order.findUnique({ where: { id: orderId }, select: { scheduledAt: true } });
      const isAsap = !order?.scheduledAt;
      const newStatus = isAsap ? "ACTIVE" : "PENDING";
      await prisma.order.update({
        where: { id: orderId },
        data: {
          status: newStatus,
          stripePaymentMethodId: paymentIntent.payment_method as string,
        },
      });
      notifyOrderStatus(orderId, newStatus).catch(() => {});
      if (isAsap) {
        notifyOrderActive(orderId, "ASAP").catch(() => {});
      }
    }
  }

  // Fallback: if a payment_intent.succeeded fires (e.g. from an off-session capture
  // after completion), we don't need to change order status since capture route handles it.
  // But handle edge cases where succeeded fires on the initial auth (some card networks).
  if (event.type === "payment_intent.succeeded") {
    const paymentIntent = event.data.object as Stripe.PaymentIntent;
    const orderId = paymentIntent.metadata.orderId;

    if (orderId) {
      // Only move to ACTIVE/PENDING if the order is still in AWAITING_PAYMENT
      const order = await prisma.order.findUnique({ where: { id: orderId }, select: { status: true, scheduledAt: true } });
      if (order && order.status === "AWAITING_PAYMENT") {
        const isAsap = !order.scheduledAt;
        const newStatus = isAsap ? "ACTIVE" : "PENDING";
        await prisma.order.update({
          where: { id: orderId },
          data: {
            status: newStatus,
            stripePaymentIntentId: paymentIntent.id,
          },
        });
        notifyOrderStatus(orderId, newStatus).catch(() => {});
        if (isAsap) {
          notifyOrderActive(orderId, "ASAP").catch(() => {});
        }
      }
    }
  }

  if (event.type === "payment_intent.payment_failed") {
    const paymentIntent = event.data.object as Stripe.PaymentIntent;
    const orderId = paymentIntent.metadata.orderId;

    if (orderId) {
      await prisma.order.update({
        where: { id: orderId },
        data: { status: "CANCELLED" },
      });
    }
  }

  // --- Subscription events ---
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.mode === "subscription" && session.subscription && session.metadata?.userId) {
      const sub = await stripe.subscriptions.retrieve(
        session.subscription as string
      );
      const item = sub.items.data[0];
      const periodStart = (item as any)?.current_period_start ?? (sub as any).current_period_start;
      const periodEnd = (item as any)?.current_period_end ?? (sub as any).current_period_end;
      await prisma.subscription.create({
        data: {
          userId: session.metadata.userId,
          stripeSubscriptionId: sub.id,
          stripeCustomerId: sub.customer as string,
          status: "ACTIVE",
          currentPeriodStart: new Date(periodStart * 1000),
          currentPeriodEnd: new Date(periodEnd * 1000),
        },
      });
    }
  }

  if (event.type === "customer.subscription.updated") {
    const sub = event.data.object as Stripe.Subscription;
    const subItem = sub.items?.data?.[0];
    const pStart = (subItem as any)?.current_period_start ?? (sub as any).current_period_start;
    const pEnd = (subItem as any)?.current_period_end ?? (sub as any).current_period_end;
    await prisma.subscription.updateMany({
      where: { stripeSubscriptionId: sub.id },
      data: {
        status: sub.status === "active" ? "ACTIVE" : "CANCELLED",
        currentPeriodStart: new Date(pStart * 1000),
        currentPeriodEnd: new Date(pEnd * 1000),
      },
    });
  }

  if (event.type === "customer.subscription.deleted") {
    const sub = event.data.object as Stripe.Subscription;
    await prisma.subscription.updateMany({
      where: { stripeSubscriptionId: sub.id },
      data: { status: "CANCELLED" },
    });
  }

  return NextResponse.json({ received: true });
}
