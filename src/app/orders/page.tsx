"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FUEL_TYPE_LABELS, ORDER_STATUS_LABELS } from "@/types";
import { getDeliveryWindow } from "@/lib/deliveryWindow";

interface Order {
  id: string;
  fuelType: string;
  gallons: number;
  totalCents: number;
  pricePerGallonCents: number;
  deliveryFeeCents: number;
  status: string;
  scheduledAt: string | null;
  etaMinutes: number | null;
  createdAt: string;
  vehicle: { make: string; model: string; year: number; nickname: string | null } | null;
  address: { street: string; city: string; state: string; zip: string; label: string | null } | null;
}

const statusColors: Record<string, string> = {
  AWAITING_PAYMENT: "bg-orange-100 text-orange-800",
  PENDING: "bg-yellow-100 text-yellow-800",
  ACTIVE: "bg-green-100 text-green-800",
  CONFIRMED: "bg-blue-100 text-blue-800",
  IN_PROGRESS: "bg-purple-100 text-purple-800",
  COMPLETED: "bg-green-100 text-green-800",
  CANCELLED: "bg-red-100 text-red-800",
};

export default function OrdersPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/signin");
  }, [status, router]);

  useEffect(() => {
    if (session?.user?.id) {
      fetch("/api/orders")
        .then((r) => r.json())
        .then((data) => {
          setOrders(data);
          setLoading(false);
        });
    }
  }, [session]);

  async function cancelOrder(e: React.MouseEvent, orderId: string) {
    e.preventDefault(); // Prevent Link navigation
    e.stopPropagation();
    if (!confirm("Cancel this order?")) return;

    setCancellingId(orderId);
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "CANCELLED" }),
      });
      if (res.ok) {
        setOrders((prev) =>
          prev.map((o) => (o.id === orderId ? { ...o, status: "CANCELLED" } : o))
        );
      }
    } catch (err) {
      console.error(err);
    } finally {
      setCancellingId(null);
    }
  }

  if (status === "loading" || loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">My Orders</h1>
        <Link
          href="/order"
          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500"
        >
          New Order
        </Link>
      </div>

      {orders.length === 0 ? (
        <div className="mt-12 rounded-xl bg-white p-12 text-center shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900">
            No orders yet
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            Place your first fuel delivery order.
          </p>
          <Link
            href="/order"
            className="mt-4 inline-block rounded-lg bg-red-600 px-6 py-2 text-sm font-semibold text-white hover:bg-red-500"
          >
            Order Fuel
          </Link>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {orders.map((order) => (
            <Link
              key={order.id}
              href={`/orders/${order.id}`}
              className="block rounded-xl bg-white p-5 shadow-sm hover:shadow-md transition-shadow border border-gray-100"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <h3 className="font-semibold text-gray-900">
                      {order.gallons} gal{" "}
                      {FUEL_TYPE_LABELS[order.fuelType as keyof typeof FUEL_TYPE_LABELS]}
                      {order.pricePerGallonCents > 0 && (
                        <span className="ml-2 text-sm font-normal text-gray-500">
                          @ ${(order.pricePerGallonCents / 100).toFixed(2)}/gal
                        </span>
                      )}
                    </h3>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        statusColors[order.status] || "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {ORDER_STATUS_LABELS[order.status as keyof typeof ORDER_STATUS_LABELS] || order.status}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-gray-500">
                    {order.vehicle
                      ? (order.vehicle.nickname ||
                          `${order.vehicle.year} ${order.vehicle.make} ${order.vehicle.model}`)
                      : "Guest vehicle"}{" "}
                    &middot;{" "}
                    {order.address
                      ? (order.address.label || order.address.street)
                      : "Guest address"}
                  </p>
                  <p className="mt-1 text-xs text-gray-400">
                    {new Date(order.createdAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                    {order.scheduledAt && (
                      <>
                        {" "}
                        &middot; Scheduled:{" "}
                        {new Date(order.scheduledAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </>
                    )}
                  </p>
                  {(() => {
                    const window = getDeliveryWindow(order.scheduledAt, order.etaMinutes, 120);
                    if (!window) return null;
                    return (
                      <p className="mt-0.5 text-xs text-blue-600 font-medium">
                        Est. at location: {window}
                      </p>
                    );
                  })()}
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className="text-lg font-bold text-gray-900">
                    ${(order.totalCents / 100).toFixed(2)}
                  </span>
                  {(order.status === "AWAITING_PAYMENT" || order.status === "PENDING") && (
                    <button
                      onClick={(e) => cancelOrder(e, order.id)}
                      disabled={cancellingId === order.id}
                      className="rounded-lg border border-red-200 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                    >
                      {cancellingId === order.id ? "Cancelling..." : "Cancel"}
                    </button>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
