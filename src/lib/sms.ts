import { prisma } from "@/lib/prisma";

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromNumber = process.env.TWILIO_PHONE_NUMBER;

async function sendSmsToNumber(to: string, message: string): Promise<boolean> {
  if (!accountSid || !authToken || !fromNumber) {
    console.warn("Twilio credentials not configured. SMS will not be sent.");
    return false;
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(accountSid)}/Messages.json`;
  const credentials = Buffer.from(`${accountSid}:${authToken}`).toString("base64");

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ To: to, From: fromNumber, Body: message }),
  });

  if (!res.ok) {
    console.error(`SMS to ${to} failed:`, await res.text());
  }
  return res.ok;
}

interface OrderSmsData {
  orderId: string;
  customerName: string;
  fuelType: string;
  gallons?: number | null;
  isFillUp?: boolean;
  address: string;
  scheduledAt?: string | Date | null;
  notes?: string | null;
  isGuest?: boolean;
  defAddon?: { gallons: number } | null;
}

export async function sendOrderNotifications(data: OrderSmsData) {
  if (!accountSid || !authToken || !fromNumber) return;

  // Get all active SMS recipients
  const recipients = await prisma.smsRecipient.findMany({
    where: { isActive: true },
  });

  if (recipients.length === 0) return;

  // Build message
  const lines: string[] = [
    `🚛 NEW ORDER #${data.orderId.slice(0, 8)}`,
    `Customer: ${data.customerName}${data.isGuest ? " (Guest)" : ""}`,
    `Fuel: ${data.fuelType}${data.isFillUp ? " (Fill Up)" : data.gallons ? ` × ${data.gallons} gal` : ""}`,
  ];

  if (data.defAddon) {
    lines.push(`DEF Fluid: ${data.defAddon.gallons} gal`);
  }

  lines.push(`Address: ${data.address}`);

  if (data.scheduledAt) {
    const scheduled = new Date(data.scheduledAt);
    lines.push(`Scheduled: ${scheduled.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "America/Chicago" })} at ${scheduled.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" })}`);
  } else {
    lines.push("Delivery: ASAP");
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
