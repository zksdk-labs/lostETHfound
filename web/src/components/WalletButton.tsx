"use client";

import { useAccount, useConnect, useDisconnect } from "wagmi";

export function WalletButton() {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending, error } = useConnect();
  const { disconnect } = useDisconnect();

  const connector = connectors[0];

  if (!connector) {
    return (
      <a
        href="https://metamask.io/download/"
        target="_blank"
        rel="noopener noreferrer"
        className="rounded-full border border-black/15 px-4 py-2 text-xs text-[var(--muted)] hover:border-black/30"
      >
        Install MetaMask
      </a>
    );
  }

  if (!isConnected) {
    const handleConnect = async () => {
      try {
        await connect({ connector });
      } catch (err) {
        console.error("Failed to connect wallet:", err);
      }
    };

    return (
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleConnect}
          className="rounded-full border border-black/20 px-4 py-2 text-xs font-semibold"
        >
          {isPending ? "Connecting..." : "Connect wallet"}
        </button>
        {error && (
          <span className="text-xs text-red-500">
            {error.message.includes("Provider")
              ? "Unlock MetaMask"
              : "Connection failed"}
          </span>
        )}
      </div>
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
