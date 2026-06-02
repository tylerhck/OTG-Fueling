import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    const body = await req.json();
    const { amountCents, orderId, isFillUp, isScheduled } = body;

    console.log("[create-intent] START", { amountCents, orderId, isFillUp, isScheduled, userId: session?.user?.id });

    if (!amountCents || amountCents < 100) {
      console.log("[create-intent] REJECTED: invalid amount", amountCents);
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }

    // Create a Stripe Customer so we can reuse the payment method later
    console.log("[create-intent] Creating Stripe customer...");
    const customer = await stripe.customers.create({
      email: session?.user?.email ?? undefined,
      metadata: {
        orderId,
        userId: session?.user?.id || "guest",
      },
    });
    console.log("[create-intent] Customer created:", customer.id);

    // SCHEDULED ORDERS: Use a SetupIntent to save the card without placing a hold.
    // The hold will be placed on delivery day when the cron activates the order.
    if (isScheduled) {
      console.log("[create-intent] Creating SetupIntent for scheduled order...");
      const setupIntent = await stripe.setupIntents.create({
        customer: customer.id,
        payment_method_types: ["card"],
        metadata: {
          orderId,
          userId: session?.user?.id || "guest",
          isFillUp: isFillUp ? "true" : "false",
          holdAmountCents: String(amountCents),
        },
      });
      console.log("[create-intent] SetupIntent created:", setupIntent.id);

      // Persist the Stripe customer ID on the order (no PaymentIntent yet)
      await prisma.order.update({
        where: { id: orderId },
        data: {
          stripeCustomerId: customer.id,
        },
      });
      console.log("[create-intent] Order updated with customer ID. Done.");

      return NextResponse.json({
        clientSecret: setupIntent.client_secret,
        isSetup: true,
      });
    }

    // ASAP ORDERS: Use a PaymentIntent with manual capture (pre-authorization hold).
    console.log("[create-intent] Creating PaymentIntent for ASAP order...");
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: "usd",
      capture_method: "manual",
      setup_future_usage: "off_session",
      customer: customer.id,
      metadata: {
        orderId,
        userId: session?.user?.id || "guest",
        isFillUp: isFillUp ? "true" : "false",
      },
      payment_method_types: ["card"],
    });
    console.log("[create-intent] PaymentIntent created:", paymentIntent.id);

    // Persist the Stripe customer ID and intent on the order
    await prisma.order.update({
      where: { id: orderId },
      data: {
        stripePaymentIntentId: paymentIntent.id,
        stripeCustomerId: customer.id,
      },
    });
    console.log("[create-intent] Order updated. Done.");

    return NextResponse.json({ clientSecret: paymentIntent.client_secret });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[create-intent] ERROR:", message, err);
    return NextResponse.json({ error: "Payment setup failed: " + message }, { status: 500 });
  }
}
