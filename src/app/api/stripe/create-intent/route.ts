import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    const body = await req.json();
    const { amountCents, orderId, isFillUp } = body;

    console.log("[create-intent] START", { amountCents, orderId, isFillUp, userId: session?.user?.id });

    if (!amountCents || amountCents < 100) {
      console.log("[create-intent] REJECTED: invalid amount", amountCents);
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }

    // Create a Stripe Customer so we can reuse the payment method later
    const customer = await stripe.customers.create({
      email: session?.user?.email ?? undefined,
      metadata: {
        orderId,
        userId: session?.user?.id || "guest",
      },
    });

    // ALL ORDERS: PaymentIntent with manual capture (hold, don't charge)
    // Admin will cancel the hold and charge the exact amount at completion.
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

    // Persist the Stripe customer ID and intent on the order
    await prisma.order.update({
      where: { id: orderId },
      data: {
        stripePaymentIntentId: paymentIntent.id,
        stripeCustomerId: customer.id,
      },
    });

    return NextResponse.json({ clientSecret: paymentIntent.client_secret });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[create-intent] ERROR:", message, err);
    return NextResponse.json({ error: "Payment setup failed: " + message }, { status: 500 });
  }
}
