import { Nav } from "@/components/Nav";

export default function HowItWorks() {
  return (
    <div className="min-h-screen">
      <Nav />
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 pb-20">
        <section className="rounded-[28px] border border-black/10 bg-white/70 p-8 shadow-glow backdrop-blur">
          <h1 className="text-3xl font-semibold">How it works</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">
            LostETHFound is a public registry for lost items. It’s open to everyone, and it keeps
            personal details private while still proving ownership.
          </p>
        </section>

        <section className="grid gap-6 md:grid-cols-2">
          <div className="rounded-3xl border border-black/10 bg-white/60 p-6 backdrop-blur">
            <h2 className="text-xl font-semibold">If you lost something</h2>
            <ol className="mt-3 space-y-2 text-sm text-[var(--muted)]">
              <li>1) Report your lost item in the registry.</li>
              <li>2) Add a hidden return code (QR, sticker, sleeve tag, inside case).</li>
              <li>3) Set a bounty for the finder (optional).</li>
              <li>4) When it’s found, you can release the bounty safely.</li>
            </ol>
          </div>
          <div className="rounded-3xl border border-black/10 bg-white/60 p-6 backdrop-blur">
            <h2 className="text-xl font-semibold">If you found something</h2>
            <ol className="mt-3 space-y-2 text-sm text-[var(--muted)]">
              <li>1) Enter the hidden return code if it exists.</li>
              <li>2) Prove you saw it without revealing the code.</li>
              <li>3) Return the item and receive the bounty.</li>
            </ol>
          </div>
        </section>

        <section className="rounded-3xl border border-black/10 bg-white/60 p-6 backdrop-blur">
          <h2 className="text-xl font-semibold">Privacy first</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Personal details stay off‑chain. The registry only stores a proof that you own the item
            (or that a finder saw the hidden code). This keeps the registry public and safe to use.
          </p>
        </section>

        <section className="rounded-3xl border border-black/10 bg-white/60 p-6 backdrop-blur">
          <h2 className="text-xl font-semibold">Two ways to recover items</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-black/10 bg-white/80 p-4">
              <h3 className="text-sm font-semibold">Fast return (hidden code)</h3>
              <p className="mt-2 text-sm text-[var(--muted)]">
                Best for MacBooks, phones, cards. A hidden code makes the return instant and fully
                trustless.
              </p>
            </div>
            <div className="rounded-2xl border border-black/10 bg-white/80 p-4">
              <h3 className="text-sm font-semibold">Owner‑verified (no code)</h3>
              <p className="mt-2 text-sm text-[var(--muted)]">
                For items without a code. The finder answers a few hints; you confirm and release
                the bounty.
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
