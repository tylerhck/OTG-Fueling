import { NextRequest, NextResponse } from "next/server";
import { getMobileSession } from "@/lib/mobileAuth";
import { prisma } from "@/lib/prisma";
import { boatSchema } from "@/lib/validators";

export async function GET(req: NextRequest) {
  const session = await getMobileSession(req);
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
  const session = await getMobileSession(req);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = boatSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  if (parsed.data.isDefault) {
    await prisma.boat.updateMany({
      where: { userId: session.user.id, deletedAt: null },
      data: { isDefault: false },
    });
  }

  const boat = await prisma.boat.create({
    data: { userId: session.user.id, ...parsed.data },
  });

  return NextResponse.json(boat, { status: 201 });
}
