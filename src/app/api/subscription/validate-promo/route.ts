import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";

// Promo code definitions:
// - OTGFREE: First month free via trial_period_days (no Stripe coupon needed)
// - OTG20: $15 off every month via Stripe coupon 1Xqmx53P
// - OTGVIP: Both — first month free trial + $15 off recurring
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
  OTG20: {
    usesTrial: false,
    stripeCouponId: "1Xqmx53P",
    description: "$15 off every month ($20/mo)",
  },
  OTGVIP: {
    usesTrial: true,
    stripeCouponId: "1Xqmx53P",
    description: "First month free + $20/month after",
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

    // If there's a Stripe coupon, verify it's still valid
    if (config.stripeCouponId) {
      try {
        const coupon = await stripe.coupons.retrieve(config.stripeCouponId);
        if (!coupon || !coupon.valid) {
          return NextResponse.json({
            valid: false,
            error: "This promo code has expired. Please contact support.",
          });
        }
      } catch {
        return NextResponse.json({
          valid: false,
          error: "Error validating promo code. Please try again.",
        });
      }
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
