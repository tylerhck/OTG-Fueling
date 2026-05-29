"use client";

import { useState, useEffect } from "react";

interface SmsRecipient {
  id: string;
  name: string;
  phone: string;
  isActive: boolean;
  createdAt: string;
}

export default function SmsAlertsPage() {
  const [recipients, setRecipients] = useState<SmsRecipient[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("+1 ");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const fetchRecipients = async () => {
    try {
      const res = await fetch("/api/admin/sms-recipients");
      if (res.ok) {
        const data = await res.json();
        setRecipients(data);
      }
    } catch (err) {
      console.error("Failed to fetch recipients", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecipients();
  }, []);

  // Auto-format phone number as user types: +1 XXX-XXX-XXXX
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value;

    // Don't allow removing the "+1 " prefix
    if (input.length < 3) {
      setPhone("+1 ");
      return;
    }

    // Extract only digits after the +1 prefix
    const afterPrefix = input.slice(3); // everything after "+1 "
    const digits = afterPrefix.replace(/\D/g, "");

    // Limit to 10 digits (US phone number)
    const limited = digits.slice(0, 10);

    // Format: XXX-XXX-XXXX
    let formatted = "+1 ";
    if (limited.length <= 3) {
      formatted += limited;
    } else if (limited.length <= 6) {
      formatted += limited.slice(0, 3) + "-" + limited.slice(3);
    } else {
      formatted += limited.slice(0, 3) + "-" + limited.slice(3, 6) + "-" + limited.slice(6);
    }

    setPhone(formatted);
  };

  // Normalize phone to E.164 format for saving: +1XXXXXXXXXX
  const normalizePhone = (formatted: string): string => {
    const digits = formatted.replace(/\D/g, "");
    if (digits.length === 11 && digits.startsWith("1")) {
      return "+" + digits;
    }
    if (digits.length === 10) {
      return "+1" + digits;
    }
    return "";
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const normalized = normalizePhone(phone);
    if (!normalized) {
      setError("Please enter a complete 10-digit phone number");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/admin/sms-recipients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone: normalized }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to add recipient");
        return;
      }
      setName("");
      setPhone("+1 ");
      fetchRecipients();
    } catch (err) {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Remove this recipient?")) return;
    await fetch(`/api/admin/sms-recipients?id=${id}`, { method: "DELETE" });
    fetchRecipients();
  };

  const handleToggle = async (id: string, isActive: boolean) => {
    await fetch("/api/admin/sms-recipients", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, isActive: !isActive }),
    });
    fetchRecipients();
  };

  const formatPhone = (phone: string) => {
    // Format +1XXXXXXXXXX to +1 XXX-XXX-XXXX
    const digits = phone.replace(/\D/g, "");
    if (digits.length === 11 && digits.startsWith("1")) {
      return `+1 ${digits.slice(1, 4)}-${digits.slice(4, 7)}-${digits.slice(7)}`;
    }
    return phone;
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">SMS Order Alerts</h1>
      <p className="text-gray-600 mb-6">
        Manage employee phone numbers that receive text notifications when new orders are placed.
      </p>

      {/* Add Recipient Form */}
      <div className="bg-white rounded-lg border p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Add Recipient</h2>
        <form onSubmit={handleAdd} className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            placeholder="Employee Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-red-500 focus:outline-none"
            required
          />
          <input
            type="tel"
            value={phone}
            onChange={handlePhoneChange}
            className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-mono focus:border-red-500 focus:outline-none"
            required
          />
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-red-600 px-6 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {saving ? "Adding..." : "Add"}
          </button>
        </form>
        {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
      </div>

      {/* Recipients List */}
      <div className="bg-white rounded-lg border">
        <div className="px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">
            Active Recipients ({recipients.filter((r) => r.isActive).length})
          </h2>
        </div>

        {loading ? (
          <div className="p-6 text-center text-gray-500">Loading...</div>
        ) : recipients.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            No recipients added yet. Add an employee phone number above to start receiving SMS alerts for new orders.
          </div>
        ) : (
          <div className="divide-y">
            {recipients.map((r) => (
              <div key={r.id} className="flex items-center justify-between px-6 py-4">
                <div>
                  <p className={`font-medium ${r.isActive ? "text-gray-900" : "text-gray-400"}`}>
                    {r.name}
                  </p>
                  <p className={`text-sm ${r.isActive ? "text-gray-600" : "text-gray-400"}`}>
                    {formatPhone(r.phone)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handleToggle(r.id, r.isActive)}
                    className={`rounded-full px-3 py-1 text-xs font-medium ${
                      r.isActive
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {r.isActive ? "Active" : "Paused"}
                  </button>
                  <button
                    onClick={() => handleDelete(r.id)}
                    className="text-red-600 hover:text-red-800 text-sm"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="mt-6 rounded-lg bg-blue-50 p-4">
        <p className="text-sm text-blue-800">
          <strong>How it works:</strong> When a new order is placed (web or app), all active recipients will receive a text message with the order details including customer name, fuel type, delivery address, and scheduled time.
        </p>
      </div>
    </div>
  );
}
