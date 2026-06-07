import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", { apiVersion: "2025-04-30.basil" as any });

export async function GET(req: NextRequest) {
  try {
    const period = req.nextUrl.searchParams.get("period") || "all";

    // Calculate date filter
    let dateFilter: Date | null = null;
    const now = new Date();
    if (period === "today") {
      dateFilter = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (period === "week") {
      dateFilter = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (period === "month") {
      dateFilter = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    // Fetch completed orders
    const whereClause: any = { status: "COMPLETED" };
    if (dateFilter) {
      whereClause.createdAt = { gte: dateFilter };
    }

    const orders = await prisma.order.findMany({
      where: whereClause,
      select: {
        totalCents: true,
        deliveryFeeCents: true,
        gallons: true,
        pricePerGallonCents: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    // Calculate fuel vs service fee totals
    let fuelRevenue = 0;
    let serviceFeeRevenue = 0;
    let totalGallons = 0;

    for (const order of orders) {
      serviceFeeRevenue += order.deliveryFeeCents || 0;
      const fuelCost = order.totalCents - (order.deliveryFeeCents || 0);
      fuelRevenue += Math.max(0, fuelCost);
      totalGallons += order.gallons || 0;
    }

    // Fetch subscription revenue from Stripe
    let subscriptionRevenue = 0;
    try {
      // Get charges from Stripe that are subscription-related
      const listParams: any = { limit: 100 };
      if (dateFilter) {
        listParams.created = { gte: Math.floor(dateFilter.getTime() / 1000) };
      }

      // Use Stripe to get subscription invoices paid
      const invoices = await stripe.invoices.list({
        ...listParams,
        status: "paid",
        collection_method: "charge_automatically",
      });

      for (const invoice of invoices.data) {
        if (invoice.subscription) {
          subscriptionRevenue += invoice.amount_paid; // already in cents
        }
      }

      // If there are more, paginate
      let hasMore = invoices.has_more;
      let lastId = invoices.data.length > 0 ? invoices.data[invoices.data.length - 1].id : null;
      while (hasMore && lastId) {
        const more = await stripe.invoices.list({
          ...listParams,
          status: "paid",
          collection_method: "charge_automatically",
          starting_after: lastId,
        });
        for (const invoice of more.data) {
          if (invoice.subscription) {
            subscriptionRevenue += invoice.amount_paid;
          }
        }
        hasMore = more.has_more;
        lastId = more.data.length > 0 ? more.data[more.data.length - 1].id : null;
      }
    } catch (stripeErr) {
      console.error("Stripe subscription fetch error:", stripeErr);
      // Continue without subscription data
    }

    const totalRevenue = fuelRevenue + serviceFeeRevenue + subscriptionRevenue;

    // Monthly breakdown (from orders)
    const monthlyMap: Record<string, { fuelRevenue: number; serviceFeeRevenue: number; subscriptionRevenue: number; gallons: number; orders: number }> = {};

    for (const order of orders) {
      const d = new Date(order.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!monthlyMap[key]) {
        monthlyMap[key] = { fuelRevenue: 0, serviceFeeRevenue: 0, subscriptionRevenue: 0, gallons: 0, orders: 0 };
      }
      const fuel = Math.max(0, order.totalCents - (order.deliveryFeeCents || 0));
      monthlyMap[key].fuelRevenue += fuel;
      monthlyMap[key].serviceFeeRevenue += order.deliveryFeeCents || 0;
      monthlyMap[key].gallons += order.gallons || 0;
      monthlyMap[key].orders += 1;
    }

    // Add subscription revenue to monthly (approximate by distributing evenly or just showing total)
    // For now, we'll add subscription totals to the current month
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    if (!monthlyMap[currentMonthKey]) {
      monthlyMap[currentMonthKey] = { fuelRevenue: 0, serviceFeeRevenue: 0, subscriptionRevenue: 0, gallons: 0, orders: 0 };
    }
    if (period === "all") {
      // Distribute subscription revenue to current month as a simplification
      monthlyMap[currentMonthKey].subscriptionRevenue = subscriptionRevenue;
    } else {
      // For filtered periods, just add it to the first available month
      const keys = Object.keys(monthlyMap).sort().reverse();
      if (keys.length > 0) {
        monthlyMap[keys[0]].subscriptionRevenue = subscriptionRevenue;
      }
    }

    const monthly = Object.entries(monthlyMap)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([key, val]) => {
        const [year, month] = key.split("-");
        const monthName = new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
        return {
          month: monthName,
          ...val,
          totalRevenue: val.fuelRevenue + val.serviceFeeRevenue + val.subscriptionRevenue,
        };
      });

    return NextResponse.json({
      totals: {
        fuelRevenue,
        serviceFeeRevenue,
        subscriptionRevenue,
        totalRevenue,
        totalGallons,
        totalOrders: orders.length,
      },
      monthly,
    });
  } catch (error) {
    console.error("Bookkeeping error:", error);
    return NextResponse.json({ error: "Failed to fetch bookkeeping data" }, { status: 500 });
  }
}
