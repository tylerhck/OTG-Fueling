import jwt from "jsonwebtoken";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

const JWT_SECRET = process.env.NEXTAUTH_SECRET || "fallback-secret";

export interface MobileTokenPayload {
  userId: string;
  email: string;
  role: string;
}

/**
 * Create a JWT token for mobile app authentication.
 * Tokens expire in 30 days.
 */
export function createMobileToken(payload: MobileTokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "30d" });
}

/**
 * Verify a JWT token from the mobile app.
 * Returns the decoded payload or null if invalid.
 */
export function verifyMobileToken(token: string): MobileTokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as MobileTokenPayload;
  } catch {
    return null;
  }
}

/**
 * Extract the authenticated user from a mobile request.
 * Checks for Bearer token in Authorization header.
 * Returns a session-like object compatible with existing API routes.
 */
export async function getMobileSession(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.slice(7);
  const payload = verifyMobileToken(token);
  if (!payload) {
    return null;
  }

  // Verify user still exists in database
  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { id: true, email: true, name: true, role: true },
  });

  if (!user) {
    return null;
  }

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
  };
}
