import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { rateLimit, getClientIp } from "@/lib/rateLimit";
import { sendEmail } from "@/lib/resend";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  try {
    // Rate limit: 5 requests per 15 minutes per IP
    const ip = getClientIp(req);
    const rl = rateLimit(`forgot-password:${ip}`, 5, 15 * 60 * 1000);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 }
      );
    }

    const body = await req.json();
    const email = (body.email || "").trim().toLowerCase();

    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    // Always return success to prevent email enumeration
    const successResponse = NextResponse.json({
      message: "If an account with that email exists, a password reset link has been sent.",
    });

    // Look up user
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, name: true, email: true },
    });

    if (!user) {
      // Don't reveal that the email doesn't exist
      return successResponse;
    }

    // Invalidate any existing unused tokens for this user
    await prisma.passwordResetToken.updateMany({
      where: {
        userId: user.id,
        usedAt: null,
      },
      data: {
        usedAt: new Date(),
      },
    });

    // Generate a secure random token
    const token = crypto.randomBytes(32).toString("hex");

    // Token expires in 1 hour
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    // Store in database
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        token,
        expiresAt,
      },
    });

    // Build reset URL
    const baseUrl = process.env.NEXTAUTH_URL || "https://www.otgfueling.com";
    const resetUrl = `${baseUrl}/reset-password?token=${token}`;

    // Send email via Resend
    const firstName = (user.name || "Customer").split(" ")[0];
    await sendEmail({
      to: user.email,
      subject: "Reset Your Password – On The Go Fueling",
      text: `Hi ${firstName},\n\nWe received a request to reset your password. Click the link below to set a new password:\n\n${resetUrl}\n\nThis link will expire in 1 hour.\n\nIf you didn't request this, you can safely ignore this email. Your password will not be changed.\n\nThank you,\nOn The Go Fueling`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
          <div style="text-align: center; margin-bottom: 32px;">
            <div style="display: inline-block; background: linear-gradient(135deg, #ef4444, #dc2626); color: white; font-weight: bold; font-size: 14px; padding: 12px 16px; border-radius: 12px;">OTG</div>
          </div>
          <h2 style="color: #1e293b; font-size: 24px; font-weight: 700; margin-bottom: 16px;">Reset Your Password</h2>
          <p style="color: #475569; font-size: 16px; line-height: 1.6; margin-bottom: 8px;">Hi ${firstName},</p>
          <p style="color: #475569; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">We received a request to reset your password. Click the button below to set a new password:</p>
          <div style="text-align: center; margin-bottom: 24px;">
            <a href="${resetUrl}" style="display: inline-block; background: linear-gradient(135deg, #ef4444, #dc2626); color: white; font-weight: 600; font-size: 16px; padding: 14px 32px; border-radius: 12px; text-decoration: none;">Reset Password</a>
          </div>
          <p style="color: #64748b; font-size: 14px; line-height: 1.5; margin-bottom: 8px;">This link will expire in 1 hour.</p>
          <p style="color: #64748b; font-size: 14px; line-height: 1.5; margin-bottom: 24px;">If you didn't request this, you can safely ignore this email. Your password will not be changed.</p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
          <p style="color: #94a3b8; font-size: 12px; text-align: center;">On The Go Fueling &bull; Fort Worth, TX</p>
        </div>
      `,
    });

    return successResponse;
  } catch (error) {
    console.error("Forgot password error:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
