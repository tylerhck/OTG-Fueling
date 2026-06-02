import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const VALID_SOURCES = [
  "Facebook",
  "Instagram",
  "TikTok",
  "Word of Mouth",
  "Friend or Family",
  "Other",
];

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { source } = await req.json();

  if (!source || !VALID_SOURCES.includes(source)) {
    return NextResponse.json({ error: "Invalid referral source" }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { referralSource: source },
  });

  return NextResponse.json({ success: true });
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { referralSource: true },
  });

  return NextResponse.json({ referralSource: user?.referralSource || null });
}
