import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function ensureFundingTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS funding (
      id VARCHAR(191) NOT NULL PRIMARY KEY,
      amount_cents INT NOT NULL,
      description VARCHAR(255),
      funding_date DATE NOT NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
    )
  `);
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session || (session.user as { role: string }).role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await ensureFundingTable();

    const period = req.nextUrl.searchParams.get("period") || "all";

    let dateFilter: Date | null = null;
    const now = new Date();
    if (period === "today") {
      dateFilter = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (period === "week") {
      dateFilter = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (period === "month") {
      dateFilter = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (period === "year") {
      dateFilter = new Date(now.getFullYear(), 0, 1);
    }

    // Fetch credits
    const creditWhere: any = {};
    if (dateFilter) {
      creditWhere.creditDate = { gte: dateFilter };
    }
    const credits = await prisma.credit.findMany({
      where: creditWhere,
      orderBy: { creditDate: "desc" },
    });

    // Fetch expenses
    const expenseWhere: any = {};
    if (dateFilter) {
      expenseWhere.expenseDate = { gte: dateFilter };
    }
    const expenses = await prisma.expense.findMany({
      where: expenseWhere,
      orderBy: { expenseDate: "desc" },
    });

    // Fetch funding
    let fundingQuery = "SELECT * FROM funding";
    const fundingParams: any[] = [];
    if (dateFilter) {
      fundingQuery += " WHERE funding_date >= ?";
      fundingParams.push(dateFilter);
    }
    fundingQuery += " ORDER BY funding_date DESC";
    const fundingRaw: any[] = await prisma.$queryRawUnsafe(fundingQuery, ...fundingParams);
    const funding = fundingRaw.map((f: any) => ({
      id: f.id,
      amountCents: Number(f.amount_cents),
      description: f.description,
      fundingDate: f.funding_date,
      createdAt: f.created_at,
    }));

    // Calculate totals
    const totalCredits = credits.reduce((sum, c) => sum + c.amountCents, 0);
    const totalExpenses = expenses.reduce((sum, e) => sum + e.amountCents, 0);
    const netProfit = totalCredits - totalExpenses;
    const totalFunding = funding.reduce((sum, f) => sum + f.amountCents, 0);
    const overallBalance = netProfit + totalFunding;

    // Monthly breakdown for chart (net profit only — funding excluded)
    const monthlyMap: Record<string, { credits: number; expenses: number }> = {};

    for (const credit of credits) {
      const d = new Date(credit.creditDate);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!monthlyMap[key]) monthlyMap[key] = { credits: 0, expenses: 0 };
      monthlyMap[key].credits += credit.amountCents;
    }

    for (const expense of expenses) {
      const d = new Date(expense.expenseDate);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!monthlyMap[key]) monthlyMap[key] = { credits: 0, expenses: 0 };
      monthlyMap[key].expenses += expense.amountCents;
    }

    const monthly = Object.entries(monthlyMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, val]) => {
        const [year, month] = key.split("-");
        const monthName = new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString("en-US", { month: "short", year: "numeric" });
        return {
          month: monthName,
          credits: val.credits,
          expenses: val.expenses,
          netProfit: val.credits - val.expenses,
        };
      });

    return NextResponse.json({
      totals: {
        totalCredits,
        totalExpenses,
        netProfit,
        totalFunding,
        overallBalance,
      },
      monthly,
      credits,
      expenses,
      funding,
    });
  } catch (error) {
    console.error("Bookkeeping error:", error);
    return NextResponse.json({ error: "Failed to fetch bookkeeping data" }, { status: 500 });
  }
}
