# Contracts

- `LostETHFound.sol`: registry + claim contract
- `IVerifier.sol`: Groth16 verifier interface (snarkjs output will replace this with a real verifier)
- `Verifier.sol`: generated Groth16 verifier (via `bun run zk:build`)
- `VerifierMock.sol`: test-only mock verifier (always returns true)

Notes:
- Public signals order: `[commitment, nullifier]`
- `claimBond` is optional; set to 0 for no bond

Build tool: Hardhat
