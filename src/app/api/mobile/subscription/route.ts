import { NextRequest, NextResponse } from "next/server";
import { getMobileSession } from "@/lib/mobileAuth";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { ensureSubscriptionFromStripe } from "@/lib/subscriptions";

function getWeekBounds(): { weekStart: Date; weekEnd: Date } {
  const now = new Date();
  const day = now.getDay();
  const diffToMonday = day === 0 ? 6 : day - 1;
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - diffToMonday);
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 7);
  return { weekStart, weekEnd };
}

async function getFillUpsThisWeek(userId: string): Promise<number> {
  const { weekStart, weekEnd } = getWeekBounds();
  return prisma.order.count({
    where: {
      userId,
      status: { notIn: ["CANCELLED"] },
      createdAt: { gte: weekStart, lt: weekEnd },
      items: {
        some: {
          isFillUp: true,
          kind: { in: ["PRIMARY_VEHICLE", "SECOND_VEHICLE", "TRAILERED_BOAT"] },
        },
      },
    },
  });
}

// GET: Check subscription status
export async function GET(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Self-heal from Stripe if needed
  const userRecord = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { email: true },
  });
  if (userRecord?.email) {
    await ensureSubscriptionFromStripe(session.user.id, userRecord.email);
  }

  const subscription = await prisma.subscription.findFirst({
    where: { userId: session.user.id, status: "ACTIVE" },
  });

  if (!subscription) {
    return NextResponse.json({
      subscription: null,
      fillUpsUsed: 0,
      fillUpLimit: 2,
      secondFillUpFeeCents: 1000,
      freeDeliveriesUsed: 0,
      freeDeliveriesPerWeek: 1,
    });
  }

  const fillUpsUsed = await getFillUpsThisWeek(session.user.id);
  return NextResponse.json({
    subscription,
    fillUpsUsed,
    fillUpLimit: 2,
    secondFillUpFeeCents: 1000,
    freeDeliveriesUsed: fillUpsUsed,
    freeDeliveriesPerWeek: 1,
  });
}

// POST: Create subscription checkout session
export async function POST(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const existing = await prisma.subscription.findFirst({
    where: { userId: session.user.id, status: "ACTIVE" },
  });
  if (existing) {
    return NextResponse.json(
      { error: "You already have an active subscription" },
      { status: 400 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { email: true, name: true },
  });

  // Create Stripe Checkout Session — returns URL for in-app browser
  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    customer_email: user?.email,
    line_items: [
      {
        price_data: {
          currency: "usd",
          recurring: { interval: "month" },
          product_data: {
            name: "On The Go Fueling Monthly Subscription",
            description:
              "Up to 2 fill-ups per week. First fill-up free delivery, second fill-up $10 delivery fee.",
          },
          unit_amount: 3500,
        },
        quantity: 1,
      },
    ],
    metadata: { userId: session.user.id },
    success_url: `${process.env.NEXTAUTH_URL}/profile?subscribed=true&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.NEXTAUTH_URL}/profile`,
  });

  return NextResponse.json({ url: checkoutSession.url });
}

// DELETE: Cancel subscription
export async function DELETE(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const subscription = await prisma.subscription.findFirst({
    where: { userId: session.user.id, status: "ACTIVE" },
  });
  if (!subscription) {
    return NextResponse.json(
      { error: "No active subscription found" },
      { status: 404 }
    );
  }

  await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
    cancel_at_period_end: true,
  });

  return NextResponse.json({
    message: "Subscription will cancel at end of billing period",
  });
}
