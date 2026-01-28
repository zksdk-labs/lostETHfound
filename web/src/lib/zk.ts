import { buildPoseidon } from "circomlibjs";
import { bytesToHex, keccak256, stringToHex } from "viem";

const FIELD = BigInt(
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

export async function nullifierFrom(secret: bigint, claimId: bigint): Promise<bigint> {
  return poseidonHash([secret, claimId]);
}
