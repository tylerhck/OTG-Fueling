import { prisma } from "@/lib/prisma";
import nodemailer from "nodemailer";
import { getDeliveryWindow } from "@/lib/deliveryWindow";

// Strip URLs / control chars from a customer-supplied name before putting it
// in an outbound email, so spam accounts can't use our mail server to deliver
// their referral links to themselves.
function sanitizeNameForEmail(raw: string | null | undefined): string {
  if (!raw) return "Customer";
  const cleaned = raw
    .replace(/https?:\/\/\S+/gi, "")
    .replace(/www\.\S+/gi, "")
    .replace(/bit\.ly\S*/gi, "")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .replace(/->|=>|<-/g, "")
    .trim();
  if (!cleaned || cleaned.length < 2 || cleaned.length > 60) return "Customer";
  return cleaned;
}

const ORDER_STATUS_MESSAGES: Record<string, { subject: string; body: string }> = {
  PENDING: {
    subject: "Order Received – On The Go Fueling",
    body: "Your fuel delivery order has been received! We'll confirm it shortly.",
  },
  CONFIRMED: {
    subject: "Order Confirmed – On The Go Fueling",
    body: "Great news! Your fuel delivery order has been confirmed and is being prepared.",
  },
  IN_PROGRESS: {
    subject: "Delivery On The Way – On The Go Fueling",
    body: "Your fuel delivery is on the way! Please make sure your vehicle is accessible.",
  },
  COMPLETED: {
    subject: "Delivery Complete – On The Go Fueling",
    body: "Your fuel delivery is complete. Thank you for choosing On The Go Fueling!",
  },
  CANCELLED: {
    subject: "Order Cancelled – On The Go Fueling",
    body: "Your fuel delivery order has been cancelled. If you have questions, please contact us.",
  },
};

function getEmailTransport() {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || "587", 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) return null;

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

async function sendSms(to: string, message: string): Promise<boolean> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken || !from) return false;

  const url = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(accountSid)}/Messages.json`;
  const credentials = Buffer.from(`${accountSid}:${authToken}`).toString("base64");

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ To: to, From: from, Body: message }),
  });

  return res.ok;
}

export async function notifyOrderStatus(orderId: string, status: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { user: true },
  });

  if (!order) return;

  const msg = ORDER_STATUS_MESSAGES[status];
  if (!msg) return;

  // For CONFIRMED / IN_PROGRESS, append the estimated delivery window
  const window = ["CONFIRMED", "IN_PROGRESS"].includes(status)
    ? getDeliveryWindow(order.scheduledAt, order.etaMinutes, 120)
    : null;

  // Determine recipient info (from user account or guest fields)
  const recipientEmail = order.user?.email || order.guestEmail;
  const recipientName = sanitizeNameForEmail(
    order.user?.name || order.guestName
  );
  const recipientPhone = order.user?.phone || order.guestPhone;

  // Send email
  const transport = getEmailTransport();
  const windowLine = window
    ? `\nEstimated vehicle arrival at your location: ${window}`
    : "";

  if (transport && recipientEmail) {
    try {
      await transport.sendMail({
        from: process.env.EMAIL_FROM || "noreply@otgfueling.com",
        to: recipientEmail,
        subject: msg.subject,
        text: `Hi ${recipientName},\n\n${msg.body}${windowLine}\n\nOrder #${order.id.slice(0, 8)}\n\nThank you,\nOn The Go Fueling`,
      });
      await prisma.notification.create({
        data: {
          orderId: order.id,
          userId: order.userId,
          type: "EMAIL",
          status: "SENT",
          sentAt: new Date(),
        },
      });
    } catch {
      await prisma.notification.create({
        data: {
          orderId: order.id,
          userId: order.userId,
          type: "EMAIL",
          status: "FAILED",
        },
      });
    }
  }

  // Send SMS
  if (recipientPhone) {
    const smsBody = `On The Go Fueling: ${msg.body}${windowLine} Order #${order.id.slice(0, 8)}`;
    const sent = await sendSms(recipientPhone, smsBody);
    await prisma.notification.create({
      data: {
        orderId: order.id,
        userId: order.userId,
        type: "SMS",
        status: sent ? "SENT" : "FAILED",
        sentAt: sent ? new Date() : undefined,
      },
    });
  }
}
