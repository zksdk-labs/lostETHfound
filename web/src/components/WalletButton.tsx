"use client";

import { useAccount, useConnect, useDisconnect } from "wagmi";

export function WalletButton() {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();

  const connector = connectors[0];

  if (!connector) {
    return (
      <span className="rounded-full border border-black/15 px-4 py-2 text-xs text-[var(--muted)]">
        No wallet
      </span>
    );
  }

  if (!isConnected) {
    return (
      <button
        type="button"
        onClick={() => connect({ connector })}
        className="rounded-full border border-black/20 px-4 py-2 text-xs font-semibold"
      >
        {isPending ? "Connecting..." : "Connect wallet"}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => disconnect()}
      className="rounded-full border border-black/20 px-4 py-2 text-xs font-semibold"
    >
      {address?.slice(0, 6)}…{address?.slice(-4)}
    </button>
  );
}
