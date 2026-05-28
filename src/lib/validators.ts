import { z } from "zod/v4";

// Block names that look like spam: URLs, control chars, suspicious patterns
const SPAM_NAME_PATTERNS = [
  /https?:\/\//i,
  /www\./i,
  /bit\.ly/i,
  /tinyurl/i,
  /\.(com|net|org|ru|tr|cn|tk|ml|ga)\b/i,
  /[\u0000-\u001F\u007F]/,
  /->|=>|<-/,
];

const cleanName = z
  .string()
  .trim()
  .min(1, "Name is required")
  .max(60, "Name is too long")
  .refine((v) => !SPAM_NAME_PATTERNS.some((re) => re.test(v)), {
    message: "Name contains invalid characters",
  });

export const signUpSchema = z.object({
  name: cleanName,
  email: z.email("Invalid email address").max(254),
  password: z.string().min(8, "Password must be at least 8 characters").max(128),
  phone: z.string().max(20).optional(),
});

export const signInSchema = z.object({
  email: z.email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export const vehicleSchema = z.object({
  nickname: z.string().optional(),
  make: z.string().min(1, "Make is required"),
  model: z.string().min(1, "Model is required"),
  year: z.number().int().min(1900).max(2030),
  color: z.string().min(1, "Color is required"),
  licensePlate: z.string().optional(),
  notes: z.string().max(1000).optional(),
  fuelCapSide: z.enum(["LEFT", "RIGHT", "REAR", "UNKNOWN"]).default("UNKNOWN"),
  fuelType: z
    .enum(["REGULAR_87", "PREMIUM_93", "DIESEL"])
    .default("REGULAR_87"),
  isDefault: z.boolean().default(false),
});

export const boatSchema = z.object({
  nickname: z.string().optional(),
  make: z.string().optional(),
  model: z.string().optional(),
  year: z.number().int().min(1900).max(2030).optional(),
  color: z.string().optional(),
  registrationNumber: z.string().min(1, "Registration number is required"),
  notes: z.string().max(1000).optional(),
  fuelType: z
    .enum(["REGULAR_87", "PREMIUM_93", "DIESEL"])
    .default("REGULAR_87"),
  isDefault: z.boolean().default(false),
});

export const addressSchema = z.object({
  label: z.string().optional(),
  street: z.string().min(1, "Street is required"),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  zip: z.string().min(5, "ZIP code is required"),
});

export const serviceAreaSchema = z.object({
  name: z.string().min(1, "Name is required"),
  centerLat: z.number().min(-90).max(90),
  centerLng: z.number().min(-180).max(180),
  radiusMiles: z.number().positive("Radius must be positive"),
  polygon: z.array(z.tuple([z.number(), z.number()])).min(3).nullable().optional(),
  isActive: z.boolean().default(true),
});

export const fuelPriceSchema = z.object({
  fuelType: z.enum(["REGULAR_87", "PREMIUM_93", "DIESEL"]),
  basePriceCents: z.number().int().positive(),
  markupPercent: z.number().min(0),
});

const orderItemSchema = z.object({
  kind: z.enum(["PRIMARY_VEHICLE", "SECOND_VEHICLE", "TRAILERED_BOAT", "PRIMARY_BOAT", "DEF_ADDON", "DEF_ONLY"]),
  vehicleId: z.string().optional(),
  boatId: z.string().optional(),
  fuelType: z.enum(["REGULAR_87", "PREMIUM_93", "DIESEL"]),
  gallons: z.number().positive().max(50).optional(),
  isFillUp: z.boolean().optional(),
  notes: z.string().max(500).optional(),
  // Inline/snapshot fields for new boat added during checkout
  itemMake: z.string().optional(),
  itemModel: z.string().optional(),
  itemYear: z.number().int().min(1900).max(2030).optional(),
  itemColor: z.string().optional(),
  itemPlate: z.string().optional(),
  itemRegNumber: z.string().optional(),
}).refine((d) => d.isFillUp || (d.gallons != null && d.gallons > 0), {
  message: "Gallons required unless this is a fill-up order",
  path: ["gallons"],
});

export const orderSchema = z.object({
  addressId: z.string().min(1),
  scheduledAt: z.string().datetime().optional(),
  notes: z.string().max(500).optional(),
  items: z.array(orderItemSchema).min(1, "At least one item is required"),
});

export const guestOrderSchema = z.object({
  fuelType: z.enum(["REGULAR_87", "PREMIUM_93", "DIESEL"]),
  gallons: z.number().positive().max(50),
  scheduledAt: z.string().datetime().optional(),
  notes: z.string().max(500).optional(),
  // Guest contact
  guestName: z.string().min(1, "Name is required"),
  guestEmail: z.email("Valid email is required"),
  guestPhone: z.string().optional(),
  // Guest vehicle info
  vehicleMake: z.string().min(1, "Vehicle make is required"),
  vehicleModel: z.string().min(1, "Vehicle model is required"),
  vehicleYear: z.number().int().min(1900).max(2030),
  vehicleColor: z.string().min(1, "Vehicle color is required"),
  // Guest address
  street: z.string().min(1, "Street is required"),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  zip: z.string().min(5, "ZIP code is required"),
});

export const guestBoatOrderSchema = z.object({
  fuelType: z.enum(["REGULAR_87", "PREMIUM_93", "DIESEL"]),
  gallons: z.number().positive().max(200),
  isFillUp: z.boolean().optional(),
  scheduledAt: z.string().datetime().optional(),
  notes: z.string().max(500).optional(),
  // Guest contact
  guestName: z.string().min(1, "Name is required"),
  guestEmail: z.email("Valid email is required"),
  guestPhone: z.string().optional(),
  // Boat info (guest snapshot)
  boatMake: z.string().optional(),
  boatModel: z.string().optional(),
  boatYear: z.number().int().min(1900).max(2030).optional(),
  boatColor: z.string().optional(),
  boatRegistrationNumber: z.string().min(1, "Boat registration number is required"),
  boatNotes: z.string().max(500).optional(),
  // Guest address
  street: z.string().min(1, "Street is required"),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  zip: z.string().min(5, "ZIP code is required"),
}).refine((d) => d.isFillUp || (d.gallons != null && d.gallons > 0), {
  message: "Gallons required unless this is a fill-up",
  path: ["gallons"],
});

export const profileSchema = z.object({
  name: z.string().min(1, "Name is required"),
  phone: z.string().optional(),
});
