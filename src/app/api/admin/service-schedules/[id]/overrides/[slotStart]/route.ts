import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; slotStart: string }> }
) {
  const { id, slotStart } = await params;
  const decoded = decodeURIComponent(slotStart);

  await prisma.scheduleSlotOverride.deleteMany({
    where: { scheduleId: id, slotStart: decoded },
  });

  return NextResponse.json({ success: true });
}
