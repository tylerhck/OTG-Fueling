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

export async function POST(req: NextRequest) {
  // Verify cron secret
  const authHeader = req.headers.get("authorization");
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  // Get today's date and day-of-week in Central Time
  // The cron fires at 6 AM CDT, so the server (UTC) sees 11 AM UTC — same calendar day.
  // But to be safe, we derive the Central date explicitly.
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
      // Skip if already processed today
      if (recurring.lastOrderDate) {
        const lastDate = new Date(recurring.lastOrderDate).toISOString().split("T")[0];
        if (lastDate === todayDate) {
          results.push({ id: recurring.id, status: "skipped", error: "Already processed today" });
          continue;
        }
      }

      // Verify user still has active subscription
      if (!recurring.user.subscriptions || recurring.user.subscriptions.length === 0) {
        results.push({ id: recurring.id, status: "skipped", error: "No active subscription" });
        continue;
      }

      const subscription = recurring.user.subscriptions[0];

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

      // Max 2 fill-ups per week for subscribers
      if (weeklyOrderCount >= 2) {
        results.push({ id: recurring.id, status: "skipped", error: "Weekly limit reached (2/2)" });
        continue;
      }

      // Determine delivery fee
      const deliveryFeeCents = weeklyOrderCount === 0 ? 0 : 1000; // 1st free, 2nd $10

      // Get fuel price
      const fuelPrice = await prisma.fuelPrice.findUnique({
        where: { fuelType: recurring.fuelType },
      });
      if (!fuelPrice) {
        results.push({ id: recurring.id, status: "error", error: "No fuel price configured" });
        continue;
      }

      // Calculate scheduled time — preferredTime is in Central Time (America/Chicago)
      // Convert to UTC by adding the offset (5 for CDT, 6 for CST)
      const [hours, minutes] = recurring.preferredTime.split(":").map(Number);
      const scheduledAt = new Date(now);
      const centralOffset = getCentralUtcOffset(now);
      scheduledAt.setUTCHours(hours + centralOffset, minutes, 0, 0);

      // For fill-ups, we authorize $1 (100 cents) to verify card
      const authAmountCents = 100; // $1 pre-authorization

      // Create the order
      const order = await prisma.order.create({
        data: {
          userId: recurring.user.id,
          vehicleId: recurring.vehicleId,
          addressId: recurring.addressId,
          fuelType: recurring.fuelType,
          gallons: recurring.isFillUp ? 30 : recurring.gallons, // max estimate for fill-up
          pricePerGallonCents: fuelPrice.effectivePriceCents,
          deliveryFeeCents,
          totalCents: authAmountCents, // Will be updated after actual fill
          subscriptionDelivery: true,
          isFillUp: recurring.isFillUp,
          authAmountCents,
          scheduledAt,
          notes: recurring.notes ? `[Recurring] ${recurring.notes}` : "[Recurring order]",
          pinLat: recurring.address.lat,
          pinLng: recurring.address.lng,
          items: {
            create: {
              kind: "PRIMARY_VEHICLE",
              vehicleId: recurring.vehicleId,
              fuelType: recurring.fuelType,
              gallons: recurring.isFillUp ? null : recurring.gallons,
              isFillUp: recurring.isFillUp,
              pricePerGallonCents: fuelPrice.effectivePriceCents,
              gasCents: recurring.isFillUp ? 0 : Math.round((recurring.gallons || 0) * fuelPrice.effectivePriceCents),
              serviceFeeCents: deliveryFeeCents,
              authAmountCents,
            },
          },
        },
      });

      // Create Stripe $1 pre-authorization using saved payment method
      try {
        const stripeCustomerId = subscription.stripeCustomerId;

        // Get the customer's default payment method
        const paymentMethods = await stripe.paymentMethods.list({
          customer: stripeCustomerId,
          type: "card",
          limit: 1,
        });

        if (paymentMethods.data.length > 0) {
          const paymentMethod = paymentMethods.data[0];

          // Create $1 pre-auth (manual capture)
          const paymentIntent = await stripe.paymentIntents.create({
            amount: 100, // $1.00
            currency: "usd",
            capture_method: "manual",
            customer: stripeCustomerId,
            payment_method: paymentMethod.id,
            off_session: true,
            confirm: true,
            metadata: {
              orderId: order.id,
              userId: recurring.user.id,
              recurringOrderId: recurring.id,
              isFillUp: "true",
            },
          });

          // Update order with Stripe info
          await prisma.order.update({
            where: { id: order.id },
            data: {
              stripePaymentIntentId: paymentIntent.id,
              stripeCustomerId,
              stripePaymentMethodId: paymentMethod.id,
              status: "PENDING",
            },
          });
        } else {
          // No payment method on file - mark order as needing payment
          await prisma.order.update({
            where: { id: order.id },
            data: {
              notes: `${order.notes || ""} [NEEDS PAYMENT - no card on file]`,
            },
          });
        }
      } catch (stripeError: any) {
        // Stripe failed - still create order but mark it
        await prisma.order.update({
          where: { id: order.id },
          data: {
            notes: `${order.notes || ""} [PRE-AUTH FAILED: ${stripeError.message}]`,
          },
        });
      }

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

  return NextResponse.json({
    processed: results.length,
    day: todayDayOfWeek,
    date: todayDate,
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
