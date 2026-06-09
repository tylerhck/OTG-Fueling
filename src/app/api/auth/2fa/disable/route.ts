import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import * as OTPAuth from "otpauth";
import bcrypt from "bcryptjs";

// POST - Disable 2FA (requires password + valid 2FA code)
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { password, code } = await req.json();
  if (!password || !code) {
    return NextResponse.json({ error: "Password and 2FA code are required" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user || !user.totpSecret) {
    return NextResponse.json({ error: "2FA not enabled" }, { status: 400 });
  }

  // Verify password
  const passwordValid = await bcrypt.compare(password, user.passwordHash);
  if (!passwordValid) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  // Verify TOTP code
  const totp = new OTPAuth.TOTP({
    issuer: "OTG Fueling",
    label: user.email,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(user.totpSecret),
  });

  const delta = totp.validate({ token: code, window: 1 });
  if (delta === null) {
    return NextResponse.json({ error: "Invalid 2FA code" }, { status: 401 });
  }

  // Disable 2FA
  await prisma.user.update({
    where: { id: session.user.id },
    data: { totpSecret: null, totpEnabled: false },
  });

  return NextResponse.json({ success: true });
}
