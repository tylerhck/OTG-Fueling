"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

interface Profile {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
}

interface SubscriptionData {
  subscription: {
    id: string;
    status: string;
    currentPeriodEnd: string;
  } | null;
  fillUpsUsed: number;
  fillUpLimit: number;
  secondFillUpFeeCents: number;
  freeDeliveriesUsed: number;
}

export default function ProfilePage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-red-500" />
      </div>
    }>
      <ProfileContent />
    </Suspense>
  );
}

function ProfileContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [subData, setSubData] = useState<SubscriptionData | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "" });
  const [saving, setSaving] = useState(false);
  const [subLoading, setSubLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") router.push("/signin");
  }, [status, router]);

  useEffect(() => {
    if (searchParams.get("subscribed") === "true") {
      setMessage("Subscription activated! You now get 1 free delivery per week.");
    }
  }, [searchParams]);

  useEffect(() => {
    if (!session?.user?.id) return;

    fetch("/api/profile")
      .then((r) => r.json())
      .then((data) => {
        setProfile(data);
        setForm({ name: data.name, phone: data.phone || "" });
      });

    const sessionId = searchParams.get("session_id");

    async function fetchSubscription(): Promise<void> {
      // If we just returned from Stripe checkout, verify and create subscription
      if (sessionId) {
        const verifyRes = await fetch("/api/subscription", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        });
        if (verifyRes.ok) {
          const data = await verifyRes.json();
          setSubData(data);
          return;
        }
      }
      // Normal fetch
      const res = await fetch("/api/subscription");
      const data = await res.json();
      setSubData(data);
    }

    fetchSubscription();
  }, [session, searchParams]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage("");

    const res = await fetch("/api/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: form.name, phone: form.phone || undefined }),
    });

    if (res.ok) {
      const data = await res.json();
      setProfile(data);
      setEditing(false);
      setMessage("Profile updated!");
    } else {
      setMessage("Failed to update profile");
    }
    setSaving(false);
  }

  async function handleSubscribe() {
    setSubLoading(true);
    const res = await fetch("/api/subscription", { method: "POST" });
    if (res.ok) {
      const { url } = await res.json();
      window.location.href = url;
    } else {
      const data = await res.json();
      setMessage(data.error || "Failed to start subscription");
      setSubLoading(false);
    }
  }

  async function handleCancelSubscription() {
    if (!confirm("Cancel your subscription? You'll keep access until the end of the billing period.")) return;
    setSubLoading(true);
    const res = await fetch("/api/subscription", { method: "DELETE" });
    if (res.ok) {
      setMessage("Subscription will cancel at end of billing period.");
      const data = await fetch("/api/subscription").then((r) => r.json());
      setSubData(data);
    } else {
      setMessage("Failed to cancel subscription");
    }
    setSubLoading(false);
  }

  if (status === "loading" || !profile) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-red-500" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-2xl font-bold text-slate-900">My Profile</h1>

      {message && (
        <div className="mt-4 rounded-xl bg-green-50 border border-green-200 p-3.5 text-sm font-medium text-green-700">
          {message}
        </div>
      )}

      {/* Profile Info */}
      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        {editing ? (
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700">Name</label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                className="mt-1.5 block w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20 transition-shadow"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Phone</label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                className="mt-1.5 block w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20 transition-shadow"
              />
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-gradient-to-r from-red-500 to-red-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-red-200 hover:shadow-md hover:shadow-red-200 disabled:opacity-50 transition-all"
              >
                {saving ? "Saving..." : "Save"}
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="rounded-xl bg-slate-100 px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-200 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Name</p>
                <div className="flex items-center gap-2">
                  <p className="font-medium text-slate-900">{profile.name}</p>
                  {subData?.subscription && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-red-500 to-red-600 px-2.5 py-0.5 text-xs font-semibold text-white shadow-sm">
                      <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                      </svg>
                      Subscriber
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => setEditing(true)}
                className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 transition-colors"
              >
                Edit
              </button>
            </div>
            <div>
              <p className="text-sm text-slate-500">Email</p>
              <p className="font-medium text-slate-900">{profile.email}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Phone</p>
              <p className="font-medium text-slate-900">{profile.phone || "Not set"}</p>
            </div>
          </div>
        )}
      </div>

      {/* Subscription */}
      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Subscription</h2>

        {subData?.subscription ? (
          <div className="mt-3 space-y-3">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-700">
                Active
              </span>
              <span className="text-sm text-slate-500">
                $35/month
              </span>
            </div>
            <div className="text-sm text-slate-600">
              <p>
                <span className="font-medium">Fill-ups this week:</span>{" "}
                {subData.fillUpsUsed ?? subData.freeDeliveriesUsed} of {subData.fillUpLimit ?? 2} used
              </p>
              <p className="mt-0.5 text-slate-500 text-xs">
                1st fill-up: free delivery · 2nd fill-up: $10 delivery · 3rd+: not available
              </p>
              <p className="mt-1">
                <span className="font-medium">Renews:</span>{" "}
                {new Date(subData.subscription.currentPeriodEnd).toLocaleDateString()}
              </p>
            </div>
            <p className="text-xs text-slate-400">
              Add 2nd vehicle at same location: +$5 · Trailered boat: +$10
            </p>
            <button
              onClick={handleCancelSubscription}
              disabled={subLoading}
              className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 transition-colors disabled:opacity-50"
            >
              {subLoading ? "Processing..." : "Cancel Subscription"}
            </button>
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            <p className="text-sm text-slate-600">
              Subscribe for <span className="font-semibold text-slate-900">$35/month</span> and get 1 free delivery per week!
            </p>
            <ul className="text-sm text-slate-500 space-y-1">
              <li>&#x2022; Up to 2 fill-ups per week</li>
              <li>&#x2022; 1st fill-up: free delivery</li>
              <li>&#x2022; 2nd fill-up: $10 delivery fee</li>
              <li>&#x2022; Add 2nd vehicle at same location: +$5</li>
              <li>&#x2022; Add trailered boat: +$10</li>
            </ul>
            <button
              onClick={handleSubscribe}
              disabled={subLoading}
              className="rounded-xl bg-gradient-to-r from-red-500 to-red-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-red-200 hover:shadow-md hover:shadow-red-200 transition-all disabled:opacity-50"
            >
              {subLoading ? "Processing..." : "Subscribe — $35/month"}
            </button>
          </div>
        )}
      </div>

      {/* Quick Links */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <Link
          href="/profile/vehicles"
          className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition-all"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-100 text-red-600">
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p className="font-semibold text-slate-900">My Vehicles</p>
            <p className="text-sm text-slate-500">Manage your saved vehicles</p>
          </div>
        </Link>

        <Link
          href="/profile/addresses"
          className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition-all"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <div>
            <p className="font-semibold text-slate-900">My Addresses</p>
            <p className="text-sm text-slate-500">Manage delivery addresses</p>
          </div>
        </Link>

        <Link
          href="/profile/boats"
          className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition-all"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-100 text-cyan-600">
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 6h18M3 14h12m-6 4h6" />
            </svg>
          </div>
          <div>
            <p className="font-semibold text-slate-900">My Boats</p>
            <p className="text-sm text-slate-500">Manage your saved boats</p>
          </div>
        </Link>

        <Link
          href="/profile/recurring"
          className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition-all"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-100 text-green-600">
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </div>
          <div>
            <p className="font-semibold text-slate-900">Recurring Fill-Ups</p>
            <p className="text-sm text-slate-500">Set up automatic weekly orders</p>
          </div>
        </Link>

        <Link
          href="/order/boat"
          className="flex items-center gap-4 rounded-2xl border border-cyan-100 bg-cyan-50 p-6 shadow-sm hover:shadow-md transition-all sm:col-span-2"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-100 text-cyan-600">
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 6h18M3 14h12m-6 4h6" />
            </svg>
          </div>
          <div>
            <p className="font-semibold text-slate-900">Order Boat Fuel</p>
            <p className="text-sm text-slate-500">$20 service fee + gas — no subscription required</p>
          </div>
        </Link>
      </div>
    </div>
  );
}
