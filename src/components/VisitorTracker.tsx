"use client";

import { useEffect } from "react";

// Fires once per browser session on public pages.
// Checks for the otg_vid cookie to distinguish new vs returning visitors.
export default function VisitorTracker() {
  useEffect(() => {
    const hasCookie = document.cookie
      .split(";")
      .some((c) => c.trim().startsWith("otg_vid="));

    const isNewVisitor = !hasCookie;

    if (isNewVisitor) {
      // Set 1-year cookie so repeat visits don't count as new
      const expires = new Date(
        Date.now() + 365 * 24 * 60 * 60 * 1000
      ).toUTCString();
      document.cookie = `otg_vid=1; expires=${expires}; path=/; SameSite=Lax`;
    }

    fetch("/api/track-visit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isNewVisitor }),
    }).catch(() => {});
  }, []);

  return null;
}
