import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { orderSchema, guestOrderSchema, guestBoatOrderSchema } from "@/lib/validators";
import { isInAnyServiceArea } from "@/lib/serviceAreaCheck";
import { geocodeAddress } from "@/lib/geocode";
import { notifyOrderStatus } from "@/lib/notifications";
import { ensureSubscriptionFromStripe } from "@/lib/subscriptions";

// Delivery fee is now read from admin settings (siteSetting table)
async function getDeliveryFeeCents(): Promise<number> {
  const setting = await prisma.siteSetting.findUnique({ where: { key: "delivery_fee_cents" } });
  return setting ? parseInt(setting.value, 10) : 1500; // fallback $15 if not set
}
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

// Helper: get today's date string in Central Time (America/Chicago)
function getTodayCT(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Chicago" }); // returns YYYY-MM-DD
}

// If scheduled for today → ACTIVE, if future → PENDING, if no schedule → ACTIVE
function getOrderStatus(scheduledAt: string | undefined | null): "ACTIVE" | "PENDING" {
  if (!scheduledAt) return "ACTIVE";
  const scheduledDate = new Date(scheduledAt).toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
  const todayCT = getTodayCT();
  if (scheduledDate === todayCT) return "ACTIVE";
  return "PENDING";
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

    // Auto-promote PENDING orders whose scheduled date is today (Central Time) or earlier → ACTIVE
    // Get end of today in Central Time, then convert to UTC for DB comparison
    const todayCT = getTodayCT(); // YYYY-MM-DD in Central Time
    const endOfTodayCT = new Date(todayCT + "T23:59:59.999-05:00"); // CDT (UTC-5)
    await prisma.order.updateMany({
      where: {
        status: "PENDING",
        scheduledAt: { lte: endOfTodayCT },
      },
      data: { status: "ACTIVE" },
    });

    const orders = await prisma.order.findMany({
      where: isAdmin ? {} : { userId: session.user.id },
      include: {
        vehicle: { select: { make: true, model: true, year: true, color: true, nickname: true, licensePlate: true, fuelCapSide: true } },
        address: { select: { street: true, city: true, state: true, zip: true, label: true } },
        user: isAdmin ? { select: { name: true, email: true, phone: true } } : false,
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
  } catch (err: any) {
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
    const { guestName, guestEmail, guestPhone, street, city, state, zip, scheduledAt, notes, gallons: defGallons, availableFrom, availableTo } = body;
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
    const deliveryFeeCents = await getDeliveryFeeCents();
    const totalCents = defPriceCents + deliveryFeeCents;

    const order = await prisma.order.create({
      data: {
        status: getOrderStatus(scheduledAt),
        fuelType: "DIESEL",
        gallons: defGallons,
        pricePerGallonCents: 0,
        deliveryFeeCents,
        totalCents,
        isFillUp: false,
        pinLat,
        pinLng,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        availableFrom: availableFrom || null,
        availableTo: availableTo || null,
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

    return NextResponse.json(order, { status: 201 });
  }

  // --- GUEST BOAT ORDER (dollar amount or fill up) ---
  if (isBoatGuest) {
    const parsed = guestBoatOrderSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const {
      fuelType, prefundedCents, isFillUp, scheduledAt, notes, availableFrom, availableTo,
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

    const deliveryFeeCents = BOAT_BASE_FEE_CENTS;
    // For fill-up: pre-auth $1 + service fee. For dollar amount: prefunded + service fee.
    const fuelPreAuthCents = isFillUp ? 100 : (prefundedCents ?? 0);
    const totalCents = fuelPreAuthCents + deliveryFeeCents;
    // authAmountCents = total hold on the card (fuel + service fee)
    const authAmountCents = totalCents;

    const order = await prisma.order.create({
      data: {
        status: getOrderStatus(scheduledAt),
        fuelType,
        gallons: null, // determined at completion
        pricePerGallonCents: 0, // determined at completion
        deliveryFeeCents,
        totalCents,
        isFillUp: isFillUp ?? false,
        authAmountCents,
        pinLat,
        pinLng,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        availableFrom: availableFrom || null,
        availableTo: availableTo || null,
        notes,
        guestName,
        guestEmail,
        guestPhone,
        guestAddress: JSON.stringify({ street, city, state, zip, lat: geo.lat, lng: geo.lng }),
        items: {
          create: [{
            kind: "PRIMARY_BOAT",
            fuelType,
            gallons: null,
            isFillUp: isFillUp ?? false,
            pricePerGallonCents: 0,
            gasCents: fuelPreAuthCents,
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

    return NextResponse.json(order, { status: 201 });
  }

  // --- GUEST VEHICLE ORDER (dollar amount or fill up) ---
  if (isGuest) {
    const parsed = guestOrderSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const {
      fuelType, prefundedCents, isFillUp, scheduledAt, notes, availableFrom, availableTo,
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

    const deliveryFeeCents = await getDeliveryFeeCents();
    // For fill-up: pre-auth $1 + delivery fee. For dollar amount: prefunded + delivery fee.
    const fuelPreAuthCents = isFillUp ? 100 : (prefundedCents ?? 0);
    const totalCents = fuelPreAuthCents + deliveryFeeCents;
    const authAmountCents = totalCents;

    const order = await prisma.order.create({
      data: {
        status: getOrderStatus(scheduledAt),
        fuelType,
        gallons: null, // determined at completion
        pricePerGallonCents: 0, // determined at completion
        deliveryFeeCents,
        totalCents,
        isFillUp: isFillUp ?? false,
        authAmountCents,
        pinLat,
        pinLng,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        availableFrom: availableFrom || null,
        availableTo: availableTo || null,
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
            gallons: null,
            isFillUp: isFillUp ?? false,
            pricePerGallonCents: 0,
            gasCents: fuelPreAuthCents,
            serviceFeeCents: 0,
            itemMake: vehicleMake,
            itemModel: vehicleModel,
            itemYear: vehicleYear,
            itemColor: vehicleColor,
          }],
        },
      },
    });

    return NextResponse.json(order, { status: 201 });
  }

  // --- AUTHENTICATED ORDER ---
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  console.log("[orders] AUTH order start", { userId: session.user.id, scheduledAt: body.scheduledAt, deliveryType: body.scheduledAt ? "scheduled" : "asap" });
  try {
  const parsed = orderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const { addressId, scheduledAt, notes, items, availableFrom, availableTo } = parsed.data;

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

  // Validate that the scheduled date falls on an open day
  if (scheduledAt) {
    const slotTime = new Date(scheduledAt);
    const dayNames = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
    const dayOfWeek = dayNames[slotTime.getDay()];
    const schedule = await prisma.serviceSchedule.findFirst({
      where: { dayOfWeek: dayOfWeek as never, isActive: true },
    });
    if (!schedule) {
      return NextResponse.json({ error: "We are not available on that day. Please choose another date." }, { status: 400 });
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

  const standardDeliveryFee = await getDeliveryFeeCents();
  let deliveryFeeCents = standardDeliveryFee;
  let subscriptionDelivery = false;

  if (isBoatOnlyOrder || isDefOnlyOrder) {
    // Boats and DEF-only orders never get subscription discount
    deliveryFeeCents = isBoatOnlyOrder ? BOAT_BASE_FEE_CENTS : standardDeliveryFee;
  } else if (activeSubscription) {
    const { weekStart, weekEnd } = getWeekBounds();
    const subOrdersThisWeek = await prisma.order.findMany({
      where: {
        userId: session.user.id,
        status: { notIn: ["CANCELLED"] },
        subscriptionDelivery: true,
        createdAt: { gte: weekStart, lt: weekEnd },
      },
      include: { items: { select: { isFillUp: true, kind: true } } },
    });
    const fillUpsThisWeek = subOrdersThisWeek.filter(o =>
      o.items.some(i => i.isFillUp && ["PRIMARY_VEHICLE", "SECOND_VEHICLE", "TRAILERED_BOAT"].includes(i.kind))
    ).length;

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
      // TEMPORARILY DISABLED FOR TESTING — re-enable later
      // return NextResponse.json(
      //   { error: "Weekly fill-up limit reached (2 per week). Contact us if you need additional service." },
      //   { status: 400 }
      // );
      deliveryFeeCents = SECOND_FILLUP_FEE_CENTS;
      subscriptionDelivery = true;
    } else {
      // Non-fill-up order from subscriber: no extra delivery fee beyond what's included
      deliveryFeeCents = 0;
      subscriptionDelivery = true;
    }
  }

  // Build order items data — now using dollar amounts instead of gallon-based pricing
  const orderItemsData = items.map((item) => {
    // DEF fluid items use a fixed price table (not per-gallon fuel pricing)
    if (item.kind === "DEF_ADDON" || item.kind === "DEF_ONLY") {
      const defGallons = item.prefundedCents ? 0 : 0; // DEF uses gallons field from old schema
      // For DEF, we still use the gallons approach since it's a fixed-price product
      // The frontend sends prefundedCents = DEF_PRICES[gallons] for DEF items
      const defPriceCents = item.prefundedCents ?? 0;
      return {
        kind: item.kind,
        vehicleId: undefined,
        boatId: undefined,
        fuelType: "DIESEL" as const,
        gallons: defPriceCents === 3000 ? 2.5 : defPriceCents === 5500 ? 5 : 0,
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

    // For fuel items: dollar amount pre-auth or fill-up ($1 pre-auth)
    const fuelPreAuthCents = item.isFillUp ? 100 : (item.prefundedCents ?? 0);

    let serviceFeeCents = 0;
    if (item.kind === "SECOND_VEHICLE") serviceFeeCents = SECOND_VEHICLE_ADDON_CENTS;
    if (item.kind === "TRAILERED_BOAT") serviceFeeCents = TRAILERED_BOAT_ADDON_CENTS;

    return {
      kind: item.kind,
      vehicleId: item.vehicleId,
      boatId: item.boatId,
      fuelType: item.fuelType,
      gallons: null, // determined at completion
      isFillUp: item.isFillUp ?? false,
      pricePerGallonCents: 0, // determined at completion
      gasCents: fuelPreAuthCents, // stores the pre-funded amount (or $1 for fill-up)
      serviceFeeCents,
      authAmountCents: fuelPreAuthCents + serviceFeeCents,
      notes: item.notes,
      itemMake: item.itemMake,
      itemModel: item.itemModel,
      itemYear: item.itemYear,
      itemColor: item.itemColor,
      itemPlate: item.itemPlate,
      itemRegNumber: item.itemRegNumber,
    };
  });

  // Total = delivery fee + sum of all item pre-auth amounts
  const totalFuelPreAuth = orderItemsData.reduce((s, i) => s + (i.gasCents || 0), 0);
  const totalServiceFeeAddonCents = orderItemsData.reduce((s, i) => s + i.serviceFeeCents, 0);
  const totalCents = deliveryFeeCents + totalFuelPreAuth + totalServiceFeeAddonCents;
  // authAmountCents = total hold on card (everything is a pre-auth now)
  const authAmountCents = totalCents;

  // Legacy top-level fields from primary item (for backward compat with existing admin UI)
  const order = await prisma.order.create({
    data: {
      status: getOrderStatus(scheduledAt),
      userId: session.user.id,
      vehicleId: primaryItem.vehicleId,
      addressId,
      fuelType: primaryItem.fuelType,
      gallons: null, // determined at completion
      pricePerGallonCents: 0, // determined at completion
      deliveryFeeCents,
      totalCents,
      subscriptionDelivery,
      isFillUp: primaryItem.isFillUp ?? false,
      authAmountCents,
      pinLat,
      pinLng,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      availableFrom: availableFrom || null,
      availableTo: availableTo || null,
      notes,
      items: { create: orderItemsData },
    },
    include: {
      items: true,
      vehicle: { select: { make: true, model: true, year: true, nickname: true } },
      address: { select: { street: true, city: true, state: true, zip: true } },
    },
  });

  notifyOrderStatus(order.id, getOrderStatus(scheduledAt)).catch(() => {});
  console.log("[orders] AUTH order SUCCESS", { orderId: order.id, status: getOrderStatus(scheduledAt), totalCents });
  return NextResponse.json(order, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[orders] AUTH order ERROR:", message, err);
    return NextResponse.json({ error: "Order creation failed: " + message }, { status: 500 });
  }
}
