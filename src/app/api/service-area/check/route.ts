import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { geocodeAddress } from "@/lib/geocode";
import { isInAnyServiceArea } from "@/lib/serviceAreaCheck";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { address } = body;

  if (!address || typeof address !== "string") {
    return NextResponse.json(
      { error: "Please enter an address" },
      { status: 400 }
    );
  }

  const geo = await geocodeAddress(address);
  if (!geo) {
    return NextResponse.json(
      { error: "Could not find that address. Please try again with a full address." },
      { status: 400 }
    );
  }

  // TEMPORARILY DISABLED for FIFA promotion — accept all addresses
  return NextResponse.json({
    message: "Great news! We deliver to your area. Sign up now!",
    inServiceArea: true,
    lat: geo.lat,
    lng: geo.lng,
  });
}
