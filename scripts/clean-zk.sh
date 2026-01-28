#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUILD_DIR="$ROOT_DIR/circuits/build"
WEB_ZK_DIR="$ROOT_DIR/web/public/zk"

rm -rf "$BUILD_DIR"
rm -f "$ROOT_DIR/contracts/Verifier.sol"
rm -rf "$WEB_ZK_DIR"

echo "ZK build artifacts removed."
