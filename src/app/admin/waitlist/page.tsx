"use client";

import { useEffect, useState } from "react";

interface WaitlistEntry {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  zip: string;
  city: string | null;
  state: string | null;
  createdAt: string;
}

export default function AdminWaitlistPage() {
  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/waitlist")
      .then((r) => r.json())
      .then((data) => {
        setEntries(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Group by ZIP for a quick area breakdown
  const zipCounts: Record<string, number> = {};
  entries.forEach((e) => {
    zipCounts[e.zip] = (zipCounts[e.zip] || 0) + 1;
  });
  const topZips = Object.entries(zipCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  if (loading) {
    return <p className="text-gray-500">Loading waitlist...</p>;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Waitlist</h1>
      <p className="mt-1 text-sm text-gray-500">
        {entries.length} {entries.length === 1 ? "person" : "people"} on the waitlist.
      </p>

      {/* Top ZIPs */}
      {topZips.length > 0 && (
        <div className="mt-6">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">
            Top Areas by ZIP
          </h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {topZips.map(([zip, count]) => (
              <span
                key={zip}
                className="inline-flex items-center gap-1.5 rounded-full bg-red-50 border border-red-200 px-3 py-1 text-sm"
              >
                <span className="font-medium text-red-700">{zip}</span>
                <span className="text-red-500">&middot;</span>
                <span className="text-red-600">
                  {count}
                </span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Mobile cards */}
      <div className="mt-6 space-y-3 md:hidden">
        {entries.map((entry) => (
          <div key={entry.id} className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-sm font-semibold text-gray-900">{entry.name}</p>
            <p className="mt-0.5 text-sm text-gray-600">{entry.email}</p>
            {entry.phone && <p className="text-sm text-gray-500">{entry.phone}</p>}
            <div className="mt-2 flex items-center gap-3 text-xs text-gray-500">
              <span>{[entry.city, entry.state, entry.zip].filter(Boolean).join(", ")}</span>
              <span>&middot;</span>
              <span>{new Date(entry.createdAt).toLocaleDateString()}</span>
            </div>
          </div>
        ))}
        {entries.length === 0 && (
          <p className="py-8 text-center text-sm text-gray-400">No waitlist signups yet.</p>
        )}
      </div>

      {/* Desktop table */}
      <div className="mt-6 hidden overflow-x-auto rounded-xl border border-gray-200 md:block">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Name
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Email
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Phone
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Location
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Signed Up
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {entries.map((entry) => (
              <tr key={entry.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm font-medium text-gray-900 whitespace-nowrap">
                  {entry.name}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                  {entry.email}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                  {entry.phone || "—"}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                  {[entry.city, entry.state, entry.zip]
                    .filter(Boolean)
                    .join(", ")}
                </td>
                <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                  {new Date(entry.createdAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
            {entries.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-8 text-center text-sm text-gray-400"
                >
                  No waitlist signups yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
