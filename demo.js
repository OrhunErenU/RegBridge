'use strict';
/**
 * RegBridge — Uçtan Uca Demo (Teknofest 5 Dakika Senaryosu)
 * =========================================================
 * Çalıştırma:  node demo.js
 * Bağımlılık:  YOK (yalnızca Node.js çekirdek modülleri)
 *
 * Bu script, sunumdaki 5 dakikalık demo senaryosunu birebir canlandırır ve
 * sonunda denetim izini dashboard/audit-log.json dosyasına yazar.
 */
const fs = require('fs');
const path = require('path');
const { RegBridge } = require('./core/regbridge');

const TL = (n) => n.toLocaleString('tr-TR') + ' TL';
const line = (s = '') => console.log(s);
const baslik = (n, t) => { line(); line(`\x1b[1m\x1b[36m── DAKİKA ${n} ── ${t}\x1b[0m`); };
const ok = (s) => line(`   \x1b[32m✓\x1b[0m ${s}`);
const bilgi = (s) => line(`   \x1b[33m•\x1b[0m ${s}`);

const rb = new RegBridge();

line('\x1b[1m═══════════════════════════════════════════════════════════════');
line('  RegBridge — Kripto Varlık Regülasyon Köprüsü  |  PoC Demo');
line('═══════════════════════════════════════════════════════════════\x1b[0m');

// Kullanıcı cüzdanları (Polygon adresleri)
const ALICE = '0xA11CE0000000000000000000000000000000A11CE';

// ── DAKİKA 1: ZK-KYC + SBT mint (Borsa A) ───────────────────────────────
baslik(1, 'ZK-KYC ve SBT Mint (Borsa A)');
const { proof, token } = rb.kycVeMint({
  ownerWallet: ALICE,
  tckn: '12345678901',           // kişisel veri — yalnızca Borsa A'da kalır
  dogumTarihi: '1998-05-20',     // zincire YAZILMAZ
  borsaId: 'BORSA_A',
});
ok('Borsa A kullanıcının kimliğini doğruladı (KYC).');
bilgi(`SBT mint edildi: ${token.tokenId.slice(0, 18)}…  (ERC-5192, locked=${token.locked})`);
bilgi(`SBT içeriği → commitment: ${proof.commitment.slice(0, 24)}…  (kişisel veri: YOK)`);
bilgi(`İfşa edilen önermeler → KYC: ${proof.claims.kycVerified}, 18+: ${proof.claims.over18}`);

// ── DAKİKA 2: Taşınabilir kimlik (Borsa B) ──────────────────────────────
baslik(2, 'Portatif Kimlik (Borsa B)');
const v = rb.kimlikDogrula(ALICE);
ok(`Borsa B, BELGE İSTEMEDEN SBT'yi doğruladı → geçerli: ${v.valid}`);
bilgi('Kullanıcı saniyeler içinde Borsa B\'de aktif — KYC tekrarı yok.');

// ── DAKİKA 3: Travel Rule (Borsa A → Borsa B, 50.000 TL) ────────────────
baslik(3, 'Travel Rule (50.000 TL transfer)');
const t1 = rb.transfer({ ownerWallet: ALICE, gonderenBorsa: 'BORSA_A', alanBorsa: 'BORSA_B', tutarTL: 50000 });
ok(`Eşik (15.000 TL) aşıldı → otomatik IVMS101 mesajı üretildi.`);
bilgi(`messageId: ${t1.travelRule.messageId}  |  gizlilik: ${t1.travelRule.confidentiality}`);
bilgi('Mesaj yalnızca Borsa A, Borsa B ve MASAK tarafından görülebilir (Fabric PDC).');

// ── DAKİKA 4: Smurfing tespiti (çok borsada eşik altı) ──────────────────
baslik(4, 'Smurfing Tespiti');
bilgi('Kullanıcı farklı borsalarda eşik ALTI küçük işlemler yapıyor:');
const kucuk = [
  { b: 'BORSA_A', t: 6000 },
  { b: 'BORSA_B', t: 7000 },
  { b: 'BORSA_C', t: 8000 },
];
let sib = null;
for (const k of kucuk) {
  const r = rb.transfer({ ownerWallet: ALICE, gonderenBorsa: k.b, alanBorsa: 'DIS', tutarTL: k.t });
  bilgi(`${k.b} üzerinden ${TL(k.t)} (tek başına eşik altı) — kümülatif: ${TL(rb.smurf.toplam(proof.commitment))}`);
  if (r.sib) sib = r.sib;
}
if (sib) {
  ok('\x1b[31mŞÜPHELİ İŞLEM\x1b[0m — kümülatif toplam eşiği aştı, otomatik ŞİB oluşturuldu!');
  bilgi(`ŞİB → ${TL(sib.kumulatifTL)} / ${sib.islemSayisi} işlem / borsalar: ${sib.kullanilanBorsalar.join(', ')}`);
  bilgi('MASAK dashboard\'ında alarm görünür.');
}

// ── DAKİKA 5: Kara liste + denetim izi ──────────────────────────────────
baslik(5, 'Kara Liste + Değiştirilemez Denetim İzi');
rb.karaListe(ALICE, 'Smurfing şüphesi — MASAK kararı');
ok('MASAK kara liste komutu verdi → SBT iptal edildi.');
const sonra = rb.kimlikDogrula(ALICE);
bilgi(`Hesap durumu artık → geçerli: ${sonra.valid} (${sonra.reason}) — TÜM borsalarda anında dondu.`);

const dogrulama = rb.audit.verifyChain();
ok(`Denetim izi bütünlüğü doğrulandı → ${dogrulama.ok ? 'BOZULMAMIŞ' : 'BOZUK!'} (${rb.audit.all().length} kayıt)`);

// İmmutability kanıtı: bir kaydı değiştirmeyi dene
const kopya = JSON.parse(JSON.stringify(rb.audit.all()));
if (kopya[3]) { kopya[3].payload.tutarTL = 1; }
bilgi('Bir kayıt sonradan değiştirilse, hash zinciri kırılır ve denetimde anında yakalanır.');

// ── Özet + dashboard verisi ─────────────────────────────────────────────
line();
line('\x1b[1m── ÖZET ──────────────────────────────────────────────────────\x1b[0m');
const g = rb.regulatorGorunum();
line(`   Toplam denetim kaydı : ${g.denetimIzi.length}`);
line(`   Üretilen ŞİB sayısı   : ${g.sibSayisi}`);
line(`   Aktif alarm sayısı    : ${g.alarmlar.length}`);
line(`   Zincir doğrulama      : ${g.zincirDogrulama.ok ? 'OK' : 'HATA'}`);

const out = path.join(__dirname, 'dashboard', 'audit-log.json');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify({ denetimIzi: g.denetimIzi, alarmlar: g.alarmlar }, null, 2));
line(`\n   Denetim izi yazıldı → dashboard/audit-log.json (MASAK paneli okur)`);
line('\x1b[1m═══════════════════════════════════════════════════════════════\x1b[0m\n');
