"use client";

import { useState } from "react";
import { Nav } from "@/components/Nav";
import { Chat } from "@/components/Chat";
import {
  answerToField,
  categoryIdFromLabel,
  commitmentFrom,
  computeAnswerHashes,
  parseField,
  parseSecretInput,
  toBytes32,
} from "@/lib/zk";
import { decryptQuestionPack, type EncryptedQuestionPack } from "@/lib/crypto";
import {
  DEFAULT_CATEGORY,
  itemCategories,
  resolveCategoryLabel,
} from "@/lib/categories";
import { NUM_QUESTIONS } from "@/lib/questionTemplates";
import { lostETHFoundAbi, getStatusLabel } from "@/lib/contracts";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import { hexToString } from "viem";

export default function ClaimPage() {
  const [returnCodeInput, setReturnCodeInput] = useState("");
  const [categoryChoice, setCategoryChoice] =
    useState<string>(DEFAULT_CATEGORY);
  const [customCategory, setCustomCategory] = useState("");
  const [itemSaltInput, setItemSaltInput] = useState("0");
  const [contractAddress, setContractAddress] = useState(
    process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || ""
  );

  // Item lookup state
  const [itemFound, setItemFound] = useState(false);
  const [tokenId, setTokenId] = useState<bigint | null>(null);
  const [itemData, setItemData] = useState<{
    reward: bigint;
    status: number;
    threshold: number;
    isTagged: boolean;
  } | null>(null);
  const [decryptedPack, setDecryptedPack] =
    useState<EncryptedQuestionPack | null>(null);

  // Proof state
  const [finderAnswers, setFinderAnswers] = useState<string[]>(
    Array(NUM_QUESTIONS).fill("")
  );
  const [proofJson, setProofJson] = useState<string>("");
  const [callData, setCallData] = useState<string>("");
  const [status, setStatus] = useState<string>("");

  // Claim success state
  const [claimSuccess, setClaimSuccess] = useState(false);
  const [claimedTokenId, setClaimedTokenId] = useState<string | null>(null);
  const [revealedContact, setRevealedContact] = useState<string | null>(null);

  const resolvedCategory = resolveCategoryLabel(categoryChoice, customCategory);
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync, isPending } = useWriteContract();

  const handleUpdateFinderAnswer = (index: number, value: string) => {
    const newAnswers = [...finderAnswers];
    newAnswers[index] = value;
    setFinderAnswers(newAnswers);
  };

  // ============ LOOKUP ITEM BY RETURN CODE ============
  const handleLookupItem = async () => {
    setStatus("");
    setItemFound(false);
    setDecryptedPack(null);
    setTokenId(null);
    setItemData(null);

    if (!returnCodeInput.trim()) {
      setStatus("Enter the return code from the item.");
      return;
    }

    if (!resolvedCategory) {
      setStatus("Select the item type.");
      return;
    }

    if (!contractAddress || !publicClient) {
      setStatus("Enter contract address and connect wallet.");
      return;
    }

    try {
      setStatus("Looking up item...");

      // Compute commitment from return code
      const secret = parseSecretInput(returnCodeInput);
      if (secret === null) {
        setStatus("Invalid return code format.");
        return;
      }

      const itemSalt = parseField(itemSaltInput) ?? 0n;
      const catId = await categoryIdFromLabel(resolvedCategory);
      const commitment = await commitmentFrom(secret, catId, itemSalt);
      const commitmentBytes = toBytes32(commitment);

      // Lookup by commitment
      const foundTokenId = (await publicClient.readContract({
        address: contractAddress as `0x${string}`,
        abi: lostETHFoundAbi,
        functionName: "byCommitment",
        args: [commitmentBytes],
      })) as bigint;

      if (foundTokenId === 0n) {
        setStatus("No item found with this return code. Check the item type.");
        return;
      }

      // Get item details
      const data = (await publicClient.readContract({
        address: contractAddress as `0x${string}`,
        abi: lostETHFoundAbi,
        functionName: "getItem",
        args: [foundTokenId],
      })) as [string, string, number, bigint, number, string, boolean, string];

      setTokenId(foundTokenId);
      setItemData({
        reward: data[3],
        status: data[4],
        threshold: data[2],
        isTagged: data[6],
      });

      // Try to decrypt the questions + contact
      const encryptedContact = data[7];
      if (encryptedContact && encryptedContact !== "0x") {
        try {
          const contactStr = hexToString(encryptedContact as `0x${string}`);
          const pack = await decryptQuestionPack(
            returnCodeInput.trim(),
            contactStr
          );
          if (pack) {
            setDecryptedPack(pack);
            setFinderAnswers(Array(NUM_QUESTIONS).fill(""));
          }
        } catch {
          // Decryption failed
        }
      }

      setItemFound(true);
      setStatus("Item found! Answer the questions to prove you have it.");
    } catch (error) {
      setStatus(`Lookup failed: ${String(error)}`);
    }
  };

  // ============ GENERATE PROOF ============
  const handleGenerateProof = async () => {
    setStatus("");

    if (!decryptedPack || !itemData || !tokenId) {
      setStatus("Look up an item first.");
      return;
    }

    const filledAnswers = finderAnswers.filter((a) => a.trim());
    if (filledAnswers.length < itemData.threshold) {
      setStatus(`Answer at least ${itemData.threshold} questions.`);
      return;
    }

    try {
      setStatus("Computing answer hashes and generating proof...");

      // Compute answer hashes for circuit input
      const answerHashes = await computeAnswerHashes(finderAnswers);
      const answerFields = finderAnswers.map(answerToField);

      // Generate ZK proof using QuestionPackProof circuit
      const { groth16 } = await import("snarkjs");

      // For packId, we need to match what was stored. Since this is the new flow,
      // we don't use packId for lookup - we use commitment. But the circuit still
      // expects a packId. We can use 0 or compute from answers.
      // Actually, the circuit output packId should match what's verified in the contract.
      // Let me check the contract - it verifies answer hashes, threshold, but for claimItem
      // it doesn't check packId. So we can use any value.

      const input = {
        answers: answerFields.map((f) => f.toString()),
        answerHashes: answerHashes.map((h) => h.toString()),
        threshold: itemData.threshold.toString(),
        packId: "0", // Not used in new flow verification
      };

      const { proof, publicSignals } = await groth16.fullProve(
        input,
        "/zk/QuestionPackProof.wasm",
        "/zk/QuestionPackProof.zkey"
      );

      const exportedCallData = await groth16.exportSolidityCallData(
        proof,
        publicSignals
      );

      setProofJson(JSON.stringify(proof, null, 2));
      setCallData(exportedCallData);
      setStatus("Proof ready! Submit your claim.");
    } catch (error) {
      setStatus(`Proof failed: ${String(error)}`);
    }
  };

  // ============ SUBMIT CLAIM ============
  const handleSubmitClaim = async () => {
    if (!callData || !contractAddress || !publicClient || !tokenId) {
      setStatus("Generate a proof first.");
      return;
    }

    try {
      setStatus("Submitting claim...");

      // Compute commitment from return code
      const secret = parseSecretInput(returnCodeInput);
      if (secret === null) {
        setStatus("Invalid return code.");
        return;
      }

      const itemSalt = parseField(itemSaltInput) ?? 0n;
      const catId = await categoryIdFromLabel(resolvedCategory);
      const commitment = await commitmentFrom(secret, catId, itemSalt);
      const commitmentBytes = toBytes32(commitment);

      // Parse the call data - need to extract 8 public signals
      const cleaned = callData.replace(/[\[\]\s"]/g, "");
      const parts = cleaned.split(",").filter(Boolean);

      const pA = [BigInt(parts[0]), BigInt(parts[1])] as const;
      const pB = [
        [BigInt(parts[2]), BigInt(parts[3])],
        [BigInt(parts[4]), BigInt(parts[5])],
      ] as const;
      const pC = [BigInt(parts[6]), BigInt(parts[7])] as const;
      const publicSignals = [
        BigInt(parts[8]),
        BigInt(parts[9]),
        BigInt(parts[10]),
        BigInt(parts[11]),
        BigInt(parts[12]),
        BigInt(parts[13]),
        BigInt(parts[14]),
        BigInt(parts[15]),
      ] as const;

      await writeContractAsync({
        address: contractAddress as `0x${string}`,
        abi: lostETHFoundAbi,
        functionName: "claimItem",
        args: [commitmentBytes, pA, pB, pC, publicSignals],
      });

      // Set success state
      setClaimSuccess(true);
      setClaimedTokenId(tokenId.toString());

      // Reveal contact info
      if (decryptedPack?.contact) {
        setRevealedContact(decryptedPack.contact);
      }

      setStatus(
        "Claim submitted! The owner has been notified. Use the chat below to coordinate the return."
      );
    } catch (error) {
      setStatus(`Claim failed: ${String(error)}`);
    }
  };

  return (
    <div className="min-h-screen">
      <Nav />
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 pb-20">
        <section className="rounded-[28px] border border-black/10 bg-white/70 p-8 shadow-glow backdrop-blur">
          <h1 className="text-3xl font-semibold">Found an Item?</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Enter the return code from the item, answer the questions to prove
            you have it, and claim the reward.
          </p>

          {/* Step 1: Enter Return Code */}
          <div className="mt-8">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--accent)] text-sm">
                1
              </span>
              Enter Return Code
            </h2>
            <p className="mt-1 ml-9 text-xs text-[var(--muted)]">
              Look for a code on the item that starts with &quot;LF-&quot;
            </p>

            <div className="mt-4 ml-9 grid gap-4">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="flex flex-col gap-2 text-sm">
                  Return code from item
                  <input
                    className="rounded-xl border border-black/15 bg-white/80 px-4 py-3 font-mono"
                    value={returnCodeInput}
                    onChange={(event) => setReturnCodeInput(event.target.value)}
                    placeholder="LF-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX"
                  />
                </label>

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
              </div>

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

              <button
                type="button"
                className="w-full rounded-full border border-black/20 px-6 py-3 text-sm font-semibold md:w-auto md:justify-self-start"
                onClick={handleLookupItem}
              >
                Look Up Item
              </button>
            </div>
          </div>

          {/* Step 2: Answer Questions (shown after lookup) */}
          {itemFound && itemData && (
            <div className="mt-8">
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--accent)] text-sm">
                  2
                </span>
                Prove You Have It
              </h2>

              <div className="mt-4 ml-9">
                <div className="rounded-2xl border border-green-500/30 bg-green-50/50 p-4">
                  <p className="font-semibold text-green-700">Item Found!</p>
                  <p className="mt-1 text-sm text-green-600">
                    Token ID: #{tokenId?.toString()}
                  </p>
                  <p className="text-sm text-green-600">
                    Bounty: {(Number(itemData.reward) / 1e18).toFixed(4)} ETH
                  </p>
                  <p className="text-sm text-green-600">
                    Status: {getStatusLabel(itemData.status)}
                  </p>
                  {itemData.status !== 1 && (
                    <p className="mt-2 text-sm text-orange-600">
                      Note: This item is not currently marked as lost. The owner
                      needs to mark it as lost before you can claim.
                    </p>
                  )}
                </div>

                {decryptedPack ? (
                  <>
                    <p className="mt-4 text-sm text-[var(--muted)]">
                      Answer these questions about the item. You need{" "}
                      {itemData.threshold} of {NUM_QUESTIONS} correct.
                    </p>

                    <div className="mt-4 grid gap-4">
                      {decryptedPack.questions.map((question, index) => (
                        <label
                          key={index}
                          className="flex flex-col gap-2 text-sm"
                        >
                          {index + 1}. {question}
                          <input
                            className="rounded-xl border border-black/15 bg-white/80 px-4 py-3"
                            value={finderAnswers[index]}
                            onChange={(event) =>
                              handleUpdateFinderAnswer(
                                index,
                                event.target.value
                              )
                            }
                            placeholder="Your answer..."
                          />
                        </label>
                      ))}
                    </div>

                    <div className="mt-6 grid gap-3 md:grid-cols-2">
                      <button
                        type="button"
                        className="w-full rounded-full border border-black/20 px-6 py-3 text-sm font-semibold"
                        onClick={handleGenerateProof}
                      >
                        Generate Proof
                      </button>
                      <button
                        type="button"
                        disabled={
                          !address ||
                          !callData ||
                          isPending ||
                          itemData.status !== 1
                        }
                        className="w-full rounded-full bg-[var(--accent)] px-6 py-3 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:opacity-50"
                        onClick={handleSubmitClaim}
                      >
                        {isPending ? "Claiming..." : "Submit Claim"}
                      </button>
                    </div>
                  </>
                ) : (
                  <p className="mt-4 text-sm text-orange-600">
                    Could not decrypt questions. Make sure the return code is
                    correct.
                  </p>
                )}
              </div>
            </div>
          )}

          {status && (
            <p className="mt-4 ml-9 text-sm text-[var(--muted)]">{status}</p>
          )}

          {/* Contact info revealed after successful claim */}
          {claimSuccess && revealedContact && (
            <div className="mt-6 ml-9 rounded-2xl border border-green-500/30 bg-green-50/50 p-4">
              <p className="font-semibold text-green-700">Owner Contact Info</p>
              <p className="mt-2 text-sm text-green-600">{revealedContact}</p>
            </div>
          )}

          {/* Chat with owner after successful claim */}
          {claimSuccess && claimedTokenId && returnCodeInput && (
            <div className="mt-6 ml-9">
              <Chat returnCode={returnCodeInput.trim()} isOwner={false} />
            </div>
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
                Item salt (if used during registration)
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

        {/* Proof Details */}
        {proofJson && (
          <section className="rounded-[28px] border border-black/10 bg-white/70 p-6 text-sm">
            <h2 className="text-lg font-semibold">Proof Details</h2>
            <div className="mt-4 rounded-2xl border border-black/10 bg-white/80 p-4">
              <p className="text-xs uppercase text-[var(--muted)]">ZK Proof</p>
              <pre className="mt-2 max-h-32 overflow-auto rounded-xl bg-black/5 p-3 text-[10px]">
                {proofJson}
              </pre>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
