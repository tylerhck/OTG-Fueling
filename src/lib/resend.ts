import { Resend } from "resend";

const EMAIL_FROM = process.env.EMAIL_FROM || "On The Go Fueling <noreply@otgfueling.com>";

// Lazy-initialize Resend client to avoid build-time errors
// (env vars aren't available during Next.js static page generation)
let _resend: Resend | null = null;
function getResendClient(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null;
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
}

export interface SendEmailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export async function sendEmail({ to, subject, text, html }: SendEmailOptions): Promise<boolean> {
  const resend = getResendClient();
  if (!resend) {
    console.warn("RESEND_API_KEY not set — skipping email send");
    return false;
  }

  try {
    const { error } = await resend.emails.send({
      from: EMAIL_FROM,
      to,
      subject,
      text,
      html: html || undefined,
    });

    if (error) {
      console.error("Resend email error:", error);
      return false;
    }

    return true;
  } catch (err) {
    console.error("Failed to send email:", err);
    return false;
  }
}
