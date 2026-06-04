import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { DayOfWeek } from "@prisma/client";

// Map JS day (0=Sunday) to our DayOfWeek enum
const DAY_MAP: Record<number, DayOfWeek> = {
  0: "SUNDAY",
  1: "MONDAY",
  2: "TUESDAY",
  3: "WEDNESDAY",
  4: "THURSDAY",
  5: "FRIDAY",
  6: "SATURDAY",
};

/**
 * Get the UTC offset for America/Chicago (Central Time) on a given date.
 * CDT (March–November) = UTC-5, CST (November–March) = UTC-6.
 * We detect DST by checking if the date falls within DST boundaries.
 */
function getCentralUtcOffset(date: Date): number {
  // DST in the US: starts 2nd Sunday of March, ends 1st Sunday of November
  const year = date.getUTCFullYear();

  // Find 2nd Sunday of March
  const marchFirst = new Date(Date.UTC(year, 2, 1)); // March 1
  const marchFirstDay = marchFirst.getUTCDay(); // 0=Sun
  const dstStart = new Date(Date.UTC(year, 2, 8 + (7 - marchFirstDay) % 7, 8, 0, 0)); // 2nd Sunday at 2AM CST = 8AM UTC

  // Find 1st Sunday of November
  const novFirst = new Date(Date.UTC(year, 10, 1)); // November 1
  const novFirstDay = novFirst.getUTCDay();
  const dstEnd = new Date(Date.UTC(year, 10, 1 + (7 - novFirstDay) % 7, 7, 0, 0)); // 1st Sunday at 2AM CDT = 7AM UTC

  // If date is between DST start and DST end, we're in CDT (UTC-5)
  if (date >= dstStart && date < dstEnd) {
    return 5; // CDT: UTC-5
  }
  return 6; // CST: UTC-6
}

// Cron secret to prevent unauthorized access
const CRON_SECRET = process.env.CRON_SECRET || "";

// GET handler — Railway cron and most cron services send GET requests
export async function GET(req: NextRequest) {
  return handleRecurringOrders(req);
}

// POST handler — for manual triggers or services that use POST
export async function POST(req: NextRequest) {
  return handleRecurringOrders(req);
}

async function handleRecurringOrders(req: NextRequest) {
  // Verify cron secret
  const authHeader = req.headers.get("authorization");
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  // Get today's date and day-of-week in Central Time
  const centralOffset = getCentralUtcOffset(now);
  const centralNow = new Date(now.getTime() - centralOffset * 60 * 60 * 1000);
  const todayDayOfWeek = DAY_MAP[centralNow.getUTCDay()];
  const todayDate = centralNow.toISOString().split("T")[0]; // YYYY-MM-DD in Central

  // Find all active recurring orders for today's day of week
  const recurringOrders = await prisma.recurringOrder.findMany({
    where: {
      isActive: true,
      dayOfWeek: todayDayOfWeek,
    },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          subscriptions: {
            where: { status: "ACTIVE" },
            take: 1,
          },
        },
      },
      vehicle: true,
      address: true,
    },
  });

  const results: { id: string; status: string; orderId?: string; error?: string }[] = [];

  for (const recurring of recurringOrders) {
    try {
      // Skip if already processed today AND the order still exists and isn't cancelled/deleted
      if (recurring.lastOrderDate && recurring.lastOrderId) {
        const lastDate = new Date(recurring.lastOrderDate).toISOString().split("T")[0];
        if (lastDate === todayDate) {
          // Check if that order still exists and is not cancelled
          const existingOrder = await prisma.order.findUnique({
            where: { id: recurring.lastOrderId },
            select: { status: true },
          });
          if (existingOrder && existingOrder.status !== "CANCELLED") {
            results.push({ id: recurring.id, status: "skipped", error: "Already processed today" });
            continue;
          }
          // Order was cancelled or deleted — allow re-creation
        }
      }

      // Verify user still has active subscription
      if (!recurring.user.subscriptions || recurring.user.subscriptions.length === 0) {
        results.push({ id: recurring.id, status: "skipped", error: "No active subscription" });
        continue;
      }

      const subscription = recurring.user.subscriptions[0];

      // ===== PRE-CHARGE FIRST — No ticket if this fails =====
      const stripeCustomerId = subscription.stripeCustomerId;

      // Get the customer's default payment method
      const paymentMethods = await stripe.paymentMethods.list({
        customer: stripeCustomerId,
        type: "card",
        limit: 1,
      });

      if (paymentMethods.data.length === 0) {
        // No card on file — skip, no ticket created
        results.push({ id: recurring.id, status: "skipped", error: "No payment method on file — no ticket created" });
        continue;
      }

      const paymentMethod = paymentMethods.data[0];

      // Attempt $40 pre-authorization (manual capture) BEFORE creating the order
      let paymentIntent;
      try {
        paymentIntent = await stripe.paymentIntents.create({
          amount: 4000, // $40.00
          currency: "usd",
          capture_method: "manual",
          customer: stripeCustomerId,
          payment_method: paymentMethod.id,
          off_session: true,
          confirm: true,
          metadata: {
            userId: recurring.user.id,
            recurringOrderId: recurring.id,
            isFillUp: "true",
          },
        });
      } catch (stripeError: any) {
        // Pre-charge FAILED — do NOT create ticket
        results.push({
          id: recurring.id,
          status: "skipped",
          error: `Pre-charge failed: ${stripeError.message} — no ticket created`,
        });
        continue;
      }

      // ===== PRE-CHARGE SUCCEEDED — Now create the order ticket =====

      // Check weekly fill-up count (Sunday midnight to Sunday midnight)
      const weekStart = getWeekStart(now);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);

      const weeklyOrderCount = await prisma.order.count({
        where: {
          userId: recurring.user.id,
          subscriptionDelivery: true,
          createdAt: { gte: weekStart, lt: weekEnd },
          status: { notIn: ["CANCELLED"] },
        },
      });

      // Determine delivery fee: 1st order of the week = free, 2nd+ = $10
      const deliveryFeeCents = weeklyOrderCount === 0 ? 0 : 1000;

      // Calculate scheduled time — use start of window (windowFrom) for scheduledAt
      // windowFrom/windowTo are stored as "HH:MM" in Central Time
      const windowFrom = (recurring as any).windowFrom || recurring.preferredTime || "08:00";
      const windowTo = (recurring as any).windowTo || "17:00";
      const [hours, minutes] = windowFrom.split(":").map(Number);
      const scheduledAt = new Date(now);
      const offset = getCentralUtcOffset(now);
      scheduledAt.setUTCHours(hours + offset, minutes, 0, 0);

      // Store raw HH:MM format
      const availableFromStr = windowFrom;
      const availableToStr = windowTo;

      // For fill-ups, we authorize $40 (4000 cents) pre-authorization
      const authAmountCents = 4000; // $40 pre-authorization

      // Create the order — pre-authorization already succeeded so we go straight to ACTIVE
      const order = await prisma.order.create({
        data: {
          userId: recurring.user.id,
          vehicleId: recurring.vehicleId,
          addressId: recurring.addressId,
          fuelType: recurring.fuelType,
          gallons: 0, // Fill-up — actual gallons entered at completion
          pricePerGallonCents: 0, // Price entered at completion
          deliveryFeeCents,
          totalCents: authAmountCents, // Will be updated after actual fill
          subscriptionDelivery: true,
          isFillUp: recurring.isFillUp,
          authAmountCents,
          scheduledAt,
          availableFrom: availableFromStr,
          availableTo: availableToStr,
          notes: recurring.notes ? `[Recurring] ${recurring.notes}` : "[Recurring order]",
          pinLat: recurring.address.lat,
          pinLng: recurring.address.lng,
          stripePaymentIntentId: paymentIntent.id,
          stripeCustomerId,
          stripePaymentMethodId: paymentMethod.id,
          status: "ACTIVE",
          items: {
            create: {
              kind: "PRIMARY_VEHICLE",
              vehicleId: recurring.vehicleId,
              fuelType: recurring.fuelType,
              gallons: null, // Fill-up — actual gallons entered at completion
              isFillUp: true,
              pricePerGallonCents: 0, // Price entered at completion
              gasCents: 0, // Calculated at completion
              serviceFeeCents: deliveryFeeCents,
              authAmountCents,
            },
          },
        },
      });

      // Update the payment intent metadata with the new order ID
      await stripe.paymentIntents.update(paymentIntent.id, {
        metadata: {
          orderId: order.id,
          userId: recurring.user.id,
          recurringOrderId: recurring.id,
          isFillUp: "true",
        },
      });

      // Update recurring order with last processed info
      await prisma.recurringOrder.update({
        where: { id: recurring.id },
        data: {
          lastOrderId: order.id,
          lastOrderDate: now,
        },
      });

      results.push({ id: recurring.id, status: "created", orderId: order.id });
    } catch (error: any) {
      results.push({ id: recurring.id, status: "error", error: error.message });
    }
  }

  // Also count total recurring orders in DB for debugging
  const totalRecurring = await prisma.recurringOrder.count();
  const activeRecurring = await prisma.recurringOrder.count({ where: { isActive: true } });

  return NextResponse.json({
    processed: results.length,
    day: todayDayOfWeek,
    date: todayDate,
    serverTimeUTC: now.toISOString(),
    centralOffset,
    foundForToday: recurringOrders.length,
    totalRecurringInDB: totalRecurring,
    activeRecurringInDB: activeRecurring,
    recurringOrdersFound: recurringOrders.map(r => ({
      id: r.id,
      dayOfWeek: r.dayOfWeek,
      isActive: r.isActive,
      userEmail: r.user.email,
      hasSubscription: r.user.subscriptions.length > 0,
      lastOrderDate: r.lastOrderDate,
      lastOrderId: r.lastOrderId,
    })),
    results,
  });
}

/**
 * Get the start of the current week (Sunday at midnight)
 */
function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0 = Sunday
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}
