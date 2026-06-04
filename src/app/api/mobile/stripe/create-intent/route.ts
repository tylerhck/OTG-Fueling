import { NextRequest, NextResponse } from "next/server";
import { getMobileSession } from "@/lib/mobileAuth";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await getMobileSession(req);

  const body = await req.json();
  const { amountCents, orderId, isFillUp } = body;

  if (!amountCents || amountCents < 100) {
    return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
  }

  // Fill-up flow: authorize $40 pre-charge
  if (isFillUp) {
    const customer = await stripe.customers.create({
      email: session?.user?.email ?? undefined,
      metadata: {
        orderId,
        userId: session?.user?.id || "guest",
      },
    });

    const paymentIntent = await stripe.paymentIntents.create({
      amount: 4000,
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
