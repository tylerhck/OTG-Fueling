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

const DAY_NAMES = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
const BOAT_BASE_FEE = 20;

// Get current time in Central timezone (America/Chicago)
function getCentralNow(): { hours: number; minutes: number; dateStr: string; dayOfWeek: number } {
  const now = new Date();
  const central = new Date(now.toLocaleString("en-US", { timeZone: "America/Chicago" }));
  const year = central.getFullYear();
  const month = String(central.getMonth() + 1).padStart(2, "0");
  const day = String(central.getDate()).padStart(2, "0");
  return {
    hours: central.getHours(),
    minutes: central.getMinutes(),
    dateStr: `${year}-${month}-${day}`,
    dayOfWeek: central.getDay(),
  };
}

function getNextDays(n: number): Date[] {
  const days: Date[] = [];
  const centralNow = getCentralNow();
  const today = new Date(centralNow.dateStr + "T00:00:00");
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

  const [asapEnabled, setAsapEnabled] = useState(true);
  const [dataLoading, setDataLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  // Form state
  const [form, setForm] = useState({
    // Shared
    fuelType: "REGULAR_87",
    dollarAmount: 40,
    isFillUp: false,
    deliveryType: "asap" as "asap" | "scheduled",
    scheduledDate: "",
    availableFrom: "",
    availableTo: "",
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



  // Dollar amount pre-auth model: customer picks $ amount, or fill-up ($40 hold)
  const fuelCost = form.isFillUp ? 0 : form.dollarAmount;
  const total = fuelCost + BOAT_BASE_FEE;



  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    if (form.deliveryType === "scheduled" && (!form.scheduledDate || !form.availableFrom || !form.availableTo)) {
      setError("Please select a delivery date and availability window.");
      setSubmitting(false);
      return;
    }

    let scheduledAt: string | undefined;
    let availableFrom: string | undefined;
    let availableTo: string | undefined;
    if (form.deliveryType === "scheduled" && form.scheduledDate && form.availableFrom) {
      const [h, m] = form.availableFrom.split(":").map(Number);
      const dt = new Date(form.scheduledDate + "T00:00:00");
      dt.setHours(h, m, 0, 0);
      scheduledAt = dt.toISOString();
      // Store as HH:MM (24h format, max 5 chars) to fit DB column
      availableFrom = form.availableFrom;
      availableTo = form.availableTo;
    }

    if (isAuthenticated) {
      // Signed-in boat order via items[]
      const boatItem: Record<string, unknown> = {
        kind: "PRIMARY_BOAT",
        fuelType: form.fuelType,
        prefundedCents: form.isFillUp ? undefined : Math.round(form.dollarAmount * 100),
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
          availableFrom,
          availableTo,
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
      const intentAmount = form.isFillUp ? 4000 : order.totalCents;

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
          prefundedCents: form.isFillUp ? undefined : Math.round(form.dollarAmount * 100),
          isFillUp: form.isFillUp,
          scheduledAt,
          availableFrom,
          availableTo,
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
      const intentAmount = form.isFillUp ? 4000 : order.totalCents;

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
              <label className="block text-sm font-medium text-slate-700">Dollar Amount</label>
              {form.isFillUp ? (
                <div className="mt-1.5 flex items-center rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <span className="text-sm text-slate-400 italic">Fill up — charged after delivery</span>
                </div>
              ) : (
                <div className="mt-1.5 relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-medium">$</span>
                  <input
                    type="number" min={10} max={500} step={5}
                    value={form.dollarAmount}
                    onChange={(e) => setForm((p) => ({ ...p, dollarAmount: parseFloat(e.target.value) || 0 }))}
                    className="block w-full rounded-xl border border-slate-300 pl-8 pr-4 py-3 text-slate-900 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20 transition-shadow"
                  />
                </div>
              )}
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-slate-700">Fill Up Tank</p>
              <p className="text-xs text-slate-400">A $40 pre-charge will be placed on your card. You will only be charged for what you receive at time of completion. The pre-charge is released immediately after.</p>
            </div>
            <button
              type="button"
              onClick={() => setForm((p) => ({ ...p, isFillUp: !p.isFillUp }))}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.isFillUp ? "bg-red-600" : "bg-slate-300"}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${form.isFillUp ? "translate-x-6" : "translate-x-1"}`} />
            </button>
          </div>
          {/* Fuel price disclaimer */}
          <div className="mt-3 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
            <p className="text-xs text-amber-700">
              <strong>Note:</strong> Fuel prices fluctuate daily. The number of gallons you receive will be based on the market price at the time of delivery. You will only be charged for the actual fuel delivered.
            </p>
          </div>
        </div>

        {/* Delivery Time */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Delivery Time</h2>
          <div className="mt-3 flex gap-4">
            {asapEnabled && (
              <button
                type="button"
                onClick={() => setForm((p) => ({ ...p, deliveryType: "asap", scheduledDate: "", availableFrom: "", availableTo: "" }))}
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

          {!asapEnabled && form.deliveryType !== "scheduled" && (
            <p className="mt-2 text-xs text-amber-600">ASAP delivery is currently unavailable. Please schedule a time.</p>
          )}

          {form.deliveryType === "scheduled" && (
            <div className="mt-4 space-y-4">
              <div>
                <p className="text-sm font-medium text-slate-700 mb-2">Select a Date</p>
                <div className="flex flex-wrap gap-2">
                  {nextDays.map((d) => {
                    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
                    const dayName = DAY_NAMES[d.getDay()];
                    const isOpen = schedules.some((s) => s.dayOfWeek === dayName);
                    const label = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
                    return (
                      <button
                        key={iso}
                        type="button"
                        disabled={!isOpen}
                        onClick={() => setForm((p) => ({ ...p, scheduledDate: iso, availableFrom: "", availableTo: "" }))}
                        className={`rounded-lg border-2 px-3 py-2 text-xs font-medium transition-colors ${form.scheduledDate === iso ? "border-red-500 bg-red-50 text-red-700" : isOpen ? "border-slate-200 text-slate-700 hover:border-slate-300" : "border-slate-100 text-slate-300 cursor-not-allowed"}`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {form.scheduledDate && (() => {
                const d = new Date(form.scheduledDate + "T00:00:00");
                const dayName = DAY_NAMES[d.getDay()];
                const daySchedule = schedules.find((s) => s.dayOfWeek === dayName);
                const startMins = daySchedule ? parseInt(daySchedule.startTime.split(":")[0]) * 60 + parseInt(daySchedule.startTime.split(":")[1]) : 480;
                const endMins = daySchedule ? parseInt(daySchedule.endTime.split(":")[0]) * 60 + parseInt(daySchedule.endTime.split(":")[1]) : 1200;

                // If scheduled date is today (Central time), filter out times less than 30 min from now
                const centralNow = getCentralNow();
                const isToday = form.scheduledDate === centralNow.dateStr;
                const minMins = isToday ? centralNow.hours * 60 + centralNow.minutes + 30 : 0;

                const timeOptions: { value: string; label: string }[] = [];
                for (let t = startMins; t <= endMins; t += 30) {
                  if (isToday && t < minMins) continue; // skip times less than 30 min from now
                  const h = Math.floor(t / 60);
                  const m = t % 60;
                  const val = `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
                  const ampm = h >= 12 ? "PM" : "AM";
                  const hour = h % 12 || 12;
                  const lbl = `${hour}:${m.toString().padStart(2, "0")} ${ampm}`;
                  timeOptions.push({ value: val, label: lbl });
                }
                // "From" options: all except the last (need at least one "To" after it)
                const fromOptions = timeOptions.length > 1 ? timeOptions.slice(0, -1) : [];
                const fromIdx = timeOptions.findIndex((o) => o.value === form.availableFrom);
                const toOptions = form.availableFrom ? timeOptions.filter((_, i) => i > fromIdx) : [];

                if (fromOptions.length === 0) {
                  return <p className="text-sm text-amber-600 font-medium">No more delivery times available today. Please select another date.</p>;
                }

                return (
                  <div>
                    <p className="text-sm font-medium text-slate-700 mb-2">What hours will your boat be at this location?</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">From</label>
                        <select
                          value={form.availableFrom}
                          onChange={(e) => setForm((p) => ({ ...p, availableFrom: e.target.value, availableTo: "" }))}
                          className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-900 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20"
                        >
                          <option value="">Select start</option>
                          {fromOptions.map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">To</label>
                        <select
                          value={form.availableTo}
                          onChange={(e) => setForm((p) => ({ ...p, availableTo: e.target.value }))}
                          disabled={!form.availableFrom}
                          className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-900 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20 disabled:opacity-50"
                        >
                          <option value="">Select end</option>
                          {toOptions.map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {form.scheduledDate && form.availableFrom && form.availableTo && (
                <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700 font-medium">
                  <p>
                    Scheduled: {new Date(form.scheduledDate + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                  </p>
                  <p className="text-xs text-emerald-600 mt-0.5">
                    Boat available: {(() => {
                      const fmt = (t: string) => { const [h, m] = t.split(":").map(Number); const ampm = h >= 12 ? "PM" : "AM"; return `${h % 12 || 12}:${m.toString().padStart(2, "0")} ${ampm}`; };
                      return `${fmt(form.availableFrom)} \u2013 ${fmt(form.availableTo)}`;
                    })()}
                  </p>
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
                  <span className="text-slate-600">{FUEL_TYPE_LABELS[form.fuelType as keyof typeof FUEL_TYPE_LABELS]} — Fill Up</span>
                  <span className="font-medium text-slate-400 italic">charged after delivery</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Service Fee</span>
                  <span className="font-medium text-slate-900">${BOAT_BASE_FEE.toFixed(2)}</span>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-2">
                  <span className="font-semibold text-slate-900">Card Hold</span>
                  <span className="font-bold text-slate-900 text-lg">$40.00</span>
                </div>
                <p className="text-xs text-slate-400">A $40.00 pre-charge will be placed on your card. You will only be charged for what you receive at time of completion. The pre-charge is released immediately after.</p>
              </>
            ) : (
              <>
                <div className="flex justify-between">
                  <span className="text-slate-600">{FUEL_TYPE_LABELS[form.fuelType as keyof typeof FUEL_TYPE_LABELS]} — ${form.dollarAmount.toFixed(2)} pre-charge</span>
                  <span className="font-medium text-slate-900">${form.dollarAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Service Fee</span>
                  <span className="font-medium text-slate-900">${BOAT_BASE_FEE.toFixed(2)}</span>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-2">
                  <span className="font-semibold text-slate-900">Total Hold</span>
                  <span className="font-bold text-slate-900 text-lg">${total.toFixed(2)}</span>
                </div>
                <p className="text-xs text-slate-400">This amount is held on your card. If your tank fills before reaching ${form.dollarAmount.toFixed(2)}, you are only charged for the actual fuel delivered.</p>
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

        {/* Accessibility notice */}
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
          <p className="text-xs text-amber-800">
            <strong>Boat accessibility:</strong> Please make sure your boat is readily available and fuel access is clear so that we may service it. Any non-accessible boats or no-shows can result in a service charge.
          </p>
        </div>

        <button
          type="submit"
          disabled={submitting || (!isAuthenticated && !agreedToTerms)}
          className="w-full rounded-xl bg-gradient-to-r from-red-500 to-red-600 px-6 py-3 text-sm font-semibold text-white shadow-sm shadow-red-200 hover:shadow-md hover:shadow-red-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting
            ? "Processing..."
            : form.isFillUp
            ? "Place Order — $40.00 Pre-charge"
            : `Place Order — $${total.toFixed(2)} Pre-charge`}
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
