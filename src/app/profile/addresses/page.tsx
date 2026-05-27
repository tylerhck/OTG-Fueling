"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

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

export default function AddressesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [error, setError] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const [form, setForm] = useState({
    label: "",
    street: "",
    city: "",
    state: "TX",
    zip: "",
    isDefault: false,
  });

  useEffect(() => {
    if (status === "unauthenticated") router.push("/signin");
  }, [status, router]);

  const fetchAddresses = useCallback(async () => {
    const res = await fetch("/api/addresses");
    if (res.ok) setAddresses(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    if (session?.user?.id) fetchAddresses();
  }, [session, fetchAddresses]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setFormLoading(true);

    const res = await fetch("/api/addresses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "Failed to add address");
      setFormLoading(false);
      return;
    }

    setShowForm(false);
    setForm({ label: "", street: "", city: "", state: "TX", zip: "", isDefault: false });
    await fetchAddresses();
    setFormLoading(false);
  }

  async function handleDelete(id: string) {
    await fetch(`/api/addresses/${id}`, { method: "DELETE" });
    setDeleteConfirm(null);
    await fetchAddresses();
  }

  async function handleSetDefault(id: string) {
    const addr = addresses.find((a) => a.id === id);
    if (!addr) return;

    await fetch(`/api/addresses/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...addr, isDefault: true }),
    });

    await fetchAddresses();
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
          <h1 className="mt-1 text-2xl font-bold text-slate-900">My Addresses</h1>
          <p className="mt-1 text-sm text-slate-500">
            Save delivery addresses within our service area
          </p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="rounded-xl bg-gradient-to-r from-red-500 to-red-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-red-200 hover:shadow-md hover:shadow-red-200 transition-all"
          >
            + Add Address
          </button>
        )}
      </div>

      {/* Add Form */}
      {showForm && (
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">Add New Address</h2>

          {error && (
            <div className="mb-4 rounded-xl bg-red-50 border border-red-200 p-3.5 text-sm font-medium text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700">
                Label <span className="text-slate-400">(optional)</span>
              </label>
              <input
                type="text"
                value={form.label}
                onChange={(e) => setForm((p) => ({ ...p, label: e.target.value }))}
                className="mt-1.5 block w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20 transition-shadow"
                placeholder='e.g. "Home", "Work"'
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">Street *</label>
              <input
                type="text"
                required
                value={form.street}
                onChange={(e) => setForm((p) => ({ ...p, street: e.target.value }))}
                className="mt-1.5 block w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20 transition-shadow"
                placeholder="123 Main St"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="block text-sm font-medium text-slate-700">City *</label>
                <input
                  type="text"
                  required
                  value={form.city}
                  onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))}
                  className="mt-1.5 block w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20 transition-shadow"
                  placeholder="Fort Worth"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">State *</label>
                <input
                  type="text"
                  required
                  value={form.state}
                  onChange={(e) => setForm((p) => ({ ...p, state: e.target.value }))}
                  className="mt-1.5 block w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20 transition-shadow"
                  placeholder="TX"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">ZIP *</label>
                <input
                  type="text"
                  required
                  value={form.zip}
                  onChange={(e) => setForm((p) => ({ ...p, zip: e.target.value }))}
                  className="mt-1.5 block w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20 transition-shadow"
                  placeholder="76102"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isDefault"
                checked={form.isDefault}
                onChange={(e) => setForm((p) => ({ ...p, isDefault: e.target.checked }))}
                className="h-4 w-4 rounded border-slate-300 text-red-600 focus:ring-red-500"
              />
              <label htmlFor="isDefault" className="text-sm text-slate-700">
                Set as default address
              </label>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={formLoading}
                className="rounded-xl bg-gradient-to-r from-red-500 to-red-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-red-200 hover:shadow-md hover:shadow-red-200 transition-all disabled:opacity-50"
              >
                {formLoading ? "Adding..." : "Add Address"}
              </button>
              <button
                type="button"
                onClick={() => { setShowForm(false); setError(""); }}
                className="rounded-xl bg-slate-100 px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-200 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Address List */}
      <div className="mt-6 space-y-4">
        {addresses.map((addr) => (
          <div key={addr.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-slate-900">
                    {addr.label || addr.street}
                  </h3>
                  {addr.isDefault && (
                    <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">
                      Default
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-slate-600">
                  {addr.street}, {addr.city}, {addr.state} {addr.zip}
                </p>
              </div>
            </div>

            <div className="mt-3 flex gap-2 border-t border-slate-200 pt-3">
              {!addr.isDefault && (
                <button
                  onClick={() => handleSetDefault(addr.id)}
                  className="rounded-lg px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                >
                  Set Default
                </button>
              )}
              <button
                onClick={() => setDeleteConfirm(addr.id)}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
              >
                Delete
              </button>
            </div>

            {deleteConfirm === addr.id && (
              <div className="mt-2 rounded-lg bg-red-50 p-3">
                <p className="text-sm text-red-700">Delete this address?</p>
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={() => handleDelete(addr.id)}
                    className="rounded-md bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-500"
                  >
                    Confirm
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(null)}
                    className="rounded-md bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {addresses.length === 0 && !showForm && (
        <div className="mt-12 rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">No addresses yet</h3>
          <p className="mt-1 text-sm text-slate-500">
            Add a delivery address to get started.
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="mt-4 rounded-xl bg-gradient-to-r from-red-500 to-red-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-red-200 hover:shadow-md hover:shadow-red-200 transition-all"
          >
            + Add Your First Address
          </button>
        </div>
      )}
    </div>
  );
}
