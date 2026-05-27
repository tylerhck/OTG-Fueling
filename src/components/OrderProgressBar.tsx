"use client";

const STEPS = ["CONFIRMED", "IN_PROGRESS", "COMPLETED"] as const;
const STEP_LABELS: Record<string, string> = {
  CONFIRMED: "Confirmed",
  IN_PROGRESS: "En Route",
  COMPLETED: "Delivered",
};

function stepIndex(status: string): number {
  if (status === "AWAITING_PAYMENT" || status === "PENDING") return -1;
  if (status === "CANCELLED") return -2;
  return STEPS.indexOf(status as (typeof STEPS)[number]);
}

function CheckIcon() {
  return (
    <svg className="h-4 w-4 text-white" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  );
}

function StepIcon({ step, isActive, isCurrent, isCompleted }: { step: string; isActive: boolean; isCurrent: boolean; isCompleted: boolean }) {
  // Heroicons Outline — clipboard-check, truck, home-modern
  const icons: Record<string, React.ReactNode> = {
    CONFIRMED: (
      // Heroicons: clipboard-document-check
      <svg className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.35 3.836c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15a2.25 2.25 0 011.65 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 3.98 8.25 4.693 8.25 5.57v1.18m5.8-2.914c.376.023.75.05 1.124.08 .631.062 1.476.775 1.476 1.652v1.182M8.25 6.75h7.5M8.25 6.75l-1.5.75m1.5-.75v3m7.5-3l1.5.75m-1.5-.75v3m-9 3.75h10.5M6.75 13.5v3.75a2.25 2.25 0 002.25 2.25h6a2.25 2.25 0 002.25-2.25V13.5" />
      </svg>
    ),
    IN_PROGRESS: (
      // Heroicons: truck (clean, recognizable)
      <svg className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0H21M3.375 14.25h3.375m0 0V11.25m0 3H12M6.75 11.25h4.875c.621 0 1.125-.504 1.125-1.125V6.375c0-.621-.504-1.125-1.125-1.125H6.75m0 6v-6m0 0H3.375c-.621 0-1.125.504-1.125 1.125v3.75c0 .621.504 1.125 1.125 1.125" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12.75 5.25h3.007a1.125 1.125 0 01.986.588l1.632 2.993c.1.183.153.39.153.6v4.694h-4.653a1.125 1.125 0 01-1.125-1.125V5.25z" />
      </svg>
    ),
    COMPLETED: (
      // Heroicons: map-pin (delivered to location)
      <svg className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
      </svg>
    ),
  };

  if (isCompleted) return <CheckIcon />;
  return <span className={isActive ? "text-white" : isCurrent ? "text-red-500" : "text-slate-400"}>{icons[step]}</span>;
}

export default function OrderProgressBar({
  status,
  etaMinutes,
}: {
  status: string;
  etaMinutes?: number | null;
}) {
  const isCancelled = status === "CANCELLED";
  const isAwaitingPayment = status === "AWAITING_PAYMENT";
  const isPending = status === "PENDING";
  const currentIdx = stepIndex(status);

  if (isCancelled) {
    return (
      <div className="rounded-2xl border border-red-200 bg-gradient-to-r from-red-50 to-red-100/50 p-5">
        <div className="flex items-center justify-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
            <svg className="h-5 w-5 text-red-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-red-800">Order Cancelled</p>
            <p className="text-xs text-red-600">This order has been cancelled</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-6 shadow-sm">
      {/* Steps */}
      <div className="relative flex items-start justify-between">
        {/* Connecting line (behind dots) */}
        <div className="absolute top-5 left-5 right-5 h-[2px] bg-slate-200" />
        <div
          className="absolute top-5 left-5 h-[2px] bg-gradient-to-r from-red-500 to-red-400 transition-all duration-700 ease-out"
          style={{
            width: isPending
              ? "0%"
              : currentIdx >= STEPS.length - 1
                ? "calc(100% - 40px)"
                : `calc(${(currentIdx / (STEPS.length - 1)) * 100}% - ${currentIdx * 2}px)`,
          }}
        />

        {STEPS.map((step, i) => {
          const isCompleted = i < currentIdx;
          const isCurrent = i === currentIdx;
          const isActive = i <= currentIdx && !isPending;

          return (
            <div key={step} className="relative z-10 flex flex-col items-center" style={{ width: "80px" }}>
              {/* Circle */}
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all duration-500 ${
                  isActive
                    ? "border-red-500 bg-gradient-to-br from-red-500 to-red-600 shadow-lg shadow-red-500/25"
                    : "border-slate-200 bg-white"
                } ${isCurrent && !isCompleted ? "ring-4 ring-red-100" : ""}`}
              >
                <StepIcon step={step} isActive={isActive} isCurrent={isCurrent} isCompleted={isCompleted} />
              </div>

              {/* Label */}
              <span
                className={`mt-2 text-xs font-medium text-center leading-tight ${
                  isCurrent
                    ? "text-red-600 font-semibold"
                    : isActive
                      ? "text-red-500"
                      : "text-slate-400"
                }`}
              >
                {STEP_LABELS[step]}
              </span>

              {/* Pulse on current step */}
              {isCurrent && !isPending && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2">
                  <div className="h-10 w-10 animate-ping rounded-full bg-red-400/20" />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ETA banner */}
      {etaMinutes != null && status !== "COMPLETED" && (
        <div className="mt-5 flex items-center justify-center gap-2.5 rounded-xl bg-red-50 border border-red-100 px-4 py-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-100">
            <svg className="h-4 w-4 text-red-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p className="text-xs text-red-600/80">Estimated Arrival</p>
            <p className="text-sm font-bold text-red-700">~{etaMinutes} minutes</p>
          </div>
        </div>
      )}

      {/* Awaiting payment state message */}
      {isAwaitingPayment && (
        <div className="mt-5 flex items-center justify-center gap-2.5 rounded-xl bg-slate-50 border border-slate-200 px-4 py-3">
          <div className="h-2 w-2 rounded-full bg-slate-400 animate-pulse" />
          <p className="text-sm text-slate-600">Payment processing…</p>
        </div>
      )}

      {/* Pending state message */}
      {isPending && (
        <div className="mt-5 flex items-center justify-center gap-2.5 rounded-xl bg-amber-50 border border-amber-100 px-4 py-3">
          <div className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
          <p className="text-sm text-amber-700">Payment received — awaiting confirmation from our team</p>
        </div>
      )}
    </div>
  );
}
