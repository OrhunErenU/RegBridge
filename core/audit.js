'use strict';
/**
 * M2 — Değiştirilemez Denetim İzi (Immutable Audit Trail)
 * ------------------------------------------------------
 * Hyperledger Fabric'in "world state + block" yapısını birebir koda dökmek
 * yerine, aynı değiştirilemezlik (immutability) garantisini hash zinciri
 * (hash chaining) ile gösteren hafif bir PoC.
 *
 * Her kayıt, bir önceki kaydın hash'ini içerir. Tek bir kayıt değiştirilirse
 * sonraki tüm hash'ler bozulur; verifyChain() bunu tespit eder. Fabric'te bu
 * garanti konsensüs + blok yapısıyla sağlanır.
 */
const crypto = require('crypto');

function sha256(obj) {
  return crypto.createHash('sha256').update(JSON.stringify(obj)).digest('hex');
}

class AuditTrail {
  constructor() {
    this.events = [];
    this.genesis = '0'.repeat(64);
  }

  /** Yeni bir uyum olayını değiştirilemez zincire ekler. */
  record(type, payload, actor = 'system') {
    const prevHash = this.events.length
      ? this.events[this.events.length - 1].hash
      : this.genesis;
    const entry = {
      index: this.events.length,
      type,                                   // KYC_ONAY | TRANSFER | TRAVEL_RULE | SIB | DONDURMA ...
      timestamp: new Date().toISOString(),
      actorHash: sha256(actor).slice(0, 16),  // aktör anonimleştirilir (KVKK)
      payload,
      prevHash,
    };
    entry.hash = sha256({ ...entry });
    this.events.push(entry);
    return entry;
  }

  /** Zincirin değiştirilmediğini doğrular (immutability kanıtı). */
  verifyChain() {
    let prev = this.genesis;
    for (const e of this.events) {
      if (e.prevHash !== prev) return { ok: false, brokenAt: e.index, reason: 'prevHash uyuşmuyor' };
      const recomputed = sha256({
        index: e.index, type: e.type, timestamp: e.timestamp,
        actorHash: e.actorHash, payload: e.payload, prevHash: e.prevHash,
      });
      if (recomputed !== e.hash) return { ok: false, brokenAt: e.index, reason: 'hash yeniden hesaplanamadı' };
      prev = e.hash;
    }
    return { ok: true, length: this.events.length };
  }

  all() { return this.events; }
  byType(type) { return this.events.filter((e) => e.type === type); }
}

module.exports = { AuditTrail, sha256 };
