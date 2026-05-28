import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ALLOWED_KEYS = ["delivery_fee_cents", "default_markup_percent", "asap_enabled", "def_price_cents_2_5", "def_price_cents_5"];

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
    defPriceCents2_5: parseInt(map.def_price_cents_2_5 || "3000", 10),
    defPriceCents5: parseInt(map.def_price_cents_5 || "5500", 10),
  });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || (session.user as { role: string }).role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { deliveryFeeCents, defaultMarkupPercent, asapEnabled, defPriceCents2_5, defPriceCents5 } = body;

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

  if (defPriceCents2_5 !== undefined) {
    const val = parseInt(defPriceCents2_5, 10);
    if (!isNaN(val) && val >= 0) {
      await prisma.siteSetting.upsert({
        where: { key: "def_price_cents_2_5" },
        update: { value: String(val) },
        create: { key: "def_price_cents_2_5", value: String(val) },
      });
    }
  }

  if (defPriceCents5 !== undefined) {
    const val = parseInt(defPriceCents5, 10);
    if (!isNaN(val) && val >= 0) {
      await prisma.siteSetting.upsert({
        where: { key: "def_price_cents_5" },
        update: { value: String(val) },
        create: { key: "def_price_cents_5", value: String(val) },
      });
    }
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
    defPriceCents2_5: parseInt(map.def_price_cents_2_5 || "3000", 10),
    defPriceCents5: parseInt(map.def_price_cents_5 || "5500", 10),
  });
}
