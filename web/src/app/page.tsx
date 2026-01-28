import Link from "next/link";
import { Nav } from "@/components/Nav";

export default function Home() {
  return (
    <div className="min-h-screen">
      <Nav />
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 pb-20">
        <section className="rounded-[32px] border border-black/10 bg-[var(--card)] p-8 shadow-glow backdrop-blur md:p-12">
          <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">
            Global lost & found registry
          </p>
          <h1 className="mt-4 text-4xl font-semibold leading-tight md:text-6xl">
            Lost something? Report it. Found something? Return it.
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-[var(--muted)]">
            Open to anyone, verifiable on Ethereum. Your personal details never go on‑chain—only a
            proof that you own it.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/register"
              className="rounded-full bg-[var(--accent)] px-6 py-3 text-sm font-semibold text-black shadow-glow"
            >
              Report lost
            </Link>
            <Link
              href="/claim"
              className="rounded-full border border-black/20 px-6 py-3 text-sm font-semibold"
            >
              Report found
            </Link>
            <Link
              href="/how-it-works"
              className="rounded-full border border-black/10 px-6 py-3 text-sm font-semibold text-[var(--muted)]"
            >
              How it works
            </Link>
          </div>
        </section>

        <section className="grid gap-6 md:grid-cols-2">
          <div className="rounded-3xl border border-black/10 bg-white/60 p-6 backdrop-blur">
            <h2 className="text-xl font-semibold">Fast return (hidden code)</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Add a hidden code to your item. A finder can prove they saw it and receive the bounty
              instantly, without learning anything else about you.
            </p>
            <ul className="mt-4 space-y-2 text-sm">
              <li>• Perfect for MacBooks, phones, tagged cards</li>
              <li>• Works with QR, sticker, sleeve tag, or hidden phrase</li>
              <li>• One‑time return, no personal data on‑chain</li>
            </ul>
          </div>
          <div className="rounded-3xl border border-black/10 bg-white/60 p-6 backdrop-blur">
            <h2 className="text-xl font-semibold">Owner‑verified (no code)</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">
              For items without a tag. The finder answers a few hints, you confirm, then release the
              bounty when it feels right.
            </p>
            <ul className="mt-4 space-y-2 text-sm">
              <li>• Great for jewelry, sunglasses, bags without tags</li>
              <li>• Private messaging + guided questions</li>
              <li>• You stay in control</li>
            </ul>
          </div>
        </section>
      </main>
    </div>
  );
}
