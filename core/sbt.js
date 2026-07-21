'use strict';
/**
 * M3 (devamı) — Soulbound Token (ERC-5192) Kayıt Defteri
 * ------------------------------------------------------
 * Demo'nun zincire bağımlı olmadan çalışması için SBT mantığının bellek-içi
 * (in-memory) bir simülasyonu. Gerçek, zincir-üstü sürüm Solidity ile
 * yazılmıştır: ../contracts/contracts/RegBridgeSBT.sol (ERC-5192, locked=true).
 *
 * Soulbound = devredilemez. Bu defter de transfer() sunmaz; yalnızca
 * mint / verify / revoke (kara liste) işlemleri vardır.
 */
const crypto = require('crypto');

class SBTRegistry {
  constructor(audit) {
    this.tokens = new Map();   // tokenId -> token
    this.byOwner = new Map();  // ownerWallet -> tokenId
    this.audit = audit;
  }

  /** KYC onayından sonra borsa, kullanıcı için SBT mint eder. */
  mint(ownerWallet, { commitment, claims, issuer, gecerlilikAy = 12 }) {
    if (this.byOwner.has(ownerWallet)) return this.tokens.get(this.byOwner.get(ownerWallet));
    const tokenId = '0x' + crypto.createHash('sha256').update(ownerWallet + commitment).digest('hex').slice(0, 40);
    const now = Date.now();
    const token = {
      tokenId,
      owner: ownerWallet,
      commitment,          // SBT içeriği: kişisel veri YOK, sadece kriptografik referans
      claims,
      issuer,
      locked: true,        // ERC-5192: kalıcı kilit
      revoked: false,
      issuedAt: new Date(now).toISOString(),
      expiresAt: new Date(now + gecerlilikAy * 30 * 24 * 3600 * 1000).toISOString(),
    };
    this.tokens.set(tokenId, token);
    this.byOwner.set(ownerWallet, tokenId);
    if (this.audit) this.audit.record('SBT_MINT', { tokenId, issuer, commitment }, issuer);
    return token;
  }

  /** Başka bir borsa, belge istemeden SBT'nin geçerliliğini kontrol eder. */
  verify(ownerWallet) {
    const tokenId = this.byOwner.get(ownerWallet);
    if (!tokenId) return { valid: false, reason: 'SBT yok' };
    const t = this.tokens.get(tokenId);
    if (t.revoked) return { valid: false, reason: 'SBT kara listede / iptal' };
    if (new Date(t.expiresAt).getTime() < Date.now()) return { valid: false, reason: 'SBT süresi dolmuş' };
    return { valid: true, token: t };
  }

  /** MASAK kara liste komutu: SBT işaretlenir → tüm borsalarda anında etkili. */
  revoke(ownerWallet, reason = 'MASAK kara liste') {
    const tokenId = this.byOwner.get(ownerWallet);
    if (!tokenId) return false;
    const t = this.tokens.get(tokenId);
    t.revoked = true;
    t.revokeReason = reason;
    if (this.audit) this.audit.record('SBT_REVOKE', { tokenId, reason }, 'MASAK');
    return true;
  }

  transfer() {
    throw new Error('ERC-5192: Soulbound token devredilemez (locked).');
  }
}

module.exports = { SBTRegistry };
