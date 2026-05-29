import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { orderSchema, guestOrderSchema, guestBoatOrderSchema } from "@/lib/validators";
import { isInAnyServiceArea } from "@/lib/serviceAreaCheck";
import { geocodeAddress } from "@/lib/geocode";
import { notifyOrderStatus } from "@/lib/notifications";
import { ensureSubscriptionFromStripe } from "@/lib/subscriptions";
import { notifyOrderActive } from "@/lib/orderActiveSms";

const FILL_UP_MAX_GALLONS = 30;
const FILL_UP_MAX_GALLONS_BOAT = 100;
const DELIVERY_FEE_STANDARD_CENTS = 1500; // $15 for non-subscribers and extra orders
const SECOND_FILLUP_FEE_CENTS = 1000;     // $10 for subscriber's 2nd weekly fill-up
const SECOND_VEHICLE_ADDON_CENTS = 500;   // $5 service fee for 2nd vehicle add-on
const TRAILERED_BOAT_ADDON_CENTS = 1000;  // $10 service fee for trailered boat add-on
const BOAT_BASE_FEE_CENTS = 2000;         // $20 for standalone boat orders

// DEF (Diesel Exhaust Fluid) pricing
const DEF_PRICES: Record<number, number> = {
  2.5: 3000, // 2.5 gal = $30
  5: 5500,   // 5 gal = $55
};

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
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isAdmin = (session.user as { role: string }).role === "ADMIN";

  try {
    // Auto-cancel orders stuck in AWAITING_PAYMENT for more than 1 hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    await prisma.order.updateMany({
      where: {
        status: "AWAITING_PAYMENT",
        createdAt: { lt: oneHourAgo },
      },
      data: { status: "CANCELLED" },
    });

    const orders = await prisma.order.findMany({
      where: isAdmin ? {} : { userId: session.user.id },
      include: {
        vehicle: { select: { make: true, model: true, year: true, color: true, nickname: true } },
        address: { select: { street: true, city: true, state: true, zip: true, label: true } },
        user: isAdmin ? { select: { name: true, email: true } } : false,
        items: {
          include: {
            vehicle: { select: { make: true, model: true, year: true, nickname: true } },
            boat: { select: { nickname: true, make: true, model: true, registrationNumber: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(orders);
  } catch (err) {
    console.error("GET /api/orders error:", err);
    return NextResponse.json({ error: "Failed to load orders" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const body = await req.json();
  const isGuest = body.guest === true;
  const isBoatGuest = body.guestBoat === true;
  const isDefGuest = body.guestDef === true;
  const pinLat = typeof body.pinLat === "number" ? body.pinLat : null;
  const pinLng = typeof body.pinLng === "number" ? body.pinLng : null;

  // --- GUEST DEF ORDER ---
  if (isDefGuest) {
    const { guestName, guestEmail, guestPhone, street, city, state, zip, scheduledAt, notes, gallons: defGallons } = body;
    if (!guestName || !guestEmail || !street || !city || !zip) {
      return NextResponse.json({ error: "Name, email, and address are required" }, { status: 400 });
    }
    const validSizes = [2.5, 5];
    if (!validSizes.includes(defGallons)) {
      return NextResponse.json({ error: "Invalid DEF size. Choose 2.5 or 5 gallons." }, { status: 400 });
    }

    const fullAddress = `${street}, ${city}, ${state || "TX"} ${zip}`;
    const geo = await geocodeAddress(fullAddress);
    if (!geo) {
      return NextResponse.json({ error: "Could not verify your address. Please check and try again." }, { status: 400 });
    }

    const serviceAreas = await prisma.serviceArea.findMany({ where: { isActive: true } });
    if (!isInAnyServiceArea(geo.lat, geo.lng, serviceAreas)) {
      return NextResponse.json({ error: "Address is outside our service area" }, { status: 400 });
    }

    const defPriceCents = DEF_PRICES[defGallons];
    const deliveryFeeCents = DELIVERY_FEE_STANDARD_CENTS;
    const totalCents = defPriceCents + deliveryFeeCents;

    const order = await prisma.order.create({
      data: {
        fuelType: "DIESEL",
        gallons: defGallons,
        pricePerGallonCents: 0,
        deliveryFeeCents,
        totalCents,
        isFillUp: false,
        status: scheduledAt ? "PENDING" : "ACTIVE",
        pinLat,
        pinLng,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        notes,
        guestName,
        guestEmail,
        guestPhone: guestPhone || null,
        guestAddress: JSON.stringify({ street, city, state: state || "TX", zip, lat: geo.lat, lng: geo.lng }),
        items: {
          create: [{
            kind: "DEF_ONLY",
            fuelType: "DIESEL",
            gallons: defGallons,
            isFillUp: false,
            pricePerGallonCents: 0,
            gasCents: defPriceCents,
            serviceFeeCents: 0,
          }],
        },
      },
    });

    // Fire SMS if ASAP order (no scheduledAt = active immediately)
    if (!scheduledAt) {
      notifyOrderActive(order.id, "ASAP").catch(() => {});
    }

    return NextResponse.json(order, { status: 201 });
  }

  // --- GUEST BOAT ORDER ---
  if (isBoatGuest) {
    const parsed = guestBoatOrderSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const {
      fuelType, gallons, isFillUp, scheduledAt, notes,
      guestName, guestEmail, guestPhone,
      boatMake, boatModel, boatYear, boatColor, boatRegistrationNumber, boatNotes,
      street, city, state, zip,
    } = parsed.data;

    const fullAddress = `${street}, ${city}, ${state} ${zip}`;
    const geo = await geocodeAddress(fullAddress);
    if (!geo) {
      return NextResponse.json({ error: "Could not verify your address. Please check and try again." }, { status: 400 });
    }

    const serviceAreas = await prisma.serviceArea.findMany({ where: { isActive: true } });
    if (!isInAnyServiceArea(geo.lat, geo.lng, serviceAreas)) {
      return NextResponse.json({ error: "Address is outside our service area" }, { status: 400 });
    }

    const fuelPrice = await prisma.fuelPrice.findUnique({ where: { fuelType } });
    if (!fuelPrice) {
      return NextResponse.json({ error: "Fuel pricing not available. Please try again later." }, { status: 400 });
    }

    const pricePerGallonCents = fuelPrice.effectivePriceCents;
    const deliveryFeeCents = BOAT_BASE_FEE_CENTS;
    const actualGallons = isFillUp ? FILL_UP_MAX_GALLONS_BOAT : (gallons ?? 0);
    const gasCents = isFillUp ? 0 : Math.round(pricePerGallonCents * actualGallons);
    const authAmountCents = isFillUp
      ? Math.round(pricePerGallonCents * FILL_UP_MAX_GALLONS_BOAT) + deliveryFeeCents
      : null;
    const totalCents = isFillUp ? authAmountCents! : gasCents + deliveryFeeCents;

    const order = await prisma.order.create({
      data: {
        fuelType,
        gallons: actualGallons,
        pricePerGallonCents,
        deliveryFeeCents,
        totalCents,
        isFillUp: isFillUp ?? false,
        status: scheduledAt ? "PENDING" : "ACTIVE",
        authAmountCents,
        pinLat,
        pinLng,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        notes,
        guestName,
        guestEmail,
        guestPhone,
        guestAddress: JSON.stringify({ street, city, state, zip, lat: geo.lat, lng: geo.lng }),
        items: {
          create: [{
            kind: "PRIMARY_BOAT",
            fuelType,
            gallons: actualGallons,
            isFillUp: isFillUp ?? false,
            pricePerGallonCents,
            gasCents,
            serviceFeeCents: deliveryFeeCents,
            authAmountCents,
            notes: boatNotes,
            itemMake: boatMake,
            itemModel: boatModel,
            itemYear: boatYear,
            itemColor: boatColor,
            itemRegNumber: boatRegistrationNumber,
          }],
        },
      },
    });

    // Fire SMS if ASAP order (no scheduledAt = active immediately)
    if (!scheduledAt) {
      notifyOrderActive(order.id, "ASAP").catch(() => {});
    }

    return NextResponse.json(order, { status: 201 });
  }

  // --- GUEST VEHICLE ORDER ---
  if (isGuest) {
    const parsed = guestOrderSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const {
      fuelType, gallons, scheduledAt, notes,
      guestName, guestEmail, guestPhone,
      vehicleMake, vehicleModel, vehicleYear, vehicleColor,
      street, city, state, zip,
    } = parsed.data;

    const fullAddress = `${street}, ${city}, ${state} ${zip}`;
    const geo = await geocodeAddress(fullAddress);
    if (!geo) {
      return NextResponse.json({ error: "Could not verify your address. Please check and try again." }, { status: 400 });
    }

    const serviceAreas = await prisma.serviceArea.findMany({ where: { isActive: true } });
    if (!isInAnyServiceArea(geo.lat, geo.lng, serviceAreas)) {
      return NextResponse.json({ error: "Address is outside our service area" }, { status: 400 });
    }

    const fuelPrice = await prisma.fuelPrice.findUnique({ where: { fuelType } });
    if (!fuelPrice) {
      return NextResponse.json({ error: "Fuel pricing not available. Please try again later." }, { status: 400 });
    }

    const pricePerGallonCents = fuelPrice.effectivePriceCents;
    const deliveryFeeCents = DELIVERY_FEE_STANDARD_CENTS;
    const totalCents = Math.round(pricePerGallonCents * gallons) + deliveryFeeCents;

    const order = await prisma.order.create({
      data: {
        fuelType,
        gallons,
        pricePerGallonCents,
        deliveryFeeCents,
        totalCents,
        status: scheduledAt ? "PENDING" : "ACTIVE",
        pinLat,
        pinLng,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        notes,
        guestName,
        guestEmail,
        guestPhone,
        guestVehicle: JSON.stringify({ make: vehicleMake, model: vehicleModel, year: vehicleYear, color: vehicleColor }),
        guestAddress: JSON.stringify({ street, city, state, zip, lat: geo.lat, lng: geo.lng }),
        items: {
          create: [{
            kind: "PRIMARY_VEHICLE",
            fuelType,
            gallons,
            isFillUp: false,
            pricePerGallonCents,
            gasCents: Math.round(pricePerGallonCents * gallons),
            serviceFeeCents: 0,
            itemMake: vehicleMake,
            itemModel: vehicleModel,
            itemYear: vehicleYear,
            itemColor: vehicleColor,
          }],
        },
      },
    });

    // Fire SMS if ASAP order (no scheduledAt = active immediately)
    if (!scheduledAt) {
      notifyOrderActive(order.id, "ASAP").catch(() => {});
    }

    return NextResponse.json(order, { status: 201 });
  }

  // --- AUTHENTICATED ORDER ---
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = orderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const { addressId, scheduledAt, notes, items } = parsed.data;

  const primaryItem = items.find(
    (i) => i.kind === "PRIMARY_VEHICLE" || i.kind === "PRIMARY_BOAT" || i.kind === "DEF_ONLY"
  );
  if (!primaryItem) {
    return NextResponse.json({ error: "A primary item (vehicle, boat, or DEF) is required" }, { status: 400 });
  }

  const addonItems = items.filter((i) => i.kind === "SECOND_VEHICLE" || i.kind === "TRAILERED_BOAT");

  // Verify address belongs to user
  const address = await prisma.address.findFirst({
    where: { id: addressId, userId: session.user.id },
  });
  if (!address) {
    return NextResponse.json({ error: "Address not found" }, { status: 404 });
  }

  // Check service area
  const serviceAreas = await prisma.serviceArea.findMany({ where: { isActive: true } });
  if (!isInAnyServiceArea(address.lat, address.lng, serviceAreas)) {
    return NextResponse.json({ error: "Address is outside our service area" }, { status: 400 });
  }

  // Validate scheduledAt slot capacity if scheduling
  if (scheduledAt) {
    const slotTime = new Date(scheduledAt);
    const slotEnd = new Date(slotTime.getTime() + 15 * 60 * 1000);
    const booked = await prisma.order.count({
      where: {
        scheduledAt: { gte: slotTime, lt: slotEnd },
        status: { notIn: ["CANCELLED"] },
      },
    });
    // Find schedule to get capacity
    const dayNames = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
    const dayOfWeek = dayNames[slotTime.getDay()];
    const slotStartStr = `${slotTime.getHours().toString().padStart(2, "0")}:${slotTime.getMinutes().toString().padStart(2, "0")}`;
    const schedule = await prisma.serviceSchedule.findFirst({
      where: { dayOfWeek: dayOfWeek as never, isActive: true },
      include: { slotOverrides: { where: { slotStart: slotStartStr } } },
    });
    if (schedule) {
      const override = schedule.slotOverrides[0];
      if (override?.isClosed) {
        return NextResponse.json({ error: "That time slot is not available." }, { status: 400 });
      }
      const capacity = override?.capacityOverride ?? schedule.capacityPerSlot;
      if (booked >= capacity) {
        return NextResponse.json({ error: "That time slot is full. Please choose another." }, { status: 400 });
      }
    }
  }

  // Get fuel prices for all unique fuel types in items
  // DEF items use a fixed price table; exclude them from fuel price lookup
  const nonDefItems = items.filter((i) => i.kind !== "DEF_ADDON" && i.kind !== "DEF_ONLY");
  const fuelTypes = [...new Set(nonDefItems.map((i) => i.fuelType))];
  const fuelPrices = await prisma.fuelPrice.findMany({ where: { fuelType: { in: fuelTypes as never[] } } });
  const priceMap = new Map(fuelPrices.map((fp) => [fp.fuelType, fp.effectivePriceCents]));

  for (const ft of fuelTypes) {
    if (!priceMap.has(ft)) {
      return NextResponse.json({ error: "Fuel pricing not available. Please try again later." }, { status: 400 });
    }
  }

  // Verify all vehicle/boat items belong to user
  for (const item of items) {
    if (item.vehicleId) {
      const v = await prisma.vehicle.findFirst({ where: { id: item.vehicleId, userId: session.user.id, deletedAt: null } });
      if (!v) return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });
    }
    if (item.boatId) {
      const b = await prisma.boat.findFirst({ where: { id: item.boatId, userId: session.user.id, deletedAt: null } });
      if (!b) return NextResponse.json({ error: "Boat not found" }, { status: 404 });
    }
  }

  // Self-heal: if no local subscription exists, check Stripe directly
  const userRecord = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { email: true },
  });
  if (userRecord?.email) {
    await ensureSubscriptionFromStripe(session.user.id, userRecord.email);
  }

  // Check subscription and weekly fill-up count
  const activeSubscription = await prisma.subscription.findFirst({
    where: { userId: session.user.id, status: "ACTIVE" },
  });

  // Add-ons are only available to subscribers
  if (addonItems.length > 0 && !activeSubscription) {
    return NextResponse.json({ error: "Add-ons (2nd vehicle, trailered boat) are available for subscribers only." }, { status: 403 });
  }

  const isBoatOnlyOrder = primaryItem.kind === "PRIMARY_BOAT";
  const isDefOnlyOrder = primaryItem.kind === "DEF_ONLY";

  let deliveryFeeCents = DELIVERY_FEE_STANDARD_CENTS;
  let subscriptionDelivery = false;

  if (isBoatOnlyOrder || isDefOnlyOrder) {
    // Boats and DEF-only orders never get subscription discount
    deliveryFeeCents = isBoatOnlyOrder ? BOAT_BASE_FEE_CENTS : DELIVERY_FEE_STANDARD_CENTS;
  } else if (activeSubscription) {
    const { weekStart, weekEnd } = getWeekBounds();
    const fillUpsThisWeek = await prisma.order.count({
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

    // Count fill-ups in the current order too
    const orderHasFillUp = items.some(
      (i) => i.isFillUp && ["PRIMARY_VEHICLE", "SECOND_VEHICLE", "TRAILERED_BOAT"].includes(i.kind)
    );

    if (fillUpsThisWeek === 0) {
      deliveryFeeCents = 0;
      subscriptionDelivery = true;
    } else if (fillUpsThisWeek === 1 && orderHasFillUp) {
      deliveryFeeCents = SECOND_FILLUP_FEE_CENTS;
    } else if (fillUpsThisWeek >= 2 && orderHasFillUp) {
      return NextResponse.json(
        { error: "Weekly fill-up limit reached (2 per week). Contact us if you need additional service." },
        { status: 400 }
      );
    } else {
      // Non-fill-up order from subscriber: no extra delivery fee beyond what's included
      deliveryFeeCents = 0;
      subscriptionDelivery = true;
    }
  }

  // Build order items data
  const orderItemsData = items.map((item) => {
    // DEF fluid items use a fixed price table (not per-gallon fuel pricing)
    if (item.kind === "DEF_ADDON" || item.kind === "DEF_ONLY") {
      const defGallons = item.gallons ?? 0;
      const defPriceCents = DEF_PRICES[defGallons];
      if (!defPriceCents) {
        throw new Error(`Invalid DEF size: ${defGallons} gallons. Valid sizes: 2.5, 5`);
      }
      return {
        kind: item.kind,
        vehicleId: undefined,
        boatId: undefined,
        fuelType: "DIESEL" as const,
        gallons: defGallons,
        isFillUp: false,
        pricePerGallonCents: 0,
        gasCents: defPriceCents,
        serviceFeeCents: 0,
        authAmountCents: null,
        notes: item.notes,
        itemMake: undefined,
        itemModel: undefined,
        itemYear: undefined,
        itemColor: undefined,
        itemPlate: undefined,
        itemRegNumber: undefined,
      };
    }

    const pricePerGallonCents = priceMap.get(item.fuelType)!;
    const maxGallons = item.kind === "PRIMARY_BOAT" || item.kind === "TRAILERED_BOAT"
      ? FILL_UP_MAX_GALLONS_BOAT
      : FILL_UP_MAX_GALLONS;
    const actualGallons = item.isFillUp ? maxGallons : (item.gallons ?? 0);
    const gasCents = item.isFillUp ? 0 : Math.round(pricePerGallonCents * actualGallons);
    const authAmountCents = item.isFillUp
      ? Math.round(pricePerGallonCents * maxGallons)
      : null;

    let serviceFeeCents = 0;
    if (item.kind === "SECOND_VEHICLE") serviceFeeCents = SECOND_VEHICLE_ADDON_CENTS;
    if (item.kind === "TRAILERED_BOAT") serviceFeeCents = TRAILERED_BOAT_ADDON_CENTS;

    return {
      kind: item.kind,
      vehicleId: item.vehicleId,
      boatId: item.boatId,
      fuelType: item.fuelType,
      gallons: actualGallons,
      isFillUp: item.isFillUp ?? false,
      pricePerGallonCents,
      gasCents,
      serviceFeeCents,
      authAmountCents,
      notes: item.notes,
      itemMake: item.itemMake,
      itemModel: item.itemModel,
      itemYear: item.itemYear,
      itemColor: item.itemColor,
      itemPlate: item.itemPlate,
      itemRegNumber: item.itemRegNumber,
    };
  });

  const totalGasCents = orderItemsData.reduce((s, i) => s + i.gasCents, 0);
  const totalServiceFeeAddonCents = orderItemsData.reduce((s, i) => s + i.serviceFeeCents, 0);
  const totalCents = deliveryFeeCents + totalGasCents + totalServiceFeeAddonCents;

  const hasFillUp = orderItemsData.some((i) => i.isFillUp);
  const authAmountCents = hasFillUp
    ? deliveryFeeCents +
      orderItemsData.reduce((s, i) => s + (i.authAmountCents ?? i.gasCents), 0) +
      totalServiceFeeAddonCents
    : null;

  // Legacy top-level fields from primary item (for backward compat with existing admin UI)
  const primaryPrice = priceMap.get(primaryItem.fuelType)!;
  const primaryActualGallons = primaryItem.isFillUp
    ? (primaryItem.kind === "PRIMARY_BOAT" ? FILL_UP_MAX_GALLONS_BOAT : FILL_UP_MAX_GALLONS)
    : (primaryItem.gallons ?? 0);

  const order = await prisma.order.create({
    data: {
      userId: session.user.id,
      vehicleId: primaryItem.vehicleId,
      addressId,
      fuelType: primaryItem.fuelType,
      gallons: primaryActualGallons,
      pricePerGallonCents: primaryPrice,
      deliveryFeeCents,
      totalCents,
      subscriptionDelivery,
      isFillUp: primaryItem.isFillUp ?? false,
      status: scheduledAt ? "PENDING" : "ACTIVE",
      authAmountCents,
      pinLat,
      pinLng,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      notes,
      items: { create: orderItemsData },
    },
    include: {
      items: true,
      vehicle: { select: { make: true, model: true, year: true, nickname: true } },
      address: { select: { street: true, city: true, state: true, zip: true } },
    },
  });

  notifyOrderStatus(order.id, scheduledAt ? "PENDING" : "ACTIVE").catch(() => {});

  // Fire SMS if ASAP order (no scheduledAt = active immediately)
  if (!scheduledAt) {
    notifyOrderActive(order.id, "ASAP").catch(() => {});
  }

  return NextResponse.json(order, { status: 201 });
}
