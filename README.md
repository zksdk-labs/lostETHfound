# LostETHFound (ZK Lost & Found)

This repo contains a two-lane MVP:
- Trustless lane: on-chain commitment + ZK proof of knowledge of a secret
- Assisted lane: owner-mediated Q/A + encrypted contact

See `LOSTETHFOUND_ZKP_PLAN.md` for the detailed plan.

Structure:
- `circuits/` Circom circuits and build notes
- `contracts/` Solidity contracts + verifier placeholder
- `web/` Frontend (Next.js) placeholder
- `scripts/` Build/deploy helper scripts
- `test/` Contract tests

Quickstart:
1) `bun install`
2) `bun run zk:build`
3) `cd web && bun dev`

App ↔ test reference: `docs/APP_REFERENCE.md`

Vercel deploy:
- Set `NEXT_PUBLIC_CONTRACT_ADDRESS` and `NEXT_PUBLIC_RPC_URL` in Vercel env
- See `web/.env.example` for the expected variables
