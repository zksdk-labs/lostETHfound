"use client";

import { useState } from "react";
import { Nav } from "@/components/Nav";
import {
  categoryIdFromLabel,
  commitmentFrom,
  formatHex,
  nullifierFrom,
  parseField,
  randomField,
  toBytes32,
} from "@/lib/zk";
import { lostETHFoundAbi } from "@/lib/contracts";
import { parseSolidityCallData } from "@/lib/solidity";
import { useAccount, useReadContract, useWriteContract } from "wagmi";
import { parseEther } from "viem";

export default function ClaimPage() {
  const [category, setCategory] = useState("electronics");
  const [secretInput, setSecretInput] = useState("");
  const [itemSaltInput, setItemSaltInput] = useState("0");
  const [claimIdInput, setClaimIdInput] = useState("");
  const [contractAddress, setContractAddress] = useState(
    process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || ""
  );
  const [bondOverride, setBondOverride] = useState("");
  const [commitment, setCommitment] = useState<bigint | null>(null);
  const [nullifier, setNullifier] = useState<bigint | null>(null);
  const [publicSignals, setPublicSignals] = useState<string[] | null>(null);
  const [proofJson, setProofJson] = useState<string>("");
  const [callData, setCallData] = useState<string>("");
  const [status, setStatus] = useState<string>("");

  const { address } = useAccount();
  const { writeContractAsync, isPending } = useWriteContract();

  const { data: claimBond } = useReadContract({
    address: contractAddress ? (contractAddress as `0x${string}`) : undefined,
    abi: lostETHFoundAbi,
    functionName: "claimBond",
    query: {
      enabled: Boolean(contractAddress),
    },
  });

  const handleGenerateClaimId = () => {
    const claimId = randomField();
    setClaimIdInput(formatHex(claimId));
  };

  const handleGenerateProof = async () => {
    setStatus("");
    const secret = parseField(secretInput);
    const itemSalt = parseField(itemSaltInput) ?? 0n;
    const claimId = parseField(claimIdInput);

    if (secret === null || claimId === null) {
      setStatus("Enter a valid secret and claimId.");
      return;
    }

    try {
      setStatus("Generating proof...");
      const catId = await categoryIdFromLabel(category);
      const nextCommitment = await commitmentFrom(secret, catId, itemSalt);
      const nextNullifier = await nullifierFrom(secret, claimId);

      const { groth16 } = await import("snarkjs");
      const input = {
        secret: secret.toString(),
        categoryId: catId.toString(),
        itemIdSalt: itemSalt.toString(),
        claimId: claimId.toString(),
      };

      const { proof, publicSignals } = await groth16.fullProve(
        input,
        "/zk/LOSTETHFOUND.wasm",
        "/zk/LOSTETHFOUND.zkey"
      );

      const exportedCallData = await groth16.exportSolidityCallData(proof, publicSignals);

      setCommitment(nextCommitment);
      setNullifier(nextNullifier);
      setPublicSignals(publicSignals);
      setProofJson(JSON.stringify(proof, null, 2));
      setCallData(exportedCallData);
      setStatus("Proof ready. You can claim on-chain.");
    } catch (error) {
      setStatus(`Proof failed: ${String(error)}`);
    }
  };

  const handleClaim = async () => {
    if (!callData || !contractAddress) {
      setStatus("Generate proof and enter contract address first.");
      return;
    }

    try {
      const { pA, pB, pC, publicSignals } = parseSolidityCallData(callData);

      const commitmentArg = toBytes32(publicSignals[0]);
      const nullifierArg = toBytes32(publicSignals[1]);

      const bond = bondOverride
        ? parseEther(bondOverride)
        : (claimBond as bigint | undefined) ?? 0n;

      await writeContractAsync({
        address: contractAddress as `0x${string}`,
        abi: lostETHFoundAbi,
        functionName: "claim",
        args: [commitmentArg, nullifierArg, address ?? "0x0000000000000000000000000000000000000000", pA, pB, pC, publicSignals],
        value: bond,
      });

      setStatus("Claim tx sent. Confirm in wallet.");
    } catch (error) {
      setStatus(`Claim failed: ${String(error)}`);
    }
  };

  return (
    <div className="min-h-screen">
      <Nav />
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 pb-20">
        <section className="rounded-[28px] border border-black/10 bg-white/70 p-8 shadow-glow backdrop-blur">
          <h1 className="text-3xl font-semibold">Claim a found item</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Enter the secret from the item and generate a ZK proof locally. Then submit the claim
            on-chain.
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
              Secret
              <input
                className="rounded-xl border border-black/15 bg-white/80 px-4 py-3"
                value={secretInput}
                onChange={(event) => setSecretInput(event.target.value)}
                placeholder="0x..."
              />
            </label>

            <label className="flex flex-col gap-2 text-sm">
              Item salt (optional)
              <input
                className="rounded-xl border border-black/15 bg-white/80 px-4 py-3"
                value={itemSaltInput}
                onChange={(event) => setItemSaltInput(event.target.value)}
                placeholder="0x0"
              />
            </label>

            <label className="flex flex-col gap-2 text-sm">
              Claim ID (random per claim)
              <div className="flex gap-2">
                <input
                  className="flex-1 rounded-xl border border-black/15 bg-white/80 px-4 py-3"
                  value={claimIdInput}
                  onChange={(event) => setClaimIdInput(event.target.value)}
                  placeholder="0x..."
                />
                <button
                  type="button"
                  className="rounded-xl border border-black/15 px-4 py-3 text-sm"
                  onClick={handleGenerateClaimId}
                >
                  Generate
                </button>
              </div>
            </label>

            <div className="flex items-end md:col-span-2">
              <button
                type="button"
                className="w-full rounded-full bg-[var(--accent)] px-6 py-3 text-sm font-semibold text-black"
                onClick={handleGenerateProof}
              >
                Generate proof
              </button>
            </div>
          </div>

          {status && <p className="mt-4 text-sm text-[var(--muted)]">{status}</p>}
        </section>

        <section className="rounded-[28px] border border-black/10 bg-white/70 p-6 text-sm">
          <h2 className="text-lg font-semibold">Computed values</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
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
            <div className="rounded-2xl border border-black/10 bg-white/80 p-4">
              <p className="text-xs uppercase text-[var(--muted)]">Nullifier</p>
              <p className="mt-2 break-all font-mono text-xs">
                {nullifier ? formatHex(nullifier) : "—"}
              </p>
              {nullifier && (
                <p className="mt-2 break-all font-mono text-[10px] text-[var(--muted)]">
                  bytes32: {toBytes32(nullifier)}
                </p>
              )}
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-black/10 bg-white/80 p-4">
              <p className="text-xs uppercase text-[var(--muted)]">Public signals</p>
              <pre className="mt-2 max-h-48 overflow-auto rounded-xl bg-black/5 p-3 text-[10px]">
                {publicSignals ? JSON.stringify(publicSignals, null, 2) : "—"}
              </pre>
            </div>
            <div className="rounded-2xl border border-black/10 bg-white/80 p-4">
              <p className="text-xs uppercase text-[var(--muted)]">Proof</p>
              <pre className="mt-2 max-h-48 overflow-auto rounded-xl bg-black/5 p-3 text-[10px]">
                {proofJson || "—"}
              </pre>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-black/10 bg-white/80 p-4">
            <p className="text-xs uppercase text-[var(--muted)]">Solidity call data</p>
            <pre className="mt-2 max-h-40 overflow-auto rounded-xl bg-black/5 p-3 text-[10px]">
              {callData || "—"}
            </pre>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-2">
            <label className="flex flex-col gap-2 text-sm">
              Claim bond override (ETH)
              <input
                className="rounded-xl border border-black/15 bg-white/80 px-4 py-3"
                value={bondOverride}
                onChange={(event) => setBondOverride(event.target.value)}
                placeholder={claimBond ? claimBond.toString() : "0"}
              />
            </label>
            <div className="flex items-end">
              <button
                type="button"
                disabled={!address || !callData || isPending}
                className="w-full rounded-full bg-[var(--accent)] px-6 py-3 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:opacity-50"
                onClick={handleClaim}
              >
                {isPending ? "Sending..." : "Claim on-chain"}
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
