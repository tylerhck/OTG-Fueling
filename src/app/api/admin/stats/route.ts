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
    revenueResult,
    totalCustomers,
    gallonsResult,
    pageViews,
    uniqueVisitors,
  ] = await Promise.all([
    prisma.order.count({ where: { status: { not: "AWAITING_PAYMENT" } } }),
    prisma.order.count({ where: { status: "PENDING" } }),
    prisma.order.count({ where: { createdAt: { gte: today }, status: { not: "AWAITING_PAYMENT" } } }),
    prisma.order.aggregate({
      _sum: { totalCents: true },
      where: { status: { in: ["CONFIRMED", "IN_PROGRESS", "COMPLETED"] } },
    }),
    prisma.user.count({ where: { role: "CUSTOMER" } }),
    // Total gallons delivered across all completed order items
    prisma.orderItem.aggregate({
      _sum: { gallons: true },
      where: {
        order: { status: { in: ["CONFIRMED", "IN_PROGRESS", "COMPLETED"] } },
      },
    }),
    prisma.siteSetting.findUnique({ where: { key: "page_views_total" } }),
    prisma.siteSetting.findUnique({ where: { key: "unique_visitors_total" } }),
  ]);

  return NextResponse.json({
    totalOrders,
    pendingOrders,
    todayOrders,
    totalRevenueCents: revenueResult._sum.totalCents || 0,
    totalCustomers,
    totalGallons: gallonsResult._sum.gallons || 0,
    pageViewsTotal: parseInt(pageViews?.value || "0", 10),
    uniqueVisitorsTotal: parseInt(uniqueVisitors?.value || "0", 10),
  });
}
