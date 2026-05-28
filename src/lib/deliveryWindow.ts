/**
 * Returns a human-readable delivery window string such as "1:00 PM – 3:00 PM".
 *
 * Rules:
 *  - Scheduled orders: window starts at scheduledAt and ends slotMinutes later
 *    (default 120 minutes if slotMinutes is unknown).
 *  - ASAP orders with an etaMinutes set: window starts now and ends now + etaMinutes.
 *  - ASAP orders without etaMinutes: returns null (no window to show yet).
 */
export function getDeliveryWindow(
  scheduledAt: string | Date | null | undefined,
  etaMinutes: number | null | undefined,
  slotMinutes: number = 120
): string | null {
  if (scheduledAt) {
    const start = new Date(scheduledAt);
    const end = new Date(start.getTime() + slotMinutes * 60 * 1000);
    return `${fmtTime(start)} – ${fmtTime(end)}`;
  }

  if (etaMinutes != null && etaMinutes > 0) {
    const start = new Date();
    const end = new Date(start.getTime() + etaMinutes * 60 * 1000);
    return `${fmtTime(start)} – ${fmtTime(end)}`;
  }

  return null;
}

function fmtTime(date: Date): string {
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/**
 * Format a UTC date/time as Central Time (America/Chicago).
 * Used for displaying recurring order scheduled times in the admin UI.
 */
export function formatCentralTime(dateInput: string | Date): string {
  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "America/Chicago",
  });
}
