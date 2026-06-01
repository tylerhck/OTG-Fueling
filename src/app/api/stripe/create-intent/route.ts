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

  // ALL orders now use manual capture (pre-authorization hold).
  // - Fill-up orders: $1 hold, charge actual amount on completion
  // - Dollar-amount orders: hold the full pre-funded amount, capture actual on completion (may be less if tank fills first)

  // Create a Stripe Customer so we can reuse the payment method later
  const customer = await stripe.customers.create({
    email: session?.user?.email ?? undefined,
    metadata: {
      orderId,
      userId: session?.user?.id || "guest",
    },
  });

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
}
