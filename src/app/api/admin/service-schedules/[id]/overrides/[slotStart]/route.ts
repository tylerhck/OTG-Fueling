import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; slotStart: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as { role?: string })?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id, slotStart } = await params;
  const decoded = decodeURIComponent(slotStart);

  await prisma.scheduleSlotOverride.deleteMany({
    where: { scheduleId: id, slotStart: decoded },
  });

  return NextResponse.json({ success: true });
}
