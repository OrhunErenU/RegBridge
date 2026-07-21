'use strict';
/**
 * RegBridge Core — Birim Testleri (bağımlılıksız)
 * Çalıştırma:  node core/test.js
 */
const assert = require('assert');
const { RegBridge } = require('./regbridge');
const { AuditTrail } = require('./audit');
const { SmurfingDetector } = require('./smurfing');
const { issueIdentityProof, verifyIdentityProof } = require('./zkkyc');
const { buildIVMS101, travelRuleGerekli } = require('./travelRule');

let gecen = 0, kalan = 0;
function test(ad, fn) {
  try { fn(); console.log('  \x1b[32m✓\x1b[0m ' + ad); gecen++; }
  catch (e) { console.log('  \x1b[31m✗\x1b[0m ' + ad + '  → ' + e.message); kalan++; }
}

console.log('\nRegBridge Core Testleri\n───────────────────────');

test('ZK-KYC: kanıt üretilir ve kişisel veri içermez', () => {
  const p = issueIdentityProof({ tckn: '11111111111', dogumTarihi: '1990-01-01', borsaId: 'A' });
  assert.ok(p.commitment.length === 64);
  assert.ok(!JSON.stringify(p).includes('11111111111'));   // TCKN sızmamalı
  assert.strictEqual(verifyIdentityProof(p), true);
});

test('ZK-KYC: bozulmuş kanıt reddedilir', () => {
  const p = issueIdentityProof({ tckn: '2', dogumTarihi: '1990-01-01', borsaId: 'A' });
  p.claims.kycVerified = false;
  assert.strictEqual(verifyIdentityProof(p), false);
});

test('Travel Rule: eşik altı tetiklenmez, eşik üstü tetiklenir', () => {
  assert.strictEqual(travelRuleGerekli(14999), false);
  assert.strictEqual(travelRuleGerekli(15000), true);
  const m = buildIVMS101({ gonderenBorsa: 'A', alanBorsa: 'B', gonderenRef: 'x', alanRef: 'y', tutarTL: 50000, varlik: 'USDT' });
  assert.strictEqual(m.standard, 'IVMS101');
  assert.strictEqual(m.confidentiality, 'FABRIC_PDC');
});

test('SBT devredilemez (soulbound)', () => {
  const rb = new RegBridge();
  const { token } = rb.kycVeMint({ ownerWallet: '0xA', tckn: '3', dogumTarihi: '1995-01-01', borsaId: 'A' });
  assert.strictEqual(token.locked, true);
  assert.throws(() => rb.sbt.transfer(), /devredilemez/);
});

test('Taşınabilir kimlik: ikinci borsa belge istemeden doğrular', () => {
  const rb = new RegBridge();
  rb.kycVeMint({ ownerWallet: '0xB', tckn: '4', dogumTarihi: '1995-01-01', borsaId: 'A' });
  assert.strictEqual(rb.kimlikDogrula('0xB').valid, true);
});

test('Smurfing: tek borsada tetiklenmez, çok borsada eşik aşımında ŞİB üretir', () => {
  const d = new SmurfingDetector({ esikTL: 15000 });
  assert.strictEqual(d.kaydet({ commitment: 'c', tutarTL: 9000, borsaId: 'A' }), null);
  assert.strictEqual(d.kaydet({ commitment: 'c', tutarTL: 5000, borsaId: 'A' }), null); // tek borsa
  const sib = d.kaydet({ commitment: 'c', tutarTL: 4000, borsaId: 'B' });               // ikinci borsa + eşik
  assert.ok(sib && sib.tip === 'SIB');
  assert.ok(sib.kumulatifTL >= 15000);
});

test('Kara liste: SBT iptal → kimlik anında geçersiz', () => {
  const rb = new RegBridge();
  rb.kycVeMint({ ownerWallet: '0xC', tckn: '5', dogumTarihi: '1990-01-01', borsaId: 'A' });
  rb.karaListe('0xC', 'test');
  assert.strictEqual(rb.kimlikDogrula('0xC').valid, false);
});

test('Denetim izi: hash zinciri bozulduğunda yakalanır', () => {
  const a = new AuditTrail();
  a.record('X', { v: 1 }); a.record('Y', { v: 2 }); a.record('Z', { v: 3 });
  assert.strictEqual(a.verifyChain().ok, true);
  a.events[1].payload.v = 999;                  // kayıt değiştir
  assert.strictEqual(a.verifyChain().ok, false); // tespit edilmeli
});

console.log('───────────────────────');
console.log(`Sonuç: ${gecen} geçti, ${kalan} kaldı\n`);
process.exit(kalan ? 1 : 0);
