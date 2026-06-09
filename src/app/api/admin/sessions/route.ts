import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/admin/sessions — Get all active sessions for all admin users
export async function GET() {
  const session = await auth();
  if (!session?.user || (session.user as { role?: string }).role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get all active sessions for admin users
  const sessions = await prisma.activeSession.findMany({
    where: {
      user: { role: "ADMIN" },
    },
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
    orderBy: { lastActiveAt: "desc" },
  });

  // Group by user
  const grouped: Record<string, {
    userId: string;
    name: string;
    email: string;
    sessions: Array<{
      id: string;
      ipAddress: string | null;
      city: string | null;
      region: string | null;
      country: string | null;
      userAgent: string | null;
      lastActiveAt: string;
      createdAt: string;
    }>;
  }> = {};

  for (const s of sessions) {
    if (!grouped[s.userId]) {
      grouped[s.userId] = {
        userId: s.userId,
        name: s.user.name,
        email: s.user.email,
        sessions: [],
      };
    }
    grouped[s.userId].sessions.push({
      id: s.id,
      ipAddress: s.ipAddress,
      city: s.city,
      region: s.region,
      country: s.country,
      userAgent: s.userAgent,
      lastActiveAt: s.lastActiveAt.toISOString(),
      createdAt: s.createdAt.toISOString(),
    });
  }

  return NextResponse.json({ users: Object.values(grouped) });
}
