"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import VehicleCard from "@/components/VehicleCard";
import VehicleForm from "@/components/VehicleForm";
import Link from "next/link";

interface Vehicle {
  id: string;
  nickname: string | null;
  make: string;
  model: string;
  year: number;
  color: string;
  fuelCapSide: string;
  fuelType: string;
  isDefault: boolean;
}

export default function VehiclesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/signin");
  }, [status, router]);

  const fetchVehicles = useCallback(async () => {
    const res = await fetch("/api/vehicles");
    if (res.ok) {
      const data = await res.json();
      setVehicles(data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (session?.user?.id) fetchVehicles();
  }, [session, fetchVehicles]);

  async function handleAdd(data: {
    nickname: string;
    make: string;
    model: string;
    year: number;
    color: string;
    fuelCapSide: string;
    fuelType: string;
    isDefault: boolean;
  }) {
    setFormLoading(true);
    const res = await fetch("/api/vehicles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (res.ok) {
      setShowForm(false);
      await fetchVehicles();
    }
    setFormLoading(false);
  }

  async function handleEdit(data: {
    nickname: string;
    make: string;
    model: string;
    year: number;
    color: string;
    fuelCapSide: string;
    fuelType: string;
    isDefault: boolean;
  }) {
    if (!editingVehicle) return;
    setFormLoading(true);

    const res = await fetch(`/api/vehicles/${editingVehicle.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (res.ok) {
      setEditingVehicle(null);
      await fetchVehicles();
    }
    setFormLoading(false);
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/vehicles/${id}`, { method: "DELETE" });
    if (res.ok) {
      setDeleteConfirm(null);
      await fetchVehicles();
    }
  }

  async function handleSetDefault(id: string) {
    const vehicle = vehicles.find((v) => v.id === id);
    if (!vehicle) return;

    await fetch(`/api/vehicles/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...vehicle, isDefault: true }),
    });

    await fetchVehicles();
  }

  if (status === "loading" || loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-red-500" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/profile" className="text-sm font-medium text-red-600 hover:text-red-500">
            &larr; Back to Profile
          </Link>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">My Vehicles</h1>
          <p className="mt-1 text-sm text-slate-500">
            Save your vehicles for quick ordering
          </p>
        </div>
        {!showForm && !editingVehicle && (
          <button
            onClick={() => setShowForm(true)}
            className="rounded-xl bg-gradient-to-r from-red-500 to-red-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-red-200 hover:shadow-md hover:shadow-red-200 transition-all"
          >
            + Add Vehicle
          </button>
        )}
      </div>

      {/* Add Form */}
      {showForm && (
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">Add New Vehicle</h2>
          <VehicleForm
            onSubmit={handleAdd}
            onCancel={() => setShowForm(false)}
            loading={formLoading}
          />
        </div>
      )}

      {/* Edit Form */}
      {editingVehicle && (
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">Edit Vehicle</h2>
          <VehicleForm
            initial={{
              nickname: editingVehicle.nickname || "",
              make: editingVehicle.make,
              model: editingVehicle.model,
              year: editingVehicle.year,
              color: editingVehicle.color,
              fuelCapSide: editingVehicle.fuelCapSide,
              fuelType: editingVehicle.fuelType,
              isDefault: editingVehicle.isDefault,
            }}
            onSubmit={handleEdit}
            onCancel={() => setEditingVehicle(null)}
            loading={formLoading}
          />
        </div>
      )}

      {/* Vehicle List */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {vehicles.map((vehicle) => (
          <div key={vehicle.id}>
            <VehicleCard
              vehicle={vehicle}
              onEdit={(v) => {
                setShowForm(false);
                setEditingVehicle(v);
              }}
              onDelete={(id) => setDeleteConfirm(id)}
              onSetDefault={handleSetDefault}
            />

            {/* Delete confirmation */}
            {deleteConfirm === vehicle.id && (
              <div className="mt-2 rounded-lg bg-red-50 p-3">
                <p className="text-sm text-red-700">
                  Delete {vehicle.nickname || `${vehicle.year} ${vehicle.make} ${vehicle.model}`}?
                </p>
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={() => handleDelete(vehicle.id)}
                    className="rounded-md bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-500"
                  >
                    Confirm Delete
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(null)}
                    className="rounded-md bg-white px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {vehicles.length === 0 && !showForm && (
        <div className="mt-12 rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
            <svg className="h-8 w-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7h8m-8 4h4m2 6H6a2 2 0 01-2-2V5a2 2 0 012-2h7l5 5v9a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 className="mt-4 text-lg font-semibold text-slate-900">No vehicles yet</h3>
          <p className="mt-1 text-sm text-slate-500">
            Add a vehicle to speed up your fuel orders.
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="mt-4 rounded-xl bg-gradient-to-r from-red-500 to-red-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-red-200 hover:shadow-md hover:shadow-red-200 transition-all"
          >
            + Add Your First Vehicle
          </button>
        </div>
      )}
    </div>
  );
}
