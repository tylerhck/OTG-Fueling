import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id || (session.user as { role: string }).role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const recipients = await prisma.smsRecipient.findMany({
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(recipients);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || (session.user as { role: string }).role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { name, phone } = body;

  if (!name?.trim() || !phone?.trim()) {
    return NextResponse.json({ error: "Name and phone are required" }, { status: 400 });
  }

  // Normalize phone: strip non-digits, ensure +1 prefix
  let normalized = phone.replace(/\D/g, "");
  if (normalized.length === 10) normalized = "1" + normalized;
  if (!normalized.startsWith("1") || normalized.length !== 11) {
    return NextResponse.json({ error: "Invalid US phone number" }, { status: 400 });
  }
  normalized = "+" + normalized;

  const recipient = await prisma.smsRecipient.create({
    data: {
      name: name.trim(),
      phone: normalized,
    },
  });

  return NextResponse.json(recipient, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || (session.user as { role: string }).role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "ID required" }, { status: 400 });
  }

  await prisma.smsRecipient.delete({ where: { id } });
  return NextResponse.json({ success: true });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || (session.user as { role: string }).role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { id, isActive } = body;

  if (!id) {
    return NextResponse.json({ error: "ID required" }, { status: 400 });
  }

  const updated = await prisma.smsRecipient.update({
    where: { id },
    data: { isActive: Boolean(isActive) },
  });

  return NextResponse.json(updated);
}
