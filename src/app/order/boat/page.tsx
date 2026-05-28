"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import nextDynamic from "next/dynamic";
export const dynamic = "force-dynamic";
import { FUEL_TYPE_LABELS } from "@/types";

const PinMap = nextDynamic(() => import("@/components/PinMap"), { ssr: false });

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
const FILL_UP_MAX_GALLONS_BOAT = 100;
const BOAT_BASE_FEE = 20;

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

export default function BoatOrderPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const isAuthenticated = status === "authenticated";
  const isLoading = status === "loading";

  const [boats, setBoats] = useState<Boat[]>([]);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [prices, setPrices] = useState<FuelPrice[]>([]);
  const [schedules, setSchedules] = useState<ServiceSchedule[]>([]);
  const [slotAvailability, setSlotAvailability] = useState<SlotAvailability[]>([]);
  const [asapEnabled, setAsapEnabled] = useState(true);
  const [dataLoading, setDataLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  // Form state
  const [form, setForm] = useState({
    // Shared
    fuelType: "REGULAR_87",
    gallons: 20,
    isFillUp: false,
    deliveryType: "asap" as "asap" | "scheduled",
    scheduledDate: "",
    scheduledSlotStart: "",
    scheduledSlotLabel: "",
    notes: "",
    // Signed-in: boat + address
    boatId: "",
    addressId: "",
    // New boat inline (signed-in)
    isNewBoat: false,
    newBoatRegNumber: "",
    newBoatNickname: "",
    newBoatMake: "",
    newBoatModel: "",
    newBoatNotes: "",
    // Guest
    guestName: "",
    guestEmail: "",
    guestPhone: "",
    boatMake: "",
    boatModel: "",
    boatYear: new Date().getFullYear() as number | "",
    boatColor: "",
    boatRegistrationNumber: "",
    boatNotes: "",
    street: "",
    city: "",
    state: "TX",
    zip: "",
  });

  const [pinLat, setPinLat] = useState<number | null>(null);
  const [pinLng, setPinLng] = useState<number | null>(null);

  const fetchAuthData = useCallback(async () => {
    const [bRes, aRes, pRes, sRes] = await Promise.all([
      fetch("/api/boats"),
      fetch("/api/addresses"),
      fetch("/api/fuel-prices"),
      fetch("/api/service-schedules"),
    ]);
    const [boatData, addressData, priceData, scheduleData] = await Promise.all([
      bRes.json(), aRes.json(), pRes.json(), sRes.json(),
    ]);
    setBoats(Array.isArray(boatData) ? boatData : []);
    setAddresses(Array.isArray(addressData) ? addressData : []);
    setPrices(priceData.prices || []);
    if (priceData.asapEnabled !== undefined) setAsapEnabled(priceData.asapEnabled);
    setSchedules(Array.isArray(scheduleData) ? scheduleData : []);

    const defaultBoat = boatData.find((b: Boat) => b.isDefault);
    const defaultAddress = addressData.find((a: Address) => a.isDefault);
    setForm((prev) => ({
      ...prev,
      boatId: defaultBoat?.id || boatData[0]?.id || "",
      addressId: defaultAddress?.id || addressData[0]?.id || "",
      fuelType: defaultBoat?.fuelType || "REGULAR_87",
      deliveryType: priceData.asapEnabled === false ? "scheduled" : "asap",
    }));
    setDataLoading(false);
  }, []);

  const fetchGuestData = useCallback(async () => {
    const [pRes, sRes] = await Promise.all([
      fetch("/api/fuel-prices"),
      fetch("/api/service-schedules"),
    ]);
    const [priceData, scheduleData] = await Promise.all([pRes.json(), sRes.json()]);
    setPrices(priceData.prices || []);
    if (priceData.asapEnabled !== undefined) setAsapEnabled(priceData.asapEnabled);
    setSchedules(Array.isArray(scheduleData) ? scheduleData : []);
    setDataLoading(false);
  }, []);

  useEffect(() => {
    if (status === "authenticated") fetchAuthData();
    else if (status === "unauthenticated") fetchGuestData();
  }, [status, fetchAuthData, fetchGuestData]);

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
  const fuelCost = form.isFillUp ? 0 : pricePerGallon * form.gallons;
  const total = form.isFillUp
    ? pricePerGallon * FILL_UP_MAX_GALLONS_BOAT + BOAT_BASE_FEE
    : fuelCost + BOAT_BASE_FEE;

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

    if (form.deliveryType === "scheduled" && (!form.scheduledDate || !form.scheduledSlotStart)) {
      setError("Please select a delivery date and time slot.");
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

    if (isAuthenticated) {
      // Signed-in boat order via items[]
      const boatItem: Record<string, unknown> = {
        kind: "PRIMARY_BOAT",
        fuelType: form.fuelType,
        gallons: form.isFillUp ? undefined : form.gallons,
        isFillUp: form.isFillUp,
        notes: form.notes || undefined,
      };

      if (form.isNewBoat) {
        if (!form.newBoatRegNumber) {
          setError("Boat registration number is required.");
          setSubmitting(false);
          return;
        }
        boatItem.itemRegNumber = form.newBoatRegNumber;
        boatItem.itemMake = form.newBoatMake || undefined;
        boatItem.itemModel = form.newBoatModel || undefined;
        boatItem.notes = form.newBoatNotes || undefined;
      } else {
        if (!form.boatId) {
          setError("Please select a boat.");
          setSubmitting(false);
          return;
        }
        if (!form.addressId) {
          setError("Please select a delivery address.");
          setSubmitting(false);
          return;
        }
        boatItem.boatId = form.boatId;
      }

      const orderRes = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          addressId: form.addressId,
          scheduledAt,
          notes: form.notes || undefined,
          items: [boatItem],
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
      const intentAmount = form.isFillUp ? 100 : order.totalCents;

      const intentRes = await fetch("/api/stripe/create-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountCents: intentAmount, orderId: order.id, isFillUp: form.isFillUp }),
      });

      if (!intentRes.ok) {
        setError("Failed to initiate payment. Please try again.");
        setSubmitting(false);
        return;
      }

      const { clientSecret } = await intentRes.json();
      router.push(`/order/payment?secret=${encodeURIComponent(clientSecret)}&orderId=${order.id}&total=${intentAmount}${form.isFillUp ? "&fillup=1" : ""}`);
    } else {
      // Guest boat order
      if (!form.boatRegistrationNumber) {
        setError("Boat registration number is required.");
        setSubmitting(false);
        return;
      }

      const orderRes = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guestBoat: true,
          fuelType: form.fuelType,
          gallons: form.isFillUp ? undefined : form.gallons,
          isFillUp: form.isFillUp,
          scheduledAt,
          notes: form.notes || undefined,
          guestName: form.guestName,
          guestEmail: form.guestEmail,
          guestPhone: form.guestPhone || undefined,
          boatMake: form.boatMake || undefined,
          boatModel: form.boatModel || undefined,
          boatYear: form.boatYear === "" ? undefined : form.boatYear,
          boatColor: form.boatColor || undefined,
          boatRegistrationNumber: form.boatRegistrationNumber,
          boatNotes: form.boatNotes || undefined,
          street: form.street,
          city: form.city,
          state: form.state,
          zip: form.zip,
        }),
      });

      if (!orderRes.ok) {
        const data = await orderRes.json();
        setError(data.error || "Failed to create order");
        setSubmitting(false);
        return;
      }

      const order = await orderRes.json();
      const intentAmount = form.isFillUp ? 100 : order.totalCents;

      const intentRes = await fetch("/api/stripe/create-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountCents: intentAmount, orderId: order.id, isFillUp: form.isFillUp }),
      });

      if (!intentRes.ok) {
        setError("Failed to initiate payment. Please try again.");
        setSubmitting(false);
        return;
      }

      const { clientSecret } = await intentRes.json();
      router.push(`/order/payment?secret=${encodeURIComponent(clientSecret)}&orderId=${order.id}&total=${intentAmount}${form.isFillUp ? "&fillup=1" : ""}`);
    }
  }

  if (isLoading || dataLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-red-500" />
      </div>
    );
  }

  const nextDays = getNextDays(14);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="flex items-center gap-3 mb-1">
        <span className="text-2xl">⛵</span>
        <h1 className="text-2xl font-bold text-slate-900">Boat Fuel Delivery</h1>
      </div>
      <p className="mt-1 text-sm text-slate-500">
        $20 service fee + cost of gas per fill. No subscription required.
      </p>

      {error && (
        <div className="mt-4 rounded-xl bg-red-50 border border-red-200 p-3.5 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-6 space-y-6">

        {/* --- AUTHENTICATED FLOW --- */}
        {isAuthenticated && (
          <>
            {/* Boat Selection */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">Boat</h2>
              <div className="mt-3 flex gap-3">
                <button
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, isNewBoat: false }))}
                  className={`rounded-lg border-2 px-3 py-2 text-xs font-medium transition-colors ${!form.isNewBoat ? "border-red-500 bg-red-50 text-red-700" : "border-slate-200 text-slate-700 hover:border-slate-300"}`}
                >
                  Saved Boat
                </button>
                <button
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, isNewBoat: true, boatId: "" }))}
                  className={`rounded-lg border-2 px-3 py-2 text-xs font-medium transition-colors ${form.isNewBoat ? "border-red-500 bg-red-50 text-red-700" : "border-slate-200 text-slate-700 hover:border-slate-300"}`}
                >
                  + New Boat
                </button>
              </div>

              {!form.isNewBoat && (
                <div className="mt-3">
                  {boats.length === 0 ? (
                    <div>
                      <p className="text-sm text-slate-500">No boats saved yet.</p>
                      <button type="button" onClick={() => setForm((p) => ({ ...p, isNewBoat: true }))} className="mt-1 text-sm font-medium text-red-600 hover:text-red-500">Enter boat info</button>
                    </div>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {boats.map((b) => (
                        <button
                          type="button"
                          key={b.id}
                          onClick={() => setForm((p) => ({ ...p, boatId: b.id, fuelType: b.fuelType }))}
                          className={`rounded-lg border-2 p-3 text-left transition-colors ${form.boatId === b.id ? "border-red-500 bg-red-50" : "border-slate-200 hover:border-slate-300"}`}
                        >
                          <p className="font-medium text-slate-900">{b.nickname || [b.year, b.make, b.model].filter(Boolean).join(" ") || "Boat"}</p>
                          <p className="text-xs text-slate-400">Reg: {b.registrationNumber}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {form.isNewBoat && (
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-slate-700">Boat Registration # *</label>
                    <input
                      type="text"
                      required
                      value={form.newBoatRegNumber}
                      onChange={(e) => setForm((p) => ({ ...p, newBoatRegNumber: e.target.value.toUpperCase() }))}
                      placeholder="e.g. TX1234AB"
                      className="mt-1.5 block w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20 transition-shadow"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700">Make <span className="text-slate-400 font-normal">(optional)</span></label>
                    <input type="text" value={form.newBoatMake} onChange={(e) => setForm((p) => ({ ...p, newBoatMake: e.target.value }))} placeholder="Yamaha" className="mt-1.5 block w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20 transition-shadow" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700">Model <span className="text-slate-400 font-normal">(optional)</span></label>
                    <input type="text" value={form.newBoatModel} onChange={(e) => setForm((p) => ({ ...p, newBoatModel: e.target.value }))} placeholder="242X" className="mt-1.5 block w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20 transition-shadow" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-slate-700">Boat Notes <span className="text-slate-400 font-normal">(optional)</span></label>
                    <input type="text" value={form.newBoatNotes} onChange={(e) => setForm((p) => ({ ...p, newBoatNotes: e.target.value }))} placeholder="e.g. fuel port on starboard side" className="mt-1.5 block w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20 transition-shadow" />
                  </div>
                </div>
              )}
            </div>

            {/* Address Selection */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">Delivery Address</h2>
              {addresses.length === 0 ? (
                <div className="mt-3">
                  <p className="text-sm text-slate-500">No addresses saved yet.</p>
                  <a href="/profile/addresses" className="mt-2 inline-block text-sm font-medium text-red-600 hover:text-red-500">+ Add an Address</a>
                </div>
              ) : (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {addresses.map((a) => (
                    <button
                      type="button"
                      key={a.id}
                      onClick={() => { setForm((p) => ({ ...p, addressId: a.id })); setPinLat(null); setPinLng(null); }}
                      className={`rounded-lg border-2 p-3 text-left transition-colors ${form.addressId === a.id ? "border-red-500 bg-red-50" : "border-slate-200 hover:border-slate-300"}`}
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
                  <p className="mt-1 text-sm text-slate-500">Drag the pin to where your boat will be so we can find you easily.</p>
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
          </>
        )}

        {/* --- GUEST FLOW --- */}
        {!isAuthenticated && (
          <>
            {/* Contact Info */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">Contact Information</h2>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-slate-700">Full Name *</label>
                  <input type="text" required value={form.guestName} onChange={(e) => setForm((p) => ({ ...p, guestName: e.target.value }))} className="mt-1.5 block w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20 transition-shadow" placeholder="John Doe" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Email *</label>
                  <input type="email" required value={form.guestEmail} onChange={(e) => setForm((p) => ({ ...p, guestEmail: e.target.value }))} className="mt-1.5 block w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20 transition-shadow" placeholder="john@example.com" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Phone <span className="text-slate-400 font-normal">(optional)</span></label>
                  <input type="tel" value={form.guestPhone} onChange={(e) => setForm((p) => ({ ...p, guestPhone: e.target.value }))} className="mt-1.5 block w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20 transition-shadow" placeholder="(817) 555-0123" />
                </div>
              </div>
            </div>

            {/* Boat Info */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">Boat Information</h2>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-slate-700">Registration Number *</label>
                  <input type="text" required value={form.boatRegistrationNumber} onChange={(e) => setForm((p) => ({ ...p, boatRegistrationNumber: e.target.value.toUpperCase() }))} className="mt-1.5 block w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20 transition-shadow" placeholder="e.g. TX1234AB" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Make <span className="text-slate-400 font-normal">(optional)</span></label>
                  <input type="text" value={form.boatMake} onChange={(e) => setForm((p) => ({ ...p, boatMake: e.target.value }))} className="mt-1.5 block w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20 transition-shadow" placeholder="Yamaha" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Model <span className="text-slate-400 font-normal">(optional)</span></label>
                  <input type="text" value={form.boatModel} onChange={(e) => setForm((p) => ({ ...p, boatModel: e.target.value }))} className="mt-1.5 block w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20 transition-shadow" placeholder="242X" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Year <span className="text-slate-400 font-normal">(optional)</span></label>
                  <input type="number" min={1900} max={new Date().getFullYear() + 1} value={form.boatYear} onChange={(e) => setForm((p) => ({ ...p, boatYear: e.target.value === "" ? "" : parseInt(e.target.value) || "" }))} className="mt-1.5 block w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20 transition-shadow" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Color <span className="text-slate-400 font-normal">(optional)</span></label>
                  <input type="text" value={form.boatColor} onChange={(e) => setForm((p) => ({ ...p, boatColor: e.target.value }))} className="mt-1.5 block w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20 transition-shadow" placeholder="White" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-slate-700">Boat Notes <span className="text-slate-400 font-normal">(optional)</span></label>
                  <input type="text" value={form.boatNotes} onChange={(e) => setForm((p) => ({ ...p, boatNotes: e.target.value }))} className="mt-1.5 block w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20 transition-shadow" placeholder="e.g. fuel port on starboard side" />
                </div>
              </div>
            </div>

            {/* Guest Address */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">Delivery Address</h2>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-slate-700">Street Address *</label>
                  <input type="text" required value={form.street} onChange={(e) => setForm((p) => ({ ...p, street: e.target.value }))} className="mt-1.5 block w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20 transition-shadow" placeholder="123 Marina Dr" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">City *</label>
                  <input type="text" required value={form.city} onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))} className="mt-1.5 block w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20 transition-shadow" placeholder="Fort Worth" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700">State *</label>
                    <input type="text" required maxLength={2} value={form.state} onChange={(e) => setForm((p) => ({ ...p, state: e.target.value.toUpperCase() }))} className="mt-1.5 block w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20 transition-shadow" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700">ZIP *</label>
                    <input type="text" required maxLength={10} value={form.zip} onChange={(e) => setForm((p) => ({ ...p, zip: e.target.value }))} className="mt-1.5 block w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20 transition-shadow" placeholder="76102" />
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Fuel Details */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Fuel Details</h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-700">Fuel Type</label>
              <select
                value={form.fuelType}
                onChange={(e) => setForm((p) => ({ ...p, fuelType: e.target.value }))}
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
                  <span className="text-sm text-slate-400 italic">We&apos;ll fill your tank — gallons billed after</span>
                </div>
              ) : (
                <input
                  type="number" min={1} max={200} step={1}
                  value={form.gallons}
                  onChange={(e) => setForm((p) => ({ ...p, gallons: parseFloat(e.target.value) || 0 }))}
                  className="mt-1.5 block w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20 transition-shadow"
                />
              )}
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-slate-700">Fill Up Tank</p>
              <p className="text-xs text-slate-400">We place a $1 hold to verify your card, then charge only for what we pump plus the delivery fee.</p>
            </div>
            <button
              type="button"
              onClick={() => setForm((p) => ({ ...p, isFillUp: !p.isFillUp }))}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.isFillUp ? "bg-red-600" : "bg-slate-300"}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${form.isFillUp ? "translate-x-6" : "translate-x-1"}`} />
            </button>
          </div>
        </div>

        {/* Delivery Time */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Delivery Time</h2>
          <div className="mt-3 flex gap-4">
            {asapEnabled && (
              <button
                type="button"
                onClick={() => setForm((p) => ({ ...p, deliveryType: "asap", scheduledDate: "", scheduledSlotStart: "", scheduledSlotLabel: "" }))}
                className={`rounded-lg border-2 px-4 py-2 text-sm font-medium transition-colors ${form.deliveryType === "asap" ? "border-red-500 bg-red-50 text-red-700" : "border-slate-200 text-slate-700 hover:border-slate-300"}`}
              >
                ASAP
              </button>
            )}
            <button
              type="button"
              onClick={() => setForm((p) => ({ ...p, deliveryType: "scheduled" }))}
              className={`rounded-lg border-2 px-4 py-2 text-sm font-medium transition-colors ${form.deliveryType === "scheduled" ? "border-red-500 bg-red-50 text-red-700" : "border-slate-200 text-slate-700 hover:border-slate-300"}`}
            >
              Schedule
            </button>
          </div>

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
                        onClick={() => setForm((p) => ({ ...p, scheduledDate: iso, scheduledSlotStart: "", scheduledSlotLabel: "" }))}
                        className={`rounded-lg border-2 px-3 py-2 text-xs font-medium transition-colors ${form.scheduledDate === iso ? "border-red-500 bg-red-50 text-red-700" : hasSlots ? "border-slate-200 text-slate-700 hover:border-slate-300" : "border-slate-100 text-slate-300 cursor-not-allowed"}`}
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
                            onClick={() => setForm((p) => ({ ...p, scheduledSlotStart: slot.slotKey, scheduledSlotLabel: slot.label }))}
                            className={`rounded-lg border-2 px-4 py-2 text-sm font-medium transition-colors ${form.scheduledSlotStart === slot.slotKey ? "border-red-500 bg-red-50 text-red-700" : isDisabled ? "border-slate-100 text-slate-300 cursor-not-allowed" : "border-slate-200 text-slate-700 hover:border-slate-300"}`}
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

        {/* Notes */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Delivery Notes <span className="text-sm text-slate-400 font-normal">(optional)</span></h2>
          <textarea
            value={form.notes}
            onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
            rows={3}
            maxLength={500}
            placeholder="Any special instructions (e.g., gate code, boat at slip 12, call on arrival)"
            className="mt-3 block w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20 transition-shadow"
          />
        </div>

        {/* Order Summary */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Order Summary</h2>
          <div className="mt-3 space-y-2 text-sm">
            {form.isFillUp ? (
              <>
                <div className="flex justify-between">
                  <span className="text-slate-600">{FUEL_TYPE_LABELS[form.fuelType as keyof typeof FUEL_TYPE_LABELS]} — Fill Up (@ ${pricePerGallon.toFixed(2)}/gal)</span>
                  <span className="font-medium text-slate-400 italic">billed after</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Service Fee</span>
                  <span className="font-medium text-slate-400 italic">billed after</span>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-2">
                  <span className="font-semibold text-slate-900">Card Verification</span>
                  <span className="font-bold text-slate-900 text-lg">$1.00</span>
                </div>
                <p className="text-xs text-slate-400">We charge $1.00 now to verify your card. You are charged the exact amount pumped + $20 service fee after delivery.</p>
              </>
            ) : (
              <>
                <div className="flex justify-between">
                  <span className="text-slate-600">{FUEL_TYPE_LABELS[form.fuelType as keyof typeof FUEL_TYPE_LABELS]} × {form.gallons} gal @ ${pricePerGallon.toFixed(2)}/gal</span>
                  <span className="font-medium text-slate-900">${fuelCost.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Service Fee</span>
                  <span className="font-medium text-slate-900">${BOAT_BASE_FEE.toFixed(2)}</span>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-2">
                  <span className="font-semibold text-slate-900">Total</span>
                  <span className="font-bold text-slate-900 text-lg">${total.toFixed(2)}</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Terms of Service (guests only) */}
        {!isAuthenticated && (
          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              id="agreeTermsBoat"
              checked={agreedToTerms}
              onChange={(e) => setAgreedToTerms(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-red-600 focus:ring-red-500"
            />
            <label htmlFor="agreeTermsBoat" className="text-sm text-slate-600">
              I agree to the{" "}
              <a href="/terms" target="_blank" className="text-red-600 hover:text-red-500 font-medium underline">
                Terms of Service
              </a>{" "}
              and{" "}
              <a href="/privacy" target="_blank" className="text-red-600 hover:text-red-500 font-medium underline">
                Privacy Policy
              </a>
            </label>
          </div>
        )}

        <button
          type="submit"
          disabled={submitting || (!isAuthenticated && !agreedToTerms)}
          className="w-full rounded-xl bg-gradient-to-r from-red-500 to-red-600 px-6 py-3 text-sm font-semibold text-white shadow-sm shadow-red-200 hover:shadow-md hover:shadow-red-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting
            ? "Processing..."
            : form.isFillUp
            ? "Verify Card \u2014 $1.00"
            : `Proceed to Payment \u2014 $${total.toFixed(2)}`}
        </button>

        {!isAuthenticated && (
          <p className="text-center text-xs text-slate-400">
            Want to save your details for next time?{" "}
            <a href="/signup" className="text-red-600 hover:text-red-500 font-medium">Create an account</a>
          </p>
        )}
      </form>
    </div>
  );
}
