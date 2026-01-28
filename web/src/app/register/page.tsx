"use client";

import { useState } from "react";
import { Nav } from "@/components/Nav";
import {
  categoryIdFromLabel,
  commitmentFrom,
  formatHex,
  parseField,
  parseSecretInput,
  toBytes32,
} from "@/lib/zk";
import { DEFAULT_CATEGORY, itemCategories, resolveCategoryLabel } from "@/lib/categories";
import { lostETHFoundAbi } from "@/lib/contracts";
import { useAccount, useWriteContract } from "wagmi";
import { parseEther, stringToHex } from "viem";

export default function RegisterPage() {
  const [categoryChoice, setCategoryChoice] = useState(DEFAULT_CATEGORY);
  const [customCategory, setCustomCategory] = useState("");
  const [secretInput, setSecretInput] = useState("");
  const [itemSaltInput, setItemSaltInput] = useState("0");
  const [rewardEth, setRewardEth] = useState("0");
  const [encryptedContact, setEncryptedContact] = useState("0x");
  const [contractAddress, setContractAddress] = useState(
    process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || ""
  );
  const [categoryId, setCategoryId] = useState<bigint | null>(null);
  const [commitment, setCommitment] = useState<bigint | null>(null);
  const [status, setStatus] = useState<string>("");
  const [copyStatus, setCopyStatus] = useState("");

  const resolvedCategory = resolveCategoryLabel(categoryChoice, customCategory);
  const { address } = useAccount();
  const { writeContractAsync, isPending } = useWriteContract();

  const buildSerialCode = () => {
    const bytes = new Uint8Array(15);
    crypto.getRandomValues(bytes);

    let value = 0n;
    for (const byte of bytes) {
      value = (value << 8n) + BigInt(byte);
    }

    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const totalChars = 24;
    let raw = "";

    for (let i = 0; i < totalChars; i += 1) {
      const index = Number(value % 32n);
      raw = alphabet[index] + raw;
      value /= 32n;
    }

    const groups: string[] = [];
    for (let i = 0; i < totalChars; i += 4) {
      groups.push(raw.slice(i, i + 4));
    }

    return `LF-${groups.join("-")}`;
  };

  const handleGenerateSecret = () => {
    setSecretInput(buildSerialCode());
    setCopyStatus("");
  };

  const handleCopySecret = async () => {
    const code = secretInput.trim();
    if (!code) {
      setCopyStatus("Generate a return code first.");
      return;
    }

    try {
      await navigator.clipboard.writeText(code);
      setCopyStatus("Copied to clipboard.");
    } catch (error) {
      setCopyStatus(`Copy failed: ${String(error)}`);
    }
  };

  const handleCompute = async () => {
    setStatus("");
    const secret = parseSecretInput(secretInput);
    if (secret === null) {
      setStatus("Enter a valid return code.");
      return;
    }
    if (!resolvedCategory) {
      setStatus("Choose an item type or enter a custom one.");
      return;
    }

    const itemSalt = parseField(itemSaltInput) ?? 0n;
    setStatus("Computing commitment...");
    const nextCategoryId = await categoryIdFromLabel(resolvedCategory);
    const nextCommitment = await commitmentFrom(secret, nextCategoryId, itemSalt);

    setCategoryId(nextCategoryId);
    setCommitment(nextCommitment);
    setStatus("Ready to post to the registry.");
  };

  const handleRegister = async () => {
    if (!commitment || !contractAddress) {
      setStatus("Compute commitment and enter contract address first.");
      return;
    }

    try {
      setStatus("Sending to the registry...");
      const contactBytes = encryptedContact.trim().startsWith("0x")
        ? encryptedContact.trim()
        : stringToHex(encryptedContact.trim());

      const rewardWei = parseEther(rewardEth || "0");

      await writeContractAsync({
        address: contractAddress as `0x${string}`,
        abi: lostETHFoundAbi,
        functionName: "registerItem",
        args: [toBytes32(commitment), contactBytes as `0x${string}`, rewardWei],
        value: rewardWei,
      });

      setStatus("Return tag posted. Confirm in wallet.");
    } catch (error) {
      setStatus(`Post failed: ${String(error)}`);
    }
  };

  return (
    <div className="min-h-screen">
      <Nav />
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 pb-20">
        <section className="rounded-[28px] border border-black/10 bg-white/70 p-8 shadow-glow backdrop-blur">
          <h1 className="text-3xl font-semibold">Add a return tag</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Use this before the item is lost. Generate a serial return code, put it on the item
            (sticker, sleeve tag, inside case), then post the proof on-chain. Your details stay
            private.
          </p>

          <div className="mt-6 grid gap-5 md:grid-cols-2">
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
                Pick a type the finder can recognize from the item.
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
              <p className="text-xs text-[var(--muted)]">Leave at 0 if you don’t want a bounty.</p>
            </label>
          </div>

          <label className="mt-5 flex flex-col gap-2 text-sm">
            Return serial code (put on the item)
            <div className="flex flex-wrap gap-2">
              <input
                className="min-w-[220px] flex-1 rounded-xl border border-black/15 bg-white/80 px-4 py-3"
                value={secretInput}
                onChange={(event) => setSecretInput(event.target.value)}
                placeholder="Tap Generate Serial"
              />
              <button
                type="button"
                className="rounded-xl border border-black/15 px-4 py-3 text-sm"
                onClick={handleGenerateSecret}
              >
                Generate serial
              </button>
              <button
                type="button"
                className="rounded-xl border border-black/15 px-4 py-3 text-sm"
                onClick={handleCopySecret}
              >
                Copy code
              </button>
            </div>
            <p className="text-xs text-[var(--muted)]">
              Put this exact code on the item (inside case/sleeve, under sticker, etc). A finder
              needs it to return your item.
            </p>
            <div className="rounded-3xl border border-black/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.9),rgba(255,236,204,0.9))] p-5 shadow-[0_24px_60px_rgba(28,26,23,0.12)]">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.4em] text-[var(--muted)]">
                    Return code
                  </p>
                  <p className="mt-3 break-all font-mono text-xl tracking-[0.25em] md:text-2xl">
                    {secretInput.trim() || "LF-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX"}
                  </p>
                </div>
                <div className="rounded-full border border-black/15 bg-white/80 px-3 py-1 text-[10px] uppercase tracking-[0.3em] text-[var(--muted)]">
                  LostETHFound
                </div>
              </div>
              <p className="mt-3 text-xs text-[var(--muted)]">
                Print or engrave this serial. Keep a backup for yourself.
              </p>
              {copyStatus && <p className="mt-2 text-xs text-[var(--muted)]">{copyStatus}</p>}
            </div>
          </label>

          <label className="mt-5 flex flex-col gap-2 text-sm">
            Contact for return (private)
            <textarea
              className="min-h-[120px] rounded-xl border border-black/15 bg-white/80 px-4 py-3"
              value={encryptedContact}
              onChange={(event) => setEncryptedContact(event.target.value)}
              placeholder="For demo: email or Telegram (use burner)."
            />
            <p className="text-xs text-[var(--muted)]">
              For the demo, you can paste contact info. In production this would be encrypted.
            </p>
          </label>

          <div className="mt-6 grid gap-3 md:grid-cols-2">
            <button
              type="button"
              className="w-full rounded-full border border-black/20 px-6 py-3 text-sm font-semibold"
              onClick={handleCompute}
            >
              Compute commitment
            </button>
            <button
              type="button"
              disabled={!address || !commitment || isPending}
              className="w-full rounded-full bg-[var(--accent)] px-6 py-3 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:opacity-50"
              onClick={handleRegister}
            >
              {isPending ? "Sending..." : "Post to registry"}
            </button>
          </div>

          {status && <p className="mt-4 text-sm text-[var(--muted)]">{status}</p>}
          <details className="mt-6 rounded-2xl border border-black/10 bg-white/80 p-4 text-sm">
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
        </section>

        <section className="rounded-[28px] border border-black/10 bg-white/70 p-6 text-sm">
          <h2 className="text-lg font-semibold">Proof details (optional)</h2>
          <p className="mt-2 text-xs text-[var(--muted)]">
            You can ignore this unless you want to inspect the on-chain proof data.
          </p>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-black/10 bg-white/80 p-4">
              <p className="text-xs uppercase text-[var(--muted)]">Item type ID (internal)</p>
              <p className="mt-2 break-all font-mono text-xs">
                {categoryId ? formatHex(categoryId) : "—"}
              </p>
            </div>
            <div className="rounded-2xl border border-black/10 bg-white/80 p-4">
              <p className="text-xs uppercase text-[var(--muted)]">Commitment</p>
              <p className="mt-2 break-all font-mono text-xs">
                {commitment ? formatHex(commitment) : "—"}
              </p>
              {commitment && (
                <p className="mt-2 break-all font-mono text-[10px] text-[var(--muted)]">
                  bytes32: {toBytes32(commitment)}
                </p>
              )}
            </div>
          </div>

          <p className="mt-4 text-xs text-[var(--muted)]">
            Post the bytes32 commitment on-chain via the contract. Keep the return code safe — it
            is the only way to prove a valid return.
          </p>
        </section>

      </main>
    </div>
  );
}
