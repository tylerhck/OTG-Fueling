import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function ensureTable() {
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

  let query = "SELECT * FROM funding";
  const params: any[] = [];

  if (dateFilter) {
    query += " WHERE funding_date >= ?";
    params.push(dateFilter);
  }

  query += " ORDER BY funding_date DESC";

  const funding: any[] = await prisma.$queryRawUnsafe(query, ...params);

  // Map to camelCase for frontend
  const mapped = funding.map((f: any) => ({
    id: f.id,
    amountCents: f.amount_cents,
    description: f.description,
    fundingDate: f.funding_date,
    createdAt: f.created_at,
  }));

  return NextResponse.json(mapped);
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
  const id = generateId();
  const fundingDate = date ? date + "T12:00:00" : new Date().toISOString().split("T")[0] + "T12:00:00";

  await prisma.$executeRawUnsafe(
    "INSERT INTO funding (id, amount_cents, description, funding_date) VALUES (?, ?, ?, ?)",
    id,
    amountCents,
    description || null,
    new Date(fundingDate)
  );

  return NextResponse.json({ id, amountCents, description }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session || (session.user as { role: string }).role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await ensureTable();

  const { id } = await req.json();
  if (!id) {
    return NextResponse.json({ error: "Funding ID is required" }, { status: 400 });
  }

  await prisma.$executeRawUnsafe("DELETE FROM funding WHERE id = ?", id);
  return NextResponse.json({ success: true });
}

function generateId() {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < 25; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}
