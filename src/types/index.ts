export type FuelType = "REGULAR_87" | "PREMIUM_93" | "DIESEL";
export type FuelCapSide = "LEFT" | "RIGHT" | "REAR" | "UNKNOWN";
export type OrderStatus =
  | "AWAITING_PAYMENT"
  | "PENDING"
  | "ACTIVE"
  | "CONFIRMED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED";
export type Role = "CUSTOMER" | "ADMIN";
export type OrderItemKind =
  | "PRIMARY_VEHICLE"
  | "SECOND_VEHICLE"
  | "TRAILERED_BOAT"
  | "PRIMARY_BOAT"
  | "DEF_ADDON"
  | "DEF_ONLY";

export const FUEL_TYPE_LABELS: Record<FuelType, string> = {
  REGULAR_87: "Regular (87)",
  PREMIUM_93: "Premium (93)",
  DIESEL: "Diesel",
};

export const FUEL_CAP_LABELS: Record<FuelCapSide, string> = {
  LEFT: "Left (Driver)",
  RIGHT: "Right (Passenger)",
  REAR: "Rear",
  UNKNOWN: "Unknown",
};

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  AWAITING_PAYMENT: "Awaiting Payment",
  PENDING: "Scheduled",
  ACTIVE: "Active",
  CONFIRMED: "Confirmed",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export const ORDER_ITEM_KIND_LABELS: Record<OrderItemKind, string> = {
  PRIMARY_VEHICLE: "Vehicle Fuel",
  SECOND_VEHICLE: "2nd Vehicle Fuel",
  TRAILERED_BOAT: "Trailered Boat Fuel",
  PRIMARY_BOAT: "Boat Fuel",
  DEF_ADDON: "DEF Fluid (Add-on)",
  DEF_ONLY: "DEF Fluid",
};

export const DEF_SIZES: { gallons: number; label: string; cents: number }[] = [
  { gallons: 2.5, label: "2.5 gallon", cents: 3000 },
  { gallons: 5, label: "5 gallon", cents: 5500 },
];
