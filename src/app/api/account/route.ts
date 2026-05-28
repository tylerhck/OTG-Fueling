import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";

export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  try {
    // Cancel any active Stripe subscription immediately (not at period end)
    const subscription = await prisma.subscription.findFirst({
      where: { userId, status: "ACTIVE" },
    });

    if (subscription) {
      try {
        await stripe.subscriptions.cancel(subscription.stripeSubscriptionId);
      } catch (stripeErr) {
        console.error("Failed to cancel Stripe subscription during account deletion:", stripeErr);
        // Continue with deletion even if Stripe cancel fails
      }

      // Mark subscription as cancelled in our DB
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: { status: "CANCELLED" },
      });
    }

    // Delete related data in order (respecting foreign keys)
    await prisma.passwordResetToken.deleteMany({ where: { userId } });
    await prisma.orderItem.deleteMany({
      where: { order: { userId } },
    });
    await prisma.order.deleteMany({ where: { userId } });
    await prisma.recurringOrder.deleteMany({ where: { userId } });
    await prisma.vehicle.deleteMany({ where: { userId } });
    await prisma.boat.deleteMany({ where: { userId } });
    await prisma.address.deleteMany({ where: { userId } });
    await prisma.subscription.deleteMany({ where: { userId } });

    // Finally delete the user
    await prisma.user.delete({ where: { id: userId } });

    return NextResponse.json({ message: "Account deleted successfully" });
  } catch (error) {
    console.error("Account deletion error:", error);
    return NextResponse.json(
      { error: "Failed to delete account. Please contact support." },
      { status: 500 }
    );
  }
}
