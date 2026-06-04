"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const adminLinks = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/schedule", label: "Schedule" },
  { href: "/admin/service-area", label: "Service Area" },
  { href: "/admin/pricing", label: "Fuel Pricing" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/recurring", label: "Recurring" },
  { href: "/admin/kill-list", label: "Kill List" },
  { href: "/admin/ban-list", label: "Ban List" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/waitlist", label: "Waitlist" },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();

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
            className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
              pathname === link.href
                ? "bg-red-100 text-red-700"
                : "bg-gray-100 text-gray-700"
            }`}
          >
            {link.label}
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
                className={`block rounded-lg px-3 py-2 text-sm font-medium ${
                  pathname === link.href
                    ? "bg-red-100 text-red-700"
                    : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                {link.label}
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
