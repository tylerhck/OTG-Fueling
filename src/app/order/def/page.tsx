"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { DEF_SIZES } from "@/types";

const PinMap = dynamic(() => import("@/components/PinMap"), { ssr: false });

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

const DAY_NAMES = ["SUNDAY","MONDAY","TUESDAY","WEDNESDAY","THURSDAY","FRIDAY","SATURDAY"];
const DELIVERY_FEE = 15;

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
    const fmt = (mins: number) => {
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      const period = h >= 12 ? "PM" : "AM";
      const displayH = h === 0 ? 12 : h > 12 ? h - 12 : h;
      return `${displayH}:${m.toString().padStart(2, "0")} ${period}`;
    };
    const startH = Math.floor(t / 60);
    const startM = t % 60;
    slots.push({
      label: `${fmt(t)} – ${fmt(slotEnd)}`,
      startH,
      startM,
      slotKey: `${String(startH).padStart(2, "0")}:${String(startM).padStart(2, "0")}`,
    });
  }
  return slots;
}

export default function DefOrderPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [addresses, setAddresses] = useState<Address[]>([]);
  const [schedules, setSchedules] = useState<ServiceSchedule[]>([]);
  const [slotAvailability, setSlotAvailability] = useState<SlotAvailability[]>([]);

  const [addressId, setAddressId] = useState("");
  const [defGallons, setDefGallons] = useState(2.5);
  const [deliveryType, setDeliveryType] = useState<"asap" | "scheduled">("asap");
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledSlotStart, setScheduledSlotStart] = useState("");
  const [scheduledSlotLabel, setScheduledSlotLabel] = useState("");
  const [notes, setNotes] = useState("");

  // Guest fields
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [guestStreet, setGuestStreet] = useState("");
  const [guestCity, setGuestCity] = useState("");
  const [guestState, setGuestState] = useState("TX");
  const [guestZip, setGuestZip] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const isAuthenticated = status === "authenticated";
  const selectedDef = DEF_SIZES.find((s) => s.gallons === defGallons)!;
  const total = DELIVERY_FEE + (selectedDef?.cents ?? 0) / 100;

  useEffect(() => {
    fetch("/api/service-schedules")
      .then((r) => r.json())
      .then((data) => setSchedules(Array.isArray(data) ? data : []));

    if (isAuthenticated) {
      fetch("/api/addresses")
        .then((r) => r.json())
        .then((data) => {
          const list: Address[] = Array.isArray(data) ? data : [];
          setAddresses(list);
          const def = list.find((a) => a.isDefault) || list[0];
          if (def) setAddressId(def.id);
        });
    }
  }, [isAuthenticated]);

  // Fetch slot availability when date changes
  useEffect(() => {
    if (!scheduledDate) return;
    fetch(`/api/slots?date=${scheduledDate}`)
      .then((r) => r.json())
      .then((data) => setSlotAvailability(Array.isArray(data) ? data : []));
  }, [scheduledDate]);

  const generatedSlots = (() => {
    if (!scheduledDate || deliveryType !== "scheduled") return [];
    const d = new Date(scheduledDate + "T00:00:00");
    const dayName = DAY_NAMES[d.getDay()];
    const sched = schedules.find((s) => s.dayOfWeek === dayName);
    if (!sched) return [];
    return generateSlots(sched.startTime, sched.endTime, sched.slotMinutes);
  })();

  function getSlotStatus(slotKey: string) {
    return slotAvailability.find((s) => {
      const d = new Date(s.slotStart);
      const h = d.getHours().toString().padStart(2, "0");
      const m = d.getMinutes().toString().padStart(2, "0");
      return `${h}:${m}` === slotKey;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      let scheduledAt: string | undefined;
      if (deliveryType === "scheduled" && scheduledDate && scheduledSlotStart) {
        const [h, m] = scheduledSlotStart.split(":").map(Number);
        const dt = new Date(scheduledDate + "T00:00:00");
        dt.setHours(h, m, 0, 0);
        scheduledAt = dt.toISOString();
      }

      const body = isAuthenticated
        ? {
            addressId,
            scheduledAt,
            notes: notes || undefined,
            items: [
              {
                kind: "DEF_ONLY",
                fuelType: "DIESEL",
                gallons: defGallons,
                isFillUp: false,
              },
            ],
          }
        : {
            guestDef: true,
            guestName,
            guestEmail,
            guestPhone: guestPhone || undefined,
            street: guestStreet,
            city: guestCity,
            state: guestState,
            zip: guestZip,
            scheduledAt,
            notes: notes || undefined,
            gallons: defGallons,
          };

      const orderRes = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const order = await orderRes.json();
      if (!orderRes.ok) {
        setError(order.error || "Failed to place order");
        setSubmitting(false);
        return;
      }

      // Create Stripe payment intent
      const intentRes = await fetch("/api/stripe/create-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountCents: order.totalCents, orderId: order.id, isFillUp: false }),
      });

      if (!intentRes.ok) {
        setError("Failed to initiate payment. Please try again.");
        setSubmitting(false);
        return;
      }

      const { clientSecret } = await intentRes.json();
      router.push(
        `/order/payment?secret=${encodeURIComponent(clientSecret)}&orderId=${order.id}&total=${order.totalCents}`
      );
    } catch {
      setError("Something went wrong. Please try again.");
      setSubmitting(false);
    }
  }

  const selectedAddress = addresses.find((a) => a.id === addressId);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-bold text-slate-900">Order DEF Fluid</h1>
      <p className="mt-1 text-sm text-slate-500">
        Diesel Exhaust Fluid delivered to your location. $15 delivery fee.
      </p>

      {error && (
        <div className="mt-4 rounded-xl bg-red-50 border border-red-200 p-3.5 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-6 space-y-6">
        {/* DEF Size Selection */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">DEF Fluid Size</h2>
          <div className="mt-3 space-y-2">
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
                <span className="font-semibold text-slate-700">${(opt.cents / 100).toFixed(2)}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Address */}
        {isAuthenticated ? (
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
                    onClick={() => setAddressId(a.id)}
                    className={`rounded-lg border-2 p-3 text-left transition-colors ${
                      addressId === a.id ? "border-red-500 bg-red-50" : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    {a.label && <p className="font-medium text-slate-900">{a.label}</p>}
                    <p className="text-sm text-slate-600">{a.street}</p>
                    <p className="text-xs text-slate-400">{a.city}, {a.state} {a.zip}</p>
                  </button>
                ))}
              </div>
            )}
            {selectedAddress && (
              <div className="mt-4 h-44 overflow-hidden rounded-xl border border-slate-200">
                <PinMap center={{ lat: selectedAddress.lat, lng: selectedAddress.lng }} />
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Your Information</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-slate-700">Full Name *</label>
                <input
                  required
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  className="mt-1 block w-full rounded-xl border border-slate-300 px-4 py-2.5 text-slate-900 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Email *</label>
                <input
                  type="email"
                  required
                  value={guestEmail}
                  onChange={(e) => setGuestEmail(e.target.value)}
                  className="mt-1 block w-full rounded-xl border border-slate-300 px-4 py-2.5 text-slate-900 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Phone (optional)</label>
                <input
                  type="tel"
                  value={guestPhone}
                  onChange={(e) => setGuestPhone(e.target.value)}
                  className="mt-1 block w-full rounded-xl border border-slate-300 px-4 py-2.5 text-slate-900 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-slate-700">Street Address *</label>
                <input
                  required
                  value={guestStreet}
                  onChange={(e) => setGuestStreet(e.target.value)}
                  className="mt-1 block w-full rounded-xl border border-slate-300 px-4 py-2.5 text-slate-900 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">City *</label>
                <input
                  required
                  value={guestCity}
                  onChange={(e) => setGuestCity(e.target.value)}
                  className="mt-1 block w-full rounded-xl border border-slate-300 px-4 py-2.5 text-slate-900 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20"
                />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-slate-700">State</label>
                  <input
                    value={guestState}
                    onChange={(e) => setGuestState(e.target.value)}
                    maxLength={2}
                    className="mt-1 block w-full rounded-xl border border-slate-300 px-4 py-2.5 text-slate-900 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-slate-700">ZIP *</label>
                  <input
                    required
                    value={guestZip}
                    onChange={(e) => setGuestZip(e.target.value)}
                    maxLength={10}
                    className="mt-1 block w-full rounded-xl border border-slate-300 px-4 py-2.5 text-slate-900 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Delivery Time */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Delivery Time</h2>
          <div className="mt-3 flex gap-3">
            {(["asap", "scheduled"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => {
                  setDeliveryType(t);
                  if (t === "asap") {
                    setScheduledDate("");
                    setScheduledSlotStart("");
                    setScheduledSlotLabel("");
                  }
                }}
                className={`flex-1 rounded-xl border-2 py-2.5 text-sm font-medium transition-colors ${
                  deliveryType === t ? "border-red-500 bg-red-50 text-red-700" : "border-slate-200 text-slate-700 hover:border-slate-300"
                }`}
              >
                {t === "asap" ? "ASAP" : "Schedule"}
              </button>
            ))}
          </div>

          {deliveryType === "scheduled" && (
            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700">Date</label>
                <input
                  type="date"
                  value={scheduledDate}
                  min={new Date().toISOString().split("T")[0]}
                  onChange={(e) => {
                    setScheduledDate(e.target.value);
                    setScheduledSlotStart("");
                    setScheduledSlotLabel("");
                  }}
                  className="mt-1 block w-full rounded-xl border border-slate-300 px-4 py-2.5 text-slate-900 focus:border-red-500 focus:outline-none"
                />
              </div>
              {scheduledDate && (
                generatedSlots.length === 0 ? (
                  <p className="text-sm text-slate-500">No service scheduled for this day.</p>
                ) : (
                  <div>
                    <label className="block text-sm font-medium text-slate-700">Time Slot</label>
                    <div className="mt-2 grid grid-cols-3 gap-2">
                      {generatedSlots.map((slot) => {
                        const avail = getSlotStatus(slot.slotKey);
                        const disabled = avail?.isClosed || avail?.isFull;
                        return (
                          <button
                            key={slot.slotKey}
                            type="button"
                            disabled={disabled}
                            onClick={() => {
                              setScheduledSlotStart(slot.slotKey);
                              setScheduledSlotLabel(slot.label);
                            }}
                            className={`rounded-lg border-2 px-2 py-2 text-xs font-medium transition-colors ${
                              scheduledSlotStart === slot.slotKey
                                ? "border-red-500 bg-red-50 text-red-700"
                                : disabled
                                ? "border-slate-100 bg-slate-50 text-slate-300 cursor-not-allowed"
                                : "border-slate-200 text-slate-700 hover:border-red-300"
                            }`}
                          >
                            {slot.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )
              )}
              {scheduledDate && scheduledSlotLabel && (
                <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700 font-medium space-y-0.5">
                  <p>
                    Scheduled: {new Date(scheduledDate + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })} &middot; {scheduledSlotLabel}
                  </p>
                  {(() => {
                    if (!scheduledSlotStart) return null;
                    const [h, m] = scheduledSlotStart.split(":").map(Number);
                    const start = new Date(scheduledDate + "T00:00:00");
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
          <h2 className="text-lg font-semibold text-slate-900">
            Notes <span className="text-sm text-slate-400 font-normal">(optional)</span>
          </h2>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder="Any special instructions (e.g., gate code, business name or apt name, parked in the back lot)"
            className="mt-3 block w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20 transition-shadow"
          />
        </div>

        {/* Order Summary */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Order Summary</h2>
          <div className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between text-slate-500">
              <span>DEF Fluid ({defGallons} gal)</span>
              <span>${((selectedDef?.cents ?? 0) / 100).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>Delivery Fee</span>
              <span>${DELIVERY_FEE.toFixed(2)}</span>
            </div>
            <div className="flex justify-between border-t border-slate-100 pt-2 font-semibold text-slate-900">
              <span>Total</span>
              <span>${total.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={
            submitting ||
            (isAuthenticated && !addressId) ||
            (!isAuthenticated && (!guestName || !guestEmail || !guestStreet || !guestCity || !guestZip)) ||
            (deliveryType === "scheduled" && (!scheduledDate || !scheduledSlotStart))
          }
          className="w-full rounded-2xl bg-red-600 py-4 text-base font-semibold text-white shadow-sm hover:bg-red-700 disabled:opacity-50 transition-colors"
        >
          {submitting ? "Placing Order…" : `Place Order · $${total.toFixed(2)}`}
        </button>
      </form>
    </div>
  );
}
