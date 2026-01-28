export const lostETHFoundAbi = [
  {
    type: "function",
    name: "registerItem",
    stateMutability: "payable",
    inputs: [
      { name: "commitment", type: "bytes32" },
      { name: "encryptedContact", type: "bytes" },
      { name: "rewardWei", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "claim",
    stateMutability: "payable",
    inputs: [
      { name: "commitment", type: "bytes32" },
      { name: "nullifier", type: "bytes32" },
      { name: "payout", type: "address" },
      { name: "pA", type: "uint256[2]" },
      { name: "pB", type: "uint256[2][2]" },
      { name: "pC", type: "uint256[2]" },
      { name: "publicSignals", type: "uint256[2]" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "claimBond",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "items",
    stateMutability: "view",
    inputs: [{ name: "", type: "bytes32" }],
    outputs: [
      { name: "owner", type: "address" },
      { name: "encryptedContact", type: "bytes" },
      { name: "reward", type: "uint256" },
      { name: "claimed", type: "bool" },
    ],
  },
] as const;
