import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";

// OTGVIP is a virtual bundle code that maps to both OTGFREE + OTG20
const BUNDLE_CODES: Record<string, string[]> = {
  OTGVIP: ["OTGFREE", "OTG20"],
};

async function lookupPromoCode(code: string) {
  const promoCodes = await stripe.promotionCodes.list({
    code: code.toUpperCase(),
    active: true,
    limit: 1,
  });

  if (promoCodes.data.length === 0) return null;

  const promoCode = promoCodes.data[0];
  const coupon = promoCode.coupon;

  let description = "";
  if (coupon.percent_off === 100 && coupon.duration === "once") {
    description = "First month free";
  } else if (coupon.amount_off && coupon.duration === "forever") {
    const dollars = coupon.amount_off / 100;
    description = `$${dollars} off every month`;
  } else if (coupon.percent_off && coupon.duration === "once") {
    description = `${coupon.percent_off}% off first month`;
  } else if (coupon.percent_off && coupon.duration === "forever") {
    description = `${coupon.percent_off}% off every month`;
  } else if (coupon.amount_off && coupon.duration === "once") {
    const dollars = coupon.amount_off / 100;
    description = `$${dollars} off first month`;
  } else {
    description = coupon.name || "Discount applied";
  }

  return { couponId: coupon.id, description, code: code.toUpperCase() };
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
      const results = await Promise.all(bundleCodes.map(lookupPromoCode));

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
    const result = await lookupPromoCode(upperCode);
    if (!result) {
      return NextResponse.json({ valid: false, error: "Invalid promo code" });
    }

    return NextResponse.json({
      valid: true,
      isBundle: false,
      code: upperCode,
      description: result.description,
      coupons: [result],
    });
  } catch (error) {
    console.error("Promo validation error:", error);
    return NextResponse.json({ valid: false, error: "Error validating code" });
  }
}
