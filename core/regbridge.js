'use strict';
/**
 * RegBridge — Orkestrasyon Katmanı
 * --------------------------------
 * Tüm modülleri (audit, ZK-KYC, SBT, Travel Rule, smurfing) tek bir "köprü"
 * API'si altında birleştirir. Borsalar ve regülatör bu sınıfla konuşur.
 */
const { AuditTrail } = require('./audit');
const { SBTRegistry } = require('./sbt');
const { issueIdentityProof, verifyIdentityProof } = require('./zkkyc');
const { buildIVMS101, travelRuleGerekli, MASAK_ESIK_TL } = require('./travelRule');
const { SmurfingDetector } = require('./smurfing');

class RegBridge {
  constructor(opts = {}) {
    this.audit = new AuditTrail();
    this.sbt = new SBTRegistry(this.audit);
    this.smurf = new SmurfingDetector({ esikTL: opts.esikTL || MASAK_ESIK_TL });
    this.esik = opts.esikTL || MASAK_ESIK_TL;
    this.alarmlar = [];          // MASAK dashboard için ŞİB/alarm kuyruğu
    this.cuzdanCommitment = new Map(); // ownerWallet -> commitment (smurfing ilişkilendirme)
  }

  /** 1) Borsa A: KYC onayı → ZK kimlik kanıtı → SBT mint. Kişisel veri zincire girmez. */
  kycVeMint({ ownerWallet, tckn, dogumTarihi, borsaId }) {
    const proof = issueIdentityProof({ tckn, dogumTarihi, borsaId });
    const token = this.sbt.mint(ownerWallet, { commitment: proof.commitment, claims: proof.claims, issuer: borsaId });
    this.cuzdanCommitment.set(ownerWallet, proof.commitment);
    this.audit.record('KYC_ONAY', { ownerWallet, borsaId, over18: proof.claims.over18 }, borsaId);
    return { proof, token };
  }

  /** 2) Borsa B: belge istemeden taşınabilir kimliği doğrular. */
  kimlikDogrula(ownerWallet) {
    const v = this.sbt.verify(ownerWallet);
    this.audit.record('KIMLIK_DOGRULAMA', { ownerWallet, sonuc: v.valid, sebep: v.reason || 'gecerli' });
    return v;
  }

  /** 3) Transfer: eşik üstüyse Travel Rule mesajı üretir; smurfing kontrolü yapar. */
  transfer({ ownerWallet, gonderenBorsa, alanBorsa, tutarTL, varlik = 'USDT' }) {
    const v = this.sbt.verify(ownerWallet);
    if (!v.valid) {
      this.audit.record('TRANSFER_RET', { ownerWallet, sebep: v.reason });
      return { ok: false, sebep: v.reason };
    }
    const commitment = this.cuzdanCommitment.get(ownerWallet);
    this.audit.record('TRANSFER', { ownerWallet, gonderenBorsa, alanBorsa, tutarTL, varlik });

    let travelRule = null;
    if (travelRuleGerekli(tutarTL, this.esik)) {
      travelRule = buildIVMS101({
        gonderenBorsa, alanBorsa,
        gonderenRef: commitment.slice(0, 16), alanRef: commitment.slice(0, 16),
        tutarTL, varlik,
      });
      this.audit.record('TRAVEL_RULE', { messageId: travelRule.messageId, gonderenBorsa, alanBorsa, tutarTL }, gonderenBorsa);
    }

    // Smurfing: işlemi kümülatife ekle
    const sib = this.smurf.kaydet({ commitment, tutarTL, borsaId: gonderenBorsa });
    if (sib) this._sibUret(sib, ownerWallet);

    return { ok: true, travelRule, sib };
  }

  _sibUret(sib, ownerWallet) {
    const kayit = this.audit.record('SIB', { ...sib, ownerWallet }, 'RegBridge');
    this.alarmlar.push({ ...sib, ownerWallet, auditIndex: kayit.index });
    return kayit;
  }

  /** 4) MASAK: kara liste → SBT iptal → tüm borsalarda anında dondurma. */
  karaListe(ownerWallet, sebep = 'MASAK kara liste kararı') {
    const ok = this.sbt.revoke(ownerWallet, sebep);
    if (ok) {
      this.audit.record('HESAP_DONDURMA', { ownerWallet, sebep, etki: 'tum_borsalar' }, 'MASAK');
      this.alarmlar.push({ tip: 'DONDURMA', ownerWallet, sebep, olusturulma: new Date().toISOString() });
    }
    return ok;
  }

  /** Regülatör read-only görünümü. */
  regulatorGorunum() {
    return {
      denetimIzi: this.audit.all(),
      zincirDogrulama: this.audit.verifyChain(),
      alarmlar: this.alarmlar,
      sibSayisi: this.audit.byType('SIB').length,
    };
  }
}

module.exports = { RegBridge };
