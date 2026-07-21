#!/usr/bin/env bash
# Tam Groth16 zk-SNARK akışı (circom + snarkjs gerektirir).
# Kurulum: https://docs.circom.io/getting-started/installation/
set -e
cd "$(dirname "$0")/.."

echo "[1/7] circomlib indiriliyor (devre include'ları için)…"
npm ls circomlib >/dev/null 2>&1 || npm install circomlib

echo "[2/7] Devre derleniyor…"
circom circuits/kyc_verify.circom --r1cs --wasm --sym -l node_modules -o build

echo "[3/7] Powers of Tau (trusted setup, faz 1)…"
npx snarkjs powersoftau new bn128 12 build/pot12_0000.ptau -v
npx snarkjs powersoftau prepare phase2 build/pot12_0000.ptau build/pot12_final.ptau -v

echo "[4/7] Groth16 anahtarı (faz 2)…"
npx snarkjs groth16 setup build/kyc_verify.r1cs build/pot12_final.ptau build/kyc_0000.zkey
npx snarkjs zkey export verificationkey build/kyc_0000.zkey build/verification_key.json

echo "[5/7] Tanık (witness) üretiliyor…"
cat > build/input.json <<JSON
{ "tckn": "12345678901", "dogumYili": "1998", "salt": "987654321",
  "commitment": "PLACEHOLDER", "esikYili": "2007" }
JSON
echo "  (input.json içindeki commitment'ı prove.js çıktısındaki Poseidon hash ile doldurun)"
node build/kyc_verify_js/generate_witness.js build/kyc_verify_js/kyc_verify.wasm build/input.json build/witness.wtns

echo "[6/7] Kanıt üretiliyor…"
npx snarkjs groth16 prove build/kyc_0000.zkey build/witness.wtns build/proof.json build/public.json

echo "[7/7] Kanıt doğrulanıyor…"
npx snarkjs groth16 verify build/verification_key.json build/public.json build/proof.json

echo "✓ Tamam — Groth16 kanıtı üretildi ve doğrulandı."
