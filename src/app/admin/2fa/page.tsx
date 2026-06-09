"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function TwoFactorSetupPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [step, setStep] = useState<"start" | "scan" | "verify" | "done">("start");
  const [qrCode, setQrCode] = useState("");
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function generateSecret() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/2fa/setup");
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to generate 2FA secret");
        setLoading(false);
        return;
      }
      const data = await res.json();
      setQrCode(data.qrCode);
      setSecret(data.secret);
      setStep("scan");
    } catch {
      setError("Failed to connect to server");
    }
    setLoading(false);
  }

  async function verifyAndEnable() {
    if (code.length !== 6) {
      setError("Please enter the 6-digit code");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/2fa/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret, code }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Verification failed");
        setLoading(false);
        return;
      }
      setStep("done");
    } catch {
      setError("Failed to verify code");
    }
    setLoading(false);
  }

  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="text-center mb-6">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
              <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h1 className="mt-4 text-xl font-bold text-slate-900">
              {step === "done" ? "2FA Enabled!" : "Set Up Two-Factor Authentication"}
            </h1>
          </div>

          {error && (
            <div className="mb-4 rounded-xl bg-red-50 border border-red-200 p-3.5 text-sm font-medium text-red-700">
              {error}
            </div>
          )}

          {step === "start" && (
            <div className="space-y-4">
              <p className="text-sm text-slate-600">
                Two-factor authentication adds an extra layer of security. You will need <strong>Google Authenticator</strong> on your phone.
              </p>
              <div className="rounded-xl bg-amber-50 border border-amber-200 p-4">
                <p className="text-xs text-amber-700">
                  <strong>Before you start:</strong> Download Google Authenticator from the App Store or Play Store.
                </p>
              </div>
              <button
                onClick={generateSecret}
                disabled={loading}
                className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? "Generating..." : "Start Setup"}
              </button>
            </div>
          )}

          {step === "scan" && (
            <div className="space-y-4">
              <p className="text-sm text-slate-600">
                Open Google Authenticator and scan this QR code:
              </p>
              {qrCode && (
                <div className="flex justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qrCode} alt="2FA QR Code" width={200} height={200} className="rounded-lg" />
                </div>
              )}
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
                <p className="text-xs text-slate-500 mb-1">Or enter this code manually:</p>
                <p className="font-mono text-xs text-slate-700 break-all select-all">{secret}</p>
              </div>
              <button
                onClick={() => setStep("verify")}
                className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700"
              >
                I have Scanned It →
              </button>
            </div>
          )}

          {step === "verify" && (
            <div className="space-y-4">
              <p className="text-sm text-slate-600">
                Enter the 6-digit code shown in Google Authenticator:
              </p>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                className="block w-full rounded-xl border border-slate-300 px-4 py-3 text-center text-2xl font-mono tracking-[0.5em] text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                placeholder="000000"
                autoFocus
              />
              <button
                onClick={verifyAndEnable}
                disabled={loading || code.length !== 6}
                className="w-full rounded-xl bg-green-600 px-4 py-3 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
              >
                {loading ? "Verifying..." : "Enable 2FA"}
              </button>
              <button
                onClick={() => setStep("scan")}
                className="w-full text-xs text-slate-500 hover:text-slate-700"
              >
                ← Back to QR code
              </button>
            </div>
          )}

          {step === "done" && (
            <div className="space-y-4 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                <svg className="h-8 w-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-sm text-slate-600">
                Two-factor authentication is now active. You will need your authenticator app every time you sign in.
              </p>
              <button
                onClick={() => router.push("/admin/orders")}
                className="w-full rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white hover:bg-red-700"
              >
                Go to Admin Panel
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
