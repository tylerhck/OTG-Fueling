import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fuelPriceSchema } from "@/lib/validators";
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

export async function GET() {
  try {
  const session = await auth();

  const [prices, asapSetting] = await Promise.all([
    prisma.fuelPrice.findMany({ orderBy: { fuelType: "asc" } }),
    prisma.siteSetting.findUnique({ where: { key: "asap_enabled" } }),
  ]);

  const result: Record<string, unknown> = {
    prices,
    deliveryFeeCents: 1500, // $15 flat delivery fee
    asapEnabled: asapSetting?.value !== "false", // defaults to true
  };

  // If authenticated, include subscription info (self-heal from Stripe if needed)
  if (session?.user?.id) {
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

    if (subscription) {
      const { weekStart, weekEnd } = getWeekBounds();
      const fillUpsUsed = await prisma.order.count({
        where: {
          userId: session.user.id,
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

      result.subscription = {
        active: true,
        fillUpsUsed,
        fillUpLimit: 2,
        secondFillUpFeeCents: 1000,
        // Legacy fields
        freeDeliveriesUsed: fillUpsUsed,
        freeDeliveriesPerWeek: 1,
      };
    }
  }

  return NextResponse.json(result);
  } catch (error) {
    console.error("GET /api/fuel-prices error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || (session.user as { role: string }).role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = fuelPriceSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const { fuelType, basePriceCents, markupPercent } = parsed.data;
  const effectivePriceCents = Math.round(
    basePriceCents * (1 + markupPercent / 100)
  );

  const price = await prisma.fuelPrice.upsert({
    where: { fuelType },
    update: { basePriceCents, markupPercent, effectivePriceCents },
    create: { fuelType, basePriceCents, markupPercent, effectivePriceCents },
  });

  return NextResponse.json(price);
}
