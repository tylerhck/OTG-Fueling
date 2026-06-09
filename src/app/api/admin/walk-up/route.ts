import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/resend";

// GET - fetch walk-up orders
export async function GET() {
  const session = await auth();
  if (!session || (session.user as { role: string }).role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const orders = await prisma.order.findMany({
      where: {
        notes: { contains: "[WALK-UP]" },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return NextResponse.json({ orders });
  } catch (error) {
    console.error("Walk-up GET error:", error);
    return NextResponse.json({ error: "Failed to fetch orders" }, { status: 500 });
  }
}

// POST - create a walk-up order and send receipt
export async function POST(req: Request) {
  const session = await auth();
  if (!session || (session.user as { role: string }).role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const {
      name,
      email,
      phone,
      vehicle,
      fuelType,
      gallons,
      pricePerGallon,
      serviceFeeDollars,
      notes,
    } = body;

    if (!email?.trim()) {
      return NextResponse.json({ error: "Email is required for receipt" }, { status: 400 });
    }
    if (!gallons || gallons <= 0) {
      return NextResponse.json({ error: "Gallons must be greater than 0" }, { status: 400 });
    }

    const pricePerGallonCents = Math.round((pricePerGallon || 0) * 100);
    const fuelCostCents = Math.round(gallons * pricePerGallonCents);
    const serviceFeeCents = Math.round((serviceFeeDollars || 0) * 100);
    const totalCents = fuelCostCents + serviceFeeCents;

    // Create the order
    const order = await prisma.order.create({
      data: {
        fuelType: fuelType || "REGULAR_87",
        gallons,
        pricePerGallonCents,
        deliveryFeeCents: serviceFeeCents,
        totalCents,
        status: "COMPLETED",
        guestName: name || "Walk-Up Customer",
        guestEmail: email.trim(),
        guestPhone: phone || null,
        guestVehicle: vehicle || null,
        notes: `[WALK-UP] ${notes || ""}`.trim(),
        isFillUp: false,
        subscriptionDelivery: false,
      },
    });

    // Build receipt email
    const fuelLabel =
      fuelType === "REGULAR_87" ? "Regular 87" :
      fuelType === "PREMIUM_93" ? "Premium 93" :
      fuelType === "DIESEL" ? "Diesel" : fuelType;

    const receiptHtml = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h1 style="color: #dc2626; font-size: 24px; margin: 0;">On The Go Fueling</h1>
          <p style="color: #6b7280; font-size: 14px; margin: 4px 0 0 0;">Fuel Delivery Receipt</p>
        </div>
        
        <div style="background: #f9fafb; border-radius: 12px; padding: 20px; margin-bottom: 20px;">
          <p style="margin: 0 0 4px 0; color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Customer</p>
          <p style="margin: 0; font-size: 16px; font-weight: 600; color: #111827;">${name || "Walk-Up Customer"}</p>
          ${vehicle ? `<p style="margin: 4px 0 0 0; font-size: 14px; color: #6b7280;">${vehicle}</p>` : ""}
        </div>

        <div style="border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden;">
          <div style="padding: 16px; border-bottom: 1px solid #e5e7eb;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="text-align: left;">
                  <p style="margin: 0; font-size: 14px; color: #374151; font-weight: 500;">${fuelLabel}</p>
                  <p style="margin: 2px 0 0 0; font-size: 12px; color: #9ca3af;">${gallons.toFixed(2)} gal × $${pricePerGallon.toFixed(2)}/gal</p>
                </td>
                <td style="text-align: right; vertical-align: top;">
                  <p style="margin: 0; font-size: 14px; font-weight: 600; color: #111827;">$${(fuelCostCents / 100).toFixed(2)}</p>
                </td>
              </tr>
            </table>
          </div>
          <div style="padding: 16px; border-bottom: 1px solid #e5e7eb;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="text-align: left;">
                  <p style="margin: 0; font-size: 14px; color: #374151; font-weight: 500;">Service Fee</p>
                </td>
                <td style="text-align: right;">
                  <p style="margin: 0; font-size: 14px; font-weight: 600; color: #111827;">$${(serviceFeeCents / 100).toFixed(2)}</p>
                </td>
              </tr>
            </table>
          </div>
          <div style="padding: 16px; background: #f9fafb;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="text-align: left;">
                  <p style="margin: 0; font-size: 16px; font-weight: 700; color: #111827;">Total</p>
                </td>
                <td style="text-align: right;">
                  <p style="margin: 0; font-size: 18px; font-weight: 700; color: #dc2626;">$${(totalCents / 100).toFixed(2)}</p>
                </td>
              </tr>
            </table>
          </div>
        </div>

        <div style="text-align: center; margin-top: 24px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
          <p style="margin: 0; font-size: 12px; color: #9ca3af;">
            ${new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </p>
          <p style="margin: 8px 0 0 0; font-size: 12px; color: #9ca3af;">
            Thank you for choosing On The Go Fueling!
          </p>
          <p style="margin: 4px 0 0 0; font-size: 12px; color: #6b7280;">
            Sign up at <a href="https://www.otgfueling.com" style="color: #dc2626; text-decoration: none;">otgfueling.com</a> for scheduled deliveries
          </p>
        </div>
      </div>
    `;

    const receiptText = `On The Go Fueling - Receipt\n\nCustomer: ${name || "Walk-Up Customer"}\n${vehicle ? `Vehicle: ${vehicle}\n` : ""}\n${fuelLabel}: ${gallons.toFixed(2)} gal × $${pricePerGallon.toFixed(2)}/gal = $${(fuelCostCents / 100).toFixed(2)}\nService Fee: $${(serviceFeeCents / 100).toFixed(2)}\nTotal: $${(totalCents / 100).toFixed(2)}\n\nThank you! Sign up at otgfueling.com for scheduled deliveries.`;

    // Send receipt email
    const emailSent = await sendEmail({
      to: email.trim(),
      subject: `Your Fuel Receipt - $${(totalCents / 100).toFixed(2)}`,
      text: receiptText,
      html: receiptHtml,
    });

    return NextResponse.json({ order, receiptSent: emailSent });
  } catch (error) {
    console.error("Walk-up POST error:", error);
    return NextResponse.json({ error: "Failed to create order" }, { status: 500 });
  }
}
