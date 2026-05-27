import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await auth();

  const body = await req.json();
  const { amountCents, orderId, isFillUp } = body;

  if (!amountCents || amountCents < 100) {
    return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
  }

  // Fill-up flow: authorize $1 to verify card, save payment method for the
  // actual off-session charge once we know how many gallons were pumped.
  if (isFillUp) {
    // Create a Stripe Customer so we can reuse the payment method later
    const customer = await stripe.customers.create({
      email: session?.user?.email ?? undefined,
      metadata: {
        orderId,
        userId: session?.user?.id || "guest",
      },
    });

    const paymentIntent = await stripe.paymentIntents.create({
      amount: 100, // $1.00 — just enough to verify the card
      currency: "usd",
      capture_method: "manual",
      setup_future_usage: "off_session",
      customer: customer.id,
      metadata: {
        orderId,
        userId: session?.user?.id || "guest",
        isFillUp: "true",
      },
      payment_method_types: ["card"],
    });

    // Persist the Stripe customer ID and intent on the order now so the
    // webhook can find it by intent ID when the authorization comes in.
    await prisma.order.update({
      where: { id: orderId },
      data: {
        stripePaymentIntentId: paymentIntent.id,
        stripeCustomerId: customer.id,
      },
    });

    return NextResponse.json({ clientSecret: paymentIntent.client_secret });
  }

  // Standard flow: immediate charge
  const paymentIntent = await stripe.paymentIntents.create({
    amount: amountCents,
    currency: "usd",
    metadata: {
      orderId,
      userId: session?.user?.id || "guest",
    },
    payment_method_types: ["card"],
  });

  return NextResponse.json({ clientSecret: paymentIntent.client_secret });
}
