import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { boatSchema } from "@/lib/validators";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const boat = await prisma.boat.findFirst({ where: { id, userId: session.user.id, deletedAt: null } });
  if (!boat) return NextResponse.json({ error: "Boat not found" }, { status: 404 });

  const body = await req.json();
  const parsed = boatSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const { isDefault, ...rest } = parsed.data;

  if (isDefault) {
    await prisma.boat.updateMany({ where: { userId: session.user.id }, data: { isDefault: false } });
  }

  const updated = await prisma.boat.update({
    where: { id },
    data: {
      ...rest,
      ...(isDefault !== undefined ? { isDefault } : {}),
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const boat = await prisma.boat.findFirst({ where: { id, userId: session.user.id, deletedAt: null } });
  if (!boat) return NextResponse.json({ error: "Boat not found" }, { status: 404 });

  await prisma.boat.update({ where: { id }, data: { deletedAt: new Date() } });

  return NextResponse.json({ success: true });
}
