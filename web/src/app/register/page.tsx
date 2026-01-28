"use client";

import { useState } from "react";
import { Nav } from "@/components/Nav";
import {
  categoryIdFromLabel,
  commitmentFrom,
  formatHex,
  parseField,
  randomField,
  toBytes32,
} from "@/lib/zk";
import { lostETHFoundAbi } from "@/lib/contracts";
import { useAccount, useWriteContract } from "wagmi";
import { parseEther, stringToHex } from "viem";

export default function RegisterPage() {
  const [category, setCategory] = useState("electronics");
  const [secretInput, setSecretInput] = useState("");
  const [itemSaltInput, setItemSaltInput] = useState("0");
  const [rewardEth, setRewardEth] = useState("0.01");
  const [encryptedContact, setEncryptedContact] = useState("0x");
  const [contractAddress, setContractAddress] = useState(
    process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || ""
  );
  const [categoryId, setCategoryId] = useState<bigint | null>(null);
  const [commitment, setCommitment] = useState<bigint | null>(null);
  const [status, setStatus] = useState<string>("");

  const { address } = useAccount();
  const { writeContractAsync, isPending } = useWriteContract();

  const handleGenerateSecret = () => {
    const secret = randomField();
    setSecretInput(formatHex(secret));
  };

  const handleCompute = async () => {
    setStatus("");
    const secret = parseField(secretInput);
    if (secret === null) {
      setStatus("Enter a valid secret (hex or bigint).");
      return;
    }

    const itemSalt = parseField(itemSaltInput) ?? 0n;
    setStatus("Computing commitment...");
    const nextCategoryId = await categoryIdFromLabel(category);
    const nextCommitment = await commitmentFrom(secret, nextCategoryId, itemSalt);

    setCategoryId(nextCategoryId);
    setCommitment(nextCommitment);
    setStatus("Ready to register on-chain.");
  };

  const handleRegister = async () => {
    if (!commitment || !contractAddress) {
      setStatus("Compute commitment and enter contract address first.");
      return;
    }

    try {
      setStatus("Sending register transaction...");
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

      setStatus("Register tx sent. Confirm in wallet.");
    } catch (error) {
      setStatus(`Register failed: ${String(error)}`);
    }
  };

  return (
    <div className="min-h-screen">
      <Nav />
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 pb-20">
        <section className="rounded-[28px] border border-black/10 bg-white/70 p-8 shadow-glow backdrop-blur">
          <h1 className="text-3xl font-semibold">Register a lost item</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Trustless lane: store a secret with the item (QR, sleeve tag, sticker, hidden phrase).
            This page computes the on-chain commitment locally.
          </p>

          <div className="mt-6 grid gap-5 md:grid-cols-2">
            <label className="flex flex-col gap-2 text-sm">
              Contract address
              <input
                className="rounded-xl border border-black/15 bg-white/80 px-4 py-3 font-mono text-xs"
                value={contractAddress}
                onChange={(event) => setContractAddress(event.target.value)}
                placeholder="0x..."
              />
            </label>

            <label className="flex flex-col gap-2 text-sm">
              Category label
              <input
                className="rounded-xl border border-black/15 bg-white/80 px-4 py-3"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
              />
            </label>

            <label className="flex flex-col gap-2 text-sm">
              Secret (store on item)
              <div className="flex gap-2">
                <input
                  className="flex-1 rounded-xl border border-black/15 bg-white/80 px-4 py-3"
                  value={secretInput}
                  onChange={(event) => setSecretInput(event.target.value)}
                  placeholder="0x..."
                />
                <button
                  type="button"
                  className="rounded-xl border border-black/15 px-4 py-3 text-sm"
                  onClick={handleGenerateSecret}
                >
                  Generate
                </button>
              </div>
            </label>

            <label className="flex flex-col gap-2 text-sm">
              Item salt (optional, keep on item if used)
              <input
                className="rounded-xl border border-black/15 bg-white/80 px-4 py-3"
                value={itemSaltInput}
                onChange={(event) => setItemSaltInput(event.target.value)}
                placeholder="0x0"
              />
            </label>

            <label className="flex flex-col gap-2 text-sm">
              Reward (ETH)
              <input
                className="rounded-xl border border-black/15 bg-white/80 px-4 py-3"
                value={rewardEth}
                onChange={(event) => setRewardEth(event.target.value)}
                placeholder="0.01"
              />
            </label>
          </div>

          <label className="mt-5 flex flex-col gap-2 text-sm">
            Encrypted contact (bytes or 0x-hex)
            <textarea
              className="min-h-[120px] rounded-xl border border-black/15 bg-white/80 px-4 py-3 font-mono text-xs"
              value={encryptedContact}
              onChange={(event) => setEncryptedContact(event.target.value)}
            />
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
              {isPending ? "Sending..." : "Register on-chain"}
            </button>
          </div>

          {status && <p className="mt-4 text-sm text-[var(--muted)]">{status}</p>}
        </section>

        <section className="rounded-[28px] border border-black/10 bg-white/70 p-6 text-sm">
          <h2 className="text-lg font-semibold">Computed values</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-black/10 bg-white/80 p-4">
              <p className="text-xs uppercase text-[var(--muted)]">Category ID</p>
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
            Register the bytes32 commitment on-chain via the contract. Keep the secret safe — it is
            the only way to claim.
          </p>
        </section>

        <section className="rounded-[28px] border border-black/10 bg-white/70 p-6 text-sm">
          <h2 className="text-lg font-semibold">Assisted lane (owner-verified)</h2>
          <p className="mt-2 text-xs text-[var(--muted)]">
            For items without a secret. Store salted answers or encrypted contact info for the
            owner to verify. This is a UI stub for the MVP.
          </p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-2 text-sm">
              Encrypted contact (placeholder)
              <textarea
                className="min-h-[120px] rounded-xl border border-black/15 bg-white/80 px-4 py-3"
                placeholder="Paste encrypted contact blob here"
              />
            </label>
            <div className="grid gap-3">
              {[
                "What color is it?",
                "Where was it lost?",
                "What accessory is attached?",
              ].map((question) => (
                <label key={question} className="flex flex-col gap-2 text-sm">
                  {question}
                  <input
                    className="rounded-xl border border-black/15 bg-white/80 px-4 py-3"
                    placeholder="Answer (salted / hashed locally)"
                  />
                </label>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
