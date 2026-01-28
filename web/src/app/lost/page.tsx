"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Nav } from "@/components/Nav";
import { DEFAULT_CATEGORY, itemCategories, resolveCategoryLabel } from "@/lib/categories";
import {
  categoryIdFromLabel,
  commitmentFrom,
  formatHex,
  parseField,
  parseSecretInput,
  toBytes32,
} from "@/lib/zk";
import { lostETHFoundAbi } from "@/lib/contracts";
import { usePublicClient, useReadContract, useWriteContract } from "wagmi";
import { formatEther, parseAbiItem, stringToHex, zeroAddress } from "viem";

type FlowMode = "tag" | "noTag";
type FoundReport = {
  reportId: string;
  reporter: string;
  message: string;
  blockNumber: bigint;
};

export default function LostPage() {
  const [mode, setMode] = useState<FlowMode>("tag");
  const [categoryChoice, setCategoryChoice] = useState(DEFAULT_CATEGORY);
  const [customCategory, setCustomCategory] = useState("");
  const [secretInput, setSecretInput] = useState("");
  const [itemSaltInput, setItemSaltInput] = useState("0");
  const [contractAddress, setContractAddress] = useState(
    process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || ""
  );
  const [commitment, setCommitment] = useState<bigint | null>(null);
  const [tagStatus, setTagStatus] = useState("");
  const [rewardEth, setRewardEth] = useState("0");
  const [contact, setContact] = useState("");
  const [hintColor, setHintColor] = useState("");
  const [hintLocation, setHintLocation] = useState("");
  const [hintTime, setHintTime] = useState("");
  const [hintDetail, setHintDetail] = useState("");
  const [status, setStatus] = useState("");
  const [searchStatus, setSearchStatus] = useState("");
  const [foundReports, setFoundReports] = useState<FoundReport[]>([]);

  const resolvedCategory = resolveCategoryLabel(categoryChoice, customCategory);
  const commitmentBytes = commitment ? toBytes32(commitment) : null;
  const publicClient = usePublicClient();
  const { writeContractAsync, isPending } = useWriteContract();
  const deploymentBlock = BigInt(process.env.NEXT_PUBLIC_DEPLOYMENT_BLOCK || "0");

  const { data: itemData, isFetching } = useReadContract({
    address: contractAddress ? (contractAddress as `0x${string}`) : undefined,
    abi: lostETHFoundAbi,
    functionName: "items",
    args: commitmentBytes ? [commitmentBytes] : undefined,
    query: {
      enabled: Boolean(contractAddress && commitmentBytes),
    },
  });

  useEffect(() => {
    if (!commitment) {
      return;
    }
    if (isFetching) {
      setTagStatus("Checking the registry...");
      return;
    }
    if (!itemData) {
      return;
    }
    const [owner, , reward, claimed] = itemData as [
      `0x${string}`,
      `0x${string}`,
      bigint,
      boolean,
    ];

    if (owner === zeroAddress) {
      setTagStatus("No registry entry yet. Post your return tag first.");
      return;
    }

    if (claimed) {
      setTagStatus("A finder has submitted a claim. Check your wallet for the bounty transfer.");
      return;
    }

    const bounty = reward > 0n ? `${formatEther(reward)} ETH bounty` : "No bounty set";
    setTagStatus(`Registered. No claim yet. ${bounty}.`);
  }, [commitment, isFetching, itemData]);

  const handleCheckTag = async () => {
    setTagStatus("");
    const secret = parseSecretInput(secretInput);
    if (secret === null) {
      setTagStatus("Enter a valid return tag code.");
      return;
    }
    if (!resolvedCategory) {
      setTagStatus("Choose an item type or enter a custom one.");
      return;
    }
    if (!contractAddress) {
      setTagStatus("Enter the registry contract address.");
      return;
    }

    const itemSalt = parseField(itemSaltInput) ?? 0n;
    const nextCategoryId = await categoryIdFromLabel(resolvedCategory);
    const nextCommitment = await commitmentFrom(secret, nextCategoryId, itemSalt);
    setCommitment(nextCommitment);
    setTagStatus("Checking the registry...");
  };

  const handlePost = async () => {
    if (!resolvedCategory) {
      setStatus("Choose an item type or enter a custom one.");
      return;
    }
    if (!contractAddress) {
      setStatus("Enter the registry contract address.");
      return;
    }

    try {
      setStatus("Sending lost report...");
      const catId = await categoryIdFromLabel(resolvedCategory);
      const contactBytes = contact.trim()
        ? contact.trim().startsWith("0x")
          ? contact.trim()
          : stringToHex(contact.trim())
        : "0x";

      const hintsPayload = JSON.stringify(
        {
          color: hintColor.trim(),
          location: hintLocation.trim(),
          time: hintTime.trim(),
          detail: hintDetail.trim(),
        },
        null,
        0
      );
      const hintsBytes = hintsPayload.trim()
        ? hintsPayload.trim().startsWith("0x")
          ? hintsPayload.trim()
          : stringToHex(hintsPayload.trim())
        : "0x";

      await writeContractAsync({
        address: contractAddress as `0x${string}`,
        abi: lostETHFoundAbi,
        functionName: "reportLost",
        args: [toBytes32(catId), contactBytes as `0x${string}`, hintsBytes as `0x${string}`],
      });

      setStatus("Lost report sent. Confirm in wallet.");
    } catch (error) {
      setStatus(`Report failed: ${String(error)}`);
    }
  };

  const handleSearchFound = async () => {
    setSearchStatus("");
    setFoundReports([]);
    if (!resolvedCategory) {
      setSearchStatus("Choose an item type or enter a custom one.");
      return;
    }
    if (!contractAddress) {
      setSearchStatus("Enter the registry contract address.");
      return;
    }
    if (!publicClient) {
      setSearchStatus("Wallet client not ready.");
      return;
    }

    try {
      setSearchStatus("Searching found reports...");
      const catId = await categoryIdFromLabel(resolvedCategory);
      const event = parseAbiItem(
        "event FoundReported(bytes32 indexed reportId, bytes32 indexed categoryId, address indexed reporter, bytes encryptedMessage)"
      );

      const logs = await publicClient.getLogs({
        address: contractAddress as `0x${string}`,
        event,
        args: { categoryId: toBytes32(catId) },
        fromBlock: deploymentBlock,
      });

      const nextReports: FoundReport[] = logs.map((log) => {
        const args = log.args as {
          reportId: `0x${string}`;
          categoryId: `0x${string}`;
          reporter: `0x${string}`;
          encryptedMessage: `0x${string}`;
        };
        return {
          reportId: args.reportId,
          reporter: args.reporter,
          message: args.encryptedMessage,
          blockNumber: log.blockNumber ?? 0n,
        };
      });

      setFoundReports(nextReports);
      setSearchStatus(nextReports.length ? "" : "No found reports yet.");
    } catch (error) {
      setSearchStatus(`Search failed: ${String(error)}`);
    }
  };

  return (
    <div className="min-h-screen">
      <Nav />
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 pb-20">
        <section className="rounded-[28px] border border-black/10 bg-white/70 p-8 shadow-glow backdrop-blur">
          <h1 className="text-3xl font-semibold">Report a lost item</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">
            If the item already has a return tag, use it to check the registry. If it doesn’t, use
            the owner‑verified flow with private hints.
          </p>

          <div className="mt-6 inline-flex rounded-full border border-black/15 bg-white/80 p-1 text-sm">
            <button
              type="button"
              className={`rounded-full px-4 py-2 ${
                mode === "tag" ? "bg-[var(--accent)] text-black" : "text-[var(--muted)]"
              }`}
              onClick={() => setMode("tag")}
            >
              Has a return tag
            </button>
            <button
              type="button"
              className={`rounded-full px-4 py-2 ${
                mode === "noTag" ? "bg-[var(--accent)] text-black" : "text-[var(--muted)]"
              }`}
              onClick={() => setMode("noTag")}
            >
              No return tag
            </button>
          </div>

          {mode === "tag" ? (
            <div className="mt-6 grid gap-5">
              <div className="grid gap-5 md:grid-cols-2">
                <label className="flex flex-col gap-2 text-sm">
                  Item type
                  <select
                    className="rounded-xl border border-black/15 bg-white/80 px-4 py-3"
                    value={categoryChoice}
                    onChange={(event) => setCategoryChoice(event.target.value)}
                  >
                    {itemCategories.map((category) => (
                      <option key={category.value} value={category.value}>
                        {category.label}
                      </option>
                    ))}
                  </select>
                </label>

                {categoryChoice === "other" && (
                  <label className="flex flex-col gap-2 text-sm">
                    Custom item type
                    <input
                      className="rounded-xl border border-black/15 bg-white/80 px-4 py-3"
                      value={customCategory}
                      onChange={(event) => setCustomCategory(event.target.value)}
                      placeholder="e.g. camera"
                    />
                  </label>
                )}
              </div>

              <label className="flex flex-col gap-2 text-sm">
                Return tag code
                <input
                  className="rounded-xl border border-black/15 bg-white/80 px-4 py-3"
                  value={secretInput}
                  onChange={(event) => setSecretInput(event.target.value)}
                  placeholder="Code from the tag"
                />
                <p className="text-xs text-[var(--muted)]">
                  Use the code you placed on the item. We only check the on‑chain proof.
                </p>
              </label>

              <div className="grid gap-3 md:grid-cols-2">
                <button
                  type="button"
                  className="w-full rounded-full bg-[var(--accent)] px-6 py-3 text-sm font-semibold text-black"
                  onClick={handleCheckTag}
                >
                  Check registry status
                </button>
                <Link
                  href="/register"
                  className="flex w-full items-center justify-center rounded-full border border-black/15 px-6 py-3 text-sm font-semibold"
                >
                  Add a return tag
                </Link>
              </div>

              {tagStatus && <p className="text-sm text-[var(--muted)]">{tagStatus}</p>}

              {commitment && (
                <div className="rounded-2xl border border-black/10 bg-white/80 p-4 text-xs">
                  <p className="text-[var(--muted)]">Commitment (internal)</p>
                  <p className="mt-2 break-all font-mono">{formatHex(commitment)}</p>
                  <p className="mt-2 break-all font-mono text-[10px] text-[var(--muted)]">
                    bytes32: {commitmentBytes}
                  </p>
                </div>
              )}

              <details className="rounded-2xl border border-black/10 bg-white/80 p-4 text-sm">
                <summary className="cursor-pointer font-semibold">Advanced</summary>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <label className="flex flex-col gap-2 text-sm">
                    Registry contract
                    <input
                      className="rounded-xl border border-black/15 bg-white/80 px-4 py-3 font-mono text-xs"
                      value={contractAddress}
                      onChange={(event) => setContractAddress(event.target.value)}
                      placeholder="0x..."
                    />
                  </label>
                  <label className="flex flex-col gap-2 text-sm">
                    Item salt (optional)
                    <input
                      className="rounded-xl border border-black/15 bg-white/80 px-4 py-3"
                      value={itemSaltInput}
                      onChange={(event) => setItemSaltInput(event.target.value)}
                      placeholder="0"
                    />
                  </label>
                </div>
              </details>
            </div>
          ) : (
            <div className="mt-6 grid gap-5">
              <div className="grid gap-5 md:grid-cols-2">
                <label className="flex flex-col gap-2 text-sm">
                  Item type
                  <select
                    className="rounded-xl border border-black/15 bg-white/80 px-4 py-3"
                    value={categoryChoice}
                    onChange={(event) => setCategoryChoice(event.target.value)}
                  >
                    {itemCategories.map((category) => (
                      <option key={category.value} value={category.value}>
                        {category.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-[var(--muted)]">
                    Pick the type a finder would recognize immediately.
                  </p>
                </label>

                {categoryChoice === "other" && (
                  <label className="flex flex-col gap-2 text-sm">
                    Custom item type
                    <input
                      className="rounded-xl border border-black/15 bg-white/80 px-4 py-3"
                      value={customCategory}
                      onChange={(event) => setCustomCategory(event.target.value)}
                      placeholder="e.g. camera"
                    />
                  </label>
                )}

                <label className="flex flex-col gap-2 text-sm">
                  Bounty (ETH, optional)
                  <input
                    className="rounded-xl border border-black/15 bg-white/80 px-4 py-3"
                    value={rewardEth}
                    onChange={(event) => setRewardEth(event.target.value)}
                    placeholder="0"
                  />
                  <p className="text-xs text-[var(--muted)]">
                    For no-tag items, this is a pledge (not escrowed in the demo).
                  </p>
                </label>
              </div>

              <label className="flex flex-col gap-2 text-sm">
                Contact for return (private)
                <textarea
                  className="min-h-[120px] rounded-xl border border-black/15 bg-white/80 px-4 py-3"
                  value={contact}
                  onChange={(event) => setContact(event.target.value)}
                  placeholder="For demo: email or Telegram (use burner)."
                />
                <p className="text-xs text-[var(--muted)]">
                  For the demo, you can paste contact info. In production this would be encrypted.
                </p>
              </label>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="flex flex-col gap-2 text-sm">
                  Color / material
                  <input
                    className="rounded-xl border border-black/15 bg-white/80 px-4 py-3"
                    value={hintColor}
                    onChange={(event) => setHintColor(event.target.value)}
                    placeholder="e.g. matte black, leather"
                  />
                </label>
                <label className="flex flex-col gap-2 text-sm">
                  Where was it lost?
                  <input
                    className="rounded-xl border border-black/15 bg-white/80 px-4 py-3"
                    value={hintLocation}
                    onChange={(event) => setHintLocation(event.target.value)}
                    placeholder="e.g. Nimman Road café"
                  />
                </label>
                <label className="flex flex-col gap-2 text-sm">
                  When did you last see it?
                  <input
                    className="rounded-xl border border-black/15 bg-white/80 px-4 py-3"
                    value={hintTime}
                    onChange={(event) => setHintTime(event.target.value)}
                    placeholder="e.g. Jan 27, 8–9pm"
                  />
                </label>
                <label className="flex flex-col gap-2 text-sm">
                  Unique detail
                  <input
                    className="rounded-xl border border-black/15 bg-white/80 px-4 py-3"
                    value={hintDetail}
                    onChange={(event) => setHintDetail(event.target.value)}
                    placeholder="e.g. sticker, scratch, engraving"
                  />
                </label>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <button
                  type="button"
                  disabled={isPending}
                  className="w-full rounded-full bg-[var(--accent)] px-6 py-3 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={handlePost}
                >
                  {isPending ? "Sending..." : "Post lost report"}
                </button>
                <button
                  type="button"
                  className="w-full rounded-full border border-black/15 px-6 py-3 text-sm font-semibold"
                  onClick={handleSearchFound}
                >
                  Search found reports
                </button>
              </div>

              {status && <p className="text-sm text-[var(--muted)]">{status}</p>}
              {searchStatus && <p className="text-sm text-[var(--muted)]">{searchStatus}</p>}

              {foundReports.length > 0 && (
                <div className="grid gap-3">
                  {foundReports.map((report) => (
                    <div
                      key={`${report.reportId}-${report.blockNumber}`}
                      className="rounded-2xl border border-black/10 bg-white/80 p-4 text-xs"
                    >
                      <p className="text-[var(--muted)]">Found report</p>
                      <p className="mt-2 break-all font-mono text-[10px]">
                        Report ID: {report.reportId}
                      </p>
                      <p className="mt-2 break-all font-mono text-[10px]">
                        Reporter: {report.reporter}
                      </p>
                      <p className="mt-2 break-all font-mono text-[10px]">
                        Message: {report.message}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              <details className="rounded-2xl border border-black/10 bg-white/80 p-4 text-sm">
                <summary className="cursor-pointer font-semibold">Advanced</summary>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <label className="flex flex-col gap-2 text-sm">
                    Registry contract
                    <input
                      className="rounded-xl border border-black/15 bg-white/80 px-4 py-3 font-mono text-xs"
                      value={contractAddress}
                      onChange={(event) => setContractAddress(event.target.value)}
                      placeholder="0x..."
                    />
                  </label>
                </div>
              </details>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
