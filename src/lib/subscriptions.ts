import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";

/**
 * If no active local subscription exists for the user, look up Stripe by email
 * and create one if found. This heals the gap where the webhook didn't fire or
 * the user never visited /profile?session_id=... after subscribing.
 */
export async function ensureSubscriptionFromStripe(
  userId: string,
  email: string
): Promise<void> {
  const existing = await prisma.subscription.findFirst({
    where: { userId, status: "ACTIVE" },
  });

  if (existing) return;

  try {
    // Find Stripe customers matching this email
    const customers = await stripe.customers.list({ email, limit: 5 });

    for (const customer of customers.data) {
      const subs = await stripe.subscriptions.list({
        customer: customer.id,
        status: "active",
        limit: 5,
      });

      for (const sub of subs.data) {
        // Make sure we don't already have this subscription recorded (even cancelled)
        const duplicate = await prisma.subscription.findUnique({
          where: { stripeSubscriptionId: sub.id },
        });
        if (duplicate) {
          if (duplicate.status !== "ACTIVE") {
            await prisma.subscription.update({
              where: { stripeSubscriptionId: sub.id },
              data: { status: "ACTIVE", userId },
            });
          }
          return;
        }

        const item = sub.items.data[0];
        await prisma.subscription.create({
          data: {
            userId,
            stripeSubscriptionId: sub.id,
            stripeCustomerId: customer.id,
            status: "ACTIVE",
            currentPeriodStart: item
              ? new Date(item.current_period_start * 1000)
              : new Date(),
            currentPeriodEnd: item
              ? new Date(item.current_period_end * 1000)
              : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          },
        });
        return;
      }
    }
  } catch {
    // Never block an order because of a Stripe lookup failure
  }
}
