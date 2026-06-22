import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id || (session.user as { role: string }).role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        phone: true,
        createdAt: true,
        _count: { select: { orders: true } },
        deletedAt: true,
        adminNotes: true,
        subscriptions: {
          select: {
            id: true,
            status: true,
            promoCode: true,
          },
          where: { status: "ACTIVE" },
          take: 1,
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const result = users.map((u) => ({
      ...u,
      isSubscriber: u.subscriptions.length > 0,
      subscriptionStatus: u.subscriptions[0]?.status || null,
      promoCode: u.subscriptions[0]?.promoCode || null,
      deletedAt: u.deletedAt,
      adminNotes: u.adminNotes,
    }));

    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error("Admin users API error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PATCH — update a user's subscription promo code
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || (session.user as { role: string }).role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { userId, promoCode } = body;

  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  // Find the user's active subscription
  const subscription = await prisma.subscription.findFirst({
    where: { userId, status: "ACTIVE" },
  });

  if (!subscription) {
    return NextResponse.json({ error: "User has no active subscription" }, { status: 404 });
  }

  // Update the promo code
  const updated = await prisma.subscription.update({
    where: { id: subscription.id },
    data: { promoCode: promoCode?.trim().toUpperCase() || null },
  });

  return NextResponse.json({ success: true, promoCode: updated.promoCode });
}
