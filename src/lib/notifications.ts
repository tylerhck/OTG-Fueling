import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/resend";
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

async function sendSms(to: string, message: string): Promise<boolean> {
  const telnyxApiKey = process.env.TELNYX_API_KEY;
  const from = process.env.TELNYX_FROM_NUMBER || "+16825497355";

  if (!telnyxApiKey) return false;

  const res = await fetch("https://api.telnyx.com/v2/messages", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${telnyxApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to, text: message }),
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

  // Send email via Resend
  const windowLine = window
    ? `\nEstimated vehicle arrival at your location: ${window}`
    : "";

  if (recipientEmail) {
    const sent = await sendEmail({
      to: recipientEmail,
      subject: msg.subject,
      text: `Hi ${recipientName},\n\n${msg.body}${windowLine}\n\nOrder #${order.id.slice(0, 8)}\n\nThank you,\nOn The Go Fueling`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
          <div style="text-align: center; margin-bottom: 32px;">
            <div style="display: inline-block; background: linear-gradient(135deg, #ef4444, #dc2626); color: white; font-weight: bold; font-size: 14px; padding: 12px 16px; border-radius: 12px;">OTG</div>
          </div>
          <h2 style="color: #1e293b; font-size: 24px; font-weight: 700; margin-bottom: 16px;">${msg.subject.replace(" – On The Go Fueling", "")}</h2>
          <p style="color: #475569; font-size: 16px; line-height: 1.6; margin-bottom: 8px;">Hi ${recipientName},</p>
          <p style="color: #475569; font-size: 16px; line-height: 1.6; margin-bottom: 16px;">${msg.body}</p>
          ${window ? `<p style="color: #475569; font-size: 16px; line-height: 1.6; margin-bottom: 16px;"><strong>Estimated arrival:</strong> ${window}</p>` : ""}
          <p style="color: #64748b; font-size: 14px; margin-bottom: 24px;">Order #${order.id.slice(0, 8)}</p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
          <p style="color: #94a3b8; font-size: 12px; text-align: center;">On The Go Fueling &bull; Fort Worth, TX</p>
        </div>
      `,
    });

    await prisma.notification.create({
      data: {
        orderId: order.id,
        userId: order.userId,
        type: "EMAIL",
        status: sent ? "SENT" : "FAILED",
        sentAt: sent ? new Date() : undefined,
      },
    });
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
