import { prisma } from "@/lib/prisma";
import { sendOrderNotifications } from "@/lib/sms";
import { sendEmail } from "@/lib/resend";

const COMPANY_EMAIL = process.env.ADMIN_EMAIL || "otgfuelingllc@gmail.com";

/**
 * Send SMS + Email notification when an order becomes "Active" (ready to go out today).
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

  // Send SMS to admin recipients (existing behavior)
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
    pinLat: (order as any).pinLat || null,
    pinLng: (order as any).pinLng || null,
  });

  // Send email to company when order goes ACTIVE
  const fuelDisplay = `${fuelType}${isFillUp ? " (Fill Up)" : gallons ? ` × ${gallons} gal` : ""}`;
  const scheduledDisplay = order.scheduledAt
    ? new Date(order.scheduledAt).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "America/Chicago" })
    : "ASAP";
  const availableFrom = (order as any).availableFrom || null;
  const availableTo = (order as any).availableTo || null;
  const pinLat = (order as any).pinLat || null;
  const pinLng = (order as any).pinLng || null;

  const textLines = [
    `${orderType.toUpperCase()} ORDER ACTIVE — #${order.id.slice(0, 8)}`,
    ``,
    `Customer: ${customerName}${isGuest ? " (Guest)" : ""}`,
    `Fuel: ${fuelDisplay}`,
    ...(defItem ? [`DEF Fluid: ${defItem.gallons || 2.5} gal`] : []),
    `Address: ${address}`,
    `Date: ${scheduledDisplay}`,
    ...(availableFrom && availableTo ? [`Available: ${availableFrom} – ${availableTo}`] : []),
    ...(order.notes ? [`Notes: ${order.notes}`] : []),
    ...(pinLat && pinLng ? [`Map: https://maps.google.com/?q=${pinLat},${pinLng}`] : []),
  ];

  await sendEmail({
    to: COMPANY_EMAIL,
    subject: `🚛 ${orderType} Order Active – #${order.id.slice(0, 8)} – ${customerName}`,
    text: textLines.join("\n"),
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
        <div style="background: #dc2626; color: white; padding: 16px 20px; border-radius: 12px; margin-bottom: 20px;">
          <h2 style="margin: 0; font-size: 18px;">🚛 ${orderType} Order Active</h2>
          <p style="margin: 4px 0 0; font-size: 14px; opacity: 0.9;">Order #${order.id.slice(0, 8)}</p>
        </div>
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          <tr><td style="padding: 8px 0; font-weight: 600; color: #374151; width: 120px;">Customer</td><td style="padding: 8px 0; color: #4b5563;">${customerName}${isGuest ? " (Guest)" : ""}</td></tr>
          <tr><td style="padding: 8px 0; font-weight: 600; color: #374151;">Fuel</td><td style="padding: 8px 0; color: #4b5563;">${fuelDisplay}</td></tr>
          ${defItem ? `<tr><td style="padding: 8px 0; font-weight: 600; color: #374151;">DEF</td><td style="padding: 8px 0; color: #4b5563;">${defItem.gallons || 2.5} gal</td></tr>` : ""}
          <tr><td style="padding: 8px 0; font-weight: 600; color: #374151;">Address</td><td style="padding: 8px 0; color: #4b5563;">${address}</td></tr>
          <tr><td style="padding: 8px 0; font-weight: 600; color: #374151;">Date</td><td style="padding: 8px 0; color: #4b5563;">${scheduledDisplay}</td></tr>
          ${availableFrom && availableTo ? `<tr><td style="padding: 8px 0; font-weight: 600; color: #374151;">Available</td><td style="padding: 8px 0; color: #4b5563;">${availableFrom} – ${availableTo}</td></tr>` : ""}
          ${order.notes ? `<tr><td style="padding: 8px 0; font-weight: 600; color: #374151;">Notes</td><td style="padding: 8px 0; color: #4b5563;">${order.notes}</td></tr>` : ""}
        </table>
        ${pinLat && pinLng ? `<a href="https://maps.google.com/?q=${pinLat},${pinLng}" style="display: inline-block; margin-top: 16px; background: #2563eb; color: white; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-size: 14px;">📍 View on Map</a>` : ""}
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
        <p style="color: #94a3b8; font-size: 12px; text-align: center;">On The Go Fueling – Internal Order Alert</p>
      </div>
    `,
  }).catch((err) => console.error("Failed to send admin order email:", err));

  // Mark as SMS notified to prevent duplicates
  await prisma.order.update({
    where: { id: orderId },
    data: { smsNotifiedAt: new Date() },
  });
}
