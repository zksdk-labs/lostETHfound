"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, createConfig, http } from "wagmi";
import { metaMask } from "wagmi/connectors";
import { hardhat, sepolia } from "wagmi/chains";
import { useState } from "react";

const sepoliaRpc =
  process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL ||
  process.env.NEXT_PUBLIC_RPC_URL ||
  undefined;

const config = createConfig({
  chains: [sepolia, hardhat],
  connectors: [
    metaMask({
      dappMetadata: {
        name: "LostETHFound",
      },
    }),
  ],
  transports: {
    [sepolia.id]: http(sepoliaRpc),
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
