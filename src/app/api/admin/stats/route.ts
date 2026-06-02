import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id || (session.user as { role: string }).role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [
    totalOrders,
    pendingOrders,
    todayOrders,
    completedOrders,
    cancelledOrders,
    revenueResult,
    totalCustomers,
    totalSubscribers,
    gallonsResult,
    pageViews,
    uniqueVisitors,
    heatMapData,
  ] = await Promise.all([
    prisma.order.count({ where: { status: { not: "AWAITING_PAYMENT" } } }),
    prisma.order.count({ where: { status: "PENDING" } }),
    prisma.order.count({ where: { createdAt: { gte: today }, status: { not: "AWAITING_PAYMENT" } } }),
    prisma.order.count({ where: { status: "COMPLETED" } }),
    prisma.order.count({ where: { status: "CANCELLED" } }),
    prisma.order.aggregate({
      _sum: { totalCents: true },
      where: { status: { in: ["CONFIRMED", "IN_PROGRESS", "COMPLETED"] } },
    }),
    prisma.user.count({ where: { role: "CUSTOMER" } }),
    prisma.subscription.count({ where: { status: "ACTIVE" } }),
    // Total gallons delivered across all completed orders
    prisma.order.aggregate({
      _sum: { gallons: true },
      where: { status: { in: ["CONFIRMED", "IN_PROGRESS", "COMPLETED"] } },
    }),
    prisma.siteSetting.findUnique({ where: { key: "page_views_total" } }),
    prisma.siteSetting.findUnique({ where: { key: "unique_visitors_total" } }),
    prisma.order.findMany({
      where: { pinLat: { not: null }, pinLng: { not: null }, status: { not: "AWAITING_PAYMENT" } },
      select: { pinLat: true, pinLng: true, status: true },
    }),
  ]);

  // Calculate net revenue from Stripe (all-time net after fees, refunds, coupons)
  let netRevenueCents = 0;
  try {
    // Sum all balance transactions (net = amount after Stripe fees and refunds)
    let hasMore = true;
    let startingAfter: string | undefined;
    while (hasMore) {
      const transactions = await stripe.balanceTransactions.list({
        limit: 100,
        ...(startingAfter ? { starting_after: startingAfter } : {}),
      });
      for (const txn of transactions.data) {
        // net is already in cents, includes fees subtracted and refunds as negative
        netRevenueCents += txn.net;
      }
      hasMore = transactions.has_more;
      if (transactions.data.length > 0) {
        startingAfter = transactions.data[transactions.data.length - 1].id;
      }
    }
  } catch (err) {
    console.error("Failed to fetch Stripe balance transactions:", err);
    // Fall back to 0 if Stripe API fails
  }

  const totalNonAwaitingOrders = totalOrders;
  const cancellationRate = totalNonAwaitingOrders > 0
    ? Math.round((cancelledOrders / totalNonAwaitingOrders) * 100)
    : 0;

  return NextResponse.json({
    totalOrders,
    pendingOrders,
    todayOrders,
    completedOrders,
    cancelledOrders,
    cancellationRate,
    totalRevenueCents: revenueResult._sum.totalCents || 0,
    netRevenueCents,
    totalCustomers,
    totalSubscribers,
    totalGallons: gallonsResult._sum.gallons || 0,
    pageViewsTotal: parseInt(pageViews?.value || "0", 10),
    uniqueVisitorsTotal: parseInt(uniqueVisitors?.value || "0", 10),
    heatMapPoints: heatMapData.map((o: { pinLat: number | null; pinLng: number | null }) => ({
      lat: o.pinLat,
      lng: o.pinLng,
    })),
  });
}
