import { buildPoseidon } from "circomlibjs";
import { bytesToHex, keccak256, stringToHex } from "viem";

export const FIELD = BigInt(
  "21888242871839275222246405745257275088548364400416034343698204186575808495617"
);

let poseidonInstance: Awaited<ReturnType<typeof buildPoseidon>> | null = null;

async function getPoseidon() {
  if (!poseidonInstance) {
    poseidonInstance = await buildPoseidon();
  }
  return poseidonInstance;
}

export function toFieldFromText(text: string): bigint {
  const hash = keccak256(stringToHex(text));
  return BigInt(hash) % FIELD;
}

export function randomField(): bigint {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const hex = bytesToHex(bytes);
  return BigInt(hex) % FIELD;
}

export function formatHex(value: bigint): string {
  return `0x${value.toString(16)}`;
}

export function toBytes32(value: bigint): `0x${string}` {
  return `0x${value.toString(16).padStart(64, "0")}` as const;
}

export function parseField(value: string): bigint | null {
  const clean = value.trim();
  if (!clean) return null;
  try {
    return BigInt(clean);
  } catch {
    return null;
  }
}

export function parseSecretInput(value: string): bigint | null {
  const clean = value.trim();
  if (!clean || clean === "0x") return null;
  try {
    return BigInt(clean);
  } catch {
    return toFieldFromText(clean);
  }
}

export async function poseidonHash(inputs: bigint[]): Promise<bigint> {
  const poseidon = await getPoseidon();
  const result = poseidon(inputs);
  return poseidon.F.toObject(result) as bigint;
}

export async function categoryIdFromLabel(label: string): Promise<bigint> {
  const domain = toFieldFromText("lostethfound:category:v1");
  const cat = toFieldFromText(label.trim().toLowerCase());
  return poseidonHash([domain, cat]);
}

export async function commitmentFrom(
  secret: bigint,
  categoryId: bigint,
  itemIdSalt: bigint
): Promise<bigint> {
  return poseidonHash([secret, categoryId, itemIdSalt]);
}

export async function nullifierFrom(
  secret: bigint,
  claimId: bigint
): Promise<bigint> {
  return poseidonHash([secret, claimId]);
}

// ============ ANSWER NORMALIZATION ============

/**
 * Normalizes an answer string for consistent hashing.
 * - Converts to lowercase
 * - Removes punctuation and extra whitespace
 * - Trims leading/trailing whitespace
 *
 * Examples:
 *   "Baby Yoda"       -> "babyyoda"
 *   "baby yoda"       -> "babyyoda"
 *   "BABY YODA"       -> "babyyoda"
 *   "baby-yoda"       -> "babyyoda"
 *   "  Baby  Yoda  "  -> "babyyoda"
 */
export function normalizeAnswer(answer: string): string {
  return answer
    .toLowerCase()
    .replace(/[\s\-_.,!?'"]/g, "") // Remove punctuation and spaces
    .trim();
}

/**
 * Converts a normalized answer to a field element.
 * Uses keccak256 and modular reduction to fit in the SNARK field.
 */
export function answerToField(answer: string): bigint {
  const normalized = normalizeAnswer(answer);
  if (!normalized) return 0n;
  return toFieldFromText(normalized);
}

/**
 * Computes Poseidon(index, normalizedAnswer) for a single answer.
 * This is the hash format expected by the QuestionPackProof circuit.
 */
export async function answerHashFrom(
  index: number,
  answer: string
): Promise<bigint> {
  const answerField = answerToField(answer);
  return poseidonHash([BigInt(index), answerField]);
}

/**
 * Computes answer hashes for an array of answers.
 * Each hash is Poseidon(index, normalizedAnswer).
 */
export async function computeAnswerHashes(
  answers: string[]
): Promise<bigint[]> {
  const hashes: bigint[] = [];
  for (let i = 0; i < answers.length; i++) {
    const hash = await answerHashFrom(i, answers[i]);
    hashes.push(hash);
  }
  return hashes;
}

/**
 * Computes a pack ID from category and answers.
 * This is used to look up question packs.
 */
export async function packIdFrom(
  categoryId: bigint,
  answers: string[]
): Promise<bigint> {
  const normalizedConcat = answers.map(normalizeAnswer).join("");
  const answersField = toFieldFromText(normalizedConcat);
  return poseidonHash([categoryId, answersField]);
}

// ============ SERIAL/SECRET UTILITIES ============

/**
 * Normalizes a serial number for consistent encryption key generation.
 * - Uppercase
 * - Remove dashes and spaces
 */
export function normalizeSerial(serial: string): string {
  return serial
    .toUpperCase()
    .replace(/[\s\-]/g, "")
    .trim();
}

/**
 * Converts a serial number to a 256-bit key for AES encryption.
 */
export function serialToKey(serial: string): Uint8Array {
  const normalized = normalizeSerial(serial);
  const hash = keccak256(stringToHex(normalized));
  // Convert hex string to bytes
  const bytes = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    bytes[i] = parseInt(hash.slice(2 + i * 2, 4 + i * 2), 16);
  }
  return bytes;
}
