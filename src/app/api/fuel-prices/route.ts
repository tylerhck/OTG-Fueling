import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureSubscriptionFromStripe } from "@/lib/subscriptions";

const DAY_NAMES = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"] as const;

/**
 * Check if ASAP orders should be available right now based on service schedules.
 * Returns false if:
 * - Today has no active schedule (closed day)
 * - Current time is within 30 minutes of closing
 * - Current time is before opening
 */
async function isAsapAvailableBySchedule(): Promise<boolean> {
  // Get current time in Central Time
  const now = new Date();
  const centralTimeStr = now.toLocaleString("en-US", { timeZone: "America/Chicago" });
  const centralNow = new Date(centralTimeStr);
  const dayOfWeek = DAY_NAMES[centralNow.getDay()];
  const currentMinutes = centralNow.getHours() * 60 + centralNow.getMinutes();

  // Find today's schedules
  const schedules = await prisma.serviceSchedule.findMany({
    where: { dayOfWeek, isActive: true },
  });

  if (schedules.length === 0) return false; // No service today

  // Check if we're within operating hours (with 30-min buffer before close)
  const ASAP_CUTOFF_MINUTES = 30;
  for (const schedule of schedules) {
    const [sh, sm] = schedule.startTime.split(":").map(Number);
    const [eh, em] = schedule.endTime.split(":").map(Number);
    const startMins = sh * 60 + sm;
    const endMins = eh * 60 + em;

    // ASAP is available if current time is between start and (end - 30 min)
    if (currentMinutes >= startMins && currentMinutes < endMins - ASAP_CUTOFF_MINUTES) {
      return true;
    }
  }

  return false; // Outside operating hours or within 30 min of close
}

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
      asapEnabled: asapSetting?.value === "false" ? false : await isAsapAvailableBySchedule(),
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
        const subOrders = await prisma.order.findMany({
          where: {
            userId: session.user.id,
            status: { notIn: ["CANCELLED"] },
            subscriptionDelivery: true,
            createdAt: { gte: weekStart, lt: weekEnd },
          },
          include: { items: { select: { isFillUp: true, kind: true } } },
        });
        const fillUpsUsed = subOrders.filter(o =>
          o.items.some(i => i.isFillUp && ["PRIMARY_VEHICLE", "SECOND_VEHICLE", "TRAILERED_BOAT"].includes(i.kind))
        ).length;

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
