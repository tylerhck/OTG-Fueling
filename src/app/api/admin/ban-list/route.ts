import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id || (session.user as { role: string }).role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const entries = await prisma.banEntry.findMany({
    orderBy: { bannedAt: "desc" },
  });
  return NextResponse.json(entries);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || (session.user as { role: string }).role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { type, value, reason } = body;

  if (!type?.trim() || !value?.trim()) {
    return NextResponse.json({ error: "Type and value are required" }, { status: 400 });
  }

  const validTypes = ["email", "phone", "address", "plate"];
  if (!validTypes.includes(type)) {
    return NextResponse.json({ error: "Invalid type. Must be: email, phone, address, or plate" }, { status: 400 });
  }

  // Normalize value based on type
  let normalizedValue = value.trim();
  if (type === "email") {
    normalizedValue = normalizedValue.toLowerCase();
  } else if (type === "phone") {
    let digits = normalizedValue.replace(/\D/g, "");
    if (digits.length === 10) digits = "1" + digits;
    if (digits.startsWith("1") && digits.length === 11) {
      normalizedValue = "+" + digits;
    }
  } else if (type === "plate") {
    normalizedValue = normalizedValue.toUpperCase().replace(/\s+/g, "");
  }

  // Create the ban entry
  const entry = await prisma.banEntry.create({
    data: {
      type,
      value: normalizedValue,
      reason: reason?.trim() || null,
    },
  });

  // If banning by email or phone, find matching user and cancel their subscription
  let subscriptionCancelled = false;
  if (type === "email" || type === "phone") {
    const whereClause = type === "email" ? { email: normalizedValue } : { phone: normalizedValue };
    const user = await prisma.user.findFirst({
      where: whereClause,
      include: { subscription: true },
    });

    if (user?.subscription && user.subscription.status === "ACTIVE") {
      try {
        // Cancel in Stripe immediately
        await stripe.subscriptions.cancel(user.subscription.stripeSubscriptionId);
        // Mark as cancelled in our DB
        await prisma.subscription.update({
          where: { id: user.subscription.id },
          data: { status: "CANCELLED" },
        });
        subscriptionCancelled = true;
      } catch (err) {
        console.error("Failed to cancel subscription for banned user:", err);
      }
    }
  }

  return NextResponse.json({ ...entry, subscriptionCancelled }, { status: 201 });
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

  await prisma.banEntry.delete({ where: { id } });
  return NextResponse.json({ success: true });
}

// Check if a set of identifiers is banned (used by order APIs)
export async function PUT(req: NextRequest) {
  // This endpoint doesn't require admin — it's used internally by order flows
  const body = await req.json();
  const { email, phone, address, plate } = body;

  const conditions: Array<{ type: string; value: string }> = [];
  
  if (email) conditions.push({ type: "email", value: email.toLowerCase() });
  if (phone) {
    let digits = phone.replace(/\D/g, "");
    if (digits.length === 10) digits = "1" + digits;
    if (digits.startsWith("1") && digits.length === 11) {
      conditions.push({ type: "phone", value: "+" + digits });
    }
  }
  if (address) conditions.push({ type: "address", value: address.trim() });
  if (plate) conditions.push({ type: "plate", value: plate.toUpperCase().replace(/\s+/g, "") });

  if (conditions.length === 0) {
    return NextResponse.json({ banned: false });
  }

  const match = await prisma.banEntry.findFirst({
    where: {
      OR: conditions.map(c => ({ type: c.type, value: c.value })),
    },
  });

  return NextResponse.json({ banned: !!match });
}
