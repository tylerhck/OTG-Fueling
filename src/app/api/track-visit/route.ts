import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function incrementSetting(key: string): Promise<void> {
  const current = await prisma.siteSetting.findUnique({ where: { key } });
  const next = String((parseInt(current?.value || "0", 10) + 1));
  await prisma.siteSetting.upsert({
    where: { key },
    create: { key, value: next },
    update: { value: next },
  });
}

// Called client-side on each public-page load.
// Body: { isNewVisitor: boolean }
export async function POST(req: NextRequest) {
  try {
    const { isNewVisitor } = await req.json();
    await incrementSetting("page_views_total");
    if (isNewVisitor) {
      await incrementSetting("unique_visitors_total");
    }
  } catch {
    // Non-critical — never fail a page request because of analytics
  }

  return NextResponse.json({ ok: true });
}
