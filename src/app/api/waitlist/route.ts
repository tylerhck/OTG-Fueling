import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod/v4";
import { rateLimit, getClientIp } from "@/lib/rateLimit";

const SPAM_PATTERNS = [
  /https?:\/\//i,
  /www\./i,
  /bit\.ly/i,
  /tinyurl/i,
  /\.(com|net|org|ru|tr|cn|tk|ml|ga)\b/i,
  /[\u0000-\u001F\u007F]/,
  /->|=>|<-/,
];

const cleanText = (max: number) =>
  z.string().trim().max(max).refine(
    (v) => !SPAM_PATTERNS.some((re) => re.test(v)),
    { message: "Field contains invalid characters" }
  );

const waitlistSchema = z.object({
  name: cleanText(60).min(1, "Name is required"),
  email: z.email("Valid email is required").max(254),
  phone: z.string().max(20).optional(),
  zip: z.string().min(5, "ZIP code is required").max(10),
  city: cleanText(60).optional(),
  state: cleanText(40).optional(),
});

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const limit = rateLimit(`waitlist:${ip}`, 5, 60 * 60 * 1000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 }
    );
  }

  const body = await req.json();
  const parsed = waitlistSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const { name, email, phone, zip, city, state } = parsed.data;

  // Check if already signed up
  const existing = await prisma.waitlist.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json(
      { message: "You're already on the waitlist! We'll be in touch." },
      { status: 200 }
    );
  }

  await prisma.waitlist.create({
    data: { name, email, phone, zip, city, state },
  });

  return NextResponse.json(
    { message: "You're on the list! We'll notify you when we launch in your area." },
    { status: 201 }
  );
}

export async function GET() {
  const session = await auth();
  if (
    !session?.user?.id ||
    (session.user as { role: string }).role !== "ADMIN"
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const entries = await prisma.waitlist.findMany({
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(entries);
}
