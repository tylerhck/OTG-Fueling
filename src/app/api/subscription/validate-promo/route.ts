import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";

// Map customer-facing codes to Stripe coupon IDs
const COUPON_MAP: Record<string, { stripeCouponId: string; description: string }> = {
  OTGFREE: { stripeCouponId: "ZTgG31Zw", description: "First month free" },
  OTG20: { stripeCouponId: "1Xqmx53P", description: "$15 off every month ($20/mo)" },
};

// OTGVIP is a virtual bundle code that applies both OTGFREE + OTG20
const BUNDLE_CODES: Record<string, string[]> = {
  OTGVIP: ["OTGFREE", "OTG20"],
};

async function lookupCoupon(code: string) {
  const mapping = COUPON_MAP[code];
  if (!mapping) return null;

  try {
    // Verify the coupon still exists and is valid in Stripe
    const coupon = await stripe.coupons.retrieve(mapping.stripeCouponId);
    if (!coupon || !coupon.valid) return null;

    return {
      couponId: coupon.id,
      description: mapping.description,
      code,
    };
  } catch {
    // Coupon doesn't exist in Stripe
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const { code } = await req.json();
    if (!code || typeof code !== "string") {
      return NextResponse.json({ valid: false, error: "No code provided" });
    }

    const upperCode = code.toUpperCase().trim();

    // Check if it's a bundle code
    if (BUNDLE_CODES[upperCode]) {
      const bundleCodes = BUNDLE_CODES[upperCode];
      const results = await Promise.all(bundleCodes.map(lookupCoupon));

      // Verify all bundle codes are valid in Stripe
      const validResults = results.filter((r) => r !== null);
      if (validResults.length !== bundleCodes.length) {
        return NextResponse.json({
          valid: false,
          error: "Bundle code configuration error. Please contact support.",
        });
      }

      return NextResponse.json({
        valid: true,
        isBundle: true,
        code: upperCode,
        description: "First month free + $20/month after",
        coupons: validResults,
      });
    }

    // Regular single code lookup
    if (COUPON_MAP[upperCode]) {
      const result = await lookupCoupon(upperCode);
      if (!result) {
        return NextResponse.json({ valid: false, error: "Invalid or expired promo code" });
      }

      return NextResponse.json({
        valid: true,
        isBundle: false,
        code: upperCode,
        description: result.description,
        coupons: [result],
      });
    }

    // Code not recognized
    return NextResponse.json({ valid: false, error: "Invalid promo code" });
  } catch (error) {
    console.error("Promo validation error:", error);
    return NextResponse.json({ valid: false, error: "Error validating code" });
  }
}
