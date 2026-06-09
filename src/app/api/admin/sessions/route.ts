import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function ensureTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS active_sessions (
      id VARCHAR(191) NOT NULL PRIMARY KEY,
      user_id VARCHAR(191) NOT NULL,
      token VARCHAR(191) NOT NULL,
      ip_address VARCHAR(45),
      city VARCHAR(100),
      region VARCHAR(100),
      country VARCHAR(100),
      user_agent TEXT,
      last_active_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      INDEX idx_active_sessions_user_id (user_id)
    )
  `);
}

// GET /api/admin/sessions — Get all active sessions for all admin users
export async function GET() {
  const session = await auth();
  if (!session?.user || (session.user as { role?: string }).role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await ensureTable();

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
