"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { loadStripe, type PaymentRequest } from "@stripe/stripe-js";
import {
  Elements,
  CardElement,
  PaymentRequestButtonElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!
);

function PaymentForm({ orderId, total, clientSecret, isFillUp }: { orderId: string; total: number; clientSecret: string; isFillUp?: boolean }) {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();
  const [error, setError] = useState("");
  const [processing, setProcessing] = useState(false);
  const [paymentRequest, setPaymentRequest] = useState<PaymentRequest | null>(null);
  const [walletAvailable, setWalletAvailable] = useState(false);

  // Set up Apple Pay / Google Pay via Payment Request API
  useEffect(() => {
    if (!stripe) return;

    const pr = stripe.paymentRequest({
      country: "US",
      currency: "usd",
      total: {
        label: "OTG Fueling",
        amount: total,
      },
      requestPayerName: true,
      requestPayerEmail: true,
    });

    pr.canMakePayment().then((result) => {
      if (result) {
        setPaymentRequest(pr);
        setWalletAvailable(true);
      }
    });

    pr.on("paymentmethod", async (ev) => {
      const { error: confirmError, paymentIntent } =
        await stripe.confirmCardPayment(
          clientSecret,
          { payment_method: ev.paymentMethod.id },
          { handleActions: false }
        );

      if (confirmError) {
        ev.complete("fail");
        setError(confirmError.message || "Payment failed");
      } else {
        ev.complete("success");
        if (paymentIntent?.status === "requires_action") {
          const { error: actionError } = await stripe.confirmCardPayment(clientSecret);
          if (actionError) {
            setError(actionError.message || "Payment failed");
          } else {
            router.push(`/order/confirmation?orderId=${orderId}`);
          }
        } else {
          router.push(`/order/confirmation?orderId=${orderId}`);
        }
      }
    });
  }, [stripe, total, clientSecret, orderId, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;

    const cardElement = elements.getElement(CardElement);
    if (!cardElement) return;

    setProcessing(true);
    setError("");

    const { error: stripeError } = await stripe.confirmCardPayment(clientSecret, {
      payment_method: { card: cardElement },
    });

    if (stripeError) {
      setError(stripeError.message || "Payment failed");
      setProcessing(false);
    } else {
      router.push(`/order/confirmation?orderId=${orderId}`);
    }
  }

  return (
    <div className="space-y-6">
      {/* Apple Pay / Google Pay button */}
      {walletAvailable && paymentRequest && (
        <div>
          <PaymentRequestButtonElement
            options={{
              paymentRequest,
              style: {
                paymentRequestButton: {
                  type: "default",
                  theme: "dark",
                  height: "48px",
                },
              },
            }}
          />
          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-white px-3 text-slate-400">or pay with card</span>
            </div>
          </div>
        </div>
      )}

      {/* Card form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="rounded-lg border border-slate-200 p-4 focus-within:border-red-400 focus-within:ring-1 focus-within:ring-red-400 transition-colors">
          <CardElement
            options={{
              style: {
                base: {
                  fontSize: "16px",
                  color: "#1e293b",
                  fontFamily: "system-ui, sans-serif",
                  "::placeholder": { color: "#94a3b8" },
                },
                invalid: { color: "#ef4444" },
              },
              hidePostalCode: false,
            }}
          />
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {isFillUp && (
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-700">
            <strong>Fill-up order:</strong> We charge $1.00 now to verify your card. After we finish fueling, we charge the exact amount pumped and release the $1.00.
          </div>
        )}
        <button
          type="submit"
          disabled={!stripe || processing}
          className="w-full rounded-xl bg-gradient-to-r from-red-500 to-red-600 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-red-500/25 hover:shadow-xl hover:shadow-red-500/35 hover:from-red-400 hover:to-red-500 transition-all disabled:opacity-50 disabled:shadow-none"
        >
          {processing ? "Processing..." : isFillUp ? "Verify Card — $1.00" : `Pay $${(total / 100).toFixed(2)}`}
        </button>
      </form>
    </div>
  );
}

function PaymentPageContent() {
  const searchParams = useSearchParams();
  const clientSecret = searchParams.get("secret");
  const orderId = searchParams.get("orderId");
  const total = parseInt(searchParams.get("total") || "0");
  const isFillUp = searchParams.get("fillup") === "1";

  if (!clientSecret || !orderId) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-gray-500">Invalid payment session.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <h1 className="text-2xl font-bold text-gray-900">
        {isFillUp ? "Verify Your Card" : "Complete Payment"}
      </h1>
      <p className="mt-1 text-sm text-gray-500">
        {isFillUp
          ? "Enter your card details to save for the final charge after fueling."
          : "Pay securely with card, Apple Pay, or Google Pay."}
      </p>

      <div className="mt-6 rounded-xl bg-white p-6 shadow-sm">
        <Elements
          stripe={stripePromise}
          options={{
            clientSecret,
            appearance: {
              theme: "stripe",
              variables: {
                colorPrimary: "#ea580c",
              },
            },
          }}
        >
          <PaymentForm orderId={orderId} total={total} clientSecret={clientSecret} isFillUp={isFillUp} />
        </Elements>
      </div>
    </div>
  );
}

export default function PaymentPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center">
          <p className="text-gray-500">Loading payment...</p>
        </div>
      }
    >
      <PaymentPageContent />
    </Suspense>
  );
}
