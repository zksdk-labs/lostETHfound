"use client";

import { useEffect, useState } from "react";
import { Nav } from "@/components/Nav";
import {
  answerToField,
  categoryIdFromLabel,
  commitmentFrom,
  computeAnswerHashes,
  formatHex,
  nullifierFrom,
  packIdFrom,
  parseField,
  parseSecretInput,
  randomField,
  toBytes32,
} from "@/lib/zk";
import { decryptQuestionPack, type EncryptedQuestionPack } from "@/lib/crypto";
import {
  DEFAULT_CATEGORY,
  itemCategories,
  resolveCategoryLabel,
} from "@/lib/categories";
import {
  getQuestionsForCategory,
  NUM_QUESTIONS,
} from "@/lib/questionTemplates";
import { lostETHFoundAbi, getStatusLabel } from "@/lib/contracts";
import { parseSolidityCallData } from "@/lib/solidity";
import {
  useAccount,
  usePublicClient,
  useReadContract,
  useWriteContract,
} from "wagmi";
import { parseAbiItem, hexToString } from "viem";

type FlowMode = "tagged" | "untagged";

export default function ClaimPage() {
  const [mode, setMode] = useState<FlowMode>("tagged");
  const [categoryChoice, setCategoryChoice] = useState(DEFAULT_CATEGORY);
  const [customCategory, setCustomCategory] = useState("");
  const [secretInput, setSecretInput] = useState("");
  const [itemSaltInput, setItemSaltInput] = useState("0");
  const [claimIdInput, setClaimIdInput] = useState("");
  const [contractAddress, setContractAddress] = useState(
    process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || ""
  );
  const [commitment, setCommitment] = useState<bigint | null>(null);
  const [nullifier, setNullifier] = useState<bigint | null>(null);
  const [publicSignals, setPublicSignals] = useState<string[] | null>(null);
  const [proofJson, setProofJson] = useState<string>("");
  const [callData, setCallData] = useState<string>("");
  const [status, setStatus] = useState<string>("");

  // Untagged flow state
  const [serialInput, setSerialInput] = useState("");
  const [decryptedPack, setDecryptedPack] =
    useState<EncryptedQuestionPack | null>(null);
  const [finderAnswers, setFinderAnswers] = useState<string[]>(
    Array(NUM_QUESTIONS).fill("")
  );
  const [packId, setPackId] = useState<bigint | null>(null);
  const [matchedTokenId, setMatchedTokenId] = useState<bigint | null>(null);
  const [matchedItemData, setMatchedItemData] = useState<{
    reward: bigint;
    status: number;
    threshold: number;
  } | null>(null);

  const resolvedCategory = resolveCategoryLabel(categoryChoice, customCategory);
  const questions = getQuestionsForCategory(categoryChoice);
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync, isPending } = useWriteContract();

  // Read item data by packId
  const { data: packTokenId } = useReadContract({
    address: contractAddress ? (contractAddress as `0x${string}`) : undefined,
    abi: lostETHFoundAbi,
    functionName: "byPackId",
    args: packId ? [toBytes32(packId)] : undefined,
    query: {
      enabled: Boolean(contractAddress && packId),
    },
  });

  useEffect(() => {
    if (!claimIdInput) {
      setClaimIdInput(formatHex(randomField()));
    }
  }, [claimIdInput]);

  const handleGenerateClaimId = () => {
    const claimId = randomField();
    setClaimIdInput(formatHex(claimId));
  };

  const handleUpdateFinderAnswer = (index: number, value: string) => {
    const newAnswers = [...finderAnswers];
    newAnswers[index] = value;
    setFinderAnswers(newAnswers);
  };

  // ============ TAGGED FLOW ============
  const handleGenerateTaggedProof = async () => {
    setStatus("");
    const secret = parseSecretInput(secretInput);
    const itemSalt = parseField(itemSaltInput) ?? 0n;
    const claimId = parseField(claimIdInput);

    if (!resolvedCategory) {
      setStatus("Choose an item type or enter a custom one.");
      return;
    }
    if (secret === null || claimId === null) {
      setStatus("Enter a valid return code.");
      return;
    }

    try {
      setStatus("Generating proof...");
      const catId = await categoryIdFromLabel(resolvedCategory);
      const nextCommitment = await commitmentFrom(secret, catId, itemSalt);
      const nextNullifier = await nullifierFrom(secret, claimId);

      const { groth16 } = await import("snarkjs");
      const input = {
        secret: secret.toString(),
        categoryId: catId.toString(),
        itemIdSalt: itemSalt.toString(),
        claimId: claimId.toString(),
        commitment: nextCommitment.toString(),
        nullifier: nextNullifier.toString(),
      };

      const { proof, publicSignals } = await groth16.fullProve(
        input,
        "/zk/LOSTETHFOUND.wasm",
        "/zk/LOSTETHFOUND.zkey"
      );

      const exportedCallData = await groth16.exportSolidityCallData(
        proof,
        publicSignals
      );

      setCommitment(nextCommitment);
      setNullifier(nextNullifier);
      setPublicSignals(publicSignals);
      setProofJson(JSON.stringify(proof, null, 2));
      setCallData(exportedCallData);
      setStatus("Proof ready. You can submit it on-chain.");
    } catch (error) {
      setStatus(`Proof failed: ${String(error)}`);
    }
  };

  const handleClaimTagged = async () => {
    if (!callData || !contractAddress) {
      setStatus("Generate a proof and make sure the registry address is set.");
      return;
    }

    try {
      setStatus("Submitting claim...");
      const { pA, pB, pC, publicSignals } = parseSolidityCallData(callData);

      const commitmentArg = toBytes32(publicSignals[0]);
      const nullifierArg = toBytes32(publicSignals[1]);

      await writeContractAsync({
        address: contractAddress as `0x${string}`,
        abi: lostETHFoundAbi,
        functionName: "claimTagged",
        args: [commitmentArg, nullifierArg, pA, pB, pC, publicSignals],
      });

      setStatus(
        "Claim submitted! Reward sent to your wallet. Check your NFTs for the Good Samaritan badge."
      );
    } catch (error) {
      setStatus(`Claim failed: ${String(error)}`);
    }
  };

  // ============ UNTAGGED FLOW ============
  const handleSearchPack = async () => {
    setStatus("");
    setDecryptedPack(null);
    setMatchedTokenId(null);
    setMatchedItemData(null);

    if (!serialInput.trim()) {
      setStatus("Enter the serial number from the item.");
      return;
    }

    if (!contractAddress || !publicClient) {
      setStatus("Enter contract address and connect wallet.");
      return;
    }

    try {
      setStatus("Searching for matching pack...");

      // Get all QuestionPackCreated events
      const event = parseAbiItem(
        "event QuestionPackCreated(uint256 indexed tokenId, bytes32 indexed packId, address indexed owner, bytes32 categoryId, uint8 threshold, uint256 reward)"
      );

      const logs = await publicClient.getLogs({
        address: contractAddress as `0x${string}`,
        event,
        fromBlock: BigInt(process.env.NEXT_PUBLIC_DEPLOYMENT_BLOCK || "0"),
      });

      // Try to decrypt each pack with the serial
      for (const log of logs) {
        const tokenId = log.args.tokenId;
        if (!tokenId) continue;

        try {
          // Get the encrypted contact data from the contract
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

          const encryptedContact = itemData[7];
          if (!encryptedContact || encryptedContact === "0x") continue;

          // Try to decrypt
          const contactStr = hexToString(encryptedContact as `0x${string}`);
          const pack = await decryptQuestionPack(serialInput, contactStr);

          if (pack) {
            // Found a match!
            setDecryptedPack(pack);
            setMatchedTokenId(tokenId);
            setMatchedItemData({
              reward: itemData[3],
              status: itemData[4],
              threshold: itemData[2],
            });
            setFinderAnswers(Array(NUM_QUESTIONS).fill(""));
            setStatus("Pack found! Answer the questions below.");
            return;
          }
        } catch {
          // Decryption failed, try next
          continue;
        }
      }

      setStatus("No matching pack found for this serial.");
    } catch (error) {
      setStatus(`Search failed: ${String(error)}`);
    }
  };

  const handleGenerateUntaggedProof = async () => {
    setStatus("");

    if (!decryptedPack || !matchedItemData) {
      setStatus("Search for a pack first.");
      return;
    }

    const filledAnswers = finderAnswers.filter((a) => a.trim());
    if (filledAnswers.length < matchedItemData.threshold) {
      setStatus(`Answer at least ${matchedItemData.threshold} questions.`);
      return;
    }

    try {
      setStatus("Computing answer hashes and generating proof...");

      // Compute pack ID from answers
      const catId = await categoryIdFromLabel(resolvedCategory);
      const nextPackId = await packIdFrom(catId, finderAnswers);
      setPackId(nextPackId);

      // Compute answer hashes for circuit input
      const answerHashes = await computeAnswerHashes(finderAnswers);
      const answerFields = finderAnswers.map(answerToField);

      // Generate ZK proof
      const { groth16 } = await import("snarkjs");
      const input = {
        answers: answerFields.map((f) => f.toString()),
        answerHashes: answerHashes.map((h) => h.toString()),
        threshold: matchedItemData.threshold.toString(),
        packId: nextPackId.toString(),
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

      setPublicSignals(publicSignals);
      setProofJson(JSON.stringify(proof, null, 2));
      setCallData(exportedCallData);
      setStatus("Proof ready. You can submit it on-chain.");
    } catch (error) {
      setStatus(`Proof failed: ${String(error)}`);
    }
  };

  const handleClaimUntagged = async () => {
    if (!packId || !callData || !contractAddress) {
      setStatus("Generate a proof first.");
      return;
    }

    try {
      setStatus("Submitting claim...");

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
        functionName: "claimUntagged",
        args: [toBytes32(packId), pA, pB, pC, publicSignals],
      });

      setStatus(
        `Claim submitted! Reward sent to your wallet. Contact: ${
          decryptedPack?.contact || "Check your Good Samaritan badge."
        }`
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
          <h1 className="text-3xl font-semibold">Claim Found Item</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Found an item? Use the return code or answer questions to prove you
            have it and claim the reward.
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
              Has Return Code
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
              Answer Questions
            </button>
          </div>

          {mode === "tagged" ? (
            // ============ TAGGED CLAIM UI ============
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
                      onChange={(event) =>
                        setCustomCategory(event.target.value)
                      }
                      placeholder="e.g. camera"
                    />
                  </label>
                )}
              </div>

              <label className="flex flex-col gap-2 text-sm">
                Return code from the item
                <input
                  className="rounded-xl border border-black/15 bg-white/80 px-4 py-3 font-mono"
                  value={secretInput}
                  onChange={(event) => setSecretInput(event.target.value)}
                  placeholder="LF-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX"
                />
              </label>

              <label className="flex flex-col gap-2 text-sm">
                Claim ID (auto-generated)
                <div className="flex gap-2">
                  <input
                    className="flex-1 rounded-xl border border-black/15 bg-white/80 px-4 py-3 font-mono text-xs"
                    value={claimIdInput}
                    readOnly
                  />
                  <button
                    type="button"
                    className="rounded-xl border border-black/15 px-4 py-3 text-sm"
                    onClick={handleGenerateClaimId}
                  >
                    New
                  </button>
                </div>
              </label>

              <div className="grid gap-3 md:grid-cols-2">
                <button
                  type="button"
                  className="w-full rounded-full border border-black/20 px-6 py-3 text-sm font-semibold"
                  onClick={handleGenerateTaggedProof}
                >
                  Generate Proof
                </button>
                <button
                  type="button"
                  disabled={!address || !callData || isPending}
                  className="w-full rounded-full bg-[var(--accent)] px-6 py-3 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={handleClaimTagged}
                >
                  {isPending ? "Claiming..." : "Claim Reward"}
                </button>
              </div>
            </div>
          ) : (
            // ============ UNTAGGED CLAIM UI ============
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
                      onChange={(event) =>
                        setCustomCategory(event.target.value)
                      }
                      placeholder="e.g. camera"
                    />
                  </label>
                )}
              </div>

              <label className="flex flex-col gap-2 text-sm">
                Serial number from the item
                <div className="flex gap-2">
                  <input
                    className="flex-1 rounded-xl border border-black/15 bg-white/80 px-4 py-3 font-mono"
                    value={serialInput}
                    onChange={(event) => setSerialInput(event.target.value)}
                    placeholder="LF-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX"
                  />
                  <button
                    type="button"
                    className="rounded-xl border border-black/15 px-4 py-3 text-sm"
                    onClick={handleSearchPack}
                  >
                    Search
                  </button>
                </div>
                <p className="text-xs text-[var(--muted)]">
                  Enter the serial to decrypt the questions for this item.
                </p>
              </label>

              {decryptedPack && matchedItemData && (
                <>
                  <div className="rounded-2xl border border-green-500/30 bg-green-50/50 p-4">
                    <p className="font-semibold text-green-700">Pack Found!</p>
                    <p className="mt-1 text-sm text-green-600">
                      Reward:{" "}
                      {(Number(matchedItemData.reward) / 1e18).toFixed(4)} ETH
                    </p>
                    <p className="text-sm text-green-600">
                      Status: {getStatusLabel(matchedItemData.status)}
                    </p>
                    <p className="text-sm text-green-600">
                      Need {matchedItemData.threshold} of {NUM_QUESTIONS}{" "}
                      correct answers
                    </p>
                  </div>

                  <div className="mt-4">
                    <h3 className="text-sm font-semibold">
                      Answer the questions
                    </h3>
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      Look at the item and answer these questions to prove you
                      have it.
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
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <button
                      type="button"
                      className="w-full rounded-full border border-black/20 px-6 py-3 text-sm font-semibold"
                      onClick={handleGenerateUntaggedProof}
                    >
                      Generate Proof
                    </button>
                    <button
                      type="button"
                      disabled={!address || !callData || isPending}
                      className="w-full rounded-full bg-[var(--accent)] px-6 py-3 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:opacity-50"
                      onClick={handleClaimUntagged}
                    >
                      {isPending ? "Claiming..." : "Claim Reward"}
                    </button>
                  </div>
                </>
              )}
            </div>
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
            </div>
            <div className="rounded-2xl border border-black/10 bg-white/80 p-4">
              <p className="text-xs uppercase text-[var(--muted)]">
                {mode === "tagged" ? "Nullifier" : "Valid"}
              </p>
              <p className="mt-2 break-all font-mono text-xs">
                {mode === "tagged"
                  ? nullifier
                    ? formatHex(nullifier)
                    : "—"
                  : publicSignals
                  ? publicSignals[7] === "1"
                    ? "Threshold met"
                    : "Threshold not met"
                  : "—"}
              </p>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-black/10 bg-white/80 p-4">
            <p className="text-xs uppercase text-[var(--muted)]">Proof</p>
            <pre className="mt-2 max-h-32 overflow-auto rounded-xl bg-black/5 p-3 text-[10px]">
              {proofJson || "—"}
            </pre>
          </div>
        </section>
      </main>
    </div>
  );
}
