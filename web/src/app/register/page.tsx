"use client";

import { useState } from "react";
import { Nav } from "@/components/Nav";
import {
  categoryIdFromLabel,
  commitmentFrom,
  computeAnswerHashes,
  formatHex,
  packIdFrom,
  parseField,
  parseSecretInput,
  toBytes32,
} from "@/lib/zk";
import { encryptQuestionPack } from "@/lib/crypto";
import {
  DEFAULT_CATEGORY,
  itemCategories,
  resolveCategoryLabel,
} from "@/lib/categories";
import {
  getQuestionsForCategory,
  DEFAULT_THRESHOLD,
  NUM_QUESTIONS,
} from "@/lib/questionTemplates";
import { lostETHFoundAbi } from "@/lib/contracts";
import { useAccount, useWriteContract } from "wagmi";
import { parseEther, stringToHex } from "viem";

type FlowMode = "tagged" | "untagged";

export default function RegisterPage() {
  const [mode, setMode] = useState<FlowMode>("tagged");
  const [categoryChoice, setCategoryChoice] = useState(DEFAULT_CATEGORY);
  const [customCategory, setCustomCategory] = useState("");
  const [secretInput, setSecretInput] = useState("");
  const [itemSaltInput, setItemSaltInput] = useState("0");
  const [rewardEth, setRewardEth] = useState("0");
  const [encryptedContact, setEncryptedContact] = useState("");
  const [contractAddress, setContractAddress] = useState(
    process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || ""
  );
  const [categoryId, setCategoryId] = useState<bigint | null>(null);
  const [commitment, setCommitment] = useState<bigint | null>(null);
  const [packId, setPackId] = useState<bigint | null>(null);
  const [status, setStatus] = useState<string>("");
  const [copyStatus, setCopyStatus] = useState("");

  // Question mode state
  const [answers, setAnswers] = useState<string[]>(
    Array(NUM_QUESTIONS).fill("")
  );
  const [threshold, setThreshold] = useState(DEFAULT_THRESHOLD);
  const [serialForQuestions, setSerialForQuestions] = useState("");

  const resolvedCategory = resolveCategoryLabel(categoryChoice, customCategory);
  const questions = getQuestionsForCategory(categoryChoice);
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

  const handleGenerateSerialForQuestions = () => {
    setSerialForQuestions(buildSerialCode());
  };

  const handleCopySecret = async () => {
    const code =
      mode === "tagged" ? secretInput.trim() : serialForQuestions.trim();
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

  const handleUpdateAnswer = (index: number, value: string) => {
    const newAnswers = [...answers];
    newAnswers[index] = value;
    setAnswers(newAnswers);
  };

  // ============ TAGGED FLOW ============
  const handleComputeTagged = async () => {
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
    const nextCommitment = await commitmentFrom(
      secret,
      nextCategoryId,
      itemSalt
    );

    setCategoryId(nextCategoryId);
    setCommitment(nextCommitment);
    setStatus("Ready to mint ownership NFT.");
  };

  const handleRegisterTagged = async () => {
    if (!commitment || !categoryId || !contractAddress) {
      setStatus("Compute commitment and enter contract address first.");
      return;
    }

    try {
      setStatus("Minting ownership NFT...");
      const contactBytes = encryptedContact.trim().startsWith("0x")
        ? encryptedContact.trim()
        : stringToHex(encryptedContact.trim() || "");

      const rewardWei = parseEther(rewardEth || "0");

      await writeContractAsync({
        address: contractAddress as `0x${string}`,
        abi: lostETHFoundAbi,
        functionName: "registerTagged",
        args: [
          toBytes32(commitment),
          toBytes32(categoryId),
          contactBytes as `0x${string}`,
        ],
        value: rewardWei,
      });

      setStatus("Ownership NFT minted! Put the return code on your item.");
    } catch (error) {
      setStatus(`Mint failed: ${String(error)}`);
    }
  };

  // ============ UNTAGGED FLOW ============
  const handleComputeUntagged = async () => {
    setStatus("");
    if (!resolvedCategory) {
      setStatus("Choose an item type or enter a custom one.");
      return;
    }

    const filledAnswers = answers.filter((a) => a.trim());
    if (filledAnswers.length < threshold) {
      setStatus(`Answer at least ${threshold} questions.`);
      return;
    }

    if (!serialForQuestions.trim()) {
      setStatus("Generate or enter a serial number for encryption.");
      return;
    }

    setStatus("Computing answer hashes...");
    const nextCategoryId = await categoryIdFromLabel(resolvedCategory);
    const nextPackId = await packIdFrom(nextCategoryId, answers);

    setCategoryId(nextCategoryId);
    setPackId(nextPackId);
    setStatus("Ready to mint ownership NFT with question pack.");
  };

  const handleRegisterUntagged = async () => {
    if (!packId || !categoryId || !contractAddress) {
      setStatus("Compute pack ID and enter contract address first.");
      return;
    }

    try {
      setStatus("Encrypting questions and minting NFT...");

      // Compute answer hashes
      const answerHashes = await computeAnswerHashes(answers);
      const answerHashBytes = answerHashes.map((h) => toBytes32(h));

      // Encrypt questions + contact with serial
      const encryptedData = await encryptQuestionPack(serialForQuestions, {
        questions: questions.map((q, i) => `${q}`),
        contact: encryptedContact.trim(),
      });

      const contactBytes = stringToHex(encryptedData);
      const rewardWei = parseEther(rewardEth || "0");

      await writeContractAsync({
        address: contractAddress as `0x${string}`,
        abi: lostETHFoundAbi,
        functionName: "registerUntagged",
        args: [
          toBytes32(packId),
          toBytes32(categoryId),
          answerHashBytes,
          threshold,
          contactBytes as `0x${string}`,
        ],
        value: rewardWei,
      });

      setStatus(
        "Ownership NFT minted! The serial number is the encryption key - put it on your item or keep it safe."
      );
    } catch (error) {
      setStatus(`Mint failed: ${String(error)}`);
    }
  };

  return (
    <div className="min-h-screen">
      <Nav />
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 pb-20">
        <section className="rounded-[28px] border border-black/10 bg-white/70 p-8 shadow-glow backdrop-blur">
          <h1 className="text-3xl font-semibold">Mint Ownership Proof NFT</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Create a ZK proof of ownership for your item. Your wallet becomes
            your proof.
          </p>

          <div className="mt-6 inline-flex rounded-full border border-black/15 bg-white/80 p-1 text-sm">
            <button
              type="button"
              className={`rounded-full px-4 py-2 ${
                mode === "tagged"
                  ? "bg-[var(--accent)] text-black"
                  : "text-[var(--muted)]"
              }`}
              onClick={() => setMode("tagged")}
            >
              With Return Code
            </button>
            <button
              type="button"
              className={`rounded-full px-4 py-2 ${
                mode === "untagged"
                  ? "bg-[var(--accent)] text-black"
                  : "text-[var(--muted)]"
              }`}
              onClick={() => setMode("untagged")}
            >
              With Questions
            </button>
          </div>

          {mode === "tagged" ? (
            // ============ TAGGED MODE UI ============
            <>
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
                </label>

                {categoryChoice === "other" && (
                  <label className="flex flex-col gap-2 text-sm">
                    Custom item type
                    <input
                      className="rounded-xl border border-black/15 bg-white/80 px-4 py-3"
                      value={customCategory}
                      onChange={(event) =>
                        setCustomCategory(event.target.value)
                      }
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
                <div className="rounded-3xl border border-black/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.9),rgba(255,236,204,0.9))] p-5 shadow-[0_24px_60px_rgba(28,26,23,0.12)]">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.4em] text-[var(--muted)]">
                        Return code
                      </p>
                      <p className="mt-3 break-all font-mono text-xl tracking-[0.25em] md:text-2xl">
                        {secretInput.trim() ||
                          "LF-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX"}
                      </p>
                    </div>
                    <div className="rounded-full border border-black/15 bg-white/80 px-3 py-1 text-[10px] uppercase tracking-[0.3em] text-[var(--muted)]">
                      LostETHFound
                    </div>
                  </div>
                  <p className="mt-3 text-xs text-[var(--muted)]">
                    Print or engrave this serial. Keep a backup for yourself.
                  </p>
                  {copyStatus && (
                    <p className="mt-2 text-xs text-[var(--muted)]">
                      {copyStatus}
                    </p>
                  )}
                </div>
              </label>

              <label className="mt-5 flex flex-col gap-2 text-sm">
                Contact for return (private)
                <textarea
                  className="min-h-[100px] rounded-xl border border-black/15 bg-white/80 px-4 py-3"
                  value={encryptedContact}
                  onChange={(event) => setEncryptedContact(event.target.value)}
                  placeholder="Email, Telegram, etc."
                />
              </label>

              <div className="mt-6 grid gap-3 md:grid-cols-2">
                <button
                  type="button"
                  className="w-full rounded-full border border-black/20 px-6 py-3 text-sm font-semibold"
                  onClick={handleComputeTagged}
                >
                  Compute commitment
                </button>
                <button
                  type="button"
                  disabled={!address || !commitment || isPending}
                  className="w-full rounded-full bg-[var(--accent)] px-6 py-3 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={handleRegisterTagged}
                >
                  {isPending ? "Minting..." : "Mint Ownership NFT"}
                </button>
              </div>
            </>
          ) : (
            // ============ UNTAGGED MODE UI ============
            <>
              <div className="mt-6 grid gap-5 md:grid-cols-2">
                <label className="flex flex-col gap-2 text-sm">
                  Item type
                  <select
                    className="rounded-xl border border-black/15 bg-white/80 px-4 py-3"
                    value={categoryChoice}
                    onChange={(event) => {
                      setCategoryChoice(event.target.value);
                      setAnswers(Array(NUM_QUESTIONS).fill(""));
                    }}
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
                      onChange={(event) =>
                        setCustomCategory(event.target.value)
                      }
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
                </label>

                <label className="flex flex-col gap-2 text-sm">
                  Threshold
                  <select
                    className="rounded-xl border border-black/15 bg-white/80 px-4 py-3"
                    value={threshold}
                    onChange={(event) =>
                      setThreshold(Number(event.target.value))
                    }
                  >
                    {[1, 2, 3, 4, 5].map((n) => (
                      <option key={n} value={n}>
                        {n} of {NUM_QUESTIONS} correct
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="mt-6">
                <h3 className="text-sm font-semibold">
                  Answer questions about your item
                </h3>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  These answers become the proof. A finder needs to match{" "}
                  {threshold} of {NUM_QUESTIONS} to claim.
                </p>
                <div className="mt-4 grid gap-4">
                  {questions.map((question, index) => (
                    <label key={index} className="flex flex-col gap-2 text-sm">
                      {index + 1}. {question}
                      <input
                        className="rounded-xl border border-black/15 bg-white/80 px-4 py-3"
                        value={answers[index]}
                        onChange={(event) =>
                          handleUpdateAnswer(index, event.target.value)
                        }
                        placeholder="Your answer..."
                      />
                    </label>
                  ))}
                </div>
              </div>

              <label className="mt-5 flex flex-col gap-2 text-sm">
                Serial for encryption (put on item or keep safe)
                <div className="flex flex-wrap gap-2">
                  <input
                    className="min-w-[220px] flex-1 rounded-xl border border-black/15 bg-white/80 px-4 py-3"
                    value={serialForQuestions}
                    onChange={(event) =>
                      setSerialForQuestions(event.target.value)
                    }
                    placeholder="Tap Generate Serial"
                  />
                  <button
                    type="button"
                    className="rounded-xl border border-black/15 px-4 py-3 text-sm"
                    onClick={handleGenerateSerialForQuestions}
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
                  The serial encrypts your questions. Only someone with this
                  serial can see them.
                </p>
              </label>

              <label className="mt-5 flex flex-col gap-2 text-sm">
                Contact for return (private, encrypted with serial)
                <textarea
                  className="min-h-[100px] rounded-xl border border-black/15 bg-white/80 px-4 py-3"
                  value={encryptedContact}
                  onChange={(event) => setEncryptedContact(event.target.value)}
                  placeholder="Email, Telegram, etc."
                />
              </label>

              <div className="mt-6 grid gap-3 md:grid-cols-2">
                <button
                  type="button"
                  className="w-full rounded-full border border-black/20 px-6 py-3 text-sm font-semibold"
                  onClick={handleComputeUntagged}
                >
                  Compute pack ID
                </button>
                <button
                  type="button"
                  disabled={!address || !packId || isPending}
                  className="w-full rounded-full bg-[var(--accent)] px-6 py-3 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={handleRegisterUntagged}
                >
                  {isPending ? "Minting..." : "Mint Ownership NFT"}
                </button>
              </div>
            </>
          )}

          {status && (
            <p className="mt-4 text-sm text-[var(--muted)]">{status}</p>
          )}

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
              {mode === "tagged" && (
                <label className="flex flex-col gap-2 text-sm">
                  Item salt (optional)
                  <input
                    className="rounded-xl border border-black/15 bg-white/80 px-4 py-3"
                    value={itemSaltInput}
                    onChange={(event) => setItemSaltInput(event.target.value)}
                    placeholder="0"
                  />
                </label>
              )}
            </div>
          </details>
        </section>

        <section className="rounded-[28px] border border-black/10 bg-white/70 p-6 text-sm">
          <h2 className="text-lg font-semibold">Proof details</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-black/10 bg-white/80 p-4">
              <p className="text-xs uppercase text-[var(--muted)]">
                Category ID
              </p>
              <p className="mt-2 break-all font-mono text-xs">
                {categoryId ? formatHex(categoryId) : "—"}
              </p>
            </div>
            <div className="rounded-2xl border border-black/10 bg-white/80 p-4">
              <p className="text-xs uppercase text-[var(--muted)]">
                {mode === "tagged" ? "Commitment" : "Pack ID"}
              </p>
              <p className="mt-2 break-all font-mono text-xs">
                {mode === "tagged"
                  ? commitment
                    ? formatHex(commitment)
                    : "—"
                  : packId
                  ? formatHex(packId)
                  : "—"}
              </p>
              {((mode === "tagged" && commitment) ||
                (mode === "untagged" && packId)) && (
                <p className="mt-2 break-all font-mono text-[10px] text-[var(--muted)]">
                  bytes32:{" "}
                  {toBytes32(mode === "tagged" ? commitment! : packId!)}
                </p>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
