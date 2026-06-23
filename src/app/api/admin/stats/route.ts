import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
    referralUsers,
    otgfreeCount,
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
    prisma.user.findMany({
      where: { referralSource: { not: null } },
      select: { referralSource: true },
    }),
    prisma.subscription.count({ where: { promoCode: "OTGFREE", status: "ACTIVE" } }),
  ]);

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
    totalCustomers,
    totalSubscribers,
    totalGallons: gallonsResult._sum.gallons || 0,
    pageViewsTotal: parseInt(pageViews?.value || "0", 10),
    uniqueVisitorsTotal: parseInt(uniqueVisitors?.value || "0", 10),
    heatMapPoints: heatMapData.map((o: { pinLat: number | null; pinLng: number | null }) => ({
      lat: o.pinLat,
      lng: o.pinLng,
    })),
    referralStats: referralUsers.reduce((acc: Record<string, number>, u: { referralSource: string | null }) => {
      const src = u.referralSource || "Unknown";
      acc[src] = (acc[src] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
    promoCodes: {
      OTGFREE: otgfreeCount,
    },
  });
}
