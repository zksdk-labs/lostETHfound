"use client";

import { useState, useEffect } from "react";
import { Nav } from "@/components/Nav";
import {
  categoryIdFromLabel,
  commitmentFrom,
  computeAnswerHashes,
  formatHex,
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

export default function RegisterPage() {
  const [categoryChoice, setCategoryChoice] =
    useState<string>(DEFAULT_CATEGORY);
  const [customCategory, setCustomCategory] = useState("");
  const [secretInput, setSecretInput] = useState("");
  const [itemSaltInput, setItemSaltInput] = useState("0");
  const [rewardEth, setRewardEth] = useState("0.1");
  const [contactInfo, setContactInfo] = useState("");
  const [contractAddress, setContractAddress] = useState(
    process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || ""
  );
  const [categoryId, setCategoryId] = useState<bigint | null>(null);
  const [commitment, setCommitment] = useState<bigint | null>(null);
  const [status, setStatus] = useState<string>("");
  const [loadingStep, setLoadingStep] = useState<string>("");
  const [copyStatus, setCopyStatus] = useState("");

  // Question state
  const [answers, setAnswers] = useState<string[]>(
    Array(NUM_QUESTIONS).fill("")
  );
  const [threshold, setThreshold] = useState(DEFAULT_THRESHOLD);

  const resolvedCategory = resolveCategoryLabel(categoryChoice, customCategory);
  const questions = getQuestionsForCategory(categoryChoice);
  const { address } = useAccount();
  const { writeContractAsync, isPending } = useWriteContract();

  // Auto-compute commitment when all required fields are filled
  useEffect(() => {
    computeCommitmentIfReady();
  }, [
    secretInput,
    resolvedCategory,
    answers,
    threshold,
    contactInfo,
    itemSaltInput,
  ]);

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

  const handleUpdateAnswer = (index: number, value: string) => {
    const newAnswers = [...answers];
    newAnswers[index] = value;
    setAnswers(newAnswers);
  };

  const computeCommitmentIfReady = async () => {
    const secret = parseSecretInput(secretInput);
    if (secret === null) return;
    if (!resolvedCategory) return;

    const filledAnswers = answers.filter((a) => a.trim());
    if (filledAnswers.length < threshold) return;

    if (!contactInfo.trim()) return;

    const itemSalt = parseField(itemSaltInput) ?? 0n;

    const nextCategoryId = await categoryIdFromLabel(resolvedCategory);
    const nextCommitment = await commitmentFrom(
      secret,
      nextCategoryId,
      itemSalt
    );

    setCategoryId(nextCategoryId);
    setCommitment(nextCommitment);
  };

  const handleRegister = async () => {
    setStatus("");

    // Validate all required fields
    const secret = parseSecretInput(secretInput);
    if (secret === null) {
      setStatus("Generate or enter a valid return code.");
      return;
    }
    if (!resolvedCategory) {
      setStatus("Choose an item type or enter a custom one.");
      return;
    }
    const filledAnswers = answers.filter((a) => a.trim());
    if (filledAnswers.length < threshold) {
      setStatus(`Answer at least ${threshold} questions.`);
      return;
    }
    if (!contactInfo.trim()) {
      setStatus("Enter your contact info for when the item is found.");
      return;
    }
    if (!contractAddress) {
      setStatus("Contract address not configured.");
      return;
    }

    try {
      setLoadingStep("Preparing...");

      // Compute commitment if not already computed
      let currentCommitment = commitment;
      let currentCategoryId = categoryId;
      if (!currentCommitment || !currentCategoryId) {
        const itemSalt = parseField(itemSaltInput) ?? 0n;
        currentCategoryId = await categoryIdFromLabel(resolvedCategory);
        currentCommitment = await commitmentFrom(
          secret,
          currentCategoryId,
          itemSalt
        );
        setCategoryId(currentCategoryId);
        setCommitment(currentCommitment);
      }

      // Compute answer hashes
      const answerHashes = await computeAnswerHashes(answers);
      const answerHashBytes = answerHashes.map((h) => toBytes32(h));

      // Encrypt questions + contact with the return code
      const encryptedData = await encryptQuestionPack(secretInput.trim(), {
        questions: questions.map((q) => `${q}`),
        contact: contactInfo.trim(),
      });

      const contactBytes = stringToHex(encryptedData);
      const rewardWei = parseEther(rewardEth || "0");

      setLoadingStep("Approve in wallet...");

      await writeContractAsync({
        address: contractAddress as `0x${string}`,
        abi: lostETHFoundAbi,
        functionName: "registerItem",
        args: [
          toBytes32(currentCommitment),
          toBytes32(currentCategoryId),
          answerHashBytes,
          threshold,
          contactBytes as `0x${string}`,
        ],
        value: rewardWei,
      });

      setLoadingStep("");
      setStatus(
        "Item registered! Put the return code on your item. When someone finds it, they'll use the code to look up your item and answer the questions to prove they have it."
      );
    } catch (error) {
      setLoadingStep("");
      setStatus(`Registration failed: ${String(error)}`);
    }
  };

  return (
    <div className="min-h-screen">
      <Nav />
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 pb-20">
        <section className="rounded-[28px] border border-black/10 bg-white/70 p-8 shadow-glow backdrop-blur">
          <h1 className="text-3xl font-semibold">Add a Return Tag</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Create a return tag for your item. The code identifies it on-chain,
            and the questions prove a finder actually has it.
          </p>

          {/* Step 1: Return Code */}
          <div className="mt-8">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--accent)] text-sm">
                1
              </span>
              Return Code
            </h2>
            <p className="mt-1 ml-9 text-xs text-[var(--muted)]">
              This code goes on your item. It&apos;s public - finders use it to
              look up your item on-chain.
            </p>

            <div className="mt-4 ml-9">
              <div className="flex flex-wrap gap-2">
                <input
                  className="min-w-[220px] flex-1 rounded-xl border border-black/15 bg-white/80 px-4 py-3 font-mono"
                  value={secretInput}
                  onChange={(event) => setSecretInput(event.target.value)}
                  placeholder="Tap Generate"
                />
                <button
                  type="button"
                  className="rounded-xl border border-black/15 px-4 py-3 text-sm"
                  onClick={handleGenerateSecret}
                >
                  Generate
                </button>
                <button
                  type="button"
                  className="rounded-xl border border-black/15 px-4 py-3 text-sm"
                  onClick={handleCopySecret}
                >
                  Copy
                </button>
              </div>

              {secretInput && (
                <div className="mt-4 rounded-3xl border border-black/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.9),rgba(255,236,204,0.9))] p-5 shadow-[0_24px_60px_rgba(28,26,23,0.12)]">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.4em] text-[var(--muted)]">
                        Return code
                      </p>
                      <p className="mt-3 break-all font-mono text-xl tracking-[0.25em] md:text-2xl">
                        {secretInput.trim()}
                      </p>
                    </div>
                    <div className="rounded-full border border-black/15 bg-white/80 px-3 py-1 text-[10px] uppercase tracking-[0.3em] text-[var(--muted)]">
                      LostETHFound
                    </div>
                  </div>
                  <p className="mt-3 text-xs text-[var(--muted)]">
                    Print or engrave this on your item. Keep a backup for
                    yourself.
                  </p>
                  {copyStatus && (
                    <p className="mt-2 text-xs text-[var(--muted)]">
                      {copyStatus}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Step 2: Item Details */}
          <div className="mt-8">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--accent)] text-sm">
                2
              </span>
              Item Details
            </h2>
            <p className="mt-1 ml-9 text-xs text-[var(--muted)]">
              What kind of item is this?
            </p>

            <div className="mt-4 ml-9 grid gap-5 md:grid-cols-2">
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
                    onChange={(event) => setCustomCategory(event.target.value)}
                    placeholder="e.g. camera"
                  />
                </label>
              )}

              <label className="flex flex-col gap-2 text-sm">
                Initial bounty (ETH)
                <input
                  className="rounded-xl border border-black/15 bg-white/80 px-4 py-3"
                  value={rewardEth}
                  onChange={(event) => setRewardEth(event.target.value)}
                  placeholder="0.1"
                />
                <span className="text-xs text-[var(--muted)]">
                  You can add more bounty later when you mark it as lost.
                </span>
              </label>

              <label className="flex flex-col gap-2 text-sm">
                Questions threshold
                <select
                  className="rounded-xl border border-black/15 bg-white/80 px-4 py-3"
                  value={threshold}
                  onChange={(event) => setThreshold(Number(event.target.value))}
                >
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      {n} of {NUM_QUESTIONS} correct answers required
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          {/* Step 3: Challenge Questions */}
          <div className="mt-8">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--accent)] text-sm">
                3
              </span>
              Challenge Questions
            </h2>
            <p className="mt-1 ml-9 text-xs text-[var(--muted)]">
              Only someone with your actual item can answer these. The finder
              needs {threshold} of {NUM_QUESTIONS} correct to prove possession.
            </p>

            <div className="mt-4 ml-9 grid gap-4">
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

          {/* Step 4: Contact Info */}
          <div className="mt-8">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--accent)] text-sm">
                4
              </span>
              Contact Info
            </h2>
            <p className="mt-1 ml-9 text-xs text-[var(--muted)]">
              How should the finder reach you? This is encrypted and only
              revealed when someone proves they have your item.
            </p>

            <div className="mt-4 ml-9">
              <textarea
                className="w-full min-h-[100px] rounded-xl border border-black/15 bg-white/80 px-4 py-3"
                value={contactInfo}
                onChange={(event) => setContactInfo(event.target.value)}
                placeholder="Email, phone, Telegram, etc."
              />
            </div>
          </div>

          {/* Action Button */}
          <div className="mt-8 ml-9">
            <button
              type="button"
              disabled={!address || isPending || !!loadingStep}
              className="w-full rounded-full bg-[var(--accent)] px-6 py-3 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:opacity-50 md:w-auto"
              onClick={handleRegister}
            >
              {loadingStep || "Get Ownership Badge"}
            </button>
          </div>

          {status && (
            <p className="mt-4 ml-9 text-sm text-[var(--muted)]">{status}</p>
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
          <h2 className="text-lg font-semibold">Proof Details</h2>
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
                Commitment (Return ID Hash)
              </p>
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
        </section>
      </main>
    </div>
  );
}
