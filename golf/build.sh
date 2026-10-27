#!/bin/sh
# Build the wasm, copy it to public/golf/, and prove the wasm reproduces the
# native golden hashes. Run from anywhere; every step fails the script.
set -e
cd "$(dirname "$0")"
cargo build --release --target wasm32-unknown-unknown
mkdir -p ../public/golf
cp target/wasm32-unknown-unknown/release/golf.wasm ../public/golf/golf.wasm
size=$(wc -c < ../public/golf/golf.wasm)
echo "golf.wasm: $size bytes"
if [ "$size" -gt 20480 ]; then
  echo "golf.wasm exceeds the 20480 byte budget"
  exit 1
fi
node check.mjs ../public/golf/golf.wasm
