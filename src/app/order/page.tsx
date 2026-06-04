"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { FUEL_TYPE_LABELS } from "@/types";

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

const DAY_NAMES = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
const FILL_UP_MAX_GALLONS = 30;

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
  // Use Central time to determine "today"
  const centralNow = getCentralNow();
  const today = new Date(centralNow.dateStr + "T00:00:00");
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
  const [defSizes, setDefSizes] = useState<{gallons: number; label: string; cents: number}[]>([
    { gallons: 2.5, label: "2.5 gallon", cents: 3000 },
    { gallons: 5, label: "5 gallon", cents: 5500 },
  ]);
  const [deliveryFeeCents, setDeliveryFeeCents] = useState(1500);
  const [asapEnabled, setAsapEnabled] = useState(true);
  const [subscriptionInfo, setSubscriptionInfo] = useState<SubscriptionInfo | null>(null);
  const [schedules, setSchedules] = useState<ServiceSchedule[]>([]);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [showRecurringPrompt, setShowRecurringPrompt] = useState(true);

  // Primary vehicle form
  const [form, setForm] = useState({
    vehicleId: "",
    addressId: "",
    fuelType: "REGULAR_87",
    dollarAmount: 40,
    isFillUp: false,
    deliveryType: "asap" as "asap" | "scheduled",
    scheduledDate: "",
    availableFrom: "",
    availableTo: "",
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
    dollarAmount: 40,
    isFillUp: false,
    notes: "",
  });

  // Trailered boat add-on
  const [addTraileredBoat, setAddTraileredBoat] = useState(false);
  const [boatAddon, setBoatAddon] = useState({
    boatId: "",
    fuelType: "REGULAR_87",
    dollarAmount: 40,
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
    if (priceData.defSizes) setDefSizes(priceData.defSizes);
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



  // Determine delivery fee based on subscription fill-up usage
  let effectiveDeliveryFeeCents = deliveryFeeCents;
  let isFreeDelivery = false;
  let isSecondPaidFillUp = false;
  let isWeeklyLimitReached = false;

  if (subscriptionInfo?.active) {
    const used = subscriptionInfo.fillUpsUsed ?? subscriptionInfo.freeDeliveriesUsed ?? 0;
    if (used === 0) {
      effectiveDeliveryFeeCents = 0;
      isFreeDelivery = true;
    } else {
      // 2nd+ fill-up: $10 service fee
      effectiveDeliveryFeeCents = subscriptionInfo.secondFillUpFeeCents ?? 1000;
      isSecondPaidFillUp = true;
    }
  }

  const deliveryFee = effectiveDeliveryFeeCents / 100;

  // Primary item cost — dollar amount pre-funded or fill-up ($40 hold)
  const primaryFuelCost = form.isFillUp ? 0 : form.dollarAmount;

  // Second vehicle cost
  const secondVehicleGasCost = addSecondVehicle
    ? secondVehicle.isFillUp ? 0 : secondVehicle.dollarAmount
    : 0;
  const secondVehicleAddonFee = addSecondVehicle ? SECOND_VEHICLE_ADDON_CENTS / 100 : 0;

  // Trailered boat cost
  const boatGasCost = addTraileredBoat
    ? boatAddon.isFillUp ? 0 : boatAddon.dollarAmount
    : 0;
  const boatAddonFee = addTraileredBoat ? TRAILERED_BOAT_ADDON_CENTS / 100 : 0;

  const defCost = addDef ? (defSizes.find((s) => s.gallons === defGallons)?.cents ?? 0) / 100 : 0;

  // Total pre-auth: for fill-up = $40, for dollar amount = fuel $ + fees
  const total = form.isFillUp
    ? deliveryFee + secondVehicleAddonFee + secondVehicleGasCost + boatAddonFee + boatGasCost + defCost
    : primaryFuelCost + deliveryFee + secondVehicleAddonFee + secondVehicleGasCost + boatAddonFee + boatGasCost + defCost;



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
    if (form.deliveryType === "scheduled" && (!form.scheduledDate || !form.availableFrom || !form.availableTo)) {
      setError("Please select a delivery date and availability window.");
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

    // Build items array
    const items: Record<string, unknown>[] = [
      {
        kind: "PRIMARY_VEHICLE",
        vehicleId: form.vehicleId,
        fuelType: form.fuelType,
        prefundedCents: form.isFillUp ? undefined : Math.round(form.dollarAmount * 100),
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
        prefundedCents: secondVehicle.isFillUp ? undefined : Math.round(secondVehicle.dollarAmount * 100),
        isFillUp: secondVehicle.isFillUp,
        notes: secondVehicle.notes || undefined,
      });
    }

    if (addTraileredBoat) {
      const boatItem: Record<string, unknown> = {
        kind: "TRAILERED_BOAT",
        fuelType: boatAddon.fuelType,
        prefundedCents: boatAddon.isFillUp ? undefined : Math.round(boatAddon.dollarAmount * 100),
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
        availableFrom,
        availableTo,
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

    // ALL orders are pre-auth (manual capture). Fill-up = $40 hold, dollar amount = full amount hold
    const hasFillUp = form.isFillUp || (addSecondVehicle && secondVehicle.isFillUp) || (addTraileredBoat && boatAddon.isFillUp);
    const intentAmount = hasFillUp ? 4000 : order.totalCents;

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
      {/* Recurring order prompt */}
      {showRecurringPrompt && (
        <div className="mb-8 rounded-2xl border-2 border-red-200 bg-gradient-to-br from-red-50 to-white p-8 shadow-sm">
          <div className="text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
              <svg className="h-8 w-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </div>
            <h2 className="mt-4 text-xl font-bold text-slate-900">Want to set up a recurring delivery?</h2>
            <p className="mt-2 text-sm text-slate-600 max-w-md mx-auto">
              Never schedule again — pick a day of the week and we&apos;ll come by and top off your tank automatically, every single week.
            </p>
            <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => router.push("/profile/recurring")}
                className="w-full sm:w-auto rounded-xl bg-gradient-to-r from-red-500 to-red-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:from-red-400 hover:to-red-500 transition-all"
              >
                Yes, Set Up Recurring
              </button>
              <button
                type="button"
                onClick={() => setShowRecurringPrompt(false)}
                className="w-full sm:w-auto rounded-xl border border-slate-300 px-6 py-3 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-all"
              >
                No, Just a One-Time Order
              </button>
            </div>
            {!isSubscriber && (
              <p className="mt-4 text-xs text-slate-400">
                Recurring deliveries require a subscription ($35/mo). You&apos;ll be guided through setup.
              </p>
            )}
          </div>
        </div>
      )}

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
            `Not subscribed — $${Math.round(deliveryFeeCents / 100)} delivery fee applies. Subscribe for $35/month to get free deliveries.`
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
              <label className="block text-sm font-medium text-slate-700">Fuel Amount ($)</label>
              {form.isFillUp ? (
                <div className="mt-1.5 flex items-center rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <span className="text-sm text-slate-400 italic">Fill up — $40 pre-charge, only charged for what you receive at completion</span>
                </div>
              ) : (
                <div className="relative mt-1.5">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-medium">$</span>
                  <input
                    type="number"
                    min={20}
                    max={500}
                    step={5}
                    value={form.dollarAmount}
                    onChange={(e) => setForm((prev) => ({ ...prev, dollarAmount: parseFloat(e.target.value) || 0 }))}
                    className="block w-full rounded-xl border border-slate-300 pl-8 pr-4 py-3 text-slate-900 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20 transition-shadow"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Fill-up toggle */}
          <div className="mt-4 flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-amber-900">Fill Up My Tank</p>
              <p className="text-xs text-amber-700">
                A $40 pre-charge will be placed on your card on the day of your fill-up. If the pre-charge fails, no order ticket will be created and you will not receive service. You will only be charged for what you receive at time of completion. The pre-charge is released upon completion.
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
                      <label className="block text-sm font-medium text-slate-700">Fuel Amount ($)</label>
                      {secondVehicle.isFillUp ? (
                        <div className="mt-1.5 flex items-center rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                          <span className="text-sm text-slate-400 italic">Fill up — $40 pre-charge, only charged for what you receive at completion</span>
                        </div>
                      ) : (
                        <div className="relative mt-1.5">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-medium">$</span>
                          <input
                            type="number" min={20} max={500} step={5}
                            value={secondVehicle.dollarAmount}
                            onChange={(e) => setSecondVehicle((p) => ({ ...p, dollarAmount: parseFloat(e.target.value) || 0 }))}
                            className="block w-full rounded-xl border border-slate-300 pl-8 pr-4 py-3 text-slate-900 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20 transition-shadow"
                          />
                        </div>
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
                      <label className="block text-sm font-medium text-slate-700">Fuel Amount ($)</label>
                      {boatAddon.isFillUp ? (
                        <div className="mt-1.5 flex items-center rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                          <span className="text-sm text-slate-400 italic">Fill up — $40 pre-charge, only charged for what you receive at completion</span>
                        </div>
                      ) : (
                        <div className="relative mt-1.5">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-medium">$</span>
                          <input
                            type="number" min={20} max={1000} step={5}
                            value={boatAddon.dollarAmount}
                            onChange={(e) => setBoatAddon((p) => ({ ...p, dollarAmount: parseFloat(e.target.value) || 0 }))}
                            className="block w-full rounded-xl border border-slate-300 pl-8 pr-4 py-3 text-slate-900 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20 transition-shadow"
                          />
                        </div>
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
                onClick={() => setForm((prev) => ({ ...prev, deliveryType: "asap", scheduledDate: "", availableFrom: "", availableTo: "" }))}
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
                    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
                    const dayName = DAY_NAMES[d.getDay()];
                    const isOpen = schedules.some((s) => s.dayOfWeek === dayName);
                    const label = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
                    return (
                      <button
                        key={iso}
                        type="button"
                        disabled={!isOpen}
                        onClick={() => setForm((prev) => ({ ...prev, scheduledDate: iso, availableFrom: "", availableTo: "" }))}
                        className={`rounded-lg border-2 px-3 py-2 text-xs font-medium transition-colors ${
                          form.scheduledDate === iso
                            ? "border-red-500 bg-red-50 text-red-700"
                            : isOpen
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
                    <p className="text-sm font-medium text-slate-700 mb-2">What hours will your vehicle be at this location?</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">From</label>
                        <select
                          value={form.availableFrom}
                          onChange={(e) => setForm((prev) => ({ ...prev, availableFrom: e.target.value, availableTo: "" }))}
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
                          onChange={(e) => setForm((prev) => ({ ...prev, availableTo: e.target.value }))}
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
                    Vehicle available: {(() => {
                      const fmt = (t: string) => { const [h, m] = t.split(":").map(Number); const ampm = h >= 12 ? "PM" : "AM"; return `${h % 12 || 12}:${m.toString().padStart(2, "0")} ${ampm}`; };
                      return `${fmt(form.availableFrom)} \u2013 ${fmt(form.availableTo)}`;
                    })()}
                  </p>
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
                {defSizes.map((opt) => (
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
            placeholder="Any special instructions (e.g., gate code, business name or apt name, parked in the back lot, fuel cap on the left)"
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
                    {FUEL_TYPE_LABELS[form.fuelType as keyof typeof FUEL_TYPE_LABELS]} — Fill Up
                  </span>
                  <span className="font-medium text-slate-400 italic">charged after delivery</span>
                </div>
              </>
            ) : (
              <div className="flex justify-between">
                <span className="text-slate-600">
                  {FUEL_TYPE_LABELS[form.fuelType as keyof typeof FUEL_TYPE_LABELS]} — Pre-funded
                </span>
                <span className="font-medium text-slate-900">${form.dollarAmount.toFixed(2)}</span>
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
                    <span>2nd Vehicle — Fill Up</span>
                    <span className="italic text-slate-400">charged after</span>
                  </div>
                ) : (
                  <div className="flex justify-between text-slate-500">
                    <span>{FUEL_TYPE_LABELS[secondVehicle.fuelType as keyof typeof FUEL_TYPE_LABELS]} (2nd vehicle)</span>
                    <span>${secondVehicle.dollarAmount.toFixed(2)}</span>
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
                    <span>Boat — Fill Up</span>
                    <span className="italic text-slate-400">charged after</span>
                  </div>
                ) : (
                  <div className="flex justify-between text-slate-500">
                    <span>{FUEL_TYPE_LABELS[boatAddon.fuelType as keyof typeof FUEL_TYPE_LABELS]} (boat)</span>
                    <span>${boatAddon.dollarAmount.toFixed(2)}</span>
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
                {form.isFillUp ? "Card Hold" : "Pre-charge Total"}
              </span>
              <span className="font-bold text-slate-900 text-lg">
                {form.isFillUp ? "$40.00" : `$${total.toFixed(2)}`}
              </span>
            </div>

            {form.isFillUp ? (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                <strong>Important:</strong> A $40 pre-charge will be placed on your card on the day of your fill-up. If the pre-charge fails, no order ticket will be created and you will not receive service. You will only be charged for what you receive at time of completion. The pre-charge is released upon completion.
              </p>
            ) : (
              <p className="text-xs text-slate-400">
                Your card will be pre-charged for the amount above. After delivery, you will be charged only for the actual fuel pumped. If your tank fills before reaching your pre-funded amount, the difference is released back to your card.
              </p>
            )}

            {/* Fuel price disclaimer */}
            <div className="mt-3 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
              <p className="text-xs text-amber-800">
                <strong>Note:</strong> Fuel prices fluctuate daily. The number of gallons you receive is based on the current market price at the time of delivery. You will be pre-charged your selected dollar amount unless your tank fills first. A detailed receipt with gallons delivered and price per gallon will be emailed upon completion.
              </p>
            </div>
          </div>
        </div>

        {/* Vehicle accessibility notice */}
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
          <p className="text-xs text-amber-800">
            <strong>Vehicle accessibility:</strong> Please make sure your vehicle is readily available and gas cap unlocked so that we may access it. Any non-accessible vehicles or no-shows can result in a service charge.
          </p>
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
            ? "Place Order — $40.00 Pre-charge"
            : `Place Order — $${total.toFixed(2)} Pre-charge`}
        </button>
      </form>
    </div>
  );
}
