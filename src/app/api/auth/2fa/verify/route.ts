import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as OTPAuth from "otpauth";
import bcrypt from "bcryptjs";

// POST - Verify 2FA code during login
export async function POST(req: Request) {
  const { email, password, code } = await req.json();

  if (!email || !password || !code) {
    return NextResponse.json({ error: "Email, password, and code are required" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.totpEnabled || !user.totpSecret) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  // Verify password
  const passwordValid = await bcrypt.compare(password, user.passwordHash);
  if (!passwordValid) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
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

  return NextResponse.json({ success: true });
}
