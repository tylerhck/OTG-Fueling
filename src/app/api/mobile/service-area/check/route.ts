import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { haversineDistance } from "@/lib/haversine";
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

  const areas = await prisma.serviceArea.findMany({
    where: { isActive: true },
  });

  for (const area of areas) {
    const distance = haversineDistance(
      coords.lat,
      coords.lng,
      area.centerLat,
      area.centerLng
    );
    if (distance <= area.radiusMiles) {
      return NextResponse.json({
        inServiceArea: true,
        serviceArea: { id: area.id, name: area.name },
        message: `Great news! We deliver to your area.`,
      });
    }
  }

  return NextResponse.json({
    inServiceArea: false,
    message:
      "Sorry, we don't currently serve your area. Join the waitlist to be notified!",
  });
}
