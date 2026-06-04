"use client";

import { useState, useEffect, useCallback } from "react";

interface BanEntry {
  id: string;
  type: string;
  value: string;
  reason: string | null;
  bannedAt: string;
}

export default function BanListPage() {
  const [entries, setEntries] = useState<BanEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState("email");
  const [value, setValue] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [search, setSearch] = useState("");

  const fetchEntries = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/ban-list");
      if (res.ok) {
        const data = await res.json();
        setEntries(data);
      }
    } catch (err) {
      console.error("Failed to fetch ban list:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim()) return;

    setSubmitting(true);
    setMessage(null);

    try {
      const res = await fetch("/api/admin/ban-list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, value: value.trim(), reason: reason.trim() }),
      });

      if (res.ok) {
        const data = await res.json();
        let msg = `Banned ${type}: ${value}`;
        if (data.subscriptionCancelled) {
          msg += " — Stripe subscription cancelled";
        }
        setMessage({ text: msg, type: "success" });
        setValue("");
        setReason("");
        fetchEntries();
      } else {
        const err = await res.json();
        setMessage({ text: err.error || "Failed to add ban entry", type: "error" });
      }
    } catch {
      setMessage({ text: "Network error", type: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Remove this ban? The user will be able to place orders again.")) return;

    try {
      const res = await fetch(`/api/admin/ban-list?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        setEntries(entries.filter((e) => e.id !== id));
        setMessage({ text: "Ban removed", type: "success" });
      }
    } catch {
      setMessage({ text: "Failed to remove ban", type: "error" });
    }
  };

  const filteredEntries = entries.filter(
    (e) =>
      e.value.toLowerCase().includes(search.toLowerCase()) ||
      e.reason?.toLowerCase().includes(search.toLowerCase()) ||
      e.type.toLowerCase().includes(search.toLowerCase())
  );

  const typeColors: Record<string, string> = {
    email: "bg-blue-100 text-blue-800",
    phone: "bg-green-100 text-green-800",
    address: "bg-purple-100 text-purple-800",
    plate: "bg-orange-100 text-orange-800",
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Ban List</h1>
      <p className="mt-1 text-sm text-gray-500">
        Block users from placing orders by email, phone, address, or license plate. Banning by email or phone will also cancel their active subscription.
      </p>

      {/* Add Ban Form */}
      <form onSubmit={handleSubmit} className="mt-6 rounded-xl bg-white p-6 shadow-sm border border-gray-100">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Add Ban Entry</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
            >
              <option value="email">Email</option>
              <option value="phone">Phone Number</option>
              <option value="address">Address</option>
              <option value="plate">License Plate</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Value</label>
            <input
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={
                type === "email" ? "user@example.com" :
                type === "phone" ? "(555) 123-4567" :
                type === "address" ? "123 Main St, City" :
                "ABC1234"
              }
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
            />
          </div>
          <div className="sm:col-span-2 lg:col-span-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Reason / Notes</label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why are they banned?"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
            />
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={submitting || !value.trim()}
              className="w-full rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? "Banning..." : "Ban"}
            </button>
          </div>
        </div>
      </form>

      {/* Message */}
      {message && (
        <div className={`mt-4 rounded-lg p-3 text-sm font-medium ${
          message.type === "success" ? "bg-green-50 text-green-800 border border-green-200" : "bg-red-50 text-red-800 border border-red-200"
        }`}>
          {message.text}
        </div>
      )}

      {/* Search */}
      <div className="mt-6">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search ban list..."
          className="w-full max-w-sm rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
        />
      </div>

      {/* Ban List Table */}
      <div className="mt-4 rounded-xl bg-white shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : filteredEntries.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            {search ? "No matching entries" : "No banned entries yet"}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Type</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Value</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Reason</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Banned</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredEntries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${typeColors[entry.type] || "bg-gray-100 text-gray-800"}`}>
                        {entry.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-gray-900">{entry.value}</td>
                    <td className="px-4 py-3 text-gray-600 max-w-xs truncate">{entry.reason || "—"}</td>
                    <td className="px-4 py-3 text-gray-500">
                      {new Date(entry.bannedAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleDelete(entry.id)}
                        className="text-red-600 hover:text-red-800 text-xs font-medium"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="mt-4 text-xs text-gray-500">
        {entries.length} total ban {entries.length === 1 ? "entry" : "entries"}
        {entries.length > 0 && (
          <span>
            {" "}— {entries.filter(e => e.type === "email").length} emails,{" "}
            {entries.filter(e => e.type === "phone").length} phones,{" "}
            {entries.filter(e => e.type === "address").length} addresses,{" "}
            {entries.filter(e => e.type === "plate").length} plates
          </span>
        )}
      </div>
    </div>
  );
}
