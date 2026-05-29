import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

/**
 * POST /api/push-token
 * Register or update an Expo push token for the authenticated user.
 * Body: { token: string, platform: "ios" | "android" | "web" }
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { token, platform } = await req.json();

  if (!token || typeof token !== "string") {
    return NextResponse.json({ error: "Token is required" }, { status: 400 });
  }

  const validPlatforms = ["ios", "android", "web"];
  const plat = validPlatforms.includes(platform) ? platform : "ios";

  // Upsert: if this user+token combo exists, just update it; otherwise create
  await prisma.pushToken.upsert({
    where: {
      userId_token: {
        userId: session.user.id,
        token,
      },
    },
    update: {
      platform: plat,
      isActive: true,
      updatedAt: new Date(),
    },
    create: {
      userId: session.user.id,
      token,
      platform: plat,
      updatedAt: new Date(),
    },
  });

  return NextResponse.json({ success: true });
}

/**
 * DELETE /api/push-token
 * Deactivate a push token (e.g., on logout).
 * Body: { token: string }
 */
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { token } = await req.json();

  if (!token) {
    return NextResponse.json({ error: "Token is required" }, { status: 400 });
  }

  await prisma.pushToken.updateMany({
    where: {
      userId: session.user.id,
      token,
    },
    data: { isActive: false },
  });

  return NextResponse.json({ success: true });
}
