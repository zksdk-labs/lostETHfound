---
title: LostETHFound Pitch Deck
---

# LostETHFound
## Find it. Prove it. Get it back.

- Privacy-preserving lost & found on Ethereum
- Two lanes: trustless (tagged) + assisted (no-tag)
- Demo-ready MVP

---

# Problem

- People lose things every day, and most never come back
- Returning items is awkward: no clear way to verify ownership
- Public posts leak personal info and invite scams

---

# Solution

**What users get (non-technical)**  
- Items get back to their owners faster  
- Finders can return safely without exposing identity  
- Owners stay in control and choose when to release a bounty  

**How it works (technical)**  
- NFT registry (ERC721) + status flow: Active → Lost → Found → Returned  
- On-chain bounty escrow (ETH), released on owner confirmation  
- ZK proof of possession (secret never revealed)  
- Two lanes: Tagged (trustless) + No-tag (assisted Q/A + encrypted contact)

---

# Trustless Lane (Tagged)

1) Owner registers item + bounty, prints Return ID/secret on the item
2) Finder scans/enters secret, generates ZK proof in browser
3) Contract verifies -> status **Found (pending)**
4) Owner confirms return -> bounty paid + Good Samaritan badge

---

# Assisted Lane (No Tag)

- Owner posts **Lost** with Q/A hashes + encrypted contact
- Finder answers questions -> ZK threshold proof
- Owner confirms return -> bounty paid

---

# Tech + Demo

- **Ethereum smart contract:** LostETHFound
- **ZK:** Circom + Groth16 + Poseidon
- **Frontend:** Next.js + wagmi/viem + snarkjs

**Live demo flow:** register -> mark lost -> claim -> confirm return

**Ask:** feedback + pilot users + L2 deployment for cheap proofs
