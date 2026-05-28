"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";

export default function Footer() {
  const [showContact, setShowContact] = useState(false);

  return (
    <>
      <footer className="border-t border-slate-200/80 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
            <div className="flex items-center gap-2.5">
              <Image
                src="/OTG-Logo.png"
                alt="On The Go Fueling"
                width={36}
                height={36}
                className="rounded-lg"
              />
              <span className="text-sm font-semibold text-slate-900 tracking-tight">On The Go Fueling</span>
            </div>
            <div className="flex flex-wrap justify-center gap-6 text-sm">
              <Link href="/" className="text-slate-500 hover:text-red-600 transition-colors">Home</Link>
              <Link href="/terms" className="text-slate-500 hover:text-red-600 transition-colors">Terms of Service</Link>
              <Link href="/privacy" className="text-slate-500 hover:text-red-600 transition-colors">Privacy Policy</Link>
              <button
                onClick={() => setShowContact(true)}
                className="text-slate-500 hover:text-red-600 transition-colors"
              >
                Contact
              </button>
            </div>
            <p className="text-xs text-slate-400">
              &copy; {new Date().getFullYear()} On The Go Fueling. All rights reserved.
            </p>
          </div>
        </div>
      </footer>

      {/* Contact Popup */}
      {showContact && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowContact(false)}>
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900">Contact Us</h3>
              <button
                onClick={() => setShowContact(false)}
                className="text-slate-400 hover:text-slate-600 text-xl leading-none"
              >
                &times;
              </button>
            </div>
            <p className="text-sm text-slate-600 mb-3">
              Have questions or need help? Reach out to us at:
            </p>
            <a
              href="mailto:otgfuelingllc@gmail.com"
              className="inline-flex items-center gap-2 text-red-600 font-medium hover:text-red-700 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              otgfuelingllc@gmail.com
            </a>
          </div>
        </div>
      )}
    </>
  );
}
