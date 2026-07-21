'use strict';
/**
 * M3 — ZK-KYC: Gizlilik Koruyan Taşınabilir Kimlik
 * ------------------------------------------------
 * İlke: Kişisel veri (TC kimlik no, ad-soyad, doğum tarihi) HİÇBİR zaman
 * zincire / SBT'ye yazılmaz. Bunun yerine kimliğin kriptografik bir
 * "commitment"ı (taahhüt) üretilir ve yalnızca bu hash paylaşılır.
 *
 * Bu PoC, gerçek zk-SNARK devresinin (bkz. ../zkp/circuits/kyc_verify.circom)
 * çözdüğü problemi bağımlılıksız olarak gösterir:
 *   - commitment = H(tckn || dogumTarihi || salt)
 *   - "18 yaşından büyük" gibi bir önermeyi, doğum tarihini İFŞA ETMEDEN
 *     borsa tarafında doğrulanabilir bir kanıta dönüştürür (selective disclosure).
 *
 * Gerçek sistemde commitment Groth16 zk-SNARK ile üretilir; burada hash
 * tabanlı eşdeğeri kullanıyoruz (kriptografik prensip aynı: ifşasız doğrulama).
 */
const crypto = require('crypto');

function H(...parts) {
  return crypto.createHash('sha256').update(parts.join('|')).digest('hex');
}

/**
 * Borsa A'da kullanıcının kimliği DOĞRULANDIKTAN sonra çağrılır.
 * Kişisel veri burada kalır, dışarı yalnızca proof/commitment çıkar.
 */
function issueIdentityProof({ tckn, dogumTarihi, borsaId }) {
  const salt = crypto.randomBytes(16).toString('hex');
  const commitment = H(tckn, dogumTarihi, salt);

  const yas = Math.floor((Date.now() - new Date(dogumTarihi).getTime()) / (365.25 * 24 * 3600 * 1000));
  const claims = {
    kycVerified: true,
    over18: yas >= 18,    // önerme: yaşı ifşa etmeden "18+" kanıtı
    issuer: borsaId,
  };

  // Kanıt: commitment + iddialar üzerine imza benzeri bağlama hash'i.
  // Doğum tarihi / TCKN bu nesnede YOKTUR.
  const proofHash = H(commitment, JSON.stringify(claims));

  return {
    commitment,                 // SBT'ye yazılacak tek kimlik referansı
    claims,                     // ifşa edilen minimal önermeler
    proofHash,                  // doğrulanabilir kanıt
    _privateSalt: salt,         // kullanıcı/borsa saklar; zincire yazılmaz
  };
}

/** Borsa B, belge istemeden yalnızca proof'u doğrular. */
function verifyIdentityProof(proof) {
  if (!proof || !proof.commitment || !proof.claims || !proof.proofHash) return false;
  const expected = H(proof.commitment, JSON.stringify(proof.claims));
  return expected === proof.proofHash && proof.claims.kycVerified === true;
}

module.exports = { issueIdentityProof, verifyIdentityProof, H };
