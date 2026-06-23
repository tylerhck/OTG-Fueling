import { NextRequest, NextResponse } from "next/server";

// Promo code definitions:
// - OTGFREE: First month free via trial_period_days (no Stripe coupon needed)
interface PromoConfig {
  usesTrial: boolean;
  stripeCouponId: string | null;
  description: string;
}

const PROMO_CODES: Record<string, PromoConfig> = {
  OTGFREE: {
    usesTrial: true,
    stripeCouponId: null,
    description: "First month free",
  },
};

export async function POST(req: NextRequest) {
  try {
    const { code } = await req.json();
    if (!code || typeof code !== "string") {
      return NextResponse.json({ valid: false, error: "No code provided" });
    }

    const upperCode = code.toUpperCase().trim();
    const config = PROMO_CODES[upperCode];

    if (!config) {
      return NextResponse.json({ valid: false, error: "Invalid promo code" });
    }

    return NextResponse.json({
      valid: true,
      code: upperCode,
      description: config.description,
      usesTrial: config.usesTrial,
      couponId: config.stripeCouponId,
    });
  } catch (error) {
    console.error("Promo validation error:", error);
    return NextResponse.json({ valid: false, error: "Error validating code" });
  }
}
