import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import Stripe from "stripe";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Webhook signature verification failed:", message);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;

        // Only handle subscription checkouts
        if (session.mode !== "subscription" || !session.subscription) break;

        const userId = session.metadata?.userId;
        if (!userId) break;

        // Check if we already have this subscription (PUT endpoint may have handled it)
        const existingSub = await prisma.subscription.findUnique({
          where: { stripeSubscriptionId: session.subscription as string },
        });
        if (existingSub) break;

        // Retrieve the full subscription from Stripe
        const sub = await stripe.subscriptions.retrieve(
          session.subscription as string,
          { expand: ["items.data"] }
        );
        const item = sub.items?.data?.[0];

        await prisma.subscription.create({
          data: {
            userId,
            stripeSubscriptionId: sub.id,
            stripeCustomerId: sub.customer as string,
            status: "ACTIVE",
            currentPeriodStart: item
              ? new Date(item.current_period_start * 1000)
              : new Date(),
            currentPeriodEnd: item
              ? new Date(item.current_period_end * 1000)
              : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          },
        });
        break;
      }

      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;

        const existing = await prisma.subscription.findUnique({
          where: { stripeSubscriptionId: sub.id },
        });
        if (!existing) break;

        const item = sub.items?.data?.[0];

        // Update status and period dates
        const status = sub.status === "active" ? "ACTIVE" :
                       sub.cancel_at_period_end ? "ACTIVE" : // still active until period end
                       "CANCELLED";

        await prisma.subscription.update({
          where: { stripeSubscriptionId: sub.id },
          data: {
            status,
            currentPeriodStart: item
              ? new Date(item.current_period_start * 1000)
              : existing.currentPeriodStart,
            currentPeriodEnd: item
              ? new Date(item.current_period_end * 1000)
              : existing.currentPeriodEnd,
          },
        });
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;

        await prisma.subscription.updateMany({
          where: { stripeSubscriptionId: sub.id },
          data: { status: "CANCELLED" },
        });
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = invoice.subscription as string | null;

        if (subscriptionId) {
          // Mark subscription as past_due so the user sees a warning
          await prisma.subscription.updateMany({
            where: { stripeSubscriptionId: subscriptionId },
            data: { status: "PAST_DUE" },
          });
        }
        break;
      }
    }
  } catch (err) {
    console.error("Webhook handler error:", err);
    // Still return 200 so Stripe doesn't retry indefinitely
  }

  return NextResponse.json({ received: true });
}
