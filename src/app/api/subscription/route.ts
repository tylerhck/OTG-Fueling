import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";

function getWeekBounds(): { weekStart: Date; weekEnd: Date } {
  const now = new Date();
  const day = now.getDay(); // 0=Sun
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
      subscriptionDelivery: true,
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

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const subscription = await prisma.subscription.findFirst({
    where: { userId: session.user.id, status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
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

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check for existing active subscription
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

  // Parse optional coupon IDs from request body
  let couponIds: string[] = [];
  try {
    const body = await req.json();
    if (body.couponIds && Array.isArray(body.couponIds)) {
      couponIds = body.couponIds.filter((id: unknown) => typeof id === "string");
    }
  } catch {
    // No body or invalid JSON — proceed without coupons
  }

  // Build checkout session params
  const checkoutParams: Record<string, unknown> = {
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
            description: "Up to 2 fill-ups per week. First fill-up free delivery, second fill-up $10 delivery fee.",
          },
          unit_amount: 3500, // $35.00
        },
        quantity: 1,
      },
    ],
    metadata: {
      userId: session.user.id,
    },
    success_url: `${process.env.NEXTAUTH_URL}/profile?subscribed=true&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.NEXTAUTH_URL}/profile`,
  };

  // If coupons provided, use discounts param (supports multiple)
  // Otherwise allow manual promo code entry on Stripe page
  if (couponIds.length > 0) {
    checkoutParams.discounts = couponIds.map((id) => ({ coupon: id }));
  } else {
    checkoutParams.allow_promotion_codes = true;
  }

  // Create Stripe Checkout Session for subscription
  const checkoutSession = await stripe.checkout.sessions.create(
    checkoutParams as Parameters<typeof stripe.checkout.sessions.create>[0]
  );

  return NextResponse.json({ url: checkoutSession.url });
}

// Verify checkout session and create subscription if webhook hasn't arrived yet
export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { sessionId } = await req.json();
  if (!sessionId) {
    return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
  }

  // Check if subscription already exists (webhook may have handled it)
  const existing = await prisma.subscription.findFirst({
    where: { userId: session.user.id, status: "ACTIVE" },
  });
  if (existing) {
    const fillUpsUsed = await getFillUpsThisWeek(session.user.id);
    return NextResponse.json({
      subscription: existing,
      fillUpsUsed,
      fillUpLimit: 2,
      secondFillUpFeeCents: 1000,
      freeDeliveriesUsed: fillUpsUsed,
      freeDeliveriesPerWeek: 1,
    });
  }

  // Verify the checkout session with Stripe
  const checkoutSession = await stripe.checkout.sessions.retrieve(sessionId);
  if (
    checkoutSession.metadata?.userId !== session.user.id ||
    checkoutSession.mode !== "subscription" ||
    !checkoutSession.subscription
  ) {
    return NextResponse.json({ error: "Invalid session" }, { status: 400 });
  }

  const sub = await stripe.subscriptions.retrieve(
    checkoutSession.subscription as string,
    { expand: ["items.data"] }
  );
  const item = sub.items?.data?.[0];

  const subscription = await prisma.subscription.create({
    data: {
      userId: session.user.id,
      stripeSubscriptionId: sub.id,
      stripeCustomerId: sub.customer as string,
      status: "ACTIVE",
      currentPeriodStart: item
        ? new Date((item as unknown as { current_period_start: number }).current_period_start * 1000)
        : new Date(),
      currentPeriodEnd: item
        ? new Date((item as unknown as { current_period_end: number }).current_period_end * 1000)
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });

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

export async function DELETE() {
  const session = await auth();
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

  // Cancel at period end so user keeps access until end of billing period
  await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
    cancel_at_period_end: true,
  });

  return NextResponse.json({ message: "Subscription will cancel at end of billing period" });
}
