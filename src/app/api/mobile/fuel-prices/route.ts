import { NextRequest, NextResponse } from "next/server";
import { getMobileSession } from "@/lib/mobileAuth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  // Auth is optional for fuel prices — guests can see prices too
  const session = await getMobileSession(req);

  const [fuelPrices, defSettings, deliveryFeeSetting] = await Promise.all([
    prisma.fuelPrice.findMany(),
    prisma.siteSetting.findMany({
      where: { key: { in: ["def_price_cents_2_5", "def_price_cents_5"] } },
    }),
    prisma.siteSetting.findUnique({ where: { key: "delivery_fee_cents" } }),
  ]);

  const adminDeliveryFeeCents = deliveryFeeSetting ? parseInt(deliveryFeeSetting.value, 10) : 1500;

  let subscription = null;
  if (session?.user?.id) {
    subscription = await prisma.subscription.findFirst({
      where: { userId: session.user.id, status: "ACTIVE" },
    });
  }

  const prices = fuelPrices.map((fp) => ({
    fuelType: fp.fuelType,
    basePriceCents: fp.basePriceCents,
    markupPercent: fp.markupPercent,
    finalPriceCents: Math.round(
      fp.basePriceCents * (1 + fp.markupPercent / 100)
    ),
  }));

  // Build DEF pricing from site settings (manually set by admin)
  const defMap: Record<string, string> = {};
  for (const s of defSettings) {
    defMap[s.key] = s.value;
  }

  const defPricing = {
    sizes: [
      { gallons: 2.5, label: "2.5 gallon", priceCents: parseInt(defMap.def_price_cents_2_5 || "3000", 10) },
      { gallons: 5, label: "5 gallon", priceCents: parseInt(defMap.def_price_cents_5 || "5500", 10) },
    ],
  };

  return NextResponse.json({
    prices,
    defPricing,
    isSubscribed: !!subscription,
    deliveryFeeCents: subscription ? 0 : adminDeliveryFeeCents,
    subscriptionPriceCents: 3500,
  });
}
