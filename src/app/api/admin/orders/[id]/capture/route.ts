import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id || (session.user as { role: string }).role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const { gallons } = body;

  if (!gallons || typeof gallons !== "number" || gallons <= 0 || gallons > 200) {
    return NextResponse.json({ error: "Invalid gallons amount" }, { status: 400 });
  }

  const order = await prisma.order.findUnique({ where: { id } });

  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  if (!order.isFillUp) return NextResponse.json({ error: "Not a fill-up order" }, { status: 400 });
  if (!order.stripeCustomerId) {
    return NextResponse.json(
      { error: "Card details not yet available. Wait for the customer's $1 authorization to complete." },
      { status: 400 }
    );
  }

  // If payment method wasn't saved by webhook (e.g. webhook DB write failed),
  // retrieve it directly from the Stripe payment intent.
  let paymentMethodId = order.stripePaymentMethodId;
  if (!paymentMethodId && order.stripePaymentIntentId) {
    const intent = await stripe.paymentIntents.retrieve(order.stripePaymentIntentId);
    if (intent.payment_method) {
      paymentMethodId = intent.payment_method as string;
      await prisma.order.update({ where: { id }, data: { stripePaymentMethodId: paymentMethodId } });
    }
  }

  if (!paymentMethodId) {
    return NextResponse.json(
      { error: "Card details not yet available. Wait for the customer's $1 authorization to complete." },
      { status: 400 }
    );
  }

  if (!order.pricePerGallonCents) {
    return NextResponse.json({ error: "Order is missing fuel price data" }, { status: 400 });
  }
  const actualFuelCents = Math.round(order.pricePerGallonCents * gallons);
  const actualTotalCents = actualFuelCents + order.deliveryFeeCents;

  // Charge the saved payment method for the actual amount (off-session)
  let newIntent;
  try {
    newIntent = await stripe.paymentIntents.create({
      amount: actualTotalCents,
      currency: "usd",
      customer: order.stripeCustomerId,
      payment_method: paymentMethodId,
      confirm: true,
      off_session: true,
      metadata: { orderId: order.id, isFillUpCapture: "true" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Card charge failed";
    return NextResponse.json({ error: msg }, { status: 402 });
  }

  // Release the original $1 authorization
  if (order.stripePaymentIntentId) {
    try {
      await stripe.paymentIntents.cancel(order.stripePaymentIntentId);
    } catch {
      // Non-fatal — log but don't block the response
      console.error("Could not cancel $1 hold for order", order.id);
    }
  }

  // Update order with actual gallons, final total, and new intent ID
  const updated = await prisma.order.update({
    where: { id },
    data: {
      gallons,
      totalCents: actualTotalCents,
      authAmountCents: actualTotalCents,
      stripePaymentIntentId: newIntent.id,
      status: "COMPLETED",
    },
  });

  return NextResponse.json(updated);
}
