"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import ReferralSourceModal from "@/components/ReferralSourceModal";

export default function WelcomePage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [showModal, setShowModal] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/signin");
    }
  }, [status, router]);

  function handleComplete() {
    setShowModal(false);
    router.push("/");
  }

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-500"></div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      {showModal && <ReferralSourceModal onComplete={handleComplete} />}
    </div>
  );
}
