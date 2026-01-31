export const lostETHFoundAbi = [
  // ============ ERC-721 Standard ============
  {
    type: "function",
    name: "name",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
  {
    type: "function",
    name: "symbol",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
  {
    type: "function",
    name: "tokenURI",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "string" }],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "ownerOf",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
  },

  // ============ TAGGED FLOW ============
  {
    type: "function",
    name: "registerTagged",
    stateMutability: "payable",
    inputs: [
      { name: "commitment", type: "bytes32" },
      { name: "categoryId", type: "bytes32" },
      { name: "encryptedContact", type: "bytes" },
    ],
    outputs: [{ name: "tokenId", type: "uint256" }],
  },
  {
    type: "function",
    name: "claimTagged",
    stateMutability: "nonpayable",
    inputs: [
      { name: "commitment", type: "bytes32" },
      { name: "nullifier", type: "bytes32" },
      { name: "pA", type: "uint256[2]" },
      { name: "pB", type: "uint256[2][2]" },
      { name: "pC", type: "uint256[2]" },
      { name: "publicSignals", type: "uint256[2]" },
    ],
    outputs: [],
  },

  // ============ UNTAGGED FLOW ============
  {
    type: "function",
    name: "registerUntagged",
    stateMutability: "payable",
    inputs: [
      { name: "packId", type: "bytes32" },
      { name: "categoryId", type: "bytes32" },
      { name: "answerHashes", type: "bytes32[]" },
      { name: "threshold", type: "uint8" },
      { name: "encryptedContact", type: "bytes" },
    ],
    outputs: [{ name: "tokenId", type: "uint256" }],
  },
  {
    type: "function",
    name: "claimUntagged",
    stateMutability: "nonpayable",
    inputs: [
      { name: "packId", type: "bytes32" },
      { name: "pA", type: "uint256[2]" },
      { name: "pB", type: "uint256[2][2]" },
      { name: "pC", type: "uint256[2]" },
      { name: "publicSignals", type: "uint256[8]" },
    ],
    outputs: [],
  },

  // ============ STATUS MANAGEMENT ============
  {
    type: "function",
    name: "markAsLost",
    stateMutability: "nonpayable",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "markAsActive",
    stateMutability: "nonpayable",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "addReward",
    stateMutability: "payable",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "withdrawReward",
    stateMutability: "nonpayable",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [],
  },

  // ============ VIEW FUNCTIONS ============
  {
    type: "function",
    name: "getItem",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [
      { name: "commitment", type: "bytes32" },
      { name: "categoryId", type: "bytes32" },
      { name: "threshold", type: "uint8" },
      { name: "reward", type: "uint256" },
      { name: "status", type: "uint8" },
      { name: "finder", type: "address" },
      { name: "isTagged", type: "bool" },
      { name: "encryptedContact", type: "bytes" },
    ],
  },
  {
    type: "function",
    name: "getAnswerHashes",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "bytes32[]" }],
  },
  {
    type: "function",
    name: "getBadge",
    stateMutability: "view",
    inputs: [{ name: "badgeId", type: "uint256" }],
    outputs: [
      { name: "originalItemId", type: "uint256" },
      { name: "categoryId", type: "bytes32" },
      { name: "rewardEarned", type: "uint256" },
      { name: "returnedAt", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "byCommitment",
    stateMutability: "view",
    inputs: [{ name: "", type: "bytes32" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "byPackId",
    stateMutability: "view",
    inputs: [{ name: "", type: "bytes32" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "isBadge",
    stateMutability: "view",
    inputs: [{ name: "", type: "uint256" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "nullifierUsed",
    stateMutability: "view",
    inputs: [{ name: "", type: "bytes32" }],
    outputs: [{ name: "", type: "bool" }],
  },

  // ============ EVENTS ============
  {
    type: "event",
    name: "ItemRegistered",
    inputs: [
      { name: "tokenId", type: "uint256", indexed: true },
      { name: "owner", type: "address", indexed: true },
      { name: "commitment", type: "bytes32", indexed: true },
      { name: "categoryId", type: "bytes32", indexed: false },
      { name: "reward", type: "uint256", indexed: false },
      { name: "isTagged", type: "bool", indexed: false },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "ItemStatusChanged",
    inputs: [
      { name: "tokenId", type: "uint256", indexed: true },
      { name: "status", type: "uint8", indexed: false },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "ItemClaimed",
    inputs: [
      { name: "tokenId", type: "uint256", indexed: true },
      { name: "finder", type: "address", indexed: true },
      { name: "reward", type: "uint256", indexed: false },
      { name: "badgeId", type: "uint256", indexed: false },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "QuestionPackCreated",
    inputs: [
      { name: "tokenId", type: "uint256", indexed: true },
      { name: "packId", type: "bytes32", indexed: true },
      { name: "owner", type: "address", indexed: true },
      { name: "categoryId", type: "bytes32", indexed: false },
      { name: "threshold", type: "uint8", indexed: false },
      { name: "reward", type: "uint256", indexed: false },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "Transfer",
    inputs: [
      { name: "from", type: "address", indexed: true },
      { name: "to", type: "address", indexed: true },
      { name: "tokenId", type: "uint256", indexed: true },
    ],
    anonymous: false,
  },
] as const;

// Status enum values
export const ItemStatus = {
  Active: 0,
  Lost: 1,
  Returned: 2,
} as const;

export type ItemStatusType = (typeof ItemStatus)[keyof typeof ItemStatus];

export function getStatusLabel(status: number): string {
  switch (status) {
    case ItemStatus.Active:
      return "Active";
    case ItemStatus.Lost:
      return "Lost";
    case ItemStatus.Returned:
      return "Returned";
    default:
      return "Unknown";
  }
}
