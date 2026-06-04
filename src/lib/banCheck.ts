import { prisma } from "@/lib/prisma";

/**
 * Check if any of the provided identifiers are on the ban list.
 * Returns true if banned, false if clear.
 */
export async function isBanned(identifiers: {
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  plate?: string | null;
}): Promise<boolean> {
  const conditions: Array<{ type: string; value: string }> = [];

  if (identifiers.email) {
    conditions.push({ type: "email", value: identifiers.email.toLowerCase() });
  }

  if (identifiers.phone) {
    let digits = identifiers.phone.replace(/\D/g, "");
    if (digits.length === 10) digits = "1" + digits;
    if (digits.startsWith("1") && digits.length === 11) {
      conditions.push({ type: "phone", value: "+" + digits });
    }
  }

  if (identifiers.address) {
    conditions.push({ type: "address", value: identifiers.address.trim() });
  }

  if (identifiers.plate) {
    conditions.push({ type: "plate", value: identifiers.plate.toUpperCase().replace(/\s+/g, "") });
  }

  if (conditions.length === 0) return false;

  const match = await prisma.banEntry.findFirst({
    where: {
      OR: conditions.map((c) => ({ type: c.type, value: c.value })),
    },
  });

  return !!match;
}
