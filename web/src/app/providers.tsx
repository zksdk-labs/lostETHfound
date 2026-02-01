"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, createConfig, http } from "wagmi";
import { metaMask } from "wagmi/connectors";
import { hardhat, sepolia, baseSepolia } from "wagmi/chains";
import { useState } from "react";

// Use env var for RPC to avoid rate limits on public endpoint
const baseSepoliaRpc =
  process.env.NEXT_PUBLIC_RPC_URL || "https://sepolia.base.org";

const config = createConfig({
  chains: [baseSepolia, sepolia, hardhat],
  connectors: [
    metaMask({
      dappMetadata: {
        name: "LostETHFound",
      },
    }),
  ],
  transports: {
    [baseSepolia.id]: http(baseSepoliaRpc),
    [sepolia.id]: http(),
    [hardhat.id]: http("http://127.0.0.1:8545"),
  },
  ssr: true,
});

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiProvider config={config} reconnectOnMount={false}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
