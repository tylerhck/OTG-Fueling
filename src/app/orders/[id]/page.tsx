"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { FUEL_TYPE_LABELS, ORDER_STATUS_LABELS, FUEL_CAP_LABELS } from "@/types";
import OrderProgressBar from "@/components/OrderProgressBar";

const PinMap = dynamic(() => import("@/components/PinMap"), { ssr: false });

interface OrderDetail {
  id: string;
  fuelType: string;
  gallons: number;
  pricePerGallonCents: number;
  deliveryFeeCents: number;
  totalCents: number;
  status: string;
  scheduledAt: string | null;
  etaMinutes: number | null;
  notes: string | null;
  createdAt: string;
  vehicle: {
    make: string;
    model: string;
    year: number;
    color: string;
    nickname: string | null;
    fuelCapSide: string;
  };
  address: { street: string; city: string; state: string; zip: string };
  user: { name: string; email: string; phone: string | null };
  pinLat: number | null;
  pinLng: number | null;
}

const statusColors: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  CONFIRMED: "bg-blue-100 text-blue-800",
  IN_PROGRESS: "bg-purple-100 text-purple-800",
  COMPLETED: "bg-green-100 text-green-800",
  CANCELLED: "bg-red-100 text-red-800",
};

export default function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (sessionStatus === "unauthenticated") router.push("/signin");
  }, [sessionStatus, router]);

  useEffect(() => {
    if (session?.user?.id && id) {
      fetch(`/api/orders/${id}`)
        .then((r) => r.json())
        .then((data) => {
          setOrder(data);
          setLoading(false);
        });
    }
  }, [session, id]);

  if (sessionStatus === "loading" || loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-gray-500">Order not found.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Link href="/orders" className="text-sm text-red-600 hover:text-red-500">
        &larr; Back to Orders
      </Link>

      <div className="mt-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Order Details</h1>
        <span
          className={`rounded-full px-3 py-1 text-sm font-medium ${
            statusColors[order.status] || "bg-gray-100"
          }`}
        >
          {ORDER_STATUS_LABELS[order.status as keyof typeof ORDER_STATUS_LABELS]}
        </span>
      </div>

      {/* Progress bar */}
      <div className="mt-6">
        <OrderProgressBar status={order.status} etaMinutes={order.etaMinutes} />
      </div>

      <div className="mt-6 space-y-6">
        {/* Fuel Details */}
        <div className="rounded-xl bg-white p-6 shadow-sm">
          <h2 className="font-semibold text-gray-900">Fuel</h2>
          <div className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Type</span>
              <span>{FUEL_TYPE_LABELS[order.fuelType as keyof typeof FUEL_TYPE_LABELS]}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Gallons</span>
              <span>{order.gallons}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Price per gallon</span>
              <span>${(order.pricePerGallonCents / 100).toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Fuel cost</span>
              <span>${((order.pricePerGallonCents * order.gallons) / 100).toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Delivery fee</span>
              <span>${(order.deliveryFeeCents / 100).toFixed(2)}</span>
            </div>
            <div className="flex justify-between border-t pt-2 font-semibold">
              <span>Total</span>
              <span className="text-lg">${(order.totalCents / 100).toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Vehicle */}
        <div className="rounded-xl bg-white p-6 shadow-sm">
          <h2 className="font-semibold text-gray-900">Vehicle</h2>
          <div className="mt-3 text-sm text-gray-700">
            <p>
              {order.vehicle.nickname &&
                <span className="font-medium">{order.vehicle.nickname} — </span>
              }
              {order.vehicle.year} {order.vehicle.make} {order.vehicle.model}
            </p>
            <p className="text-gray-500">
              Color: {order.vehicle.color} · Fuel cap: {FUEL_CAP_LABELS[order.vehicle.fuelCapSide as keyof typeof FUEL_CAP_LABELS]}
            </p>
          </div>
        </div>

        {/* Delivery */}
        <div className="rounded-xl bg-white p-6 shadow-sm">
          <h2 className="font-semibold text-gray-900">Delivery</h2>
          <div className="mt-3 text-sm text-gray-700">
            <p>
              {order.address.street}, {order.address.city}, {order.address.state}{" "}
              {order.address.zip}
            </p>
            <p className="mt-1 text-gray-500">
              {order.scheduledAt
                ? `Scheduled: ${new Date(order.scheduledAt).toLocaleString()}`
                : "ASAP delivery"}
            </p>
          </div>
          {order.pinLat !== null && order.pinLng !== null && (
            <div className="mt-4">
              <p className="text-xs font-medium text-gray-500 mb-2">Pinned Location</p>
              <PinMap
                center={{ lat: order.pinLat, lng: order.pinLng }}
                height="180px"
              />
            </div>
          )}
        </div>

        {/* Notes */}
        {order.notes && (
          <div className="rounded-xl bg-white p-6 shadow-sm">
            <h2 className="font-semibold text-gray-900">Notes</h2>
            <p className="mt-2 text-sm text-gray-700">{order.notes}</p>
          </div>
        )}

        {/* Timestamps */}
        <div className="text-center text-xs text-gray-400">
          Order placed {new Date(order.createdAt).toLocaleString()}
        </div>
      </div>
    </div>
  );
}
