"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const adminLinks = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/schedule", label: "Schedule" },
  { href: "/admin/service-area", label: "Service Area" },
  { href: "/admin/pricing", label: "Fuel Pricing" },
  { href: "/admin/orders", label: "Orders", badge: true },
  { href: "/admin/recurring", label: "Recurring" },
  { href: "/admin/kill-list", label: "Kill List" },
  { href: "/admin/ban-list", label: "Ban List" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/walk-up", label: "Walk-Up" },
  { href: "/admin/bookkeeping", label: "Bookkeeping" },
  { href: "/admin/pool", label: "🎱 Pool" },
  { href: "/admin/security", label: "🔒 Security" },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [activeCount, setActiveCount] = useState(0);

  const fetchActiveCount = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/orders/active-count");
      if (res.ok) {
        const data = await res.json();
        setActiveCount(data.count || 0);
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (status === "authenticated") {
      fetchActiveCount();
      // Poll every 30 seconds
      const interval = setInterval(fetchActiveCount, 30000);
      return () => clearInterval(interval);
    }
  }, [status, fetchActiveCount]);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/signin");
    } else if (
      status === "authenticated" &&
      (session?.user as { role?: string })?.role !== "ADMIN"
    ) {
      router.push("/");
    }
  }, [status, session, router]);

  if (
    status === "loading" ||
    (session?.user as { role?: string })?.role !== "ADMIN"
  ) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Mobile nav */}
      <div className="mb-6 flex flex-wrap gap-2 md:hidden">
        {adminLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`relative rounded-lg px-3 py-1.5 text-xs font-medium ${
              pathname === link.href
                ? "bg-red-100 text-red-700"
                : "bg-gray-100 text-gray-700"
            }`}
          >
            {link.label}
            {link.badge && activeCount > 0 && (
              <span className="ml-1 inline-flex items-center justify-center rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-bold text-white min-w-[18px]">
                {activeCount}
              </span>
            )}
          </Link>
        ))}
      </div>

      <div className="flex gap-8">
        {/* Sidebar */}
        <nav className="hidden w-48 flex-shrink-0 md:block">
          <div className="space-y-1">
            {adminLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium ${
                  pathname === link.href
                    ? "bg-red-100 text-red-700"
                    : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                {link.label}
                {link.badge && activeCount > 0 && (
                  <span className="inline-flex items-center justify-center rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-bold text-white min-w-[18px]">
                    {activeCount}
                  </span>
                )}
              </Link>
            ))}
          </div>
        </nav>

        {/* Content */}
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
