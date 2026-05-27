import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { vehicleSchema } from "@/lib/validators";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const vehicles = await prisma.vehicle.findMany({
      where: { userId: session.user.id, deletedAt: null },
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    });
    return NextResponse.json(vehicles);
  } catch (error) {
    console.error("GET /api/vehicles error:", error);
    return NextResponse.json({ error: "Failed to load vehicles" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = vehicleSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  // If this vehicle is default, unset other defaults
  if (parsed.data.isDefault) {
    await prisma.vehicle.updateMany({
      where: { userId: session.user.id, deletedAt: null },
      data: { isDefault: false },
    });
  }

  const vehicle = await prisma.vehicle.create({
    data: {
      userId: session.user.id,
      ...parsed.data,
    },
  });

  return NextResponse.json(vehicle, { status: 201 });
}
