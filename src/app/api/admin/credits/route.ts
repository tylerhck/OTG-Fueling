import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function ensureTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS credits (
      id VARCHAR(191) NOT NULL PRIMARY KEY,
      amount_cents INT NOT NULL,
      description VARCHAR(255),
      credit_date DATE NOT NULL,
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

  await ensureTable();

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
    whereClause.creditDate = { gte: dateFilter };
  }

  const credits = await prisma.credit.findMany({
    where: whereClause,
    orderBy: { creditDate: "desc" },
  });

  return NextResponse.json(credits);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || (session.user as { role: string }).role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await ensureTable();

  const body = await req.json();
  const { amount, description, date } = body;

  if (!amount || amount <= 0) {
    return NextResponse.json({ error: "Amount is required and must be positive" }, { status: 400 });
  }

  const amountCents = Math.round(amount * 100);

  const credit = await prisma.credit.create({
    data: {
      amountCents,
      description: description || null,
      creditDate: date ? new Date(date + "T12:00:00") : new Date(),
    },
  });

  return NextResponse.json(credit, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session || (session.user as { role: string }).role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await ensureTable();

  const { id } = await req.json();
  if (!id) {
    return NextResponse.json({ error: "Credit ID is required" }, { status: 400 });
  }

  await prisma.credit.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
