# LostETHFound End-to-End Flow (Feb 1)

## Implementation Status (Feb 1, 2026)

### Smart Contract (`contracts/LostETHFound.sol`)

- [x] Status enum: `Active`, `Lost`, `Found`, `Returned`
- [x] New events: `BountyActivated`, `FoundPending`, `ReturnConfirmed`
- [x] `activateBounty(tokenId)` - Owner escrows reward when status is Lost
- [x] `claimTagged` / `claimUntagged` - Sets status to Found, records finder, does NOT pay reward
- [x] `confirmReturn(tokenId)` - Owner confirms, pays reward, mints badge, sets Returned
- [x] NFT SVG shows "Found" status

### Frontend ABI (`web/src/lib/contracts.ts`)

- [x] Added `activateBounty` function
- [x] Added `confirmReturn` function
- [x] Added new events (BountyActivated, FoundPending, ReturnConfirmed)
- [x] Updated ItemStatus enum: `Active=0, Lost=1, Found=2, Returned=3`
- [x] Added `getStatusColor()` helper

### Claim Page (`web/src/app/claim/page.tsx`)

- [x] Updated success message: "Waiting for owner confirmation"

### Owner Dashboard (`web/src/app/dashboard/page.tsx`) - NEW

- [x] Shows owned items with current status
- [x] Status indicators with colors (blue/red/orange/green)
- [x] "Mark as Lost" button for Active items
- [x] "Add Bounty" button for Lost items
- [x] "Confirm Return & Pay Reward" button for Found items
- [x] Added Dashboard link to navigation

### Verification

```bash
cd /Users/saeeddawod/Desktop/lostETHfound
bunx hardhat compile  # ✅ Compiles
cd web && bun run build  # ✅ Builds
```

---

## One-sentence summary

A public Return ID links the physical item to an on-chain record, questions + ZK prove possession, and the owner confirms return after activating the bounty.

## Actors

- Owner: registers the item and activates the bounty when lost.
- Finder: finds the item and proves possession.

## Data + Trust Anchors

- Return ID (public): printed on the item; used only to find the on-chain record.
- Questions + ZK proof: prove the finder actually has the item without revealing answers.
- NFT: on-chain registration receipt + live status card (shows Return ID hash, status, bounty).
- Owner confirmation: releases payout after real-world handoff.

## Status Lifecycle

Active -> Lost -> Found (Pending) -> Returned

## Boxed Flow (Tagged + Questions)

```
┌───────────────────────────────────────┐
│ 1) OWNER REGISTERS ITEM               │
│ - Return ID (public tag)              │
│ - 5 questions + threshold             │
│ - Category + (optional) initial bounty│
└───────────────┬───────────────────────┘
                │ mint NFT
                ▼
┌───────────────────────────────────────┐
│ 2) NFT MINTED (Active)                │
│ - Shows Return ID hash                │
│ - Shows live status/bounty            │
└───────────────┬───────────────────────┘
                │ item lost
                ▼
┌───────────────────────────────────────┐
│ 3) OWNER MARKS LOST                   │
│ - Status = Lost                       │
└───────────────┬───────────────────────┘
                │ activate bounty
                ▼
┌───────────────────────────────────────┐
│ 4) OWNER ACTIVATES BOUNTY             │
│ - Escrows reward on-chain             │
└───────────────┬───────────────────────┘
                │ finder sees tag
                ▼
┌───────────────────────────────────────┐
│ 5) FINDER ENTERS RETURN ID            │
│ - App loads item by Return ID hash    │
└───────────────┬───────────────────────┘
                │ answers + proof
                ▼
┌───────────────────────────────────────┐
│ 6) FINDER SUBMITS ZK PROOF            │
│ - Status = Found (Pending)            │
│ - Finder recorded                     │
└───────────────┬───────────────────────┘
                │ meet in person
                ▼
┌───────────────────────────────────────┐
│ 7) HANDOFF + CONFIRM RETURN           │
│ - Owner verifies item                 │
│ - Owner confirms on-chain             │
│ - Bounty released                     │
│ - Status = Returned                   │
└───────────────────────────────────────┘
```

## Default Flow (Tag + Questions)

1. Owner registers the item with:
   - Return ID (public, on tag)
   - Category
   - 5 observable questions + threshold
   - Bounty (can be 0 at registration)
2. Contract stores:
   - Return ID hash
   - Answer hashes + threshold
   - Reward, status = Active
3. NFT is minted. SVG shows status/bounty and Return ID hash.
4. When item is lost, owner marks it Lost.
5. Owner activates bounty (escrows reward) via activateBounty.
6. Finder sees the Return ID on the tag and opens the Claim flow.
7. App looks up the item by Return ID hash and shows the questions.
8. Finder answers questions and generates a ZK proof.
9. Contract verifies proof, sets status = Found (Pending), records finder.
10. Owner and finder coordinate handoff (P2PT chat for demo; fallback if needed).
11. Owner verifies the physical item in person.
12. Owner confirms return on-chain.
13. Contract releases bounty to finder and sets status = Returned.

## Open / No-Tag Flow (Fallback)

1. Owner registers questions + bounty (no Return ID).
2. Owner posts a Lost listing with text-only hints.
3. Owner activates bounty via activateBounty.
4. Finder posts a Found listing with text-only hints.
5. Owner matches listing -> shares tokenId or opens claim page.
6. Finder answers questions + ZK proof -> status Found (Pending).
7. Owner confirms return -> payout -> Returned.

## Why this is secure

- Return ID is public but not a payout key.
- ZK proves possession without revealing answers.
- Owner confirmation prevents payout without handoff.
- NFT displays the public link (Return ID hash) to tie the physical tag to on-chain record.

## What the NFT proves

- The item was registered by a specific wallet.
- Current status and bounty are live from chain.
- The Return ID hash on the NFT matches the tag on the item.

## Communication (Demo)

- Use lightweight P2P chat via P2PT (public trackers).
- If P2P fails, fall back to revealing encrypted contact after proof.
