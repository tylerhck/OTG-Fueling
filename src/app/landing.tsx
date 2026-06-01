"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import dynamic from "next/dynamic";
import Link from "next/link";
import AddressChecker from "@/components/AddressChecker";

const Map = dynamic(() => import("@/components/Map"), { ssr: false });

function formatScheduleTime(t: string) {
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${m.toString().padStart(2, "0")} ${ampm}`;
}

interface ServiceArea {
  centerLat: number;
  centerLng: number;
  radiusMiles: number;
  name: string;
  polygon?: [number, number][] | null;
}


interface ServiceSchedule {
  id: string;
  dayOfWeek: string;
  serviceArea: { name: string };
  description: string | null;
  startTime: string;
  endTime: string;
}

const FUEL_LABEL: Record<string, string> = {
  REGULAR_87: "Regular 87",
  PREMIUM_93: "Premium 93",
  DIESEL: "Diesel",
};

const FUEL_COLOR: Record<string, string> = {
  REGULAR_87: "from-emerald-500 to-emerald-600",
  PREMIUM_93: "from-blue-500 to-blue-600",
  DIESEL: "from-slate-600 to-slate-700",
};

const FUEL_GRADE: Record<string, string> = {
  REGULAR_87: "87",
  PREMIUM_93: "93",
  DIESEL: "D",
};

export default function HomePage() {
  const { data: session } = useSession();
  const [serviceAreas, setServiceAreas] = useState<ServiceArea[]>([]);
  const [deliveryFeeCents, setDeliveryFeeCents] = useState(500);
  const [schedules, setSchedules] = useState<ServiceSchedule[]>([]);
  const [geocodedPos, setGeocodedPos] = useState<{ lat: number; lng: number } | null>(null);
  const [videoMuted, setVideoMuted] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Attempt unmuted autoplay; if browser blocks it, fall back to muted
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = false;
    const playPromise = video.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {
        // Browser blocked unmuted autoplay — fall back to muted
        video.muted = true;
        setVideoMuted(true);
        video.play().catch(() => {});
      });
    }
  }, []);

  useEffect(() => {
    fetch("/api/service-area")
      .then((r) => r.json())
      .then(setServiceAreas)
      .catch(() => {});
    fetch("/api/fuel-prices")
      .then((r) => r.json())
      .then((data) => {
        if (data.deliveryFeeCents !== undefined) setDeliveryFeeCents(data.deliveryFeeCents);
      })
      .catch(() => {});
    fetch("/api/service-schedules")
      .then((r) => r.json())
      .then(setSchedules)
      .catch(() => {});
  }, []);

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden min-h-[calc(100vh-4rem)]">
        {/* Hero background image — grayscale */}
        <div
          className="absolute inset-0 bg-cover bg-no-repeat grayscale"
          style={{ backgroundImage: "url('/bg.jpeg')", backgroundPosition: "center calc(30% - 100px)" }}
        />
        {/* Dark overlay */}
        <div className="absolute inset-0 bg-black/70" />
        {/* Subtle red tint */}
        <div className="absolute inset-0 bg-gradient-to-br from-red-950/40 via-transparent to-red-950/30" />
        {/* Dot grid texture */}
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.9) 1px, transparent 1px)", backgroundSize: "28px 28px" }} />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center py-20 sm:py-28 lg:py-32">
            {/* Left: Copy */}
            <div className="max-w-xl">
              {(() => {
                const DAY_NAMES_HERO = ["SUNDAY","MONDAY","TUESDAY","WEDNESDAY","THURSDAY","FRIDAY","SATURDAY"];
                const todayDay = DAY_NAMES_HERO[new Date().getDay()];
                const todaySchedules = schedules.filter((s) => s.dayOfWeek === todayDay);
                const areaNames = [
                  ...new Set(todaySchedules.map((s) => s.serviceArea.name)),
                ];
                let badgeText = "Now Live · Fort Worth, TX";
                if (areaNames.length > 0) {
                  badgeText = `Now Live · ${areaNames.join(" & ")}`;
                }
                return (
                  <div className="inline-flex items-center gap-2 rounded-full bg-white/[0.08] border border-white/[0.12] backdrop-blur-sm px-4 py-1.5 mb-8">
                    <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-sm font-medium text-slate-200">{badgeText}</span>
                  </div>
                );
              })()}

              <h1 className="text-4xl font-extrabold tracking-tighter text-white sm:text-5xl lg:text-6xl xl:text-7xl leading-[1.05]">
                Gas station?{" "}
                <span className="relative whitespace-nowrap">
                  <span className="bg-gradient-to-r from-red-400 via-rose-400 to-red-500 bg-clip-text text-transparent">
                    We come to you.
                  </span>
                  <span className="absolute -bottom-1 left-0 right-0 h-[3px] bg-gradient-to-r from-red-500 via-rose-400 to-transparent rounded-full" />
                </span>
              </h1>
              <p className="mt-8 text-lg leading-relaxed text-slate-300 max-w-md">
                Subscribe, set a recurring delivery, and never think about fuel again. We come by once a week and top you off — no scheduling, no gas stations, no hassle.
              </p>
              <div className="mt-10 flex flex-wrap items-center gap-3">
                <Link
                  href={session ? "/profile" : "/signup"}
                  className="group rounded-xl bg-gradient-to-r from-red-500 to-red-600 px-8 py-4 text-sm font-semibold text-white shadow-lg shadow-red-500/25 hover:shadow-xl hover:shadow-red-500/40 hover:from-red-400 hover:to-red-500 transition-all"
                >
                  Set Up Weekly Delivery
                  <span className="inline-block ml-2 group-hover:translate-x-0.5 transition-transform">&rarr;</span>
                </Link>
                <Link
                  href={session ? "/order" : "/order/guest"}
                  className="rounded-xl border border-white/[0.15] px-8 py-4 text-sm font-semibold text-slate-300 hover:bg-white/[0.06] hover:border-white/[0.25] transition-all"
                >
                  One-Time Order
                </Link>
              </div>

              {/* Trust indicators */}
              <div className="mt-12 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-slate-400">
                {["Set it & forget it", "Weekly top-offs included", "Cancel anytime"].map((item) => (
                  <div key={item} className="flex items-center gap-2">
                    <svg className="h-4 w-4 text-emerald-500 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    {item}
                  </div>
                ))}
              </div>
            </div>

            {/* Right: Hero video */}
            <div className="hidden lg:block">
              <div className="relative">
                {/* Glow behind video */}
                <div className="absolute -inset-6 bg-gradient-to-br from-red-500/20 to-red-600/5 rounded-3xl blur-3xl" />
                <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/60 shadow-2xl shadow-black/40 ring-1 ring-white/5">
                  <video
                    ref={videoRef}
                    src="/v3_final_ad.MOV"
                    loop
                    muted={videoMuted}
                    playsInline
                    className="block h-full w-full object-cover"
                  />
                  {/* Mute / unmute toggle */}
                  <button
                    onClick={() => {
                      setVideoMuted((prev) => !prev);
                      if (videoRef.current) {
                        videoRef.current.muted = !videoMuted;
                      }
                    }}
                    className="absolute bottom-3 right-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm hover:bg-black/70 transition-colors"
                    aria-label={videoMuted ? "Unmute video" : "Mute video"}
                  >
                    {videoMuted ? (
                      /* Muted icon */
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707A1 1 0 0112 5v14a1 1 0 01-1.707.707L5.586 15z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                      </svg>
                    ) : (
                      /* Unmuted icon */
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072M12 6v12m0 0l-4.243-4.243M12 18l4.243-4.243M12 6l-4.243 4.243M12 6l4.243 4.243" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707A1 1 0 0112 5v14a1 1 0 01-1.707.707L5.586 15z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

      </section>

      {/* Stats bar */}
      <section className="relative -mt-12 z-10 mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 pb-8">
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-8 shadow-2xl shadow-slate-900/[0.08]">
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-4 sm:divide-x sm:divide-slate-100">
            {[
              { value: "1x", label: "Weekly Top-Off", sub: "We come to you" },
              { value: "$35", label: "/Month", sub: "Free weekly delivery" },
              { value: "Set It", label: "& Forget It", sub: "Recurring auto-fills" },
              { value: "$0", label: "To Sign Up", sub: "Cancel anytime" },
            ].map((stat) => (
              <div key={stat.label} className="text-center px-2">
                <p className="text-3xl font-black text-slate-900 sm:text-4xl tabular-nums">{stat.value}</p>
                <p className="mt-1.5 text-sm font-bold text-slate-700">{stat.label}</p>
                <p className="mt-0.5 text-xs text-slate-400">{stat.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-24 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto">
            <p className="text-sm font-semibold uppercase tracking-wider text-red-600">How it works</p>
            <h2 className="mt-3 text-3xl font-bold text-slate-900 sm:text-4xl">
              Never visit a gas station again
            </h2>
            <p className="mt-4 text-slate-500 leading-relaxed">
              Set up once, and we handle the rest — every single week.
            </p>
          </div>
          <div className="mt-16 grid gap-6 sm:grid-cols-3 lg:gap-10">
            {[
              {
                step: "01",
                title: "Subscribe & Add Your Vehicle",
                desc: "Create a free account, subscribe for $35/mo, and add your vehicle and delivery address.",
                icon: (
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                ),
              },
              {
                step: "02",
                title: "Set Your Recurring Day",
                desc: "Pick which day of the week works best. We'll come by and top off your tank automatically — no scheduling needed.",
                icon: (
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                ),
              },
              {
                step: "03",
                title: "We Top You Off Weekly",
                desc: "Every week on your chosen day, we fill your tank. No need to be present — just leave your fuel cap accessible.",
                icon: (
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                ),
              },
            ].map((item) => (
              <div key={item.step} className="group relative rounded-2xl border border-slate-200 bg-white p-8 hover:border-red-200 hover:shadow-lg hover:shadow-red-500/5 transition-all">
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-red-500 to-red-600 text-white shadow-md shadow-red-200 group-hover:shadow-lg group-hover:shadow-red-200 transition-shadow shrink-0">
                    {item.icon}
                  </div>
                  <span className="text-5xl font-black text-slate-200 group-hover:text-red-200 transition-colors leading-none">{item.step}</span>
                </div>
                <h3 className="mt-6 text-lg font-bold text-slate-900">{item.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-slate-500">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-24 bg-slate-50">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto">
            <p className="text-sm font-semibold uppercase tracking-wider text-red-600">Pricing</p>
            <h2 className="mt-3 text-3xl font-bold text-slate-900 sm:text-4xl">
              Simple, transparent pricing
            </h2>
            <p className="mt-4 text-slate-500 leading-relaxed">
              Pay competitive fuel prices plus a delivery fee. Subscribe monthly to save.
            </p>
          </div>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 max-w-3xl mx-auto">
            {/* One-Off */}
            <div className="rounded-2xl border border-slate-200 bg-white p-8 hover:shadow-lg transition-shadow">
              <p className="text-sm font-semibold uppercase tracking-wider text-slate-500">Per Delivery</p>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-4xl font-extrabold text-slate-900">$15</span>
                <span className="text-sm text-slate-500">/delivery</span>
              </div>
              <p className="mt-3 text-sm text-slate-500">
                No commitment. Order whenever you need a fill-up.
              </p>
              <ul className="mt-6 space-y-3">
                {[`$${Math.round(deliveryFeeCents / 100)} delivery fee per order`, "No account required", "ASAP or scheduled", "All fuel types"].map((item) => (
                  <li key={item} className="flex items-center gap-3 text-sm text-slate-700">
                    <svg className="h-4 w-4 shrink-0 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    {item}
                  </li>
                ))}
              </ul>
              <Link
                href="/order/guest"
                className="mt-8 block rounded-xl border border-slate-200 py-3 text-center text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Order Now
              </Link>
            </div>
            {/* Subscription */}
            <div className="relative rounded-2xl border-2 border-red-500 bg-white p-8 shadow-lg shadow-red-500/10">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="rounded-full bg-red-600 px-4 py-1 text-xs font-semibold text-white shadow-sm">Best Value</span>
              </div>
              <p className="text-sm font-semibold uppercase tracking-wider text-red-600">Monthly Subscription</p>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-4xl font-extrabold text-slate-900">$35</span>
                <span className="text-sm text-slate-500">/month</span>
              </div>
              <p className="mt-3 text-sm text-slate-500">
                Set a recurring day and we top you off every week. Never think about fuel again.
              </p>
              <ul className="mt-6 space-y-3">
                {["1 free weekly top-off included", "Set it and forget it", "Recurring delivery on your day", "All fuel types", "ASAP orders available too", "Cancel anytime"].map((item) => (
                  <li key={item} className="flex items-center gap-3 text-sm text-slate-700">
                    <svg className="h-4 w-4 shrink-0 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    {item}
                  </li>
                ))}
              </ul>
              <Link
                href="/signup"
                className="mt-8 block rounded-xl bg-gradient-to-r from-red-500 to-red-600 py-3 text-center text-sm font-semibold text-white shadow-md shadow-red-500/20 hover:from-red-400 hover:to-red-500 transition-all"
              >
                Subscribe &amp; Save
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Why OTG */}
      <section className="py-24 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wider text-red-600">Why choose us</p>
              <h2 className="mt-3 text-3xl font-bold text-slate-900 sm:text-4xl">
                Fuel delivery that fits your life
              </h2>
              <p className="mt-4 text-slate-500 leading-relaxed">
                Whether you&apos;re a busy professional, manage a fleet, or just hate waiting at the pump — On The Go Fueling saves you time and hassle.
              </p>

              <div className="mt-10 space-y-6">
                {[
                  {
                    title: "Save Time",
                    desc: "Skip the trip to the gas station. We deliver while you work, relax, or sleep.",
                    icon: (
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    ),
                  },
                  {
                    title: "Competitive Pricing",
                    desc: `$35/mo subscription includes one free delivery per week. Otherwise, $${Math.round(deliveryFeeCents / 100)} delivery fee. No surge pricing, no hidden costs.`,
                    icon: (
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    ),
                  },
                  {
                    title: "Fleet Friendly",
                    desc: "Manage multiple vehicles and addresses from your account. Perfect for businesses.",
                    icon: (
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                    ),
                  },
                  {
                    title: "Secure Payments",
                    desc: "Pay with card, Apple Pay, or Google Pay through our secure Stripe-powered checkout.",
                    icon: (
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                    ),
                  },
                ].map((item) => (
                  <div key={item.title} className="flex items-start gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-600">
                      {item.icon}
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900">{item.title}</h3>
                      <p className="mt-1 text-sm text-slate-500 leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Fuel type cards */}
            <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
              {[
                { name: "Regular", grade: "87", desc: "Standard unleaded", color: "from-emerald-500 to-emerald-600", bgLight: "bg-emerald-50", border: "border-emerald-100" },
                { name: "Premium", grade: "93", desc: "Super unleaded", color: "from-blue-500 to-blue-600", bgLight: "bg-blue-50", border: "border-blue-100" },
                { name: "Diesel", grade: "D", desc: "Ultra low sulfur", color: "from-slate-600 to-slate-700", bgLight: "bg-slate-100", border: "border-slate-200" },
              ].map((fuel) => (
                  <div
                    key={fuel.name}
                    className={`group rounded-2xl ${fuel.bgLight} border ${fuel.border} p-6 text-center hover:shadow-lg transition-all`}
                  >
                    <div
                      className={`mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br ${fuel.color} text-white text-2xl font-black shadow-md`}
                    >
                      {fuel.grade}
                    </div>
                    <h3 className="mt-4 font-bold text-slate-900">{fuel.name}</h3>
                    <p className="mt-1 text-xs text-slate-600">{fuel.desc}</p>
                    <p className="mt-3 text-sm font-medium text-slate-500">Market price</p>
                  </div>
              ))}

              {/* DEF Fluid card */}
              <a
                href="/order/def"
                className="group rounded-2xl bg-amber-50 border border-amber-100 p-6 text-center hover:shadow-lg transition-all"
              >
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 text-white text-xl font-black shadow-md">
                  DEF
                </div>
                <h3 className="mt-4 font-bold text-slate-900">DEF Fluid</h3>
                <p className="mt-1 text-xs text-slate-600">Diesel Exhaust Fluid</p>
                <p className="mt-3 text-sm font-semibold text-amber-700">From $30</p>
                <p className="mt-1 text-xs text-slate-500">2.5 gal · 5 gal</p>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Service Area Map */}
      <section className="py-24 bg-slate-50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-5 gap-10 items-start">
            <div className="lg:col-span-2">
              <p className="text-sm font-semibold uppercase tracking-wider text-red-600">Coverage</p>
              <h2 className="mt-3 text-3xl font-bold text-slate-900 sm:text-4xl">
                Our Service Area
              </h2>
              <p className="mt-4 text-slate-500 leading-relaxed">
                We currently deliver across the greater Fort Worth metropolitan area. Enter your address below to check eligibility.
              </p>

              <div className="mt-8">
                <AddressChecker onGeocode={setGeocodedPos} />
              </div>
            </div>

            <div className="lg:col-span-3">
              <div className="overflow-hidden rounded-2xl border border-slate-300/60 shadow-lg shadow-slate-300/30">
                <Map serviceAreas={serviceAreas} height="500px" markerPos={geocodedPos} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Commercial / Residential / Marine Pricing */}
      <section className="py-24 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto">
            <p className="text-sm font-semibold uppercase tracking-wider text-red-600">Custom Pricing</p>
            <h2 className="mt-3 text-3xl font-bold text-slate-900 sm:text-4xl">
              Need a quote for your situation?
            </h2>
            <p className="mt-4 text-slate-500 leading-relaxed">
              We offer custom pricing for residential accounts, commercial fleets, and marine vessels. Email us and we&apos;ll get back to you within one business day.
            </p>
          </div>
          <div className="mt-12 grid gap-6 sm:grid-cols-3 max-w-4xl mx-auto">
            {[
              {
                title: "Residential",
                desc: "Home fill-ups, apartment complexes, or regular vehicle fueling schedules.",
                icon: (
                  <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                  </svg>
                ),
                email: "pricing@otgfueling.com",
                subject: "Residential Pricing Inquiry",
              },
              {
                title: "Commercial",
                desc: "Fleet accounts, job sites, parking lots, and high-volume business needs.",
                icon: (
                  <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                ),
                email: "pricing@otgfueling.com",
                subject: "Commercial Pricing Inquiry",
              },
              {
                title: "Boats & Marine",
                desc: "Dock-side fueling for boats, jet skis, and other watercraft.",
                icon: (
                  <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 17l1.5-4.5M3 17h18M3 17l-1-3m19 3l-1.5-4.5M21 17l1-3M6.5 12.5L12 4l5.5 8.5M9 12.5h6" />
                  </svg>
                ),
                email: "pricing@otgfueling.com",
                subject: "Marine Pricing Inquiry",
              },
            ].map((item) => (
              <div key={item.title} className="group rounded-2xl border border-slate-200 bg-white p-8 hover:border-red-200 hover:shadow-lg hover:shadow-red-500/5 transition-all text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-100 text-red-600 group-hover:bg-red-600 group-hover:text-white transition-colors">
                  {item.icon}
                </div>
                <h3 className="mt-5 text-lg font-bold text-slate-900">{item.title}</h3>
                <p className="mt-2 text-sm text-slate-500 leading-relaxed">{item.desc}</p>
                <a
                  href={`mailto:${item.email}?subject=${encodeURIComponent(item.subject)}`}
                  className="mt-6 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-red-500 to-red-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-red-200 hover:shadow-md hover:shadow-red-200 transition-all"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                  Get a Quote
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Service Schedule */}
      {schedules.length > 0 && (
        <section className="py-24 bg-slate-50">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-2xl mx-auto">
              <p className="text-sm font-semibold uppercase tracking-wider text-red-600">Schedule</p>
              <h2 className="mt-3 text-3xl font-bold text-slate-900 sm:text-4xl">
                Weekly Service Schedule
              </h2>
              <p className="mt-4 text-slate-500 leading-relaxed">
                See where we&apos;re delivering each day of the week.
              </p>
            </div>
            <div className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {(() => {
                const DAY_ORDER = ["MONDAY","TUESDAY","WEDNESDAY","THURSDAY","FRIDAY","SATURDAY","SUNDAY"];
                const DAY_LABELS: Record<string, string> = { MONDAY:"Mon", TUESDAY:"Tue", WEDNESDAY:"Wed", THURSDAY:"Thu", FRIDAY:"Fri", SATURDAY:"Sat", SUNDAY:"Sun" };
                const DAY_FULL: Record<string, string> = { MONDAY:"Monday", TUESDAY:"Tuesday", WEDNESDAY:"Wednesday", THURSDAY:"Thursday", FRIDAY:"Friday", SATURDAY:"Saturday", SUNDAY:"Sunday" };
                const grouped = DAY_ORDER.map(d => ({ day: d, items: schedules.filter(s => s.dayOfWeek === d) })).filter(g => g.items.length > 0);
                return grouped.map(({ day, items }) => (
                  <div key={day} className="rounded-2xl border border-slate-200 bg-white p-5 hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-100 text-sm font-bold text-red-600">
                        {DAY_LABELS[day]}
                      </span>
                      <span className="text-sm font-semibold text-slate-900">{DAY_FULL[day]}</span>
                    </div>
                    <div className="space-y-2">
                      {items.map((s) => (
                        <div key={s.id} className="rounded-lg bg-slate-50 px-3 py-2">
                          <p className="text-sm font-medium text-slate-800">{s.serviceArea.name}</p>
                          <p className="text-xs text-slate-500">
                            {formatScheduleTime(s.startTime)} – {formatScheduleTime(s.endTime)}
                          </p>
                          {s.description && (
                            <p className="mt-0.5 text-xs text-slate-400">{s.description}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ));
              })()}
            </div>
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="relative overflow-hidden py-24">
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat grayscale"
          style={{ backgroundImage: "url('/bg.jpeg')" }}
        />
        <div className="absolute inset-0 bg-black/75" />
        <div className="absolute inset-0 bg-gradient-to-br from-red-950/30 via-transparent to-red-950/20" />

        <div className="relative mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-white sm:text-5xl leading-tight">
            Ready to never visit a gas station again?
          </h2>
          <p className="mt-6 text-lg text-slate-300 max-w-lg mx-auto leading-relaxed">
            Subscribe, set your recurring day, and we handle the rest. Your tank stays full without you lifting a finger.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <Link
              href={session ? "/profile" : "/signup"}
              className="group rounded-xl bg-gradient-to-r from-red-500 to-red-600 px-8 py-4 text-sm font-semibold text-white shadow-lg shadow-red-500/20 hover:shadow-xl hover:shadow-red-500/30 hover:from-red-400 hover:to-red-500 transition-all"
            >
              Set Up Weekly Delivery
              <span className="inline-block ml-2 group-hover:translate-x-0.5 transition-transform">&rarr;</span>
            </Link>
            <Link
              href={session ? "/order" : "/order/guest"}
              className="rounded-xl border border-slate-600 px-8 py-4 text-sm font-semibold text-slate-300 hover:bg-white/5 hover:border-slate-500 transition-all"
            >
              One-Time Order Instead
            </Link>
          </div>
          <p className="mt-6 text-xs text-slate-400">
            {`$35/mo · 1 free weekly top-off included · Cancel anytime · $${Math.round(deliveryFeeCents / 100)} per delivery without subscription`}
          </p>
        </div>
      </section>
    </div>
  );
}
