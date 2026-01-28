# LostETHFound Protocol Spec (v1)

This spec defines how to derive IDs and commitments without any server. Anyone can reproduce these values from public labels.

## Field modulus (BN254)
```
FIELD = 21888242871839275222246405745257275088548364400416034343698204186575808495617
```

## Helper: text -> field
1) `h = keccak256(utf8(text))`
2) `field = uint256(h) mod FIELD`

## Category ID (deterministic)
```
categoryId = Poseidon([
  toField("lostethfound:category:v1"),
  toField(categoryLabel.toLowerCase().trim())
])
```

Examples of `categoryLabel`:
- "electronics"
- "macbook"
- "phone"
- "credit-card"

## Commitment
```
commitment = Poseidon([
  secret,
  categoryId,
  itemIdSalt
])
```

Notes:
- For the trustless lane, `itemIdSalt` can be `0` so the finder only needs the secret.
- If a non-zero salt is used, it must be stored with the item (e.g., printed on the tag).

## Nullifier
```
nullifier = Poseidon([
  secret,
  claimId
])
```

## Notes
- `secret` is a high-entropy random value (QR/tag/long phrase).
- `itemIdSalt` is random and can be stored locally by the owner.
- `claimId` is random per claim attempt.
- All inputs are field elements.
- No server or app-specific IDs are required.
