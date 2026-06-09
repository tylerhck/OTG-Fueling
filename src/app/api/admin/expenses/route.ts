import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as { role?: string })?.role !== "ADMIN") {
    return null;
  }
  return session;
}

export async function GET(req: NextRequest) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
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

    const whereClause: any = {};
    if (dateFilter) {
      whereClause.expenseDate = { gte: dateFilter };
    }

    const expenses = await prisma.expense.findMany({
      where: whereClause,
      orderBy: { expenseDate: "desc" },
    });

    // Category totals
    const categoryTotals: Record<string, number> = {};
    let totalExpenses = 0;
    for (const exp of expenses) {
      categoryTotals[exp.category] = (categoryTotals[exp.category] || 0) + exp.amountCents;
      totalExpenses += exp.amountCents;
    }

    return NextResponse.json({ expenses, categoryTotals, totalExpenses });
  } catch (error) {
    console.error("Expenses GET error:", error);
    return NextResponse.json({ error: "Failed to fetch expenses" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await req.json();
    const { category, amount, description, date, receiptImage } = body;

    if (!category || !amount || amount <= 0) {
      return NextResponse.json({ error: "Category and amount are required" }, { status: 400 });
    }

    const amountCents = Math.round(amount * 100);
    const expenseDate = date ? new Date(date) : new Date();

    const expense = await prisma.expense.create({
      data: {
        category,
        amountCents,
        description: description || null,
        receiptImage: receiptImage || null,
        expenseDate,
      },
    });

    return NextResponse.json({ expense });
  } catch (error) {
    console.error("Expenses POST error:", error);
    return NextResponse.json({ error: "Failed to create expense" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const id = req.nextUrl.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "ID required" }, { status: 400 });
    }

    await prisma.expense.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Expenses DELETE error:", error);
    return NextResponse.json({ error: "Failed to delete expense" }, { status: 500 });
  }
}
