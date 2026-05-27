"use client";

import { useState } from "react";

export default function WaitlistPage() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    zip: "",
    city: "",
    state: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    const res = await fetch("/api/waitlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    const data = await res.json();

    if (res.ok) {
      setSubmitted(true);
      setMessage(data.message);
    } else {
      setError(data.error || "Something went wrong. Please try again.");
    }
    setSubmitting(false);
  }

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="relative overflow-hidden min-h-[100vh] flex items-center">
        {/* Hero background image — grayscale */}
        <div
          className="absolute inset-0 bg-cover bg-[center_top_30%] bg-no-repeat grayscale"
          style={{ backgroundImage: "url('/bg.jpeg')" }}
        />
        {/* Dark overlay */}
        <div className="absolute inset-0 bg-black/70" />
        {/* Subtle red tint */}
        <div className="absolute inset-0 bg-gradient-to-br from-red-950/40 via-transparent to-red-950/30" />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 w-full">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center py-20 sm:py-28 lg:py-32">
            {/* Left: Copy */}
            <div className="max-w-xl">
              <div className="inline-flex items-center gap-2 rounded-full bg-red-500/10 border border-red-500/20 px-4 py-1.5 mb-8">
                <div className="h-2 w-2 rounded-full bg-red-400 animate-pulse" />
                <span className="text-sm font-medium text-red-300">
                  Launching Soon in Fort Worth, TX
                </span>
              </div>

              <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl lg:text-6xl leading-[1.08]">
                Gas station?{" "}
                <span className="relative">
                  <span className="bg-gradient-to-r from-red-400 via-rose-400 to-red-500 bg-clip-text text-transparent">
                    We come to you.
                  </span>
                  <svg
                    className="absolute -bottom-2 left-0 w-full h-3 text-red-500/30"
                    viewBox="0 0 200 8"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M1 5.5C32 2 62 1 101 4C140 7 170 3 199 5"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    />
                  </svg>
                </span>
              </h1>
              <p className="mt-8 text-lg leading-relaxed text-slate-400 max-w-md">
                On The Go Fueling delivers gas and diesel straight to your vehicle —
                at home, work, or anywhere you&apos;re parked. No detours, no
                lines, no hassle.
              </p>

              {/* Features */}
              <div className="mt-10 grid grid-cols-2 gap-4">
                {[
                  { icon: "M13 10V3L4 14h7v7l9-11h-7z", label: "ASAP or Scheduled" },
                  {
                    icon: "M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z",
                    label: "Secure Payment",
                  },
                  {
                    icon: "M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z",
                    label: "Door-to-Door",
                  },
                  {
                    icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
                    label: "Competitive Prices",
                  },
                ].map((f) => (
                  <div key={f.label} className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-500/10">
                      <svg
                        className="h-4 w-4 text-red-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d={f.icon}
                        />
                      </svg>
                    </div>
                    <span className="text-sm text-slate-300">{f.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: Waitlist form */}
            <div className="relative">
              <div className="absolute -inset-4 bg-gradient-to-br from-red-500/20 to-red-500/10 rounded-3xl blur-2xl" />
              <div className="relative rounded-2xl border border-slate-700/50 bg-stone-950/80 backdrop-blur-sm p-8 shadow-2xl">
                {submitted ? (
                  <div className="text-center py-8">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10 border border-green-500/20">
                      <svg
                        className="h-8 w-8 text-green-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    </div>
                    <h3 className="mt-4 text-xl font-bold text-white">
                      You&apos;re on the list!
                    </h3>
                    <p className="mt-2 text-slate-400">{message}</p>
                  </div>
                ) : (
                  <>
                    <div className="text-center mb-6">
                      <h2 className="text-xl font-bold text-white">
                        Join the Waitlist
                      </h2>
                      <p className="mt-1 text-sm text-slate-400">
                        Be first to know when we launch in your area.
                      </p>
                    </div>

                    {error && (
                      <div className="mb-4 rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400">
                        {error}
                      </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-300">
                          Name *
                        </label>
                        <input
                          type="text"
                          required
                          value={form.name}
                          onChange={(e) =>
                            setForm((p) => ({ ...p, name: e.target.value }))
                          }
                          placeholder="John Doe"
                          className="mt-1.5 block w-full rounded-xl border border-slate-600 bg-slate-700/50 px-4 py-3 text-white placeholder-slate-500 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20 transition-shadow"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-300">
                          Email *
                        </label>
                        <input
                          type="email"
                          required
                          value={form.email}
                          onChange={(e) =>
                            setForm((p) => ({ ...p, email: e.target.value }))
                          }
                          placeholder="john@example.com"
                          className="mt-1.5 block w-full rounded-xl border border-slate-600 bg-slate-700/50 px-4 py-3 text-white placeholder-slate-500 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20 transition-shadow"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-300">
                          Phone{" "}
                          <span className="text-slate-500">(optional)</span>
                        </label>
                        <input
                          type="tel"
                          value={form.phone}
                          onChange={(e) =>
                            setForm((p) => ({ ...p, phone: e.target.value }))
                          }
                          placeholder="(817) 555-0123"
                          className="mt-1.5 block w-full rounded-xl border border-slate-600 bg-slate-700/50 px-4 py-3 text-white placeholder-slate-500 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20 transition-shadow"
                        />
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        <div className="col-span-1">
                          <label className="block text-sm font-medium text-slate-300">
                            ZIP *
                          </label>
                          <input
                            type="text"
                            required
                            value={form.zip}
                            onChange={(e) =>
                              setForm((p) => ({ ...p, zip: e.target.value }))
                            }
                            placeholder="76107"
                            maxLength={10}
                            className="mt-1.5 block w-full rounded-xl border border-slate-600 bg-slate-700/50 px-4 py-3 text-white placeholder-slate-500 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20 transition-shadow"
                          />
                        </div>
                        <div className="col-span-1">
                          <label className="block text-sm font-medium text-slate-300">
                            City
                          </label>
                          <input
                            type="text"
                            value={form.city}
                            onChange={(e) =>
                              setForm((p) => ({ ...p, city: e.target.value }))
                            }
                            placeholder="Fort Worth"
                            className="mt-1.5 block w-full rounded-xl border border-slate-600 bg-slate-700/50 px-4 py-3 text-white placeholder-slate-500 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20 transition-shadow"
                          />
                        </div>
                        <div className="col-span-1">
                          <label className="block text-sm font-medium text-slate-300">
                            State
                          </label>
                          <input
                            type="text"
                            value={form.state}
                            onChange={(e) =>
                              setForm((p) => ({ ...p, state: e.target.value }))
                            }
                            placeholder="TX"
                            maxLength={2}
                            className="mt-1.5 block w-full rounded-xl border border-slate-600 bg-slate-700/50 px-4 py-3 text-white placeholder-slate-500 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20 transition-shadow"
                          />
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={submitting}
                        className="w-full rounded-xl bg-gradient-to-r from-red-500 to-red-600 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-red-500/25 hover:shadow-xl hover:shadow-red-500/35 hover:from-red-400 hover:to-red-500 transition-all disabled:opacity-50"
                      >
                        {submitting ? "Joining..." : "Join the Waitlist"}
                      </button>

                      <p className="text-center text-xs text-slate-500">
                        We&apos;ll only email you about our launch. No spam.
                      </p>
                    </form>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom fade */}
        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-white to-transparent" />
      </section>

      {/* How it will work */}
      <section className="py-24 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto">
            <p className="text-sm font-semibold uppercase tracking-wider text-red-600">
              Coming Soon
            </p>
            <h2 className="mt-3 text-3xl font-bold text-slate-900 sm:text-4xl">
              How On The Go Fueling works
            </h2>
            <p className="mt-4 text-slate-500 leading-relaxed">
              When we launch, getting fuel delivered will be as easy as 1-2-3.
            </p>
          </div>
          <div className="mt-16 grid gap-6 sm:grid-cols-3 lg:gap-10">
            {[
              {
                step: "01",
                title: "Tell Us Your Details",
                desc: "Enter your vehicle info, delivery address, and fuel type. No account required — order as a guest anytime.",
                icon: (
                  <svg
                    className="h-6 w-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                    />
                  </svg>
                ),
              },
              {
                step: "02",
                title: "We Come to You",
                desc: "Choose ASAP or schedule a time. Our team will deliver fuel directly to your vehicle, wherever it's parked.",
                icon: (
                  <svg
                    className="h-6 w-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0"
                    />
                  </svg>
                ),
              },
              {
                step: "03",
                title: "Drive On",
                desc: "Full tank, zero hassle. Pay securely online and get back to your day.",
                icon: (
                  <svg
                    className="h-6 w-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                ),
              },
            ].map((item) => (
              <div
                key={item.step}
                className="relative rounded-2xl border border-slate-200 bg-white p-8 shadow-sm hover:shadow-lg transition-shadow"
              >
                <div className="absolute -top-4 left-6 flex h-8 items-center rounded-full bg-gradient-to-r from-red-500 to-red-600 px-3 text-xs font-bold text-white shadow-sm">
                  {item.step}
                </div>
                <div className="mt-2 flex h-12 w-12 items-center justify-center rounded-xl bg-red-100 text-red-600">
                  {item.icon}
                </div>
                <h3 className="mt-5 text-lg font-semibold text-slate-900">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-500">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Fuel types */}
      <section className="py-20 bg-slate-50">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto">
            <h2 className="text-3xl font-bold text-slate-900 sm:text-4xl">
              All major fuel types
            </h2>
            <p className="mt-4 text-slate-500">
              Regular, premium, and diesel — we&apos;ll have what
              your vehicle needs.
            </p>
          </div>
          <div className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-3">
            {[
              { grade: "87", name: "Regular", color: "from-emerald-500 to-emerald-600" },
              { grade: "93", name: "Premium", color: "from-blue-500 to-blue-600" },
              { grade: "D", name: "Diesel", color: "from-slate-600 to-slate-700" },
            ].map((fuel) => (
              <div
                key={fuel.grade}
                className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm"
              >
                <div
                  className={`mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br ${fuel.color} text-white text-lg font-bold shadow-sm`}
                >
                  {fuel.grade}
                </div>
                <p className="mt-3 font-semibold text-slate-900">{fuel.name}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
