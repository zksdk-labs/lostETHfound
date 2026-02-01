import Link from "next/link";
import { WalletButton } from "@/components/WalletButton";

export function Nav() {
  return (
    <nav className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-6 py-6">
      <Link href="/" className="text-lg font-semibold tracking-tight">
        LostETHFound
      </Link>
      <div className="flex items-center gap-3 text-sm">
        <Link
          className="rounded-full border border-black/15 px-4 py-2 hover:border-black/40"
          href="/register"
        >
          Add a Return Tag
        </Link>
        <Link
          className="rounded-full border border-black/15 px-4 py-2 hover:border-black/40"
          href="/claim"
        >
          Report Found
        </Link>
        <Link
          className="rounded-full border border-black/15 px-4 py-2 hover:border-black/40"
          href="/dashboard"
        >
          Dashboard
        </Link>
        <Link
          className="rounded-full border border-black/10 px-4 py-2 text-[var(--muted)] hover:border-black/40"
          href="/how-it-works"
        >
          How it works
        </Link>
        <WalletButton />
      </div>
    </nav>
  );
}
