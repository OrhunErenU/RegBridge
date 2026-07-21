# Kodu GitHub'a Yükleme — github.com/OrhunErenU/RegBridge

> Not: Bu kodu sizin adınıza otomatik gönderemiyoruz, çünkü GitHub'a yazma işlemi
> sizin hesabınızın parolası/token'ı ile kimlik doğrulaması gerektirir (bizde
> bu bilgi yok ve olmamalı). Aşağıdaki iki yoldan biriyle 3-5 dakikada
> yükleyebilirsiniz.

## Yol A — Sürükle-bırak (en kolay, Git gerekmez)

1. https://github.com/OrhunErenU/RegBridge adresine girin.
2. **Add file → Upload files**'a tıklayın.
3. Bu klasördeki (`regbridge/`) tüm dosya ve klasörleri sürükleyip bırakın.
   - `node_modules/` klasörlerini YÜKLEMEYİN (zaten dahil değil).
4. Aşağıda **Commit changes**'e basın. Bitti.

## Yol B — Git ile (terminal)

Bilgisayarınızda `regbridge` klasörünün içinde:

```bash
git init
git add .
git commit -m "RegBridge PoC: ZK-KYC, ERC-5192 SBT, Travel Rule, smurfing, denetim izi"
git branch -M main
git remote add origin https://github.com/OrhunErenU/RegBridge.git
git push -u origin main
```

Push sırasında kullanıcı adı + **Personal Access Token** ister
(GitHub → Settings → Developer settings → Personal access tokens → "repo" izni).

## Yükledikten sonra

Sunumdaki link zaten `github.com/OrhunErenU/RegBridge` olarak ayarlı
(Faaliyet 1 ve Sonuçlar slaytları). Hakemler tıklayınca şunları görecek:

- `README.md` — özet ve çalıştırma talimatları
- `node demo.js` — tek komutla uçtan uca senaryo
- `core