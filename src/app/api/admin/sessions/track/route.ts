import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getGeoFromIp, getClientIp } from "@/lib/geo";
import { randomBytes } from "crypto";

// POST /api/admin/sessions/track — Called after successful login to record session location
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Only track admin sessions
  if ((session.user as { role?: string }).role !== "ADMIN") {
    return NextResponse.json({ ok: true });
  }

  const ip = getClientIp(req.headers);
  const userAgent = req.headers.get("user-agent") || null;
  const geo = await getGeoFromIp(ip);
  const token = randomBytes(32).toString("hex");

  try {
    await prisma.activeSession.create({
      data: {
        userId: session.user.id!,
        token,
        ipAddress: ip,
        city: geo.city,
        region: geo.region,
        country: geo.country,
        userAgent,
      },
    });
  } catch (err) {
    console.error("[SESSION TRACK] Failed:", err);
  }

  return NextResponse.json({ ok: true });
}
