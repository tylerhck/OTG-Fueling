import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { addressSchema } from "@/lib/validators";
import { geocodeAddress } from "@/lib/geocode";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const existing = await prisma.address.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!existing) {
    return NextResponse.json({ error: "Address not found" }, { status: 404 });
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

  const geo = await geocodeAddress(fullAddress);
  if (!geo) {
    return NextResponse.json(
      { error: "Could not find that address." },
      { status: 400 }
    );
  }

  const isDefault = body.isDefault ?? existing.isDefault;
  if (isDefault && !existing.isDefault) {
    await prisma.address.updateMany({
      where: { userId: session.user.id, id: { not: id } },
      data: { isDefault: false },
    });
  }

  const address = await prisma.address.update({
    where: { id },
    data: { label, street, city, state, zip, lat: geo.lat, lng: geo.lng, isDefault },
  });

  return NextResponse.json(address);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const existing = await prisma.address.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!existing) {
    return NextResponse.json({ error: "Address not found" }, { status: 404 });
  }

  await prisma.address.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
