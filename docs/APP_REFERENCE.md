# App ↔ Test Reference

This app mirrors the end-to-end flow in `test/LostETHFound.e2e.js`.

## Proof generation flow
- Test: `snarkjs.groth16.fullProve(input, wasm, zkey)`
- App: `web/src/app/claim/page.tsx` uses the same call with `/public/zk` artifacts.

## Solidity calldata
- Test: `snarkjs.groth16.exportSolidityCallData(...)` + parse
- App: `web/src/lib/solidity.ts` parses the same calldata into `pA/pB/pC/publicSignals`.

## Contract calls
- Test: `LostETHFound.claim(...)` with real proof and signals
- App: `web/src/app/claim/page.tsx` calls the same `claim` function via wagmi

## Register flow
- App: `web/src/app/register/page.tsx` computes commitment and calls `registerItem`

