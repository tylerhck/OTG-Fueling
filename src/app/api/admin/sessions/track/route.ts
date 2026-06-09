import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getGeoFromIp, getClientIp } from "@/lib/geo";
import { randomBytes } from "crypto";

// POST /api/admin/sessions/track — Called after successful login to record session location
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      // Log for debugging
      console.log("[SESSION TRACK] No session found - auth() returned:", JSON.stringify(session));
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const userId = session.user.id;
    const role = (session.user as { role?: string }).role;

    // Only track admin sessions
    if (role !== "ADMIN") {
      return NextResponse.json({ ok: true, skipped: "not admin" });
    }

    const ip = getClientIp(req.headers);
    const userAgent = req.headers.get("user-agent") || null;
    const geo = await getGeoFromIp(ip);
    const token = randomBytes(32).toString("hex");

    console.log("[SESSION TRACK] Creating session for user:", userId, "IP:", ip, "Geo:", JSON.stringify(geo));

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

    console.log("[SESSION TRACK] Session created successfully");
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[SESSION TRACK] Error:", err?.message || err);
    return NextResponse.json({ error: "Failed to track session", detail: err?.message }, { status: 500 });
  }
}
