import { NextRequest, NextResponse } from "next/server";
import { getMobileSession } from "@/lib/mobileAuth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  // Auth is optional for fuel prices — guests can see prices too
  const session = await getMobileSession(req);

  const fuelPrices = await prisma.fuelPrice.findMany();

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

  return NextResponse.json({
    prices,
    isSubscribed: !!subscription,
    deliveryFeeCents: subscription ? 0 : 1500,
    subscriptionPriceCents: 3500,
  });
}
