'use strict';
/**
 * RegBridge REST API / Webhook Sunucusu
 * -------------------------------------
 * Borsaların ve regülatörün bağlandığı tek nokta (mimaride Katman 5).
 * Bağımlılık YOK — Node.js çekirdek http modülü ile yazılmıştır.
 *
 * Çalıştırma:  node api/server.js     (varsayılan port 8787)
 *
 * Uçlar:
 *   POST /kyc            { ownerWallet, tckn, dogumTarihi, borsaId }  → SBT mint
 *   GET  /verify/:wallet                                            → kimlik doğrula
 *   POST /transfer      { ownerWallet, gonderenBorsa, alanBorsa, tutarTL } → Travel Rule + smurfing
 *   POST /regulator/blacklist  { ownerWallet, sebep }   (MASAK)     → kara liste
 *   GET  /regulator/audit                               (read-only) → denetim izi + alarmlar
 *   GET  /health
 */
const http = require('http');
const { RegBridge } = require('../core/regbridge');

const rb = new RegBridge();
const PORT = process.env.PORT || 8787;

function send(res, code, obj) {
  const body = JSON.stringify(obj, null, 2);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => { try { resolve(data ? JSON.parse(data) : {}); } catch { resolve({}); } });
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const p = url.pathname;

  try {
    if (req.method === 'GET' && p === '/health') return send(res, 200, { ok: true, service: 'RegBridge', uptime: process.uptime() });

    if (req.method === 'POST' && p === '/kyc') {
      const b = await readBody(req);
      if (!b.ownerWallet || !b.tckn) return send(res, 400, { error: 'ownerWallet ve tckn gerekli' });
      const { proof, token } = rb.kycVeMint({
        ownerWallet: b.ownerWallet, tckn: b.tckn,
        dogumTarihi: b.dogumTarihi || '2000-01-01', borsaId: b.borsaId || 'BORSA_A',
      });
      return send(res, 201, { tokenId: token.tokenId, commitment: proof.commitment, claims: proof.claims, locked: token.locked });
    }

    if (req.method === 'GET' && p.startsWith('/verify/')) {
      const wallet = decodeURIComponent(p.split('/')[2] || '');
      const v = rb.kimlikDogrula(wallet);
      return send(res, 200, { wallet, valid: v.valid, reason: v.reason || 'gecerli' });
    }

    if (req.method === 'POST' && p === '/transfer') {
      const b = await readBody(req);
      const r = rb.transfer({
        ownerWallet: b.ownerWallet, gonderenBorsa: b.gonderenBorsa || 'BORSA_A',
        alanBorsa: b.alanBorsa || 'BORSA_B', tutarTL: Number(b.tutarTL || 0), varlik: b.varlik || 'USDT',
      });
      return send(res, r.ok ? 200 : 403, r);
    }

    if (req.method === 'POST' && p === '/regulator/blacklist') {
      const b = await readBody(req);
      const ok = rb.karaListe(b.ownerWallet, b.sebep || 'MASAK kararı');
      return send(res, ok ? 200 : 404, { ok, ownerWallet: b.ownerWallet });
    }

    if (req.method === 'GET' && p === '/regulator/audit') {
      return send(res, 200, rb.regulatorGorunum());
    }

    return send(res, 404, { error: 'bulunamadı', path: p });
  } catch (e) {
    return send(res, 500, { error: e.message });
  }
});

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`RegBridge API → http://localhost:${PORT}  (uçlar için README'ye bakın)`);
  });
}
module.exports = { server, rb };
