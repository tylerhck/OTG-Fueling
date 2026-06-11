import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { addressSchema } from "@/lib/validators";
import { geocodeAddress } from "@/lib/geocode";
import { isInAnyServiceArea } from "@/lib/serviceAreaCheck";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const addresses = await prisma.address.findMany({
    where: { userId: session.user.id },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
  });

  return NextResponse.json(addresses);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = addressSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const { street, city, state, zip, label } = parsed.data;
  const fullAddress = `${street}, ${city}, ${state} ${zip}`;

  // Geocode the address
  const geo = await geocodeAddress(fullAddress);
  if (!geo) {
    return NextResponse.json(
      { error: "Could not find that address. Please check and try again." },
      { status: 400 }
    );
  }

  // TEMPORARILY DISABLED for FIFA promotion — allow any address
  // const serviceAreas = await prisma.serviceArea.findMany({
  //   where: { isActive: true },
  // });
  // const inServiceArea = isInAnyServiceArea(geo.lat, geo.lng, serviceAreas);
  // if (!inServiceArea && serviceAreas.length > 0) {
  //   return NextResponse.json(
  //     {
  //       error:
  //         "This address is outside our current service area. We currently serve the Fort Worth area.",
  //       lat: geo.lat,
  //       lng: geo.lng,
  //     },
  //     { status: 400 }
  //   );
  // }

  // If setting as default, unset others
  const isDefault = body.isDefault ?? false;
  if (isDefault) {
    await prisma.address.updateMany({
      where: { userId: session.user.id },
      data: { isDefault: false },
    });
  }

  const address = await prisma.address.create({
    data: {
      userId: session.user.id,
      label,
      street,
      city,
      state,
      zip,
      lat: geo.lat,
      lng: geo.lng,
      isDefault,
    },
  });

  return NextResponse.json(address, { status: 201 });
}
