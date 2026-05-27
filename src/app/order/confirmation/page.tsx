"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { FUEL_TYPE_LABELS, ORDER_STATUS_LABELS } from "@/types";
import OrderProgressBar from "@/components/OrderProgressBar";
import { getDeliveryWindow } from "@/lib/deliveryWindow";

interface Order {
  id: string;
  userId: string | null;
  fuelType: string;
  gallons: number;
  pricePerGallonCents: number;
  deliveryFeeCents: number;
  totalCents: number;
  status: string;
  scheduledAt: string | null;
  createdAt: string;
  vehicle: { make: string; model: string; year: number; nickname: string | null } | null;
  address: { street: string; city: string; state: string; zip: string } | null;
  guestName: string | null;
  guestEmail: string | null;
  guestVehicle: string | null;
  guestAddress: string | null;
  etaMinutes: number | null;
}

function ConfirmationContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get("orderId");
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (orderId) {
      fetch(`/api/orders/${orderId}`)
        .then((r) => r.json())
        .then((data) => {
          setOrder(data);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
  }, [orderId]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-red-500" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-slate-500">Order not found.</p>
      </div>
    );
  }

  // Derive display info from either relation data or guest JSON
  const guestVehicle = order.guestVehicle ? JSON.parse(order.guestVehicle) : null;
  const guestAddr = order.guestAddress ? JSON.parse(order.guestAddress) : null;

  const vehicleLabel = order.vehicle
    ? (order.vehicle.nickname || `${order.vehicle.year} ${order.vehicle.make} ${order.vehicle.model}`)
    : guestVehicle
      ? `${guestVehicle.year} ${guestVehicle.make} ${guestVehicle.model}`
      : "N/A";

  const addressLabel = order.address
    ? `${order.address.street}, ${order.address.city}`
    : guestAddr
      ? `${guestAddr.street}, ${guestAddr.city}`
      : "N/A";

  const isGuest = !order.userId;

  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <div className="text-center">
        <div className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full ${order.status === "AWAITING_PAYMENT" ? "bg-amber-100" : "bg-green-100"}`}>
          <svg className={`h-8 w-8 ${order.status === "AWAITING_PAYMENT" ? "text-amber-500" : "text-green-600"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={order.status === "AWAITING_PAYMENT" ? "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" : "M5 13l4 4L19 7"} />
          </svg>
        </div>
        <h1 className="mt-4 text-2xl font-bold text-slate-900">
          {order.status === "AWAITING_PAYMENT" ? "Payment Processing…" : "Order Received!"}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {order.status === "AWAITING_PAYMENT"
            ? "Your payment is being processed. You'll receive a confirmation email once it's complete."
            : "Payment received. Our team will review and confirm your order shortly."}
        </p>
      </div>

      {/* Progress bar */}
      <div className="mt-6">
        <OrderProgressBar status={order.status} etaMinutes={order.etaMinutes} />
      </div>

      <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        <div className="flex justify-between text-sm">
          <span className="text-slate-500">Order ID</span>
          <span className="font-mono text-slate-900">{order.id.slice(0, 12)}...</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-slate-500">Status</span>
          <span className="font-medium text-slate-900">
            {ORDER_STATUS_LABELS[order.status as keyof typeof ORDER_STATUS_LABELS]}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-slate-500">Vehicle</span>
          <span className="text-slate-900">{vehicleLabel}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-slate-500">Delivery To</span>
          <span className="text-slate-900 text-right">{addressLabel}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-slate-500">Fuel</span>
          <span className="text-slate-900">
            {order.gallons} gal {FUEL_TYPE_LABELS[order.fuelType as keyof typeof FUEL_TYPE_LABELS]}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-slate-500">Delivery</span>
          <span className="text-slate-900">
            {order.scheduledAt
              ? new Date(order.scheduledAt).toLocaleString()
              : "ASAP"}
          </span>
        </div>
        {(() => {
          const window = getDeliveryWindow(order.scheduledAt, order.etaMinutes, 120);
          if (!window) return null;
          return (
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Est. Time at Location</span>
              <span className="text-slate-900 font-medium">{window}</span>
            </div>
          );
        })()}
        <div className="flex justify-between border-t border-slate-100 pt-3 text-sm">
          <span className="font-semibold text-slate-900">Total</span>
          <span className="font-bold text-lg text-slate-900">
            ${(order.totalCents / 100).toFixed(2)}
          </span>
        </div>
      </div>

      <div className="mt-6 flex gap-4">
        {!isGuest && (
          <Link
            href="/orders"
            className="flex-1 rounded-xl bg-gradient-to-r from-red-500 to-red-600 px-4 py-2.5 text-center text-sm font-semibold text-white shadow-sm shadow-red-200 hover:shadow-md hover:shadow-red-200 transition-all"
          >
            View All Orders
          </Link>
        )}
        <Link
          href="/"
          className={`rounded-xl px-4 py-2.5 text-center text-sm font-medium transition-colors ${
            isGuest
              ? "flex-1 bg-gradient-to-r from-red-500 to-red-600 text-white shadow-sm shadow-red-200 hover:shadow-md hover:shadow-red-200 font-semibold"
              : "flex-1 bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
        >
          Back Home
        </Link>
      </div>

      {isGuest && (
        <p className="mt-4 text-center text-xs text-slate-400">
          Want to track your orders?{" "}
          <a href="/signup" className="text-red-600 hover:text-red-500 font-medium">
            Create an account
          </a>
        </p>
      )}
    </div>
  );
}

export default function ConfirmationPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center">
          <p className="text-gray-500">Loading...</p>
        </div>
      }
    >
      <ConfirmationContent />
    </Suspense>
  );
}
