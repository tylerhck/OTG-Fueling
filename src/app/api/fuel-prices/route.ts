import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
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

    const [asapSetting, defSettings, deliveryFeeSetting, displayPriceSettings] = await Promise.all([
      prisma.siteSetting.findUnique({ where: { key: "asap_enabled" } }),
      prisma.siteSetting.findMany({ where: { key: { in: ["def_price_cents_2_5", "def_price_cents_5"] } } }),
      prisma.siteSetting.findUnique({ where: { key: "delivery_fee_cents" } }),
      prisma.siteSetting.findMany({ where: { key: { in: ["display_price_regular_87", "display_price_premium_93", "display_price_diesel"] } } }),
    ]);

    const deliveryFeeCents = deliveryFeeSetting ? parseInt(deliveryFeeSetting.value, 10) : 1500;

    // Build dynamic DEF pricing from admin settings
    const defMap: Record<string, string> = {};
    for (const s of defSettings) {
      defMap[s.key] = s.value;
    }
    const defSizes = [
      { gallons: 2.5, label: "2.5 gallon", cents: parseInt(defMap.def_price_cents_2_5 || "3000", 10) },
      { gallons: 5, label: "5 gallon", cents: parseInt(defMap.def_price_cents_5 || "5500", 10) },
    ];

    // Build display prices map
    const displayMap: Record<string, string> = {};
    for (const s of displayPriceSettings) {
      displayMap[s.key] = s.value;
    }

    const result: Record<string, unknown> = {
      prices: [], // No longer serving live fuel prices — prices entered at completion
      displayPrices: {
        regular87: displayMap.display_price_regular_87 || "",
        premium93: displayMap.display_price_premium_93 || "",
        diesel: displayMap.display_price_diesel || "",
      },
      defSizes,
      deliveryFeeCents,
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
