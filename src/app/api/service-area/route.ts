import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { serviceAreaSchema } from "@/lib/validators";

export async function GET() {
  const serviceAreas = await prisma.serviceArea.findMany({
    where: { isActive: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(serviceAreas);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || (session.user as { role: string }).role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = serviceAreaSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const area = await prisma.serviceArea.create({
    data: parsed.data,
  });

  return NextResponse.json(area, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || (session.user as { role: string }).role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { id, ...data } = body;

  if (!id) {
    return NextResponse.json({ error: "ID is required" }, { status: 400 });
  }

  const parsed = serviceAreaSchema.safeParse(data);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const area = await prisma.serviceArea.update({
    where: { id },
    data: parsed.data,
  });

  return NextResponse.json(area);
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || (session.user as { role: string }).role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "ID is required" }, { status: 400 });
  }

  // Check if any active schedules reference this area
  const scheduleCount = await prisma.serviceSchedule.count({
    where: { serviceAreaId: id, isActive: true },
  });

  if (scheduleCount > 0) {
    return NextResponse.json(
      {
        error: `This area has ${scheduleCount} active schedule(s). Deactivate them first before deleting the area.`,
      },
      { status: 409 }
    );
  }

  // Soft-delete: mark inactive so historical order records remain intact
  await prisma.serviceArea.update({
    where: { id },
    data: { isActive: false },
  });

  return NextResponse.json({ success: true });
}
