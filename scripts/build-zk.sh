#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CIRCUIT_DIR="$ROOT_DIR/circuits"
BUILD_DIR="$CIRCUIT_DIR/build"
CONTRACTS_DIR="$ROOT_DIR/contracts"
WEB_ZK_DIR="$ROOT_DIR/web/public/zk"

CIRCUIT_NAME="LOSTETHFOUND"
POWER=${POWER:-12}
ENTROPY=${ENTROPY:-"lostethfound"}

SNARKJS=(bunx snarkjs)

mkdir -p "$BUILD_DIR"

# Compile circuit
circom "$CIRCUIT_DIR/${CIRCUIT_NAME}.circom" \
  --r1cs --wasm --sym \
  -l "$ROOT_DIR/node_modules" \
  -o "$BUILD_DIR"

# Powers of Tau (phase 1 + prepare phase 2)
POT0="$BUILD_DIR/pot${POWER}_0000.ptau"
POT1="$BUILD_DIR/pot${POWER}_0001.ptau"
POT_FINAL="$BUILD_DIR/pot${POWER}_final.ptau"

if [ ! -f "$POT_FINAL" ]; then
  "${SNARKJS[@]}" powersoftau new bn128 "$POWER" "$POT0"
  printf "lostethfound\n%s\n" "$ENTROPY" | "${SNARKJS[@]}" powersoftau contribute "$POT0" "$POT1"
  "${SNARKJS[@]}" powersoftau prepare phase2 "$POT1" "$POT_FINAL"
fi

# Groth16 setup + contribution
ZKEY0="$BUILD_DIR/${CIRCUIT_NAME}_0000.zkey"
ZKEY1="$BUILD_DIR/${CIRCUIT_NAME}_0001.zkey"

"${SNARKJS[@]}" groth16 setup "$BUILD_DIR/${CIRCUIT_NAME}.r1cs" "$POT_FINAL" "$ZKEY0"
printf "lostethfound\n%s\n" "$ENTROPY" | "${SNARKJS[@]}" zkey contribute "$ZKEY0" "$ZKEY1"

# Export verification key + Solidity verifier
"${SNARKJS[@]}" zkey export verificationkey "$ZKEY1" "$BUILD_DIR/verification_key.json"
"${SNARKJS[@]}" zkey export solidityverifier "$ZKEY1" "$CONTRACTS_DIR/Verifier.sol"

if [ -d "$ROOT_DIR/web" ]; then
  mkdir -p "$WEB_ZK_DIR"
  cp "$ZKEY1" "$WEB_ZK_DIR/LOSTETHFOUND.zkey"
  cp "$BUILD_DIR/verification_key.json" "$WEB_ZK_DIR/verification_key.json"
  cp "$BUILD_DIR/${CIRCUIT_NAME}_js/${CIRCUIT_NAME}.wasm" "$WEB_ZK_DIR/LOSTETHFOUND.wasm"
fi

printf "\n%s\n" "ZK build complete."
printf "%s\n" "- Verifier: $CONTRACTS_DIR/Verifier.sol"
printf "%s\n" "- vkey: $BUILD_DIR/verification_key.json"
printf "%s\n" "- wasm: $BUILD_DIR/${CIRCUIT_NAME}_js/${CIRCUIT_NAME}.wasm"
