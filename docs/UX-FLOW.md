# LostETHFound UX Flow Chart (E2E)

A privacy-preserving lost & found dApp using zero-knowledge proofs on Ethereum.

---

## High-Level System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              LOSTETHFOUND                                   │
│                     "Find it. Prove it. Get it back."                       │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                    ┌────────────────┴────────────────┐
                    ▼                                 ▼
        ┌───────────────────┐             ┌───────────────────┐
        │   OWNER FLOW      │             │   FINDER FLOW     │
        │  "I lost something"│             │ "I found something"│
        │      /register     │             │      /claim        │
        └───────────────────┘             └───────────────────┘
```

---

## Complete E2E User Journey

```
                              ┌─────────────────┐
                              │   HOMEPAGE (/)   │
                              │                 │
                              │  Hero Section   │
                              │  + Two CTAs     │
                              └────────┬────────┘
                                       │
              ┌────────────────────────┴────────────────────────┐
              │                                                 │
              ▼                                                 ▼
┌──────────────────────────┐                     ┌──────────────────────────┐
│  "I lost something"      │                     │  "I found something"     │
│         BUTTON           │                     │         BUTTON           │
└────────────┬─────────────┘                     └────────────┬─────────────┘
             │                                                │
             ▼                                                ▼
┌──────────────────────────┐                     ┌──────────────────────────┐
│    REGISTER PAGE         │                     │      CLAIM PAGE          │
│       /register          │                     │        /claim            │
└──────────────────────────┘                     └──────────────────────────┘
```

---

## Owner Flow (Registration)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         OWNER REGISTRATION FLOW                              │
│                              /register                                       │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────┐     ┌──────────────────┐     ┌─────────────────────┐
│   START     │────▶│  Connect Wallet  │────▶│  Enter Item Details │
│             │     │   (MetaMask)     │     │                     │
└─────────────┘     └──────────────────┘     └──────────┬──────────┘
                                                        │
                    ┌───────────────────────────────────┘
                    │
                    ▼
    ┌───────────────────────────────────────────────────────────────┐
    │                    REGISTRATION FORM                          │
    │  ┌─────────────────────────────────────────────────────────┐  │
    │  │  • Category Label (e.g., "electronics", "macbook")      │  │
    │  │  • Secret [_____________] [Generate Random]             │  │
    │  │  • Item Salt (optional)                                  │  │
    │  │  • Reward Amount (ETH)                                   │  │
    │  │  • Encrypted Contact (optional)                          │  │
    │  └─────────────────────────────────────────────────────────┘  │
    └───────────────────────────────────────────────────────────────┘
                    │
                    ▼
    ┌───────────────────────────────────────────────────────────────┐
    │              [Compute Commitment] Button                      │
    │                                                               │
    │   Client-side cryptography (browser):                         │
    │   ┌─────────────────────────────────────────────────────────┐ │
    │   │  categoryId = Poseidon(domain, category)                │ │
    │   │  commitment = Poseidon(secret, categoryId, itemIdSalt)  │ │
    │   └─────────────────────────────────────────────────────────┘ │
    └───────────────────────────────────────────────────────────────┘
                    │
                    ▼
    ┌───────────────────────────────────────────────────────────────┐
    │              COMPUTED VALUES DISPLAY                          │
    │  ┌─────────────────────────────────────────────────────────┐  │
    │  │  Category ID: 0x1234...                                  │  │
    │  │  Commitment:  0xabcd...  (bytes32)                       │  │
    │  └─────────────────────────────────────────────────────────┘  │
    └───────────────────────────────────────────────────────────────┘
                    │
                    ▼
    ┌───────────────────────────────────────────────────────────────┐
    │              [Register On-Chain] Button                       │
    │                                                               │
    │   Wallet Popup:                                               │
    │   ┌─────────────────────────────────────────────────────────┐ │
    │   │  Transaction Details:                                   │ │
    │   │  • Function: registerItem()                             │ │
    │   │  • Value: [Reward Amount] ETH                           │ │
    │   │  • Gas Estimate: ~XX,XXX                                │ │
    │   │              [Confirm]  [Reject]                        │ │
    │   └─────────────────────────────────────────────────────────┘ │
    └───────────────────────────────────────────────────────────────┘
                    │
                    ▼
    ┌───────────────────────────────────────────────────────────────┐
    │                    ON-CHAIN (Ethereum)                        │
    │   ┌─────────────────────────────────────────────────────────┐ │
    │   │  LostETHFound.registerItem(commitment, contact, reward) │ │
    │   │                                                         │ │
    │   │  Storage: items[commitment] = {                         │ │
    │   │    owner: msg.sender,                                   │ │
    │   │    encryptedContact: ...,                               │ │
    │   │    reward: rewardWei,                                   │ │
    │   │    claimed: false                                       │ │
    │   │  }                                                      │ │
    │   │                                                         │ │
    │   │  Event: ItemRegistered(commitment, owner, reward)       │ │
    │   └─────────────────────────────────────────────────────────┘ │
    └───────────────────────────────────────────────────────────────┘
                    │
                    ▼
    ┌───────────────────────────────────────────────────────────────┐
    │                    POST-REGISTRATION                          │
    │                                                               │
    │   Owner's task: Place secret on the item                      │
    │   ┌─────────────────────────────────────────────────────────┐ │
    │   │  Options:                                               │ │
    │   │  • QR code sticker                                      │ │
    │   │  • Hidden tag/label                                     │ │
    │   │  • Engraved code                                        │ │
    │   │  • Secret phrase on item                                │ │
    │   └─────────────────────────────────────────────────────────┘ │
    └───────────────────────────────────────────────────────────────┘
                    │
                    ▼
              ┌───────────┐
              │    END    │
              │  (Owner)  │
              └───────────┘
```

---

## Finder Flow (Claim)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            FINDER CLAIM FLOW                                 │
│                                /claim                                        │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  PREREQUISITE: Finder discovers item with secret                            │
│  (QR code, hidden tag, engraved code, etc.)                                 │
└─────────────────────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────┐     ┌──────────────────┐     ┌─────────────────────┐
│   START     │────▶│  Connect Wallet  │────▶│  Enter Claim Details│
│             │     │   (MetaMask)     │     │                     │
└─────────────┘     └──────────────────┘     └──────────┬──────────┘
                                                        │
                    ┌───────────────────────────────────┘
                    │
                    ▼
    ┌───────────────────────────────────────────────────────────────┐
    │                      CLAIM FORM                               │
    │  ┌─────────────────────────────────────────────────────────┐  │
    │  │  • Contract Address                                      │  │
    │  │  • Category Label (from item)                            │  │
    │  │  • Secret [_____________] (from item)                    │  │
    │  │  • Item Salt (if applicable)                             │  │
    │  │  • Claim ID [_____________] [Generate Random]            │  │
    │  │  • Claim Bond Override (optional)                        │  │
    │  └─────────────────────────────────────────────────────────┘  │
    └───────────────────────────────────────────────────────────────┘
                    │
                    ▼
    ┌───────────────────────────────────────────────────────────────┐
    │              [Generate Proof] Button                          │
    │                                                               │
    │   Client-side ZK proof generation (~15-30 seconds):           │
    │   ┌─────────────────────────────────────────────────────────┐ │
    │   │  PRIVATE INPUTS (never leave browser):                  │ │
    │   │  • secret                                               │ │
    │   │  • categoryId                                           │ │
    │   │  • itemIdSalt                                           │ │
    │   │  • claimId                                              │ │
    │   │                                                         │ │
    │   │  COMPUTATION:                                           │ │
    │   │  commitment = Poseidon(secret, categoryId, itemIdSalt)  │ │
    │   │  nullifier  = Poseidon(secret, claimId)                 │ │
    │   │                                                         │ │
    │   │  ZK CIRCUIT (Groth16):                                  │ │
    │   │  Proves: "I know secret s.t. commitment & nullifier"    │ │
    │   │  Without revealing: the actual secret                   │ │
    │   └─────────────────────────────────────────────────────────┘ │
    └───────────────────────────────────────────────────────────────┘
                    │
                    ▼
    ┌───────────────────────────────────────────────────────────────┐
    │              COMPUTED VALUES DISPLAY                          │
    │  ┌─────────────────────────────────────────────────────────┐  │
    │  │  Commitment:      0xabcd...                              │  │
    │  │  Nullifier:       0x5678...                              │  │
    │  │  Public Signals:  [commitment, nullifier]                │  │
    │  │  Proof:           { pi_a: [...], pi_b: [...], pi_c: ...} │  │
    │  │  Solidity Data:   pA, pB, pC (parsed for contract call)  │  │
    │  └─────────────────────────────────────────────────────────┘  │
    └───────────────────────────────────────────────────────────────┘
                    │
                    ▼
    ┌───────────────────────────────────────────────────────────────┐
    │              [Claim On-Chain] Button                          │
    │                                                               │
    │   Wallet Popup:                                               │
    │   ┌─────────────────────────────────────────────────────────┐ │
    │   │  Transaction Details:                                   │ │
    │   │  • Function: claim()                                    │ │
    │   │  • Value: [Claim Bond] ETH (if required)                │ │
    │   │  • Gas Estimate: ~XXX,XXX                               │ │
    │   │              [Confirm]  [Reject]                        │ │
    │   └─────────────────────────────────────────────────────────┘ │
    └───────────────────────────────────────────────────────────────┘
                    │
                    ▼
    ┌───────────────────────────────────────────────────────────────┐
    │                    ON-CHAIN (Ethereum)                        │
    │   ┌─────────────────────────────────────────────────────────┐ │
    │   │  LostETHFound.claim(commitment, nullifier, payout,      │ │
    │   │                     pA, pB, pC, publicSignals)          │ │
    │   │                                                         │ │
    │   │  VERIFICATIONS:                                         │ │
    │   │  ✓ commitment exists (item registered)                  │ │
    │   │  ✓ item not already claimed                             │ │
    │   │  ✓ nullifier not already used                           │ │
    │   │  ✓ Groth16 proof valid (verifier contract)              │ │
    │   │  ✓ publicSignals match commitment & nullifier           │ │
    │   │                                                         │ │
    │   │  STATE CHANGES:                                         │ │
    │   │  • nullifierUsed[nullifier] = true                      │ │
    │   │  • items[commitment].claimed = true                     │ │
    │   │  • Transfer reward → finder address                     │ │
    │   │                                                         │ │
    │   │  Event: Claimed(commitment, nullifier, payout)          │ │
    │   └─────────────────────────────────────────────────────────┘ │
    └───────────────────────────────────────────────────────────────┘
                    │
                    ▼
    ┌───────────────────────────────────────────────────────────────┐
    │                    SUCCESS STATE                              │
    │  ┌─────────────────────────────────────────────────────────┐  │
    │  │  Finder receives:                                        │  │
    │  │  • Reward amount (ETH)                                   │  │
    │  │  • Claim bond (if applicable)                            │  │
    │  │  • Confirmation of successful claim                      │  │
    │  └─────────────────────────────────────────────────────────┘  │
    └───────────────────────────────────────────────────────────────┘
                    │
                    ▼
              ┌───────────┐
              │    END    │
              │  (Finder) │
              └───────────┘
```

---

## Navigation Structure

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           NAVIGATION BAR                                     │
│  ┌───────────┐  ┌──────────┐  ┌─────────┐  ┌─────────────────────────────┐  │
│  │   Logo    │  │ Register │  │  Claim  │  │      WalletButton           │  │
│  │ (→ Home)  │  │  (→ /r)  │  │ (→ /c)  │  │  [Connect] or [0x123...]    │  │
│  └───────────┘  └──────────┘  └─────────┘  └─────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘

ROUTES:
┌─────────────────────────────────────────────────────────────────────────────┐
│  /              Homepage (landing, CTAs)                                     │
│  /register      Owner registration form                                      │
│  /claim         Finder claim form + proof generation                         │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Wallet States

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         WALLET CONNECTION STATES                             │
└─────────────────────────────────────────────────────────────────────────────┘

    ┌─────────────────┐                      ┌─────────────────┐
    │   DISCONNECTED  │◀────────────────────▶│    CONNECTED    │
    │                 │     Click Toggle     │                 │
    │  [Connect]      │                      │  [0x123...abc]  │
    │   Button        │                      │   (truncated)   │
    └─────────────────┘                      └─────────────────┘
           │                                        │
           │                                        │
           ▼                                        ▼
    ┌─────────────────┐                      ┌─────────────────┐
    │  Can browse     │                      │  Can execute    │
    │  No transactions│                      │  transactions   │
    │                 │                      │  (register/claim│
    └─────────────────┘                      └─────────────────┘
```

---

## Data Flow Summary

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              DATA FLOW                                       │
└─────────────────────────────────────────────────────────────────────────────┘

REGISTRATION:
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│ User Input   │────▶│ Client-side  │────▶│  On-chain    │────▶│   Physical   │
│ (secret,     │     │ Poseidon     │     │  Storage     │     │   World      │
│  category,   │     │ Hash         │     │  (items      │     │   (secret    │
│  reward)     │     │ (commitment) │     │  mapping)    │     │   on item)   │
└──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘

CLAIM:
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│ Secret from  │────▶│ Client-side  │────▶│  On-chain    │────▶│   Reward     │
│ Item         │     │ ZK Proof     │     │  Verification│     │   Transfer   │
│              │     │ Generation   │     │  (Groth16)   │     │   to Finder  │
└──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘

KEY INSIGHT: Secret NEVER touches the blockchain - only cryptographic commitments
```

---

## Privacy Model

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           PRIVACY GUARANTEES                                 │
└─────────────────────────────────────────────────────────────────────────────┘

    ┌────────────────────────────────┐     ┌────────────────────────────────┐
    │       STAYS PRIVATE            │     │      GOES ON-CHAIN             │
    │       (Browser only)           │     │      (Public)                  │
    ├────────────────────────────────┤     ├────────────────────────────────┤
    │  • Secret                      │     │  • Commitment (hash)           │
    │  • Category ID                 │     │  • Nullifier (hash)            │
    │  • Item Salt                   │     │  • Reward amount               │
    │  • Claim ID                    │     │  • Owner/Finder addresses      │
    │  • ZK proof private inputs     │     │  • ZK proof (public part)      │
    └────────────────────────────────┘     └────────────────────────────────┘
```

---

## Error/Edge Cases

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           ERROR STATES                                       │
└─────────────────────────────────────────────────────────────────────────────┘

REGISTRATION ERRORS:
• "commitment required" → Empty secret
• "already registered" → Item already exists
• "reward mismatch" → ETH sent ≠ stated reward

CLAIM ERRORS:
• "not registered" → Commitment doesn't exist
• "already claimed" → Item was claimed before
• "nullifier used" → Replay attack detected
• "invalid proof" → ZK proof verification failed
• "commitment mismatch" → Wrong public signals
• "reward transfer failed" → Payout address issue
```

---

## Key Files Reference

| File                            | Purpose                           |
| ------------------------------- | --------------------------------- |
| `web/src/app/page.tsx`          | Homepage with CTAs                |
| `web/src/app/register/page.tsx` | Owner registration form           |
| `web/src/app/claim/page.tsx`    | Finder claim + proof generation   |
| `web/src/lib/zk.ts`             | Poseidon hashing, proof utilities |
| `web/src/lib/contracts.ts`      | Contract ABI                      |
| `contracts/LostETHFound.sol`    | Main smart contract               |
| `circuits/LOSTETHFOUND.circom`  | ZK circuit definition             |
