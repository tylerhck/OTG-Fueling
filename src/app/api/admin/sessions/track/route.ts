import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getGeoFromIp, getClientIp } from "@/lib/geo";
import { randomBytes } from "crypto";

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

// GET /api/admin/sessions/track — Record current session
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const userId = session.user.id;
    const role = (session.user as { role?: string }).role;

    if (role !== "ADMIN") {
      return NextResponse.json({ ok: true, skipped: "not admin" });
    }

    // Ensure table exists
    await ensureTable();

    const ip = getClientIp(req.headers);
    const userAgent = req.headers.get("user-agent") || null;
    const geo = await getGeoFromIp(ip);

    // Check if we already have a session for this user from this IP
    const existing = await prisma.activeSession.findFirst({
      where: { userId, ipAddress: ip },
    });

    if (existing) {
      await prisma.activeSession.update({
        where: { id: existing.id },
        data: { lastActiveAt: new Date() },
      });
      return NextResponse.json({ ok: true, action: "updated" });
    }

    // Create new session record
    const token = randomBytes(32).toString("hex");
    await prisma.activeSession.create({
      data: {
        id: randomBytes(12).toString("hex"),
        userId,
        token,
        ipAddress: ip,
        city: geo.city,
        region: geo.region,
        country: geo.country,
        userAgent,
      },
    });

    return NextResponse.json({ ok: true, action: "created", geo });
  } catch (err: any) {
    return NextResponse.json({ error: "Failed", detail: err?.message }, { status: 500 });
  }
}

// Keep POST for sign-in page compat
export async function POST(req: NextRequest) {
  return GET(req);
}
