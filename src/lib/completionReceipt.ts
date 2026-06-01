import { sendEmail } from "@/lib/resend";

const FUEL_TYPE_LABELS: Record<string, string> = {
  REGULAR_87: "Regular 87",
  PREMIUM_93: "Premium 93",
  DIESEL: "Diesel",
};

interface CompletionReceiptData {
  orderId: string;
  recipientEmail: string | null;
  recipientName: string;
  fuelType: string;
  gallons: number;
  pricePerGallon: number;
  fuelTotalCents: number;
  deliveryFeeCents: number;
  totalCents: number;
}

export async function sendCompletionReceipt(data: CompletionReceiptData) {
  if (!data.recipientEmail) return;

  const fuelLabel = FUEL_TYPE_LABELS[data.fuelType] || data.fuelType;
  const fuelTotal = (data.fuelTotalCents / 100).toFixed(2);
  const deliveryFee = (data.deliveryFeeCents / 100).toFixed(2);
  const grandTotal = (data.totalCents / 100).toFixed(2);
  const orderRef = data.orderId.slice(0, 8).toUpperCase();

  const subject = "Delivery Receipt – On The Go Fueling";

  const text = `Hi ${data.recipientName},

Your fuel delivery is complete! Here's your receipt:

Order #${orderRef}
────────────────────────────
Fuel Type: ${fuelLabel}
Gallons Delivered: ${data.gallons.toFixed(2)} gal
Price Per Gallon: $${data.pricePerGallon.toFixed(3)}/gal
Fuel Total: $${fuelTotal}
${data.deliveryFeeCents > 0 ? `Delivery Fee: $${deliveryFee}\n` : ""}
TOTAL CHARGED: $${grandTotal}
────────────────────────────

Thank you for choosing On The Go Fueling!

Questions? Reply to this email or contact us at otgfuelingllc@gmail.com`;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
      <div style="text-align: center; margin-bottom: 32px;">
        <div style="display: inline-block; background: linear-gradient(135deg, #ef4444, #dc2626); color: white; font-weight: bold; font-size: 14px; padding: 12px 16px; border-radius: 12px;">OTG</div>
      </div>
      <h2 style="color: #1e293b; font-size: 24px; font-weight: 700; margin-bottom: 8px;">Delivery Receipt</h2>
      <p style="color: #475569; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">Hi ${data.recipientName}, your fuel delivery is complete!</p>
      
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
        <p style="color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 16px 0;">Order #${orderRef}</p>
        
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="color: #475569; font-size: 14px; padding: 8px 0;">Fuel Type</td>
            <td style="color: #1e293b; font-size: 14px; font-weight: 600; padding: 8px 0; text-align: right;">${fuelLabel}</td>
          </tr>
          <tr>
            <td style="color: #475569; font-size: 14px; padding: 8px 0;">Gallons Delivered</td>
            <td style="color: #1e293b; font-size: 14px; font-weight: 600; padding: 8px 0; text-align: right;">${data.gallons.toFixed(2)} gal</td>
          </tr>
          <tr>
            <td style="color: #475569; font-size: 14px; padding: 8px 0;">Price Per Gallon</td>
            <td style="color: #1e293b; font-size: 14px; font-weight: 600; padding: 8px 0; text-align: right;">$${data.pricePerGallon.toFixed(3)}/gal</td>
          </tr>
          <tr style="border-top: 1px solid #e2e8f0;">
            <td style="color: #475569; font-size: 14px; padding: 8px 0;">Fuel Total</td>
            <td style="color: #1e293b; font-size: 14px; font-weight: 600; padding: 8px 0; text-align: right;">$${fuelTotal}</td>
          </tr>
          ${data.deliveryFeeCents > 0 ? `
          <tr>
            <td style="color: #475569; font-size: 14px; padding: 8px 0;">Delivery Fee</td>
            <td style="color: #1e293b; font-size: 14px; font-weight: 600; padding: 8px 0; text-align: right;">$${deliveryFee}</td>
          </tr>
          ` : ""}
          <tr style="border-top: 2px solid #1e293b;">
            <td style="color: #1e293b; font-size: 16px; font-weight: 700; padding: 12px 0;">Total Charged</td>
            <td style="color: #1e293b; font-size: 16px; font-weight: 700; padding: 12px 0; text-align: right;">$${grandTotal}</td>
          </tr>
        </table>
      </div>

      <p style="color: #475569; font-size: 14px; line-height: 1.6; margin-bottom: 24px;">
        Thank you for choosing On The Go Fueling! If you have any questions about this charge, please reply to this email or contact us at otgfuelingllc@gmail.com.
      </p>

      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
      <p style="color: #94a3b8; font-size: 12px; text-align: center;">On The Go Fueling &bull; Fort Worth, TX</p>
    </div>
  `;

  await sendEmail({ to: data.recipientEmail, subject, text, html });
}
