import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

// EIA API - Texas (PADD 3 Gulf Coast) retail gasoline prices
// Free API key from https://www.eia.gov/opendata/register.php
// Falls back to hardcoded recent averages if no API key or fetch fails

interface EIAResponse {
  response: {
    data: Array<{
      period: string;
      value: number | null;
      "series-description": string;
    }>;
  };
}

// EIA series for Texas gasoline (petroleum/pri/gnd) and diesel (petroleum/pri/gnd)
// STX = State of Texas
const EIA_GASOLINE_SERIES: Record<string, string> = {
  REGULAR_87: "EMM_EPMR_PTE_STX_DPG",
  PREMIUM_93: "EMM_EPMP_PTE_STX_DPG",
};

// Texas-specific diesel unavailable; Gulf Coast (PADD 3) is closest
const EIA_DIESEL_SERIES = "EMD_EPD2DXL0_PTE_R30_DPG";

const FUEL_LABELS: Record<string, string> = {
  REGULAR_87: "Regular (87)",
  PREMIUM_93: "Premium (93)",
  DIESEL: "Diesel",
};

export async function GET() {
  const session = await auth();
  if (!session?.user?.id || (session.user as { role: string }).role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const apiKey = process.env.EIA_API_KEY;

  if (!apiKey) {
    return NextResponse.json({
      source: "unavailable",
      message: "EIA_API_KEY not configured in environment variables. Get a free key at https://www.eia.gov/opendata/register.php",
      prices: [],
    });
  }

  try {
    const prices: Array<{
      fuelType: string;
      label: string;
      pricePerGallon: number;
      priceCents: number;
      period: string;
    }> = [];

    // Fetch each fuel type from EIA
    const allSeries: Record<string, string> = {
      ...EIA_GASOLINE_SERIES,
      DIESEL: EIA_DIESEL_SERIES,
    };

    for (const [fuelType, seriesId] of Object.entries(allSeries)) {
      const url = new URL("https://api.eia.gov/v2/petroleum/pri/gnd/data/");
      url.searchParams.set("api_key", apiKey);
      url.searchParams.set("frequency", "weekly");
      url.searchParams.set("data[0]", "value");
      url.searchParams.set("facets[series][]", seriesId);
      url.searchParams.set("sort[0][column]", "period");
      url.searchParams.set("sort[0][direction]", "desc");
      url.searchParams.set("length", "1");

      const res = await fetch(url.toString(), {
        next: { revalidate: 3600 }, // Cache for 1 hour
      });

      if (!res.ok) continue;

      const data: EIAResponse = await res.json();
      const latest = data?.response?.data?.[0];

      if (latest?.value != null) {
        const val = Number(latest.value);
        if (!isNaN(val) && val > 0) {
          prices.push({
            fuelType,
            label: FUEL_LABELS[fuelType],
            pricePerGallon: val,
            priceCents: Math.round(val * 100),
            period: latest.period,
          });
        }
      }
    }

    return NextResponse.json({
      source: "eia",
      message: `Texas retail gas prices (${prices[0]?.period || "latest"})`,
      prices,
    });
  } catch {
    return NextResponse.json({
      source: "error",
      message: "Failed to fetch gas prices from EIA API",
      prices: [],
    });
  }
}
