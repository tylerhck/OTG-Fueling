import { prisma } from "@/lib/prisma";

const telnyxApiKey = process.env.TELNYX_API_KEY;
const fromNumber = process.env.TELNYX_FROM_NUMBER || "+16825497355";

async function sendSmsToNumber(to: string, message: string): Promise<boolean> {
  if (!telnyxApiKey) {
    console.warn("Telnyx API key not configured. SMS will not be sent.");
    return false;
  }

  const res = await fetch("https://api.telnyx.com/v2/messages", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${telnyxApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromNumber,
      to: to,
      text: message,
    }),
  });

  if (!res.ok) {
    console.error(`SMS to ${to} failed:`, await res.text());
  }
  return res.ok;
}

interface OrderSmsData {
  orderId: string;
  customerName: string;
  orderType: "ASAP" | "Scheduled" | "Recurring";
  fuelType: string;
  gallons?: number | null;
  isFillUp?: boolean;
  address: string;
  scheduledAt?: string | Date | null;
  availableFrom?: string | null;
  availableTo?: string | null;
  notes?: string | null;
  isGuest?: boolean;
  defAddon?: { gallons: number } | null;
}

export async function sendOrderNotifications(data: OrderSmsData) {
  if (!telnyxApiKey) return;

  // Get all active SMS recipients
  const recipients = await prisma.smsRecipient.findMany({
    where: { isActive: true },
  });

  if (recipients.length === 0) return;

  // Build message
  const lines: string[] = [
    `🚛 ${data.orderType.toUpperCase()} ORDER #${data.orderId.slice(0, 8)}`,
    `Customer: ${data.customerName}${data.isGuest ? " (Guest)" : ""}`,
    `Fuel: ${data.fuelType}${data.isFillUp ? " (Fill Up)" : data.gallons ? ` × ${data.gallons} gal` : ""}`,
  ];

  if (data.defAddon) {
    lines.push(`DEF Fluid: ${data.defAddon.gallons} gal`);
  }

  lines.push(`Address: ${data.address}`);

  if (data.scheduledAt) {
    const scheduled = new Date(data.scheduledAt);
    lines.push(`Date: ${scheduled.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "America/Chicago" })}`);
  }

  if (data.availableFrom && data.availableTo) {
    lines.push(`Available: ${data.availableFrom} – ${data.availableTo}`);
  }

  if (data.notes) {
    lines.push(`Notes: ${data.notes}`);
  }

  const message = lines.join("\n");

  // Send to all active recipients in parallel
  await Promise.allSettled(
    recipients.map((r) => sendSmsToNumber(r.phone, message))
  );
}
