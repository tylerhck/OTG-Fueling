import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// POST - Check if a user has 2FA enabled (called before login to show 2FA field)
export async function POST(req: Request) {
  const { email } = await req.json();

  if (!email) {
    return NextResponse.json({ requires2FA: false });
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { totpEnabled: true },
  });

  return NextResponse.json({ requires2FA: user?.totpEnabled || false });
}
