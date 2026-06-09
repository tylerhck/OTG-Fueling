import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getGeoFromIp, getClientIp } from "@/lib/geo";
import { randomBytes } from "crypto";

// GET /api/admin/sessions/track — Record current session (called when admin visits security page or any admin page)
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Not authenticated", debug: "no session" }, { status: 401 });
    }

    const userId = session.user.id;
    const role = (session.user as { role?: string }).role;

    if (role !== "ADMIN") {
      return NextResponse.json({ ok: true, skipped: "not admin" });
    }

    const ip = getClientIp(req.headers);
    const userAgent = req.headers.get("user-agent") || null;
    const geo = await getGeoFromIp(ip);

    // Check if we already have a session for this user from this IP
    const existing = await prisma.activeSession.findFirst({
      where: { userId, ipAddress: ip },
    });

    if (existing) {
      // Update last active time
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

// Keep POST for backwards compat with sign-in page
export async function POST(req: NextRequest) {
  return GET(req);
}
