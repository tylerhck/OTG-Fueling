import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import Stripe from "stripe";
import { notifyOrderStatus } from "@/lib/notifications";

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

  // Standard payment: move to PENDING so admin reviews before confirming
  if (event.type === "payment_intent.succeeded") {
    const paymentIntent = event.data.object as Stripe.PaymentIntent;
    const orderId = paymentIntent.metadata.orderId;

    if (orderId) {
      await prisma.order.update({
        where: { id: orderId },
        data: {
          status: "PENDING",
          stripePaymentIntentId: paymentIntent.id,
        },
      });
      // Notify admin / internal — customer is NOT notified until admin confirms
      notifyOrderStatus(orderId, "PENDING").catch(() => {});
    }
  }

  // Fill-up: card authorized for $1 → save payment method, move to PENDING
  if (event.type === "payment_intent.amount_capturable_updated") {
    const paymentIntent = event.data.object as Stripe.PaymentIntent;
    const orderId = paymentIntent.metadata.orderId;
    if (orderId && paymentIntent.metadata.isFillUp === "true") {
      await prisma.order.update({
        where: { id: orderId },
        data: {
          status: "PENDING",
          stripePaymentMethodId: paymentIntent.payment_method as string,
        },
      });
      notifyOrderStatus(orderId, "PENDING").catch(() => {});
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
      await prisma.subscription.create({
        data: {
          userId: session.metadata.userId,
          stripeSubscriptionId: sub.id,
          stripeCustomerId: sub.customer as string,
          status: "ACTIVE",
          currentPeriodStart: new Date(item.current_period_start * 1000),
          currentPeriodEnd: new Date(item.current_period_end * 1000),
        },
      });
    }
  }

  if (event.type === "customer.subscription.updated") {
    const sub = event.data.object as Stripe.Subscription;
    const existing = await prisma.subscription.findUnique({
      where: { stripeSubscriptionId: sub.id },
    });
    if (existing) {
      const status = sub.cancel_at_period_end
        ? "ACTIVE"
        : sub.status === "active"
          ? "ACTIVE"
          : sub.status === "past_due"
            ? "PAST_DUE"
            : "CANCELLED";

      const item = sub.items.data[0];
      await prisma.subscription.update({
        where: { stripeSubscriptionId: sub.id },
        data: {
          status,
          currentPeriodStart: new Date(item.current_period_start * 1000),
          currentPeriodEnd: new Date(item.current_period_end * 1000),
        },
      });
    }
  }

  if (event.type === "customer.subscription.deleted") {
    const sub = event.data.object as Stripe.Subscription;
    await prisma.subscription.updateMany({
      where: { stripeSubscriptionId: sub.id },
      data: { status: "CANCELLED" },
    });
  }

  if (event.type === "invoice.payment_failed") {
    const invoice = event.data.object as Stripe.Invoice;
    const subId =
      (invoice.parent?.subscription_details?.subscription as string) ?? null;
    if (subId) {
      await prisma.subscription.updateMany({
        where: { stripeSubscriptionId: subId },
        data: { status: "PAST_DUE" },
      });
    }
  }

  return NextResponse.json({ received: true });
}
