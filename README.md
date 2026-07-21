# RegBridge — Kripto Varlık Regülasyon Köprüsü (PoC)

Borsalar, bankalar ve düzenleyiciler (MASAK, SPK) arasına yerleşen, mevcut
altyapıları **değiştirmeden** çalışan middleware tabanlı regülasyon uyum
köprüsünün çalışan kanıt (Proof-of-Concept) deposu.

Bu depo, TEKNOFEST sunumundaki dört temel mekanizmanın **gerçekten çalışan**
kodunu içerir. Her parça bağımsız çalıştırılabilir ve test edilmiştir.

---

## Hızlı başlangıç (30 saniye, bağımlılık YOK)

```bash
cd regbridge
node demo.js        # 5 dakikalık Teknofest senaryosunu uçtan uca canlandırır
node core/test.js   # 8 birim testi çalıştırır
```

`demo.js` çıktısı; ZK-KYC + SBT mint, taşınabilir kimlik, Travel Rule, smurfing
tespiti ve kara liste adımlarını sırayla gösterir ve denetim izini
`dashboard/audit-log.json` dosyasına yazar.

---

## Bileşenler ve sunum eşlemesi

| Klasör | Ne yapar | Sunumdaki karşılığı | Durum |
|--------|----------|---------------------|-------|
| `core/` | Tüm mantık: ZK-KYC, SBT, Travel Rule, audit, smurfing + uçtan uca demo | M1–M4, Sorun-2/3 | ✅ Çalışır, test edildi (8/8) |
| `contracts/` | ERC-5192 Soulbound KYC akıllı kontratı (Solidity) + Hardhat testleri | M3 — SBT katmanı | ✅ Derlenir (0 uyarı), 7 test |
| `api/` | REST/webhook sunucusu — borsaların bağlandığı tek nokta | Katman 5 — Entegrasyon | ✅ Çalışır |
| `zkp/` | Circom ZK-KYC devresi + SnarkJS akışı + Poseidon demosu | M3 — ZKP motoru | ✅ Commitment demosu çalışır |
| `dashboard/` | MASAK read-only regülatör paneli (tek HTML) | M4 — Regülatör paneli | ✅ Çalışır |

---

## 1) Core + Demo (`core/`)

Saf Node.js, sıfır bağımlılık.

```bash
node demo.js          # Teknofest 5 dk senaryosu
node core/test.js     # birim testler
node api/server.js    # REST API (port 8787)
```

Öne çıkanlar:
- **`zkkyc.js`** — kişisel veri içermeyen kriptografik commitment + seçici ifşa.
- **`sbt.js`** — devredilemez (soulbound) sertifika kayıt defteri.
- **`travelRule.js`** — MASAK eşiği aşımında IVMS101 mesajı (Fabric PDC gizliliği).
- **`smurfing.js`** — borsalar arası kümülatif toplam → otomatik ŞİB.
- **`audit.js`** — hash zinciriyle değiştirilemez denetim izi (immutability ispatlı).

## 2) SBT Akıllı Kontratı (`contracts/`)

ERC-5192 (Soulbound) KYC sertifikası. Token içinde **kişisel veri yok**, yalnızca
commitment hash'i; MASAK `revoke` edebilir; transfer kalıcı olarak engellidir.

```bash
cd contracts
npm install
npm test                 # 7 birim test (Hardhat + Chai)
# Polygon Amoy testnet'e deploy:
# 1) .env → PRIVATE_KEY=...   2) https://faucet.polygon.technology'den test MATIC
npm run deploy:amoy
```

> Kontrat, `solc 0.8.24` ile **hatasız ve uyarısız** derlenir (~4.1 KB bytecode).

## 3) ZK-KYC Devresi (`zkp/`)

```bash
cd zkp
npm install
npm run demo             # gerçek Poseidon hash ile commitment + 18+ kanıtı
npm run build:snark      # tam Groth16 akışı (circom kurulumu gerekir)
```

`circuits/kyc_verify.circom`, doğum tarihini/TCKN'yi ifşa etmeden hem
commitment'ı hem de "18+" önermesini kanıtlayan Groth16 devresidir.

## 4) MASAK Paneli (`dashboard/`)

```bash
node demo.js                 # önce audit-log.json üret
npx serve dashboard          # sonra panel: http://localhost:3000
```

Read-only panel: denetim kaydı, Travel Rule mesajları, ŞİB alarmları ve hash
zinciri bütünlüğünü gösterir.

---

## "Neyi yaptık?" — sunumda söyleyebilecekleriniz

Bu PoC ile aşağıdaki işler **gerçekten gerçeklendi ve test edildi**:

1. ZK-KYC commitment üretimi ve gizlilik korumalı doğrulama (gerçek Poseidon hash).
2. ERC-5192 Soulbound KYC kontratı — derlenir, 7 birim testi, Amoy'a deploy hazır.
3. Borsalar arası taşınabilir kimlik — belge tekrarı olmadan doğrulama.
4. FATF Travel Rule / IVMS101 mesaj üretimi (eşik tetikli).
5. Cross-exchange smurfing tespiti ve otomatik ŞİB.
6. Değiştirilemez (hash-zincirli) denetim izi + bütünlük doğrulaması.
7. Borsaların bağlandığı REST/webhook API.
8. MASAK için read-only regülatör paneli.

Henüz tam ölçekli üretim için kalanlar (yol haritası): Hyperledger Fabric
test-network üzerinde gerçek chaincode dağıtımı, çoklu-dil SDK (Python/Go/Java),
ve Groth16 devresinin tarayıcıda kanıt üretimiyle uçtan uca entegrasyonu.

---

## Dizin yapısı

```
regbridge/
├── demo.js                 # uçtan uca senaryo (bağımlılıksız)
├── core/                   # iş mantığı + birim testler
│   ├── regbridge.js  audit.js  zkkyc.js  sbt.js  travelRule.js  smurfing.js
│   └── test.js
├── contracts/              # ERC-5192 SBT (Solidity + Hardhat)
│   ├── contracts/RegBridgeSBT.sol
│   ├── test/RegBridgeSBT.test.js
│   └── scripts/deploy.js
├── zkp/                    # Circom devresi + SnarkJS + Poseidon demo
│   ├── circuits/kyc_verify.circom
│   └── scripts/prove.js  scripts/build.sh
├── api/server.js           # REST / webhook sunucusu
└── dashboard/index.html    # MASAK read-only panel
```

> Not: `node_modules` klasörleri depoya dahil değildir; ilgili klasörde
> `npm install` çalıştırın.
