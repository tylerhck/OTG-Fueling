import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", { apiVersion: "2025-04-30.basil" as any });

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as { role?: string })?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
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
    } else if (period === "year") {
      dateFilter = new Date(now.getFullYear(), 0, 1); // Jan 1 of current year
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
    // Service fee = total - (gallons * pricePerGallon)
    // If deliveryFeeCents is set and > 0, use that directly
    // Otherwise calculate from the difference
    let fuelRevenue = 0;
    let serviceFeeRevenue = 0;
    let totalGallons = 0;

    for (const order of orders) {
      const gallons = order.gallons || 0;
      const ppg = order.pricePerGallonCents || 0;
      const calculatedFuelCents = Math.round(gallons * ppg);

      if (order.deliveryFeeCents && order.deliveryFeeCents > 0) {
        // Service fee was explicitly recorded
        serviceFeeRevenue += order.deliveryFeeCents;
        fuelRevenue += order.totalCents - order.deliveryFeeCents;
      } else if (calculatedFuelCents > 0 && order.totalCents > calculatedFuelCents) {
        // Calculate service fee as difference between total and fuel cost
        const impliedServiceFee = order.totalCents - calculatedFuelCents;
        serviceFeeRevenue += impliedServiceFee;
        fuelRevenue += calculatedFuelCents;
      } else {
        // Can't determine breakdown — put it all in fuel
        fuelRevenue += order.totalCents;
      }

      totalGallons += gallons;
    }

    // Fetch subscription revenue from Stripe
    let subscriptionRevenue = 0;
    try {
      const listParams: any = { limit: 100, status: "paid" };
      if (dateFilter) {
        listParams.created = { gte: Math.floor(dateFilter.getTime() / 1000) };
      }

      const invoices = await stripe.invoices.list(listParams);

      for (const invoice of invoices.data) {
        if (invoice.subscription) {
          subscriptionRevenue += invoice.amount_paid;
        }
      }

      // Paginate
      let hasMore = invoices.has_more;
      let lastId = invoices.data.length > 0 ? invoices.data[invoices.data.length - 1].id : null;
      while (hasMore && lastId) {
        const more = await stripe.invoices.list({
          ...listParams,
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
    }

    const totalRevenue = fuelRevenue + serviceFeeRevenue + subscriptionRevenue;

    // Monthly breakdown
    const monthlyMap: Record<string, { fuelRevenue: number; serviceFeeRevenue: number; subscriptionRevenue: number; gallons: number; orders: number }> = {};

    for (const order of orders) {
      const d = new Date(order.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!monthlyMap[key]) {
        monthlyMap[key] = { fuelRevenue: 0, serviceFeeRevenue: 0, subscriptionRevenue: 0, gallons: 0, orders: 0 };
      }

      const gallons = order.gallons || 0;
      const ppg = order.pricePerGallonCents || 0;
      const calculatedFuelCents = Math.round(gallons * ppg);

      if (order.deliveryFeeCents && order.deliveryFeeCents > 0) {
        monthlyMap[key].serviceFeeRevenue += order.deliveryFeeCents;
        monthlyMap[key].fuelRevenue += order.totalCents - order.deliveryFeeCents;
      } else if (calculatedFuelCents > 0 && order.totalCents > calculatedFuelCents) {
        const impliedServiceFee = order.totalCents - calculatedFuelCents;
        monthlyMap[key].serviceFeeRevenue += impliedServiceFee;
        monthlyMap[key].fuelRevenue += calculatedFuelCents;
      } else {
        monthlyMap[key].fuelRevenue += order.totalCents;
      }

      monthlyMap[key].gallons += gallons;
      monthlyMap[key].orders += 1;
    }

    // Distribute subscription revenue into months (from Stripe invoice dates if possible)
    // For simplicity, add total subscription revenue to the summary
    // The monthly table will show order-based revenue per month + subscription as a separate total

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
