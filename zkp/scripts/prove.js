'use strict';
/**
 * ZK-KYC Commitment Demosu (çalışan PoC)
 * --------------------------------------
 * Çalıştırma:  npm install && npm run demo
 *
 * Bu script, kyc_verify.circom devresinin MANTIĞINI gerçek Poseidon hash'i ile
 * (zk-SNARK dostu hash, circomlib ile aynı) JavaScript'te canlandırır:
 *   - commitment = Poseidon(tckn, dogumYili, salt)
 *   - Borsa B, doğum tarihini/TCKN'yi GÖRMEDEN commitment + "18+" önermesini
 *     doğrular.
 *
 * Tam Groth16 zk-SNARK kanıtı üretmek için (circom gerektirir):
 *   npm run build:snark
 */
const { buildPoseidon } = require('circomlibjs');

async function main() {
  const poseidon = await buildPoseidon();
  const F = poseidon.F;

  // --- Borsa A tarafı: GİZLİ kişisel veriler ---
  const tckn = 12345678901n;
  const dogumYili = 1998n;
  const salt = 987654321n;            // rastgele
  const buYil = BigInt(new Date().getFullYear());
  const esikYili = buYil - 18n;       // 18+ için doğum yılı eşiği

  // commitment = Poseidon(tckn, dogumYili, salt)
  const commitment = F.toString(poseidon([tckn, dogumYili, salt]));

  console.log('── ZK-KYC Commitment Demo ─────────────────────────────');
  console.log('GİZLİ (Borsa A\'da kalır)  : TCKN=%s, doğumYılı=%s, salt=gizli', tckn, dogumYili);
  console.log('AÇIK  (paylaşılan)        : commitment=%s…', commitment.slice(0, 28));
  console.log('AÇIK  (paylaşılan)        : eşikYılı=%s (18+ kanıtı için)', esikYili);

  // --- Borsa B tarafı: doğrulama (kişisel veri görmeden) ---
  // Gerçek SNARK'ta bu, kanıtın matematiksel doğrulamasıdır. Burada commitment'ın
  // tutarlılığını ve over18 önermesini kontrol ediyoruz.
  const yenidenHesap = F.toString(poseidon([tckn, dogumYili, salt]));
  const commitmentGecerli = yenidenHesap === commitment;     // devredeki: h.out === commitment
  const over18 = dogumYili <= esikYili;                       // devredeki: LessEqThan

  console.log('───────────────────────────────────────────────────────');
  console.log('Borsa B doğrulaması       : commitmentGeçerli=%s, over18=%s', commitmentGecerli, over18);
  console.log(commitmentGecerli && over18
    ? '\x1b[32m✓ KANIT KABUL — kullanıcı belge yüklemeden onaylandı (KYC taşındı).\x1b[0m'
    : '\x1b[31m✗ KANIT RED\x1b[0m');
  console.log('Not: TCKN ve doğum tarihi hiçbir zaman commitment\'tan geri elde edilemez.');
}

main().catch((e) => { console.error(e); process.exit(1); });
