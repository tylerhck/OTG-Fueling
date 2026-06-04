import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id || (session.user as { role: string }).role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        phone: true,
        createdAt: true,
        _count: { select: { orders: true } },
        subscriptions: {
          select: {
            id: true,
            status: true,
            promoCode: true,
          },
          where: { status: "ACTIVE" },
          take: 1,
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const result = users.map((u) => ({
      ...u,
      isSubscriber: u.subscriptions.length > 0,
      subscriptionStatus: u.subscriptions[0]?.status || null,
      promoCode: u.subscriptions[0]?.promoCode || null,
    }));

    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error("Admin users API error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
