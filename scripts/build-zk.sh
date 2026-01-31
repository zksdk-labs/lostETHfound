#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CIRCUIT_DIR="$ROOT_DIR/circuits"
BUILD_DIR="$CIRCUIT_DIR/build"
CONTRACTS_DIR="$ROOT_DIR/contracts"
WEB_ZK_DIR="$ROOT_DIR/web/public/zk"

POWER=${POWER:-12}
ENTROPY=${ENTROPY:-"lostethfound"}

SNARKJS=(bunx snarkjs)

mkdir -p "$BUILD_DIR"

# Function to build a single circuit
build_circuit() {
	local CIRCUIT_NAME=$1
	local VERIFIER_NAME=${2:-"${CIRCUIT_NAME}Verifier"}

	echo "Building circuit: $CIRCUIT_NAME"

	# Compile circuit
	circom "$CIRCUIT_DIR/${CIRCUIT_NAME}.circom" \
		--r1cs --wasm --sym \
		-l "$ROOT_DIR/node_modules" \
		-o "$BUILD_DIR"

	# Powers of Tau (phase 1 + prepare phase 2) - shared across circuits
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
	"${SNARKJS[@]}" zkey export verificationkey "$ZKEY1" "$BUILD_DIR/${CIRCUIT_NAME}_verification_key.json"
	"${SNARKJS[@]}" zkey export solidityverifier "$ZKEY1" "$CONTRACTS_DIR/${VERIFIER_NAME}.sol"

	# Copy to web directory
	if [ -d "$ROOT_DIR/web" ]; then
		mkdir -p "$WEB_ZK_DIR"
		cp "$ZKEY1" "$WEB_ZK_DIR/${CIRCUIT_NAME}.zkey"
		cp "$BUILD_DIR/${CIRCUIT_NAME}_verification_key.json" "$WEB_ZK_DIR/${CIRCUIT_NAME}_verification_key.json"
		cp "$BUILD_DIR/${CIRCUIT_NAME}_js/${CIRCUIT_NAME}.wasm" "$WEB_ZK_DIR/${CIRCUIT_NAME}.wasm"
	fi

	printf "%s circuit build complete.\n" "$CIRCUIT_NAME"
}

# Build both circuits
build_circuit "LOSTETHFOUND" "Verifier"
build_circuit "QuestionPackProof" "QuestionVerifier"

printf "\n%s\n" "All ZK builds complete."
printf "%s\n" "Contracts:"
printf "  - $CONTRACTS_DIR/Verifier.sol (tagged flow)"
printf "  - $CONTRACTS_DIR/QuestionVerifier.sol (untagged flow)"
printf "%s\n" "Web assets:"
printf "  - $WEB_ZK_DIR/LOSTETHFOUND.wasm + .zkey"
printf "  - $WEB_ZK_DIR/QuestionPackProof.wasm + .zkey"
