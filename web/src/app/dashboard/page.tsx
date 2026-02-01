"use client";

import { useEffect, useState, useMemo } from "react";
import { Nav } from "@/components/Nav";
import { Chat } from "@/components/Chat";
import {
  lostETHFoundAbi,
  ItemStatus,
  getStatusLabel,
  getStatusColor,
} from "@/lib/contracts";
import { itemCategories } from "@/lib/categories";
import { categoryIdFromLabel, toBytes32 } from "@/lib/zk";
import { useAccount, useWriteContract } from "wagmi";
import {
  parseAbiItem,
  formatEther,
  parseEther,
  createPublicClient,
  http,
} from "viem";
import { baseSepolia } from "wagmi/chains";

interface OwnedItem {
  tokenId: bigint;
  status: number;
  reward: bigint;
  finder: string;
  isTagged: boolean;
  categoryId: string;
  categoryLabel: string;
  threshold: number;
  imageUri: string;
}

export default function DashboardPage() {
  const [items, setItems] = useState<OwnedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [bountyAmounts, setBountyAmounts] = useState<Record<string, string>>(
    {}
  );
  const [returnCodes, setReturnCodes] = useState<Record<string, string>>({});
  const [contractAddress] = useState(
    process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || ""
  );

  const { address } = useAccount();
  const { writeContractAsync, isPending } = useWriteContract();

  // Use dedicated Base Sepolia client for reads (memoized to prevent infinite loops)
  const publicClient = useMemo(
    () =>
      createPublicClient({
        chain: baseSepolia,
        transport: http(
          process.env.NEXT_PUBLIC_RPC_URL || "https://sepolia.base.org"
        ),
      }),
    []
  );

  // Fetch owned items
  useEffect(() => {
    if (!address || !publicClient || !contractAddress) {
      setLoading(false);
      return;
    }

    const fetchItems = async () => {
      setLoading(true);
      try {
        // Build category lookup map
        const categoryMap = new Map<string, string>();
        for (const cat of itemCategories) {
          if (cat.value !== "other") {
            const id = await categoryIdFromLabel(cat.value);
            categoryMap.set(toBytes32(id), cat.label);
          }
        }

        // Get all ItemRegistered events where owner is current address
        const event = parseAbiItem(
          "event ItemRegistered(uint256 indexed tokenId, address indexed owner, bytes32 indexed commitment, bytes32 categoryId, uint256 reward, bool isTagged)"
        );

        const logs = await publicClient.getLogs({
          address: contractAddress as `0x${string}`,
          event,
          args: { owner: address },
          fromBlock: BigInt(process.env.NEXT_PUBLIC_DEPLOYMENT_BLOCK || "0"),
        });

        const ownedItems: OwnedItem[] = [];

        for (const log of logs) {
          const tokenId = log.args.tokenId;
          if (!tokenId) continue;

          try {
            // Check if user still owns this item
            const owner = await publicClient.readContract({
              address: contractAddress as `0x${string}`,
              abi: lostETHFoundAbi,
              functionName: "ownerOf",
              args: [tokenId],
            });

            if (owner !== address) continue;

            // Get item details
            const itemData = (await publicClient.readContract({
              address: contractAddress as `0x${string}`,
              abi: lostETHFoundAbi,
              functionName: "getItem",
              args: [tokenId],
            })) as [
              string,
              string,
              number,
              bigint,
              number,
              string,
              boolean,
              string
            ];

            const categoryIdHex = itemData[1] as string;
            const categoryLabel = categoryMap.get(categoryIdHex) || "Custom";

            // Fetch tokenURI for the SVG image
            let imageUri = "";
            try {
              const tokenUri = (await publicClient.readContract({
                address: contractAddress as `0x${string}`,
                abi: lostETHFoundAbi,
                functionName: "tokenURI",
                args: [tokenId],
              })) as string;

              // Decode base64 JSON to extract image
              const jsonBase64 = tokenUri.replace(
                "data:application/json;base64,",
                ""
              );
              const json = JSON.parse(atob(jsonBase64));
              imageUri = json.image || "";
            } catch {
              // tokenURI might fail for some items
            }

            ownedItems.push({
              tokenId,
              status: itemData[4],
              reward: itemData[3],
              finder: itemData[5],
              isTagged: itemData[6],
              categoryId: categoryIdHex,
              categoryLabel,
              threshold: itemData[2],
              imageUri,
            });
          } catch {
            // Item may have been transferred or burned
            continue;
          }
        }

        setItems(ownedItems);
      } catch (error) {
        console.error("Failed to fetch items:", error);
        setStatus(`Failed to load items: ${String(error)}`);
      }
      setLoading(false);
    };

    fetchItems();
  }, [address, publicClient, contractAddress]);

  const handleActivateBounty = async (tokenId: bigint) => {
    const amount = bountyAmounts[tokenId.toString()] || "0";
    if (!amount || parseFloat(amount) <= 0) {
      setStatus("Enter a bounty amount.");
      return;
    }

    try {
      setStatus("Activating bounty...");
      await writeContractAsync({
        address: contractAddress as `0x${string}`,
        abi: lostETHFoundAbi,
        functionName: "activateBounty",
        args: [tokenId],
        value: parseEther(amount),
      });

      setStatus("Bounty activated!");
      // Refresh items
      window.location.reload();
    } catch (error) {
      setStatus(`Failed to activate bounty: ${String(error)}`);
    }
  };

  const handleConfirmReturn = async (tokenId: bigint) => {
    try {
      setStatus("Confirming return...");
      await writeContractAsync({
        address: contractAddress as `0x${string}`,
        abi: lostETHFoundAbi,
        functionName: "confirmReturn",
        args: [tokenId],
      });

      setStatus("Return confirmed! Finder has received their reward.");
      // Refresh items
      window.location.reload();
    } catch (error) {
      setStatus(`Failed to confirm return: ${String(error)}`);
    }
  };

  const handleMarkAsLost = async (tokenId: bigint) => {
    try {
      setStatus("Marking as lost...");
      await writeContractAsync({
        address: contractAddress as `0x${string}`,
        abi: lostETHFoundAbi,
        functionName: "markAsLost",
        args: [tokenId],
      });

      setStatus("Item marked as lost.");
      window.location.reload();
    } catch (error) {
      setStatus(`Failed to mark as lost: ${String(error)}`);
    }
  };

  const handleMarkAsActive = async (tokenId: bigint) => {
    try {
      setStatus("Marking as active...");
      await writeContractAsync({
        address: contractAddress as `0x${string}`,
        abi: lostETHFoundAbi,
        functionName: "markAsActive",
        args: [tokenId],
      });

      setStatus("Item marked as active.");
      window.location.reload();
    } catch (error) {
      setStatus(`Failed to mark as active: ${String(error)}`);
    }
  };

  if (!address) {
    return (
      <div className="min-h-screen">
        <Nav />
        <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 pb-20">
          <section className="rounded-[28px] border border-black/10 bg-white/70 p-8 shadow-glow backdrop-blur">
            <h1 className="text-3xl font-semibold">Owner Dashboard</h1>
            <p className="mt-4 text-[var(--muted)]">
              Connect your wallet to view your registered items.
            </p>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Nav />
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 pb-20">
        <section className="rounded-[28px] border border-black/10 bg-white/70 p-8 shadow-glow backdrop-blur">
          <h1 className="text-3xl font-semibold">Owner Dashboard</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Manage your registered items. Activate bounties on lost items and
            confirm returns when finders claim them.
          </p>

          {status && (
            <p className="mt-4 text-sm text-[var(--muted)]">{status}</p>
          )}

          {loading ? (
            <p className="mt-6 text-[var(--muted)]">Loading items...</p>
          ) : items.length === 0 ? (
            <p className="mt-6 text-[var(--muted)]">
              No items found. Register an item first.
            </p>
          ) : (
            <div className="mt-6 grid gap-4">
              {items.map((item) => (
                <div
                  key={item.tokenId.toString()}
                  className="overflow-hidden rounded-2xl border border-black/10 bg-white/80"
                >
                  <div className="flex flex-col md:flex-row">
                    {/* NFT Image */}
                    {item.imageUri && (
                      <div className="md:w-48 flex-shrink-0 bg-gradient-to-br from-slate-900 to-slate-800 p-4">
                        <img
                          src={item.imageUri}
                          alt={`Item #${item.tokenId.toString()}`}
                          className="w-full rounded-lg shadow-lg"
                        />
                      </div>
                    )}

                    <div className="flex-1 p-5">
                      <div className="flex items-center gap-3">
                        <h3 className="text-xl font-semibold">
                          {item.categoryLabel}
                        </h3>
                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-medium ${getStatusColor(
                            item.status
                          )}`}
                        >
                          {getStatusLabel(item.status)}
                        </span>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-xs uppercase tracking-wide text-[var(--muted)]">
                            Token
                          </p>
                          <p className="font-medium">
                            #{item.tokenId.toString()}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-wide text-[var(--muted)]">
                            Type
                          </p>
                          <p className="font-medium">
                            {item.isTagged ? "Tagged" : "Question-based"}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-wide text-[var(--muted)]">
                            Threshold
                          </p>
                          <p className="font-medium">
                            {item.threshold} of 5 correct
                          </p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-wide text-[var(--muted)]">
                            Bounty
                          </p>
                          <p className="font-medium text-green-600">
                            {formatEther(item.reward)} ETH
                          </p>
                        </div>
                      </div>

                      {item.finder &&
                        item.finder !==
                          "0x0000000000000000000000000000000000000000" && (
                          <div className="mt-3">
                            <p className="text-xs uppercase tracking-wide text-[var(--muted)]">
                              Finder
                            </p>
                            <p className="font-mono text-sm">
                              {item.finder.slice(0, 6)}...
                              {item.finder.slice(-4)}
                            </p>
                          </div>
                        )}

                      {/* Actions */}
                      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-black/5 pt-4">
                        {/* Active -> Lost */}
                        {item.status === ItemStatus.Active && (
                          <button
                            type="button"
                            onClick={() => handleMarkAsLost(item.tokenId)}
                            disabled={isPending}
                            className="rounded-full border border-red-300 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
                          >
                            Mark as Lost
                          </button>
                        )}

                        {/* Lost -> Active */}
                        {item.status === ItemStatus.Lost && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleMarkAsActive(item.tokenId)}
                              disabled={isPending}
                              className="rounded-full border border-blue-300 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50"
                            >
                              Mark as Found
                            </button>
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                placeholder="ETH"
                                value={
                                  bountyAmounts[item.tokenId.toString()] || ""
                                }
                                onChange={(e) =>
                                  setBountyAmounts((prev) => ({
                                    ...prev,
                                    [item.tokenId.toString()]: e.target.value,
                                  }))
                                }
                                className="w-20 rounded-xl border border-black/15 bg-white px-3 py-2 text-sm"
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  handleActivateBounty(item.tokenId)
                                }
                                disabled={isPending}
                                className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-medium text-black hover:opacity-90 disabled:opacity-50"
                              >
                                Add Bounty
                              </button>
                            </div>
                          </>
                        )}

                        {/* Found -> Confirm Return */}
                        {item.status === ItemStatus.Found && (
                          <button
                            type="button"
                            onClick={() => handleConfirmReturn(item.tokenId)}
                            disabled={isPending}
                            className="rounded-full bg-green-500 px-4 py-2 text-sm font-medium text-white hover:bg-green-600 disabled:opacity-50"
                          >
                            Confirm Return & Pay Reward
                          </button>
                        )}

                        {/* Returned - no actions */}
                        {item.status === ItemStatus.Returned && (
                          <span className="text-sm text-green-600">
                            Successfully returned
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Chat with finder when item is Found */}
                  {item.status === ItemStatus.Found && (
                    <div className="mt-4 border-t border-black/10 pt-4">
                      {returnCodes[item.tokenId.toString()] ? (
                        <Chat
                          returnCode={returnCodes[item.tokenId.toString()]}
                          isOwner={true}
                        />
                      ) : (
                        <div className="rounded-xl border border-black/10 bg-white/80 p-4">
                          <p className="mb-2 text-sm text-gray-600">
                            Enter your return code to chat with the finder:
                          </p>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              placeholder="LF-XXXX-XXXX-XXXX..."
                              className="flex-1 rounded-lg border border-black/15 px-3 py-2 font-mono text-sm"
                              onChange={(e) =>
                                setReturnCodes((prev) => ({
                                  ...prev,
                                  [`temp_${item.tokenId.toString()}`]:
                                    e.target.value,
                                }))
                              }
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const code =
                                  returnCodes[
                                    `temp_${item.tokenId.toString()}`
                                  ];
                                if (code?.trim()) {
                                  setReturnCodes((prev) => ({
                                    ...prev,
                                    [item.tokenId.toString()]: code.trim(),
                                  }));
                                }
                              }}
                              className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium"
                            >
                              Open Chat
                            </button>
                          </div>
                          <p className="mt-2 text-xs text-gray-400">
                            This is the code you received when registering this
                            item.
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Placeholder for "no tag" flow */}
          <p className="mt-6 text-center text-xs text-[var(--muted)]">
            Lost an item without a return tag?{" "}
            <span className="opacity-60">Report Lost Item coming soon.</span>
          </p>
        </section>
      </main>
    </div>
  );
}
