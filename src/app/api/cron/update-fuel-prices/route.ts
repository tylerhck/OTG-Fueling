import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Cron job: Update fuel prices from Google Places API.
 *
 * Pulls live prices from QuikTrip #883 (2949 Basswood Blvd, Fort Worth, TX)
 * via Google Places API fuelOptions field.
 *
 * Should be called once daily at 5 AM Central.
 * Secured with CRON_SECRET.
 */

// Google Place ID for QuikTrip #883, 2949 Basswood Blvd, Fort Worth, TX 76131
const QT_PLACE_ID = "ChIJJUvIK4XYTYYR8AJ_tfynhsI";

// Map Google fuel types to our FuelType enum
const FUEL_TYPE_MAP: Record<string, "REGULAR_87" | "PREMIUM_93" | "DIESEL"> = {
  REGULAR_UNLEADED: "REGULAR_87",
  PREMIUM: "PREMIUM_93",
  DIESEL: "DIESEL",
};

interface GoogleFuelPrice {
  type: string;
  price: {
    currencyCode: string;
    units: string;
    nanos: number;
  };
  updateTime: string;
}

interface GooglePlaceDetails {
  fuelOptions?: {
    fuelPrices: GoogleFuelPrice[];
  };
}

export async function GET(req: NextRequest) {
  // Verify cron secret
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "GOOGLE_PLACES_API_KEY not configured" },
      { status: 500 }
    );
  }

  try {
    // Fetch fuel prices from Google Places API
    const url = `https://places.googleapis.com/v1/places/${QT_PLACE_ID}`;
    const res = await fetch(url, {
      headers: {
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "fuelOptions",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      const errorText = await res.text();
      return NextResponse.json(
        { error: "Google Places API error", details: errorText },
        { status: 502 }
      );
    }

    const data: GooglePlaceDetails = await res.json();

    if (!data.fuelOptions?.fuelPrices?.length) {
      return NextResponse.json(
        { error: "No fuel price data returned from Google" },
        { status: 502 }
      );
    }

    const results: Array<{
      fuelType: string;
      priceDollars: number;
      priceCents: number;
      updated: string;
    }> = [];

    for (const fuel of data.fuelOptions.fuelPrices) {
      const ourFuelType = FUEL_TYPE_MAP[fuel.type];
      if (!ourFuelType) continue; // Skip midgrade or other types we don't sell

      // Convert Google price format (units + nanos) to cents
      const dollars = parseInt(fuel.price.units, 10) + fuel.price.nanos / 1_000_000_000;
      const priceCents = Math.round(dollars * 100);

      // Get existing record to preserve markup (should be 0 but keep it flexible)
      const existing = await prisma.fuelPrice.findUnique({
        where: { fuelType: ourFuelType },
      });

      const markupPercent = existing?.markupPercent ?? 0;
      const effectivePriceCents = Math.round(priceCents * (1 + markupPercent / 100));

      await prisma.fuelPrice.upsert({
        where: { fuelType: ourFuelType },
        update: {
          basePriceCents: priceCents,
          effectivePriceCents,
        },
        create: {
          fuelType: ourFuelType,
          basePriceCents: priceCents,
          markupPercent,
          effectivePriceCents,
        },
      });

      results.push({
        fuelType: ourFuelType,
        priceDollars: dollars,
        priceCents,
        updated: fuel.updateTime,
      });
    }

    return NextResponse.json({
      success: true,
      source: "Google Places API - QuikTrip #883 Basswood & I-35",
      updatedAt: new Date().toISOString(),
      prices: results,
    });
  } catch (error) {
    console.error("Fuel price cron error:", error);
    return NextResponse.json(
      { error: "Failed to update fuel prices", details: String(error) },
      { status: 500 }
    );
  }
}
