"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function SignUpPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    phone: "",
  });
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function update(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!agreedToTerms) {
      setError("You must agree to the Terms of Service and Privacy Policy to create an account.");
      return;
    }

    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);

    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        email: form.email,
        password: form.password,
        phone: form.phone || undefined,
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Something went wrong");
      setLoading(false);
      return;
    }

    // Auto sign-in after registration
    const result = await signIn("credentials", {
      email: form.email,
      password: form.password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError("Account created but sign-in failed. Please sign in manually.");
    } else {
      router.push("/welcome");
      router.refresh();
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-red-500 to-red-600 text-white font-bold text-sm shadow-lg shadow-red-200">
            OTG
          </div>
          <h1 className="mt-6 text-2xl font-bold text-slate-900">
            Create your account
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Get fuel delivered right to your vehicle
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          {error && (
            <div className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 p-3.5 text-sm font-medium text-red-700">
              <svg className="h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              {error}
            </div>
          )}

          <div>
            <label htmlFor="name" className="block text-sm font-medium text-slate-700">
              Full Name
            </label>
            <input
              id="name"
              type="text"
              required
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              className="mt-1.5 block w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20 transition-shadow"
              placeholder="John Doe"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-700">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={form.email}
              onChange={(e) => update("email", e.target.value)}
              className="mt-1.5 block w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20 transition-shadow"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-slate-700">
              Phone <span className="text-slate-400">(optional)</span>
            </label>
            <input
              id="phone"
              type="tel"
              value={form.phone}
              onChange={(e) => update("phone", e.target.value)}
              className="mt-1.5 block w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20 transition-shadow"
              placeholder="(555) 123-4567"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-700">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                minLength={8}
                value={form.password}
                onChange={(e) => update("password", e.target.value)}
                className="mt-1.5 block w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20 transition-shadow"
                placeholder="8+ chars"
              />
            </div>
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-700">
                Confirm
              </label>
              <input
                id="confirmPassword"
                type="password"
                required
                value={form.confirmPassword}
                onChange={(e) => update("confirmPassword", e.target.value)}
                className="mt-1.5 block w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20 transition-shadow"
                placeholder="••••••••"
              />
            </div>
          </div>

          {/* Terms of Service & Privacy Policy Agreement */}
          <div className="flex items-start gap-3 pt-2">
            <input
              id="terms"
              type="checkbox"
              checked={agreedToTerms}
              onChange={(e) => setAgreedToTerms(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-red-600 focus:ring-red-500 cursor-pointer"
            />
            <label htmlFor="terms" className="text-sm text-slate-600 leading-snug cursor-pointer">
              I agree to the{" "}
              <Link href="/terms" target="_blank" className="font-semibold text-red-600 hover:text-red-500 underline">
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link href="/privacy" target="_blank" className="font-semibold text-red-600 hover:text-red-500 underline">
                Privacy Policy
              </Link>
              , including that fuel prices are subject to change at the time of fill-up.
            </label>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-gradient-to-r from-red-500 to-red-600 px-4 py-3 text-sm font-semibold text-white shadow-sm shadow-red-200 hover:shadow-md hover:shadow-red-200 disabled:opacity-50 transition-all"
          >
            {loading ? "Creating account..." : "Create Account"}
          </button>

          <p className="text-center text-sm text-slate-500">
            Already have an account?{" "}
            <Link href="/signin" className="font-semibold text-red-600 hover:text-red-500">
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
