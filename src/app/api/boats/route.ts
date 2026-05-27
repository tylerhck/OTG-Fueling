import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { boatSchema } from "@/lib/validators";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const boats = await prisma.boat.findMany({
    where: { userId: session.user.id, deletedAt: null },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
  });

  return NextResponse.json(boats);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = boatSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const { nickname, make, model, year, color, registrationNumber, notes, fuelType, isDefault } = parsed.data;

  // If setting as default, unset all existing defaults
  if (isDefault) {
    await prisma.boat.updateMany({
      where: { userId: session.user.id },
      data: { isDefault: false },
    });
  }

  const boat = await prisma.boat.create({
    data: {
      userId: session.user.id,
      nickname: nickname || null,
      make: make || null,
      model: model || null,
      year: year ?? null,
      color: color || null,
      registrationNumber,
      notes: notes || null,
      fuelType,
      isDefault,
    },
  });

  return NextResponse.json(boat, { status: 201 });
}
