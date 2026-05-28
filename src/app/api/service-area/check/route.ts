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

  const serviceAreas = await prisma.serviceArea.findMany({
    where: { isActive: true },
  });

  if (serviceAreas.length === 0) {
    return NextResponse.json(
      { message: "Our service is being set up. Check back soon!" },
      { status: 200 }
    );
  }

  const inArea = isInAnyServiceArea(geo.lat, geo.lng, serviceAreas);

  if (inArea) {
    return NextResponse.json({
      message: "Great news! We deliver to your area. Order now!",
      inServiceArea: true,
      lat: geo.lat,
      lng: geo.lng,
    });
  }

  return NextResponse.json(
    {
      error: "Sorry, we don't deliver to your area yet. We currently serve the Fort Worth area.",
      inServiceArea: false,
      lat: geo.lat,
      lng: geo.lng,
    },
    { status: 400 }
  );
}
