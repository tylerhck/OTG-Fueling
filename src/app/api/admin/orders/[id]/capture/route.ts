import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { sendCompletionReceipt } from "@/lib/completionReceipt";

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
  const { gallons, pricePerGallon } = body;

  if (!gallons || typeof gallons !== "number" || gallons <= 0 || gallons > 200) {
    return NextResponse.json({ error: "Invalid gallons amount" }, { status: 400 });
  }

  if (!pricePerGallon || typeof pricePerGallon !== "number" || pricePerGallon <= 0 || pricePerGallon > 20) {
    return NextResponse.json({ error: "Invalid price per gallon" }, { status: 400 });
  }

  const order = await prisma.order.findUnique({
    where: { id },
    include: { user: true },
  });

  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  if (!order.stripeCustomerId) {
    return NextResponse.json(
      { error: "Card details not yet available. Wait for the customer's authorization to complete." },
      { status: 400 }
    );
  }

  // If payment method wasn't saved by webhook, retrieve it from the Stripe payment intent.
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
      { error: "Card details not yet available. Wait for the customer's authorization to complete." },
      { status: 400 }
    );
  }

  // Calculate the actual charge amount
  const pricePerGallonCents = Math.round(pricePerGallon * 100);
  const actualFuelCents = Math.round(pricePerGallonCents * gallons);
  const actualTotalCents = actualFuelCents + order.deliveryFeeCents;

  // Try to capture the original pre-auth for the actual amount (partial capture if less than held)
  let capturedViaOriginal = false;
  if (order.stripePaymentIntentId) {
    try {
      const originalIntent = await stripe.paymentIntents.retrieve(order.stripePaymentIntentId);
      // If the original intent is still capturable and the actual amount is <= the held amount
      if (originalIntent.status === "requires_capture" && actualTotalCents <= originalIntent.amount) {
        await stripe.paymentIntents.capture(order.stripePaymentIntentId, {
          amount_to_capture: actualTotalCents,
        });
        capturedViaOriginal = true;
      } else if (originalIntent.status === "requires_capture" && actualTotalCents > originalIntent.amount) {
        // Actual exceeds hold — cancel original and charge full amount off-session
        await stripe.paymentIntents.cancel(order.stripePaymentIntentId);
      }
    } catch {
      // If capture fails, fall through to off-session charge
      console.error("Could not capture original intent for order", order.id);
    }
  }

  // If we couldn't capture via original intent, charge off-session
  let finalIntentId = order.stripePaymentIntentId;
  if (!capturedViaOriginal) {
    try {
      const newIntent = await stripe.paymentIntents.create({
        amount: actualTotalCents,
        currency: "usd",
        customer: order.stripeCustomerId,
        payment_method: paymentMethodId,
        confirm: true,
        off_session: true,
        metadata: { orderId: order.id, capture: "true", gallons: String(gallons), pricePerGallon: String(pricePerGallon) },
      });
      finalIntentId = newIntent.id;

      // Cancel the original hold if it's still capturable
      if (order.stripePaymentIntentId) {
        try {
          await stripe.paymentIntents.cancel(order.stripePaymentIntentId);
        } catch {
          // Non-fatal
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Card charge failed";
      return NextResponse.json({ error: msg }, { status: 402 });
    }
  }

  // Update order with actual gallons, price per gallon, final total, and mark completed
  const updated = await prisma.order.update({
    where: { id },
    data: {
      gallons,
      pricePerGallonCents,
      totalCents: actualTotalCents,
      authAmountCents: actualTotalCents,
      stripePaymentIntentId: finalIntentId,
      status: "COMPLETED",
    },
    include: { user: true },
  });

  // Send completion receipt email with breakdown
  sendCompletionReceipt({
    orderId: order.id,
    recipientEmail: order.user?.email || order.guestEmail || null,
    recipientName: order.user?.name || order.guestName || "Customer",
    fuelType: order.fuelType || "REGULAR_87",
    gallons,
    pricePerGallon,
    fuelTotalCents: actualFuelCents,
    deliveryFeeCents: order.deliveryFeeCents,
    totalCents: actualTotalCents,
  }).catch((err) => console.error("Failed to send completion receipt:", err));

  return NextResponse.json(updated);
}
