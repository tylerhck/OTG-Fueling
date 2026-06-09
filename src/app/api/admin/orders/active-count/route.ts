import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as { role?: string })?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const count = await prisma.order.count({
      where: {
        status: {
          in: ["ACTIVE", "IN_PROGRESS"],
        },
      },
    });

    return NextResponse.json({ count });
  } catch (error) {
    console.error("Error fetching active count:", error);
    return NextResponse.json({ count: 0 });
  }
}
