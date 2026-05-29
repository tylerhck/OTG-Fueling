import { prisma } from "@/lib/prisma";

interface PushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: "default" | null;
  badge?: number;
}

/**
 * Send push notifications via Expo Push API.
 * No API key needed — Expo Push is free and keyless.
 */
async function sendExpoPush(messages: PushMessage[]): Promise<boolean> {
  if (messages.length === 0) return true;

  try {
    const res = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(messages),
    });
    return res.ok;
  } catch (err) {
    console.error("Expo push error:", err);
    return false;
  }
}

/**
 * Send a push notification to a specific user (all their registered devices).
 */
export async function sendPushToUser(
  userId: string,
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<boolean> {
  const tokens = await prisma.pushToken.findMany({
    where: { userId, isActive: true },
    select: { token: true },
  });

  if (tokens.length === 0) return false;

  const messages: PushMessage[] = tokens.map((t) => ({
    to: t.token,
    title,
    body,
    sound: "default" as const,
    data,
  }));

  const sent = await sendExpoPush(messages);

  // Log notification (if there's an orderId in data)
  if (data?.orderId) {
    await prisma.notification.create({
      data: {
        orderId: data.orderId as string,
        userId,
        type: "PUSH",
        status: sent ? "SENT" : "FAILED",
        sentAt: sent ? new Date() : undefined,
      },
    });
  }

  return sent;
}

/**
 * Send push notification to all admin/employee users.
 */
export async function sendPushToAdmins(
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<void> {
  const admins = await prisma.user.findMany({
    where: { role: "ADMIN" },
    select: { id: true },
  });

  for (const admin of admins) {
    await sendPushToUser(admin.id, title, body, data);
  }
}

/**
 * Notify customer about order status change via push.
 */
export async function pushOrderStatus(orderId: string, status: string): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { userId: true, id: true },
  });

  if (!order?.userId) return;

  const messages: Record<string, { title: string; body: string }> = {
    CONFIRMED: {
      title: "Order Confirmed",
      body: "Your fuel delivery has been confirmed and is being prepared.",
    },
    IN_PROGRESS: {
      title: "Driver On The Way",
      body: "Your fuel delivery is on the way!",
    },
    COMPLETED: {
      title: "Delivery Complete",
      body: "Your fuel delivery is complete. Thank you!",
    },
    CANCELLED: {
      title: "Order Cancelled",
      body: "Your fuel delivery order has been cancelled.",
    },
  };

  const msg = messages[status];
  if (!msg) return;

  await sendPushToUser(order.userId, msg.title, msg.body, { orderId });
}

/**
 * Send delivery reminder push notification.
 */
export async function pushDeliveryReminder(
  userId: string,
  orderId: string,
  timeframe: "24h" | "1h"
): Promise<void> {
  const title = timeframe === "24h" ? "Delivery Tomorrow" : "Delivery in 1 Hour";
  const body =
    timeframe === "24h"
      ? "You have a fuel delivery scheduled for tomorrow. Make sure your vehicle is accessible."
      : "Your fuel delivery is coming in about 1 hour. Please ensure your vehicle is accessible.";

  await sendPushToUser(userId, title, body, { orderId, reminder: timeframe });
}
