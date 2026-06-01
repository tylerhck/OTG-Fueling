import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Use raw SQL to avoid dependency on Prisma client having the canvassPin model generated
function generateId() {
  // cuid-like ID
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let id = "c";
  for (let i = 0; i < 24; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

async function checkAdmin() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (user?.role !== "ADMIN") return null;
  return session.user.id;
}

export async function GET() {
  try {
    const userId = await checkAdmin();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const pins: any[] = await prisma.$queryRawUnsafe(
      "SELECT id, lat, lng, color, label, notes, created_at as createdAt, updated_at as updatedAt FROM canvass_pins ORDER BY created_at DESC"
    );

    return NextResponse.json(pins);
  } catch (err: any) {
    console.error("GET /api/admin/canvass-zones error:", err);
    return NextResponse.json(
      { error: `Server error: ${err.message || "Unknown"}` },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await checkAdmin();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { lat, lng, color, label, notes } = body;

    if (typeof lat !== "number" || typeof lng !== "number") {
      return NextResponse.json(
        { error: "lat and lng are required" },
        { status: 400 }
      );
    }

    const id = generateId();
    const now = new Date().toISOString().slice(0, 23).replace("T", " ");

    await prisma.$executeRawUnsafe(
      "INSERT INTO canvass_pins (id, lat, lng, color, label, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      id,
      lat,
      lng,
      color || "#E53935",
      label || null,
      notes || null,
      now,
      now
    );

    return NextResponse.json(
      { id, lat, lng, color: color || "#E53935", label, notes, createdAt: now, updatedAt: now },
      { status: 201 }
    );
  } catch (err: any) {
    console.error("POST /api/admin/canvass-zones error:", err);
    return NextResponse.json(
      { error: `Server error: ${err.message || "Unknown"}` },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const userId = await checkAdmin();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Missing pin id" }, { status: 400 });
    }

    await prisma.$executeRawUnsafe(
      "DELETE FROM canvass_pins WHERE id = ?",
      id
    );

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("DELETE /api/admin/canvass-zones error:", err);
    return NextResponse.json(
      { error: `Server error: ${err.message || "Unknown"}` },
      { status: 500 }
    );
  }
}
