export function parseSolidityCallData(calldata: string) {
  const cleaned = calldata.replace(/[\[\]\s"]/g, "");
  const parts = cleaned.split(",").filter(Boolean);

  if (parts.length < 10) {
    throw new Error("Invalid calldata format");
  }

  const pA = [BigInt(parts[0]), BigInt(parts[1])] as const;
  const pB = [
    [BigInt(parts[2]), BigInt(parts[3])],
    [BigInt(parts[4]), BigInt(parts[5])],
  ] as const;
  const pC = [BigInt(parts[6]), BigInt(parts[7])] as const;
  const publicSignals = [BigInt(parts[8]), BigInt(parts[9])] as const;

  return { pA, pB, pC, publicSignals };
}
