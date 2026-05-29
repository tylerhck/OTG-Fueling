import { NextRequest, NextResponse } from "next/server";
import { getMobileSession } from "@/lib/mobileAuth";
import { prisma } from "@/lib/prisma";
import { orderSchema } from "@/lib/validators";
import { notifyOrderActive } from "@/lib/orderActiveSms";

export async function GET(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const orders = await prisma.order.findMany({
    where: { userId: session.user.id },
    include: { items: true, address: true, vehicle: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(orders);
}

export async function POST(req: NextRequest) {
  const session = await getMobileSession(req);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = orderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const { addressId, scheduledAt, availableFrom, availableTo, notes, items } = parsed.data;

  // Verify address belongs to user
  const address = await prisma.address.findFirst({
    where: { id: addressId, userId: session.user.id },
  });
  if (!address) {
    return NextResponse.json(
      { error: "Address not found" },
      { status: 404 }
    );
  }

  // Get current fuel prices and DEF pricing
  const [fuelPrices, defSettings] = await Promise.all([
    prisma.fuelPrice.findMany(),
    prisma.siteSetting.findMany({ where: { key: { in: ["def_price_cents_2_5", "def_price_cents_5"] } } }),
  ]);
  const priceMap = new Map(
    fuelPrices.map((fp: { fuelType: string; basePriceCents: number; markupPercent: number }) => [fp.fuelType, fp])
  );
  const defPriceMap: Record<string, number> = {};
  for (const s of defSettings) {
    defPriceMap[s.key] = parseInt(s.value, 10);
  }

  // Calculate order items with pricing
  const orderItems = items.map((item) => {
    // DEF add-on uses fixed pricing from admin settings
    if (item.kind === "DEF_ADDON" || item.kind === "DEF_ONLY") {
      const defCents = item.gallons === 5
        ? (defPriceMap.def_price_cents_5 || 5500)
        : (defPriceMap.def_price_cents_2_5 || 3000);
      return {
        kind: item.kind,
        vehicleId: item.vehicleId || null,
        boatId: item.boatId || null,
        fuelType: item.fuelType || "DIESEL",
        gallons: item.gallons || 2.5,
        isFillUp: false,
        pricePerGallonCents: 0,
        gasCents: defCents,
        serviceFeeCents: 0,
        notes: item.notes || null,
        itemMake: item.itemMake || null,
        itemModel: item.itemModel || null,
        itemYear: item.itemYear || null,
        itemColor: item.itemColor || null,
        itemPlate: item.itemPlate || null,
        itemRegNumber: item.itemRegNumber || null,
      };
    }

    const price = priceMap.get(item.fuelType);
    const baseCents = price
      ? Math.round(price.basePriceCents * (1 + price.markupPercent / 100))
      : 0;
    const gasCents = item.isFillUp ? 0 : Math.round(baseCents * (item.gallons || 0));

    return {
      kind: item.kind,
      vehicleId: item.vehicleId || null,
      boatId: item.boatId || null,
      fuelType: item.fuelType,
      gallons: item.isFillUp ? null : item.gallons,
      isFillUp: item.isFillUp || false,
      pricePerGallonCents: baseCents,
      gasCents,
      serviceFeeCents: 0,
      notes: item.notes || null,
      itemMake: item.itemMake || null,
      itemModel: item.itemModel || null,
      itemYear: item.itemYear || null,
      itemColor: item.itemColor || null,
      itemPlate: item.itemPlate || null,
      itemRegNumber: item.itemRegNumber || null,
    };
  });

  const totalGasCents = orderItems.reduce((sum, i) => sum + i.gasCents, 0);

  const order = await prisma.order.create({
    data: {
      userId: session.user.id,
      addressId,
      vehicleId: items[0]?.vehicleId || null,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      availableFrom: availableFrom || null,
      availableTo: availableTo || null,
      notes: notes || null,
      status: "AWAITING_PAYMENT",
      totalCents: totalGasCents,
      items: { create: orderItems },
    },
    include: { items: true, address: true },
  });

  // Fire SMS if ASAP order (no scheduledAt = active immediately)
  if (!scheduledAt) {
    notifyOrderActive(order.id, "ASAP").catch(() => {});
  }

  return NextResponse.json(order, { status: 201 });
}
