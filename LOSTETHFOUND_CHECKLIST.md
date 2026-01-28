# LostETHFound MVP Checklist

This is the execution checklist for building the hackathon MVP. Check items as you go.

Legend: [ ] todo, [x] done

---

## 1) Repo Setup
- [x] Create base folders: `circuits/`, `contracts/`, `web/`, `scripts/`, `test/`
- [x] Add plan: `LOSTETHFOUND_ZKP_PLAN.md`
- [x] Add base READMEs
- [x] Install JS deps (`bun install`)

## 2) Circuits (ZK)
- [x] Create `circuits/LOSTETHFOUND.circom`
- [x] Install circom + snarkjs + circomlib
- [x] Compile circuit (r1cs/wasm/sym)
- [x] Powers of Tau setup
- [x] Groth16 zkey generation
- [x] Export Solidity verifier
- [x] Export verification key + wasm for frontend

## 3) Contracts (Hardhat)
- [x] Add `contracts/LostETHFound.sol`
- [x] Add `contracts/IVerifier.sol`
- [x] Initialize Hardhat project (`hardhat.config.js`, package scripts)
- [x] Add generated `Verifier.sol`
- [ ] Wire `Verifier.sol` into `LostETHFound` constructor
- [x] Write basic tests: register -> claim -> payout
- [x] E2E proof test: real Groth16 proof verifies on-chain
- [x] Add deployment script

## 4) Web (Next.js)
- [x] Initialize Next.js app in `web/`
- [x] Install deps: viem, wagmi, snarkjs (or snarkjs browser build)
- [x] Create pages: `/`, `/register`, `/claim`
- [x] Implement Trustless flow: secret -> commitment -> register (local compute)
- [x] Implement Claim flow: secret -> proof -> claim tx (local proof gen)
- [x] Assisted flow: Q/A hints + encrypted contact (UI stub)
- [x] Wire wagmi contract calls (register + claim)

## 5) Demo & UX
- [ ] Add QR/secret display + copy
- [ ] Add simple status UI (registered/claimed)
- [ ] Add demo script notes

## 6) Optional Hardening
- [ ] Add claim bond requirement
- [ ] Add minimal indexing for UX
