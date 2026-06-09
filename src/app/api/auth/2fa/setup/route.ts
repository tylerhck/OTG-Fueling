import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import * as OTPAuth from "otpauth";

// GET - Generate a new TOTP secret and QR code for the user
export async function GET() {
  const session = await auth();
  if (!session?.user?.id || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // OTPAuth auto-generates a random secret when none is provided
  const totp = new OTPAuth.TOTP({
    issuer: "OTG Fueling",
    label: session.user.email || "Admin",
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: new OTPAuth.Secret({ size: 20 }),
  });

  const uri = totp.toString();
  const secret = totp.secret.base32;
  const qrCode = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(uri)}`;

  return NextResponse.json({ secret, qrCode, uri });
}

// POST - Verify code and enable 2FA
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { secret, code } = await req.json();
  if (!secret || !code) {
    return NextResponse.json({ error: "Secret and code are required" }, { status: 400 });
  }

  const totp = new OTPAuth.TOTP({
    issuer: "OTG Fueling",
    label: session.user.email || "Admin",
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secret),
  });

  const delta = totp.validate({ token: code, window: 1 });
  if (delta === null) {
    return NextResponse.json({ error: "Invalid code. Please try again." }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { totpSecret: secret, totpEnabled: true },
  });

  return NextResponse.json({ success: true });
}
