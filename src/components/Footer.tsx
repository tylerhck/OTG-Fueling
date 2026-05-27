import Link from "next/link";
import Image from "next/image";

export default function Footer() {
  return (
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
          <div className="flex gap-8 text-sm">
            <Link href="/" className="text-slate-500 hover:text-red-600 transition-colors">Home</Link>
          </div>
          <p className="text-xs text-slate-400">
            &copy; {new Date().getFullYear()} On The Go Fueling. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
