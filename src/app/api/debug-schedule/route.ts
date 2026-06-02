import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const results: Record<string, unknown> = {};
  const timings: Record<string, number> = {};

  try {
    // Test 1: Basic serviceSchedule query (what scheduled orders use)
    let t0 = Date.now();
    const schedules = await prisma.serviceSchedule.findFirst({
      where: { dayOfWeek: "MONDAY" as never, isActive: true },
    });
    timings["serviceSchedule.findFirst"] = Date.now() - t0;
    results["scheduleResult"] = schedules ? "found" : "null";

    // Test 2: findMany all schedules
    t0 = Date.now();
    const allSchedules = await prisma.serviceSchedule.findMany({
      where: { isActive: true },
    });
    timings["serviceSchedule.findMany"] = Date.now() - t0;
    results["totalSchedules"] = allSchedules.length;

    // Test 3: order.findMany with subscription filter (the one we fixed)
    t0 = Date.now();
    const now = new Date();
    const day = now.getDay();
    const diffToMonday = day === 0 ? 6 : day - 1;
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - diffToMonday);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);
    const subOrders = await prisma.order.findMany({
      where: {
        status: { notIn: ["CANCELLED"] },
        subscriptionDelivery: true,
        createdAt: { gte: weekStart, lt: weekEnd },
      },
      include: { items: { select: { isFillUp: true, kind: true } } },
      take: 10,
    });
    timings["order.findMany(subDelivery)"] = Date.now() - t0;
    results["subOrdersCount"] = subOrders.length;

    // Test 4: Simple order count
    t0 = Date.now();
    const orderCount = await prisma.order.count();
    timings["order.count()"] = Date.now() - t0;
    results["totalOrders"] = orderCount;

    return NextResponse.json({ ok: true, timings, results });
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error, timings, results }, { status: 500 });
  }
}
