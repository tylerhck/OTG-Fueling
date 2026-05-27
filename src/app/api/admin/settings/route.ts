import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ALLOWED_KEYS = ["delivery_fee_cents", "default_markup_percent", "asap_enabled"];

export async function GET() {
  const settings = await prisma.siteSetting.findMany({
    where: { key: { in: ALLOWED_KEYS } },
  });

  const map: Record<string, string> = {};
  for (const s of settings) {
    map[s.key] = s.value;
  }

  return NextResponse.json({
    deliveryFeeCents: parseInt(map.delivery_fee_cents || "500", 10),
    defaultMarkupPercent: parseFloat(map.default_markup_percent || "10"),
    asapEnabled: map.asap_enabled !== "false",
  });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || (session.user as { role: string }).role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { deliveryFeeCents, defaultMarkupPercent, asapEnabled } = body;

  if (deliveryFeeCents !== undefined) {
    const val = parseInt(deliveryFeeCents, 10);
    if (isNaN(val) || val < 0) {
      return NextResponse.json({ error: "Invalid delivery fee" }, { status: 400 });
    }
    await prisma.siteSetting.upsert({
      where: { key: "delivery_fee_cents" },
      update: { value: String(val) },
      create: { key: "delivery_fee_cents", value: String(val) },
    });
  }

  if (defaultMarkupPercent !== undefined) {
    const val = parseFloat(defaultMarkupPercent);
    if (isNaN(val) || val < 0) {
      return NextResponse.json({ error: "Invalid markup percent" }, { status: 400 });
    }
    await prisma.siteSetting.upsert({
      where: { key: "default_markup_percent" },
      update: { value: String(val) },
      create: { key: "default_markup_percent", value: String(val) },
    });
  }

  if (asapEnabled !== undefined) {
    await prisma.siteSetting.upsert({
      where: { key: "asap_enabled" },
      update: { value: asapEnabled ? "true" : "false" },
      create: { key: "asap_enabled", value: asapEnabled ? "true" : "false" },
    });
  }

  // Return updated settings
  const settings = await prisma.siteSetting.findMany({
    where: { key: { in: ALLOWED_KEYS } },
  });
  const map: Record<string, string> = {};
  for (const s of settings) {
    map[s.key] = s.value;
  }

  return NextResponse.json({
    deliveryFeeCents: parseInt(map.delivery_fee_cents || "500", 10),
    defaultMarkupPercent: parseFloat(map.default_markup_percent || "10"),
    asapEnabled: map.asap_enabled !== "false",
  });
}
