import { prisma } from "@/lib/prisma";
import { sendOrderNotifications } from "@/lib/sms";

/**
 * Send SMS notification when an order becomes "Active" (ready to go out today).
 * Call this whenever an order transitions to the Active state:
 * - ASAP orders: immediately on creation
 * - Scheduled orders: when the 6 AM cron moves them to Active on their day
 * - Recurring orders: when the 6 AM cron creates them
 */
export async function notifyOrderActive(
  orderId: string,
  orderType: "ASAP" | "Scheduled" | "Recurring"
) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      user: { select: { name: true } },
      address: { select: { street: true, city: true, state: true, zip: true } },
      items: true,
    },
  });

  if (!order) return;

  // Build customer name
  const customerName = order.user?.name || order.guestName || "Customer";
  const isGuest = !order.userId;

  // Build address
  let address = "Unknown";
  if (order.address) {
    address = `${order.address.street}, ${order.address.city}, ${order.address.state} ${order.address.zip}`;
  } else if (order.guestAddress) {
    try {
      const ga = JSON.parse(order.guestAddress);
      address = `${ga.street}, ${ga.city}, ${ga.state} ${ga.zip}`;
    } catch {}
  }

  // Get fuel type from order or primary item
  const primaryItem = order.items.find(
    (i) => i.kind === "PRIMARY_VEHICLE" || i.kind === "PRIMARY_BOAT" || i.kind === "DEF_ONLY"
  );
  const fuelType = primaryItem?.fuelType?.replace("_", " ") || order.fuelType?.replace("_", " ") || "Fuel";

  // Gallons
  const isFillUp = primaryItem?.isFillUp ?? order.isFillUp ?? false;
  const gallons = isFillUp ? undefined : (primaryItem?.gallons ?? order.gallons ?? undefined);

  // DEF addon
  const defItem = order.items.find((i) => i.kind === "DEF_ADDON");

  await sendOrderNotifications({
    orderId: order.id,
    customerName,
    orderType,
    fuelType,
    gallons,
    isFillUp,
    address,
    scheduledAt: order.scheduledAt,
    availableFrom: (order as any).availableFrom || null,
    availableTo: (order as any).availableTo || null,
    notes: order.notes,
    isGuest,
    defAddon: defItem ? { gallons: defItem.gallons || 2.5 } : null,
  });

  // Mark as SMS notified to prevent duplicates
  await prisma.order.update({
    where: { id: orderId },
    data: { smsNotifiedAt: new Date() },
  });
}
