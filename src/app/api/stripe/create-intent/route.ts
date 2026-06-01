import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await auth();

  const body = await req.json();
  const { amountCents, orderId, isFillUp, isScheduled } = body;

  if (!amountCents || amountCents < 100) {
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

  // SCHEDULED ORDERS: Use a SetupIntent to save the card without placing a hold.
  // The hold will be placed on delivery day when the cron activates the order.
  if (isScheduled) {
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

    // Persist the Stripe customer ID on the order (no PaymentIntent yet)
    await prisma.order.update({
      where: { id: orderId },
      data: {
        stripeCustomerId: customer.id,
      },
    });

    return NextResponse.json({
      clientSecret: setupIntent.client_secret,
      isSetup: true,
    });
  }

  // ASAP ORDERS: Use a PaymentIntent with manual capture (pre-authorization hold).
  // - Fill-up orders: $1 hold, charge actual amount on completion
  // - Dollar-amount orders: hold the full pre-funded amount, capture actual on completion
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
