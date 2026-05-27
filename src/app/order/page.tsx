"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { FUEL_TYPE_LABELS, DEF_SIZES } from "@/types";

const PinMap = dynamic(() => import("@/components/PinMap"), { ssr: false });

interface Vehicle {
  id: string;
  nickname: string | null;
  make: string;
  model: string;
  year: number;
  fuelType: string;
  licensePlate: string | null;
  isDefault: boolean;
}

interface Boat {
  id: string;
  nickname: string | null;
  make: string | null;
  model: string | null;
  year: number | null;
  registrationNumber: string;
  fuelType: string;
  isDefault: boolean;
}

interface Address {
  id: string;
  label: string | null;
  street: string;
  city: string;
  state: string;
  zip: string;
  lat: number;
  lng: number;
  isDefault: boolean;
}

interface FuelPrice {
  fuelType: string;
  effectivePriceCents: number;
}

interface SubscriptionInfo {
  active: boolean;
  fillUpsUsed: number;
  fillUpLimit: number;
  secondFillUpFeeCents: number;
  freeDeliveriesUsed: number;
  freeDeliveriesPerWeek: number;
}

interface ServiceSchedule {
  id: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  slotMinutes: number;
  capacityPerSlot: number;
}

interface SlotAvailability {
  slotStart: string;
  isClosed: boolean;
  isFull: boolean;
  remaining: number;
}

const DAY_NAMES = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
const FILL_UP_MAX_GALLONS = 30;

function generateSlots(
  startTime: string,
  endTime: string,
  slotMinutes: number
): { label: string; startH: number; startM: number; slotKey: string }[] {
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  const startMins = sh * 60 + sm;
  const endMins = eh * 60 + em;
  const slots: { label: string; startH: number; startM: number; slotKey: string }[] = [];
  for (let t = startMins; t < endMins; t += slotMinutes) {
    const slotEnd = Math.min(t + slotMinutes, endMins);
    const startH = Math.floor(t / 60);
    const startM = t % 60;
    slots.push({
      label: `${fmtTime(t)} – ${fmtTime(slotEnd)}`,
      startH,
      startM,
      slotKey: `${startH.toString().padStart(2, "0")}:${startM.toString().padStart(2, "0")}`,
    });
  }
  return slots;
}

function fmtTime(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${m.toString().padStart(2, "0")} ${ampm}`;
}

function getNextDays(n: number): Date[] {
  const days: Date[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = 0; i < n; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    days.push(d);
  }
  return days;
}

const SECOND_VEHICLE_ADDON_CENTS = 500;
const TRAILERED_BOAT_ADDON_CENTS = 1000;

export default function OrderPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [boats, setBoats] = useState<Boat[]>([]);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [prices, setPrices] = useState<FuelPrice[]>([]);
  const [deliveryFeeCents, setDeliveryFeeCents] = useState(1500);
  const [asapEnabled, setAsapEnabled] = useState(true);
  const [subscriptionInfo, setSubscriptionInfo] = useState<SubscriptionInfo | null>(null);
  const [schedules, setSchedules] = useState<ServiceSchedule[]>([]);
  const [slotAvailability, setSlotAvailability] = useState<SlotAvailability[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Primary vehicle form
  const [form, setForm] = useState({
    vehicleId: "",
    addressId: "",
    fuelType: "REGULAR_87",
    gallons: 10,
    isFillUp: false,
    deliveryType: "asap" as "asap" | "scheduled",
    scheduledDate: "",
    scheduledSlotStart: "",
    scheduledSlotLabel: "",
    notes: "",
  });

  const [pinLat, setPinLat] = useState<number | null>(null);
  const [pinLng, setPinLng] = useState<number | null>(null);

  // DEF fluid add-on
  const [addDef, setAddDef] = useState(false);
  const [defGallons, setDefGallons] = useState<number>(2.5);

  // Second vehicle add-on
  const [addSecondVehicle, setAddSecondVehicle] = useState(false);
  const [secondVehicle, setSecondVehicle] = useState({
    vehicleId: "",
    fuelType: "REGULAR_87",
    gallons: 10,
    isFillUp: false,
    notes: "",
  });

  // Trailered boat add-on
  const [addTraileredBoat, setAddTraileredBoat] = useState(false);
  const [boatAddon, setBoatAddon] = useState({
    boatId: "",
    fuelType: "REGULAR_87",
    gallons: 20,
    isFillUp: false,
    notes: "",
    // New boat inline fields
    isNewBoat: false,
    newBoatRegNumber: "",
    newBoatNickname: "",
    newBoatMake: "",
    newBoatModel: "",
  });

  const fetchData = useCallback(async () => {
    const [vRes, aRes, pRes, sRes, bRes] = await Promise.all([
      fetch("/api/vehicles"),
      fetch("/api/addresses"),
      fetch("/api/fuel-prices"),
      fetch("/api/service-schedules"),
      fetch("/api/boats"),
    ]);

    const [vehicleData, addressData, priceData, scheduleData, boatData] = await Promise.all([
      vRes.json(),
      aRes.json(),
      pRes.json(),
      sRes.json(),
      bRes.json(),
    ]);

    setVehicles(vehicleData);
    setAddresses(addressData);
    setPrices(priceData.prices || []);
    setBoats(Array.isArray(boatData) ? boatData : []);
    if (priceData.deliveryFeeCents !== undefined) setDeliveryFeeCents(priceData.deliveryFeeCents);
    if (priceData.asapEnabled !== undefined) setAsapEnabled(priceData.asapEnabled);
    if (priceData.subscription) setSubscriptionInfo(priceData.subscription);
    setSchedules(Array.isArray(scheduleData) ? scheduleData : []);

    const defaultVehicle = vehicleData.find((v: Vehicle) => v.isDefault);
    const defaultAddress = addressData.find((a: Address) => a.isDefault);

    setForm((prev) => ({
      ...prev,
      vehicleId: defaultVehicle?.id || vehicleData[0]?.id || "",
      addressId: defaultAddress?.id || addressData[0]?.id || "",
      fuelType: defaultVehicle?.fuelType || "REGULAR_87",
      deliveryType: priceData.asapEnabled === false ? "scheduled" : "asap",
    }));

    setLoading(false);
  }, []);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/signin");
  }, [status, router]);

  useEffect(() => {
    if (session?.user?.id) fetchData();
  }, [session, fetchData]);

  // Fetch slot availability when date changes
  useEffect(() => {
    if (form.deliveryType === "scheduled" && form.scheduledDate) {
      fetch(`/api/service-schedules/availability?date=${form.scheduledDate}`)
        .then((r) => r.json())
        .then((data) => setSlotAvailability(Array.isArray(data) ? data : []))
        .catch(() => setSlotAvailability([]));
    }
  }, [form.scheduledDate, form.deliveryType]);

  const selectedPrice = prices.find((p) => p.fuelType === form.fuelType);
  const pricePerGallon = selectedPrice ? selectedPrice.effectivePriceCents / 100 : 0;

  // Determine delivery fee based on subscription fill-up usage
  let effectiveDeliveryFeeCents = deliveryFeeCents;
  let isFreeDelivery = false;
  let isSecondPaidFillUp = false;
  let isWeeklyLimitReached = false;

  if (subscriptionInfo?.active) {
    const used = subscriptionInfo.fillUpsUsed ?? subscriptionInfo.freeDeliveriesUsed ?? 0;
    const limit = subscriptionInfo.fillUpLimit ?? 2;
    if (used === 0) {
      effectiveDeliveryFeeCents = 0;
      isFreeDelivery = true;
    } else if (used === 1) {
      effectiveDeliveryFeeCents = subscriptionInfo.secondFillUpFeeCents ?? 1000;
      isSecondPaidFillUp = true;
    } else if (used >= limit) {
      isWeeklyLimitReached = true;
    }
  }

  const deliveryFee = effectiveDeliveryFeeCents / 100;

  // Primary item cost
  const primaryFuelCost = form.isFillUp ? 0 : pricePerGallon * form.gallons;
  const primaryFillUpAuth = form.isFillUp ? pricePerGallon * FILL_UP_MAX_GALLONS : 0;

  // Second vehicle cost
  const secondVehiclePrice = prices.find((p) => p.fuelType === secondVehicle.fuelType);
  const secondVehiclePPG = secondVehiclePrice ? secondVehiclePrice.effectivePriceCents / 100 : 0;
  const secondVehicleGasCost = addSecondVehicle
    ? secondVehicle.isFillUp ? 0 : secondVehiclePPG * secondVehicle.gallons
    : 0;
  const secondVehicleAddonFee = addSecondVehicle ? SECOND_VEHICLE_ADDON_CENTS / 100 : 0;

  // Trailered boat cost
  const boatPrice = prices.find((p) => p.fuelType === boatAddon.fuelType);
  const boatPPG = boatPrice ? boatPrice.effectivePriceCents / 100 : 0;
  const boatGasCost = addTraileredBoat
    ? boatAddon.isFillUp ? 0 : boatPPG * boatAddon.gallons
    : 0;
  const boatAddonFee = addTraileredBoat ? TRAILERED_BOAT_ADDON_CENTS / 100 : 0;

  const defCost = addDef ? (DEF_SIZES.find((s) => s.gallons === defGallons)?.cents ?? 0) / 100 : 0;

  const total = form.isFillUp
    ? primaryFillUpAuth + deliveryFee + secondVehicleAddonFee + secondVehicleGasCost + boatAddonFee + boatGasCost + defCost
    : primaryFuelCost + deliveryFee + secondVehicleAddonFee + secondVehicleGasCost + boatAddonFee + boatGasCost + defCost;

  // Available slots for selected date
  const generatedSlots = (() => {
    if (!form.scheduledDate || form.deliveryType !== "scheduled") return [];
    const d = new Date(form.scheduledDate + "T00:00:00");
    const dayName = DAY_NAMES[d.getDay()];
    return schedules
      .filter((s) => s.dayOfWeek === dayName)
      .flatMap((s) => generateSlots(s.startTime, s.endTime, s.slotMinutes || 15));
  })();

  const availabilityMap = new Map(slotAvailability.map((s) => [s.slotStart, s]));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    if (!form.vehicleId) {
      setError("Please select or add a vehicle first.");
      setSubmitting(false);
      return;
    }
    if (!form.addressId) {
      setError("Please select or add a delivery address first.");
      setSubmitting(false);
      return;
    }
    if (form.deliveryType === "scheduled" && (!form.scheduledDate || !form.scheduledSlotStart)) {
      setError("Please select a delivery date and time slot.");
      setSubmitting(false);
      return;
    }
    if (isWeeklyLimitReached) {
      setError("Your weekly fill-up limit has been reached. Please contact us for additional service.");
      setSubmitting(false);
      return;
    }

    if (addTraileredBoat && boatAddon.isNewBoat && !boatAddon.newBoatRegNumber) {
      setError("Please provide a registration number for the trailered boat.");
      setSubmitting(false);
      return;
    }

    let scheduledAt: string | undefined;
    if (form.deliveryType === "scheduled" && form.scheduledDate && form.scheduledSlotStart) {
      const [h, m] = form.scheduledSlotStart.split(":").map(Number);
      const dt = new Date(form.scheduledDate + "T00:00:00");
      dt.setHours(h, m, 0, 0);
      scheduledAt = dt.toISOString();
    }

    // Build items array
    const items: Record<string, unknown>[] = [
      {
        kind: "PRIMARY_VEHICLE",
        vehicleId: form.vehicleId,
        fuelType: form.fuelType,
        gallons: form.isFillUp ? undefined : form.gallons,
        isFillUp: form.isFillUp,
      },
    ];

    if (addDef) {
      items.push({
        kind: "DEF_ADDON",
        fuelType: "DIESEL",
        gallons: defGallons,
        isFillUp: false,
      });
    }

    if (addSecondVehicle && secondVehicle.vehicleId) {
      items.push({
        kind: "SECOND_VEHICLE",
        vehicleId: secondVehicle.vehicleId,
        fuelType: secondVehicle.fuelType,
        gallons: secondVehicle.isFillUp ? undefined : secondVehicle.gallons,
        isFillUp: secondVehicle.isFillUp,
        notes: secondVehicle.notes || undefined,
      });
    }

    if (addTraileredBoat) {
      const boatItem: Record<string, unknown> = {
        kind: "TRAILERED_BOAT",
        fuelType: boatAddon.fuelType,
        gallons: boatAddon.isFillUp ? undefined : boatAddon.gallons,
        isFillUp: boatAddon.isFillUp,
        notes: boatAddon.notes || undefined,
      };
      if (boatAddon.isNewBoat) {
        boatItem.itemRegNumber = boatAddon.newBoatRegNumber;
        boatItem.itemMake = boatAddon.newBoatMake || undefined;
        boatItem.itemModel = boatAddon.newBoatModel || undefined;
      } else {
        boatItem.boatId = boatAddon.boatId;
      }
      items.push(boatItem);
    }

    const orderRes = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        addressId: form.addressId,
        scheduledAt,
        notes: form.notes || undefined,
        items,
        ...(pinLat !== null && pinLng !== null ? { pinLat, pinLng } : {}),
      }),
    });

    if (!orderRes.ok) {
      const data = await orderRes.json();
      setError(data.error || "Failed to create order");
      setSubmitting(false);
      return;
    }

    const order = await orderRes.json();

    const hasFillUp = form.isFillUp || (addSecondVehicle && secondVehicle.isFillUp) || (addTraileredBoat && boatAddon.isFillUp);
    const intentAmount = hasFillUp ? 100 : order.totalCents;

    const intentRes = await fetch("/api/stripe/create-intent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amountCents: intentAmount,
        orderId: order.id,
        isFillUp: hasFillUp,
      }),
    });

    if (!intentRes.ok) {
      setError("Failed to initiate payment. Please try again.");
      setSubmitting(false);
      return;
    }

    const { clientSecret } = await intentRes.json();

    router.push(
      `/order/payment?secret=${encodeURIComponent(clientSecret)}&orderId=${order.id}&total=${intentAmount}${hasFillUp ? "&fillup=1" : ""}`
    );
  }

  if (status === "loading" || loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-red-500" />
      </div>
    );
  }

  const nextDays = getNextDays(14);
  const isSubscriber = subscriptionInfo?.active ?? false;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-bold text-slate-900">Order Fuel</h1>
      <p className="mt-1 text-sm text-slate-500">
        Select your vehicle, address, fuel type and amount.
      </p>

      {/* Subscriber / delivery-fee status banner */}
      {subscriptionInfo !== null && (
        <div
          className={`mt-4 rounded-xl border p-3.5 text-sm font-medium ${
            subscriptionInfo.active
              ? isWeeklyLimitReached
                ? "border-amber-200 bg-amber-50 text-amber-800"
                : "border-green-200 bg-green-50 text-green-800"
              : "border-slate-200 bg-slate-50 text-slate-700"
          }`}
        >
          {subscriptionInfo.active ? (
            isWeeklyLimitReached ? (
              "Weekly limit reached — no more fill-ups available this week."
            ) : isFreeDelivery ? (
              "OTG Subscriber — first fill-up this week is free delivery ($0)."
            ) : isSecondPaidFillUp ? (
              "OTG Subscriber — second fill-up this week: $10 delivery fee."
            ) : (
              "OTG Subscriber — delivery included."
            )
          ) : (
            "Not subscribed — $15 delivery fee applies. Subscribe for $35/month to get free deliveries."
          )}
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-xl bg-red-50 border border-red-200 p-3.5 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-6 space-y-6">
        {/* Vehicle Selection */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Vehicle</h2>
          {vehicles.length === 0 ? (
            <div className="mt-3">
              <p className="text-sm text-slate-500">No vehicles saved yet.</p>
              <a href="/profile/vehicles" className="mt-2 inline-block text-sm font-medium text-red-600 hover:text-red-500">
                + Add a Vehicle
              </a>
            </div>
          ) : (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {vehicles.map((v) => (
                <button
                  type="button"
                  key={v.id}
                  onClick={() => setForm((prev) => ({ ...prev, vehicleId: v.id, fuelType: v.fuelType }))}
                  className={`rounded-lg border-2 p-3 text-left transition-colors ${
                    form.vehicleId === v.id ? "border-red-500 bg-red-50" : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <p className="font-medium text-slate-900">{v.nickname || `${v.year} ${v.make} ${v.model}`}</p>
                  {v.nickname && <p className="text-xs text-slate-500">{v.year} {v.make} {v.model}</p>}
                  {v.licensePlate && <p className="text-xs text-slate-400">Plate: {v.licensePlate}</p>}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Address Selection */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Delivery Address</h2>
          {addresses.length === 0 ? (
            <div className="mt-3">
              <p className="text-sm text-slate-500">No addresses saved yet.</p>
              <a href="/profile/addresses" className="mt-2 inline-block text-sm font-medium text-red-600 hover:text-red-500">
                + Add an Address
              </a>
            </div>
          ) : (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {addresses.map((a) => (
                <button
                  type="button"
                  key={a.id}
                  onClick={() => { setForm((prev) => ({ ...prev, addressId: a.id })); setPinLat(null); setPinLng(null); }}
                  className={`rounded-lg border-2 p-3 text-left transition-colors ${
                    form.addressId === a.id ? "border-red-500 bg-red-50" : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <p className="font-medium text-slate-900">{a.label || a.street}</p>
                  <p className="text-xs text-slate-500">{a.street}, {a.city}, {a.state} {a.zip}</p>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Pin Location */}
        {(() => {
          const selectedAddress = addresses.find((a) => a.id === form.addressId);
          if (!selectedAddress) return null;
          return (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">Pin Your Exact Location</h2>
              <p className="mt-1 text-sm text-slate-500">Drag the pin to where your car will be parked so we can find you easily.</p>
              <div className="mt-3">
                <PinMap
                  center={{ lat: pinLat ?? selectedAddress.lat, lng: pinLng ?? selectedAddress.lng }}
                  onChange={(lat, lng) => { setPinLat(lat); setPinLng(lng); }}
                  height="200px"
                />
              </div>
              {pinLat !== null && (
                <p className="mt-2 text-xs text-slate-400">
                  Pin set &mdash; <button type="button" className="text-red-500 hover:underline" onClick={() => { setPinLat(null); setPinLng(null); }}>Reset to address</button>
                </p>
              )}
            </div>
          );
        })()}

        {/* Primary Fuel Details */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Fuel Details</h2>

          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-700">Fuel Type</label>
              <select
                value={form.fuelType}
                onChange={(e) => setForm((prev) => ({ ...prev, fuelType: e.target.value }))}
                className="mt-1.5 block w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20 transition-shadow"
              >
                {Object.entries(FUEL_TYPE_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Gallons</label>
              {form.isFillUp ? (
                <div className="mt-1.5 flex items-center rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <span className="text-sm text-slate-400 italic">We&apos;ll fill your tank — gallons billed after delivery</span>
                </div>
              ) : (
                <input
                  type="number"
                  min={1}
                  max={50}
                  step={0.5}
                  value={form.gallons}
                  onChange={(e) => setForm((prev) => ({ ...prev, gallons: parseFloat(e.target.value) || 0 }))}
                  className="mt-1.5 block w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20 transition-shadow"
                />
              )}
            </div>
          </div>

          {/* Fill-up toggle */}
          <div className="mt-4 flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-slate-700">Fill Up My Tank</p>
              <p className="text-xs text-slate-400">
                We place a $1 hold to verify your card, then charge only for what we pump plus the delivery fee.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setForm((prev) => ({ ...prev, isFillUp: !prev.isFillUp }))}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.isFillUp ? "bg-red-600" : "bg-slate-300"}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${form.isFillUp ? "translate-x-6" : "translate-x-1"}`} />
            </button>
          </div>
        </div>

        {/* --- SUBSCRIBER ADD-ONS --- */}
        {isSubscriber && (
          <>
            {/* 2nd Vehicle Add-on */}
            <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Add 2nd Vehicle</h2>
                  <p className="text-sm text-slate-500">$5 service fee + cost of gas</p>
                </div>
                <button
                  type="button"
                  onClick={() => setAddSecondVehicle((v) => !v)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${addSecondVehicle ? "bg-red-600" : "bg-slate-300"}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${addSecondVehicle ? "translate-x-6" : "translate-x-1"}`} />
                </button>
              </div>

              {addSecondVehicle && (
                <div className="mt-4 space-y-4">
                  <p className="text-xs text-slate-500">Choose a different vehicle at the same location.</p>
                  {vehicles.filter((v) => v.id !== form.vehicleId).length === 0 ? (
                    <p className="text-sm text-slate-400">No other vehicles saved. <a href="/profile/vehicles" className="text-red-600 hover:text-red-500">Add one</a>.</p>
                  ) : (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {vehicles.filter((v) => v.id !== form.vehicleId).map((v) => (
                        <button
                          type="button"
                          key={v.id}
                          onClick={() => setSecondVehicle((prev) => ({ ...prev, vehicleId: v.id, fuelType: v.fuelType }))}
                          className={`rounded-lg border-2 p-3 text-left transition-colors ${
                            secondVehicle.vehicleId === v.id ? "border-red-500 bg-red-50" : "border-slate-200 hover:border-slate-300 bg-white"
                          }`}
                        >
                          <p className="font-medium text-slate-900 text-sm">{v.nickname || `${v.year} ${v.make} ${v.model}`}</p>
                          {v.licensePlate && <p className="text-xs text-slate-400">Plate: {v.licensePlate}</p>}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-sm font-medium text-slate-700">Fuel Type</label>
                      <select
                        value={secondVehicle.fuelType}
                        onChange={(e) => setSecondVehicle((p) => ({ ...p, fuelType: e.target.value }))}
                        className="mt-1.5 block w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20 transition-shadow"
                      >
                        {Object.entries(FUEL_TYPE_LABELS).map(([key, label]) => (
                          <option key={key} value={key}>{label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700">Gallons</label>
                      {secondVehicle.isFillUp ? (
                        <div className="mt-1.5 flex items-center rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                          <span className="text-sm text-slate-400 italic">Fill up — billed after</span>
                        </div>
                      ) : (
                        <input
                          type="number" min={1} max={50} step={0.5}
                          value={secondVehicle.gallons}
                          onChange={(e) => setSecondVehicle((p) => ({ ...p, gallons: parseFloat(e.target.value) || 0 }))}
                          className="mt-1.5 block w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20 transition-shadow"
                        />
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3">
                    <p className="text-sm font-medium text-slate-700">Fill Up 2nd Vehicle</p>
                    <button
                      type="button"
                      onClick={() => setSecondVehicle((p) => ({ ...p, isFillUp: !p.isFillUp }))}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${secondVehicle.isFillUp ? "bg-red-600" : "bg-slate-300"}`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${secondVehicle.isFillUp ? "translate-x-6" : "translate-x-1"}`} />
                    </button>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700">Notes <span className="text-slate-400 font-normal">(optional)</span></label>
                    <input
                      type="text"
                      value={secondVehicle.notes}
                      onChange={(e) => setSecondVehicle((p) => ({ ...p, notes: e.target.value }))}
                      placeholder="e.g. fuel cap on the right side"
                      className="mt-1.5 block w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20 transition-shadow"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Trailered Boat Add-on */}
            <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Add Trailered Boat</h2>
                  <p className="text-sm text-slate-500">$10 service fee + cost of gas</p>
                </div>
                <button
                  type="button"
                  onClick={() => setAddTraileredBoat((v) => !v)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${addTraileredBoat ? "bg-red-600" : "bg-slate-300"}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${addTraileredBoat ? "translate-x-6" : "translate-x-1"}`} />
                </button>
              </div>

              {addTraileredBoat && (
                <div className="mt-4 space-y-4">
                  <p className="text-xs text-slate-500">Boat must be at the same location as your vehicle.</p>

                  {/* Select saved boat or enter new */}
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setBoatAddon((p) => ({ ...p, isNewBoat: false }))}
                      className={`rounded-lg border-2 px-3 py-2 text-xs font-medium transition-colors ${!boatAddon.isNewBoat ? "border-red-500 bg-red-50 text-red-700" : "border-slate-200 text-slate-700 hover:border-slate-300"}`}
                    >
                      Saved Boat
                    </button>
                    <button
                      type="button"
                      onClick={() => setBoatAddon((p) => ({ ...p, isNewBoat: true, boatId: "" }))}
                      className={`rounded-lg border-2 px-3 py-2 text-xs font-medium transition-colors ${boatAddon.isNewBoat ? "border-red-500 bg-red-50 text-red-700" : "border-slate-200 text-slate-700 hover:border-slate-300"}`}
                    >
                      + New Boat
                    </button>
                  </div>

                  {!boatAddon.isNewBoat && (
                    boats.length === 0 ? (
                      <p className="text-sm text-slate-400">No saved boats. <button type="button" onClick={() => setBoatAddon((p) => ({ ...p, isNewBoat: true }))} className="text-red-600 hover:text-red-500">Enter boat info.</button></p>
                    ) : (
                      <div className="grid gap-2 sm:grid-cols-2">
                        {boats.map((b) => (
                          <button
                            type="button"
                            key={b.id}
                            onClick={() => setBoatAddon((p) => ({ ...p, boatId: b.id, fuelType: b.fuelType }))}
                            className={`rounded-lg border-2 p-3 text-left transition-colors ${
                              boatAddon.boatId === b.id ? "border-red-500 bg-red-50" : "border-slate-200 hover:border-slate-300 bg-white"
                            }`}
                          >
                            <p className="font-medium text-slate-900 text-sm">{b.nickname || `${b.make || ""} ${b.model || ""}`.trim() || "Boat"}</p>
                            <p className="text-xs text-slate-400">Reg: {b.registrationNumber}</p>
                          </button>
                        ))}
                      </div>
                    )
                  )}

                  {boatAddon.isNewBoat && (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="sm:col-span-2">
                        <label className="block text-sm font-medium text-slate-700">Boat Registration # *</label>
                        <input
                          type="text"
                          required
                          value={boatAddon.newBoatRegNumber}
                          onChange={(e) => setBoatAddon((p) => ({ ...p, newBoatRegNumber: e.target.value }))}
                          placeholder="e.g. TX1234AB"
                          className="mt-1.5 block w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20 transition-shadow"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700">Make <span className="text-slate-400 font-normal">(optional)</span></label>
                        <input
                          type="text"
                          value={boatAddon.newBoatMake}
                          onChange={(e) => setBoatAddon((p) => ({ ...p, newBoatMake: e.target.value }))}
                          placeholder="e.g. Yamaha"
                          className="mt-1.5 block w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20 transition-shadow"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700">Model <span className="text-slate-400 font-normal">(optional)</span></label>
                        <input
                          type="text"
                          value={boatAddon.newBoatModel}
                          onChange={(e) => setBoatAddon((p) => ({ ...p, newBoatModel: e.target.value }))}
                          placeholder="e.g. 242X"
                          className="mt-1.5 block w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20 transition-shadow"
                        />
                      </div>
                    </div>
                  )}

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-sm font-medium text-slate-700">Fuel Type</label>
                      <select
                        value={boatAddon.fuelType}
                        onChange={(e) => setBoatAddon((p) => ({ ...p, fuelType: e.target.value }))}
                        className="mt-1.5 block w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20 transition-shadow"
                      >
                        {Object.entries(FUEL_TYPE_LABELS).map(([key, label]) => (
                          <option key={key} value={key}>{label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700">Gallons</label>
                      {boatAddon.isFillUp ? (
                        <div className="mt-1.5 flex items-center rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                          <span className="text-sm text-slate-400 italic">Fill up — billed after</span>
                        </div>
                      ) : (
                        <input
                          type="number" min={1} max={200} step={1}
                          value={boatAddon.gallons}
                          onChange={(e) => setBoatAddon((p) => ({ ...p, gallons: parseFloat(e.target.value) || 0 }))}
                          className="mt-1.5 block w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20 transition-shadow"
                        />
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3">
                    <p className="text-sm font-medium text-slate-700">Fill Up Boat</p>
                    <button
                      type="button"
                      onClick={() => setBoatAddon((p) => ({ ...p, isFillUp: !p.isFillUp }))}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${boatAddon.isFillUp ? "bg-red-600" : "bg-slate-300"}`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${boatAddon.isFillUp ? "translate-x-6" : "translate-x-1"}`} />
                    </button>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700">Boat Notes <span className="text-slate-400 font-normal">(optional)</span></label>
                    <input
                      type="text"
                      value={boatAddon.notes}
                      onChange={(e) => setBoatAddon((p) => ({ ...p, notes: e.target.value }))}
                      placeholder="e.g. fuel port on the starboard side"
                      className="mt-1.5 block w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20 transition-shadow"
                    />
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* Delivery Time */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Delivery Time</h2>
          <div className="mt-3 flex gap-4">
            {asapEnabled && (
              <button
                type="button"
                onClick={() => setForm((prev) => ({ ...prev, deliveryType: "asap", scheduledDate: "", scheduledSlotStart: "", scheduledSlotLabel: "" }))}
                className={`rounded-lg border-2 px-4 py-2 text-sm font-medium transition-colors ${
                  form.deliveryType === "asap" ? "border-red-500 bg-red-50 text-red-700" : "border-slate-200 text-slate-700 hover:border-slate-300"
                }`}
              >
                ASAP
              </button>
            )}
            <button
              type="button"
              onClick={() => setForm((prev) => ({ ...prev, deliveryType: "scheduled" }))}
              className={`rounded-lg border-2 px-4 py-2 text-sm font-medium transition-colors ${
                form.deliveryType === "scheduled" ? "border-red-500 bg-red-50 text-red-700" : "border-slate-200 text-slate-700 hover:border-slate-300"
              }`}
            >
              Schedule
            </button>
          </div>

          {!asapEnabled && form.deliveryType !== "scheduled" && (
            <p className="mt-2 text-xs text-amber-600">ASAP delivery is currently unavailable. Please schedule a time.</p>
          )}

          {form.deliveryType === "scheduled" && (
            <div className="mt-4 space-y-4">
              <div>
                <p className="text-sm font-medium text-slate-700 mb-2">Select a Date</p>
                <div className="flex flex-wrap gap-2">
                  {nextDays.map((d) => {
                    const iso = d.toISOString().slice(0, 10);
                    const dayName = DAY_NAMES[d.getDay()];
                    const hasSlots = schedules.some((s) => s.dayOfWeek === dayName);
                    const label = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
                    return (
                      <button
                        key={iso}
                        type="button"
                        disabled={!hasSlots}
                        onClick={() => setForm((prev) => ({ ...prev, scheduledDate: iso, scheduledSlotStart: "", scheduledSlotLabel: "" }))}
                        className={`rounded-lg border-2 px-3 py-2 text-xs font-medium transition-colors ${
                          form.scheduledDate === iso
                            ? "border-red-500 bg-red-50 text-red-700"
                            : hasSlots
                            ? "border-slate-200 text-slate-700 hover:border-slate-300"
                            : "border-slate-100 text-slate-300 cursor-not-allowed"
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {form.scheduledDate && (
                <div>
                  <p className="text-sm font-medium text-slate-700 mb-2">Select a Time Slot</p>
                  {generatedSlots.length === 0 ? (
                    <p className="text-sm text-slate-400">No delivery slots available on this day.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {generatedSlots.map((slot) => {
                        const avail = availabilityMap.get(slot.slotKey);
                        const isClosed = avail?.isClosed ?? false;
                        const isFull = avail?.isFull ?? false;
                        const isDisabled = isClosed || isFull;
                        return (
                          <button
                            key={slot.slotKey}
                            type="button"
                            disabled={isDisabled}
                            onClick={() => setForm((prev) => ({ ...prev, scheduledSlotStart: slot.slotKey, scheduledSlotLabel: slot.label }))}
                            className={`rounded-lg border-2 px-4 py-2 text-sm font-medium transition-colors ${
                              form.scheduledSlotStart === slot.slotKey
                                ? "border-red-500 bg-red-50 text-red-700"
                                : isDisabled
                                ? "border-slate-100 text-slate-300 cursor-not-allowed"
                                : "border-slate-200 text-slate-700 hover:border-slate-300"
                            }`}
                          >
                            {slot.label}
                            {isClosed && <span className="ml-1 text-xs text-slate-300">(closed)</span>}
                            {isFull && !isClosed && <span className="ml-1 text-xs text-slate-300">(full)</span>}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {form.scheduledDate && form.scheduledSlotLabel && (
                <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700 font-medium space-y-0.5">
                  <p>
                    Scheduled: {new Date(form.scheduledDate + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })} &middot; {form.scheduledSlotLabel}
                  </p>
                  {(() => {
                    if (!form.scheduledSlotStart) return null;
                    const [h, m] = form.scheduledSlotStart.split(":").map(Number);
                    const start = new Date(form.scheduledDate + "T00:00:00");
                    start.setHours(h, m, 0, 0);
                    const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
                    const fmt = (d: Date) => d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
                    return (
                      <p className="text-xs text-emerald-600">
                        Vehicle will be at your location: {fmt(start)} – {fmt(end)}
                      </p>
                    );
                  })()}
                </div>
              )}
            </div>
          )}
        </div>

        {/* DEF Fluid Add-on (only shown for diesel orders) */}
        {form.fuelType === "DIESEL" && (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">DEF Fluid</h2>
                <p className="mt-0.5 text-sm text-slate-500">Add Diesel Exhaust Fluid to your order</p>
              </div>
              <button
                type="button"
                onClick={() => setAddDef((v) => !v)}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
                  addDef ? "bg-red-600" : "bg-slate-200"
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform duration-200 ${
                    addDef ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
            {addDef && (
              <div className="mt-4 space-y-2">
                {DEF_SIZES.map((opt) => (
                  <button
                    key={opt.gallons}
                    type="button"
                    onClick={() => setDefGallons(opt.gallons)}
                    className={`flex w-full items-center justify-between rounded-xl border-2 px-4 py-3 transition-colors ${
                      defGallons === opt.gallons
                        ? "border-red-500 bg-red-50"
                        : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <span className="font-medium text-slate-900">{opt.label}</span>
                    <span className="font-semibold text-slate-700">
                      ${(opt.cents / 100).toFixed(2)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Notes */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Notes <span className="text-sm text-slate-400 font-normal">(optional)</span></h2>
          <textarea
            value={form.notes}
            onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
            rows={3}
            maxLength={500}
            placeholder="Any special instructions (e.g., parked in the back lot, fuel cap on the left)"
            className="mt-3 block w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20 transition-shadow"
          />
        </div>

        {/* Subscription Banner */}
        {subscriptionInfo?.active && (
          <div className={`rounded-2xl border p-4 ${isWeeklyLimitReached ? "border-amber-200 bg-amber-50" : "border-green-200 bg-green-50"}`}>
            <div className="flex items-center gap-2">
              <svg className={`h-5 w-5 ${isWeeklyLimitReached ? "text-amber-600" : "text-green-600"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className={`text-sm font-semibold ${isWeeklyLimitReached ? "text-amber-800" : "text-green-800"}`}>OTG Subscriber</span>
            </div>
            <p className={`mt-1 text-sm ${isWeeklyLimitReached ? "text-amber-700" : "text-green-700"}`}>
              {isFreeDelivery && "You have a free fill-up delivery this week!"}
              {isSecondPaidFillUp && "Free fill-up used — your 2nd fill-up this week is $10 delivery."}
              {isWeeklyLimitReached && "Weekly fill-up limit reached (2/week). Contact us for additional service."}
            </p>
          </div>
        )}

        {/* Order Summary */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Order Summary</h2>
          <div className="mt-3 space-y-2 text-sm">
            {/* Primary vehicle */}
            {form.isFillUp ? (
              <>
                <div className="flex justify-between">
                  <span className="text-slate-600">
                    {FUEL_TYPE_LABELS[form.fuelType as keyof typeof FUEL_TYPE_LABELS]} — Fill Up (@ ${pricePerGallon.toFixed(2)}/gal)
                  </span>
                  <span className="font-medium text-slate-400 italic">billed after</span>
                </div>
              </>
            ) : (
              <div className="flex justify-between">
                <span className="text-slate-600">
                  {FUEL_TYPE_LABELS[form.fuelType as keyof typeof FUEL_TYPE_LABELS]} × {form.gallons} gal @ ${pricePerGallon.toFixed(2)}/gal
                </span>
                <span className="font-medium text-slate-900">${primaryFuelCost.toFixed(2)}</span>
              </div>
            )}

            {/* 2nd vehicle add-on */}
            {addSecondVehicle && (
              <>
                <div className="flex justify-between text-slate-500">
                  <span>2nd Vehicle service fee</span>
                  <span>${secondVehicleAddonFee.toFixed(2)}</span>
                </div>
                {secondVehicle.isFillUp ? (
                  <div className="flex justify-between text-slate-500">
                    <span>2nd Vehicle gas — Fill Up</span>
                    <span className="italic text-slate-400">billed after</span>
                  </div>
                ) : (
                  <div className="flex justify-between text-slate-500">
                    <span>{FUEL_TYPE_LABELS[secondVehicle.fuelType as keyof typeof FUEL_TYPE_LABELS]} × {secondVehicle.gallons} gal (2nd vehicle)</span>
                    <span>${secondVehicleGasCost.toFixed(2)}</span>
                  </div>
                )}
              </>
            )}

            {/* Trailered boat add-on */}
            {addTraileredBoat && (
              <>
                <div className="flex justify-between text-slate-500">
                  <span>Trailered Boat service fee</span>
                  <span>${boatAddonFee.toFixed(2)}</span>
                </div>
                {boatAddon.isFillUp ? (
                  <div className="flex justify-between text-slate-500">
                    <span>Boat gas — Fill Up</span>
                    <span className="italic text-slate-400">billed after</span>
                  </div>
                ) : (
                  <div className="flex justify-between text-slate-500">
                    <span>{FUEL_TYPE_LABELS[boatAddon.fuelType as keyof typeof FUEL_TYPE_LABELS]} × {boatAddon.gallons} gal (boat)</span>
                    <span>${boatGasCost.toFixed(2)}</span>
                  </div>
                )}
              </>
            )}

            {/* DEF add-on */}
            {addDef && (
              <div className="flex justify-between text-slate-500">
                <span>DEF Fluid ({defGallons} gal)</span>
                <span>${defCost.toFixed(2)}</span>
              </div>
            )}

            {/* Delivery fee */}
            <div className="flex justify-between">
              <span className="text-slate-600">
                Delivery Fee
                {isFreeDelivery && (
                  <span className="ml-1.5 inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">Included</span>
                )}
                {isSecondPaidFillUp && (
                  <span className="ml-1.5 inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">2nd fill-up</span>
                )}
              </span>
              <span className="font-medium text-slate-900">
                {isFreeDelivery ? <span className="text-green-600">$0.00</span> : `$${deliveryFee.toFixed(2)}`}
              </span>
            </div>

            <div className="flex justify-between border-t border-slate-200 pt-2">
              <span className="font-semibold text-slate-900">
                {form.isFillUp ? "Card Verification" : "Total"}
              </span>
              <span className="font-bold text-slate-900 text-lg">
                {form.isFillUp ? "$1.00" : `$${total.toFixed(2)}`}
              </span>
            </div>

            {form.isFillUp && (
              <p className="text-xs text-slate-400">
                We charge $1.00 now to verify your card. Once we finish fueling, we charge your card for the exact amount pumped and release the $1.00.
              </p>
            )}
          </div>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={submitting || !form.vehicleId || !form.addressId || isWeeklyLimitReached}
          className="w-full rounded-xl bg-gradient-to-r from-red-500 to-red-600 px-6 py-3 text-sm font-semibold text-white shadow-sm shadow-red-200 hover:shadow-md hover:shadow-red-200 transition-all disabled:opacity-50"
        >
          {submitting
            ? "Processing..."
            : form.isFillUp
            ? "Verify Card — $1.00"
            : `Proceed to Payment — $${total.toFixed(2)}`}
        </button>
      </form>
    </div>
  );
}
