import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isInServiceArea } from "@/lib/serviceAreaCheck";
import { geocodeAddress } from "@/lib/geocode";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const zip = searchParams.get("zip");
  const address = searchParams.get("address");

  if (!zip && !address) {
    return NextResponse.json(
      { error: "Provide a zip or address query parameter" },
      { status: 400 }
    );
  }

  const query = address || zip || "";
  const coords = await geocodeAddress(query);
  if (!coords) {
    return NextResponse.json({
      inServiceArea: false,
      message: "Could not locate that address. Please check and try again.",
    });
  }

  // TEMPORARILY DISABLED for FIFA promotion — accept all addresses
  return NextResponse.json({
    inServiceArea: true,
    message: "Great news! We deliver to your area. Sign up now!",
  });
}
