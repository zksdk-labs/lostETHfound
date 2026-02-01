# LostETHFound Protocol Plan (vNext)

## Goal
Build a real-world lost-and-found protocol that maximizes item returns and minimizes scams.
We prioritize: (1) proof of possession, (2) owner confirmation before payout, (3) privacy by default, (4) minimal UX friction.

## Core Decisions (locked)
- Return ID is **public** and printed on the item. It is **not** a payout key.
- Questions are **required** for claims (tagged and no-tag). They prove possession.
- Claims only allowed when status == **Lost**.
- Bounty is **activated only after Lost** (owner opts in via `activateBounty`).
- Payout is released **only after owner confirmation** (Found/Pending stage).
- No images in v1. No verify link in NFT.

## Status Flow
Active → Lost → Found (Pending) → Returned

## User Flows

### 1) Tagged + Questions (default)
1. Owner registers item with: Return ID + category + 5 questions + bounty.
2. Return ID is printed on the item (public lookup key).
3. Owner marks item Lost when it’s actually lost.
4. Owner activates bounty (escrows reward) via `activateBounty`.
5. Finder enters Return ID → app loads the item.
6. Finder answers questions → generates ZK proof.
7. Contract verifies proof → status becomes Found (Pending), finder recorded.
8. Owner confirms return → bounty released → status Returned.

### 2) Open / No-Tag (fallback)
1. Owner registers item with questions + bounty (no Return ID).
2. Owner posts a Lost listing with text-only hints.
3. Owner activates bounty via `activateBounty`.
4. Finder posts a Found listing with text-only hints.
5. Owner matches the listing → shares tokenId or opens claim page.
6. Finder answers questions → ZK proof → Found (Pending).
7. Owner confirms return → payout → Returned.

## ZK Circuits
- Keep `circuits/QuestionPackProof.circom` as the proof for claims.
- V2 (optional): bind `packId` to answers inside the circuit.
- No need to change circuits for Return ID (public lookup only).

## Contract Changes (LostETHFound.sol)

### Data Model
- Add status: `Found` (pending).
- Add `returnIdHash` to Item.
- Add mapping: `byReturnIdHash => tokenId`.

### Registration
- New primary register function stores:
  - `returnIdHash` (bytes32)
  - `answerHashes` + `threshold`
  - `encryptedContact` (optional)
  - `reward` (can be 0 initially)
- Keep older tagged/untagged functions for compatibility if needed.

### Claim
- Require `status == Lost`.
- Require bounty active (reward > 0).
- Verify QuestionPackProof.
- Set `status = Found` and `finder = msg.sender`.
- Emit `FoundPending` event.
- **Do not pay out yet**.

### Confirm Return
- New `confirmReturn(tokenId)`:
  - only owner
  - status must be Found
  - payout to finder
  - status = Returned
  - mint Good Samaritan badge
  - emit `ReturnConfirmed`

### Bounty Activation
- New `activateBounty(tokenId)` (payable):
  - only owner
  - status must be Lost
  - adds to reward (escrows bounty)

### Open Listings (text-only)
- `LostPosted(tokenId, categoryId, hints)`
- `FoundPosted(categoryId, hints)`
- Hints are bytes (stringToHex) for demo. No images in v1.

## NFT Metadata (tokenURI)
- Keep on-chain SVG.
- Show:
  - Status (Active/Lost/Found/Returned)
  - Bounty (live)
  - Category/Type
  - **Return ID hash** (public tag lookup key, displayed in SVG)
  - Proof ID: `packId` (no-tag items)
- No verify link. No secret data.

## UI Changes (web/)

### Register Page
- Make “Return ID + Questions” the default flow.
- Generate Return ID (public) + questions + bounty.
- Store Return ID hash on-chain.

### Claim Page
- Path A: Enter Return ID → load item → answer questions → proof → Found (Pending).
- Path B: Browse Lost listings → select item → answer questions → proof → Found (Pending).

### Owner / Lost Page
- Mark item Lost / Active.
- Activate bounty (escrow) after Lost.
- View Found (Pending) claims.
- Confirm return → payout.

### Listings
- Lost board: text hints only.
- Found board: text hints only.

## Communication (v1)
- Add lightweight P2P chat using **P2PT** (WebTorrent public trackers) for demo.
- Use a room code derived from on-chain data (e.g., tokenId + finder + nonce).
- Make tracker list pluggable in config so the community can add/remove trackers.
- Fallback: if P2P fails, reveal encrypted contact after proof (no server).

## Tests / Validation
- Add tests for:
  - status transitions (Lost → Found → Returned)
  - claim only when Lost
  - claim blocked if bounty not activated
  - confirmReturn only by owner
  - returnIdHash lookup

## Files Likely Touched
- `contracts/LostETHFound.sol`
- `web/src/lib/contracts.ts`
- `web/src/app/register/page.tsx`
- `web/src/app/claim/page.tsx`
- `web/src/app/lost/page.tsx`
- `test/LostETHFound.js`

