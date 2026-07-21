'use strict';
/**
 * Cross-Exchange Smurfing Tespiti
 * -------------------------------
 * Mevcut sistemde her borsa yalnızca KENDİ işlem hacmini görür; bu yüzden bir
 * kullanıcı farklı borsalarda eşik altı küçük işlemler yaparak (smurfing)
 * MASAK raporlama eşiğini aşmadan büyük toplam transfer edebilir.
 *
 * RegBridge, işlemleri kullanıcının SBT commitment'ı (borsalar arası tek kimlik)
 * üzerinden ilişkilendirir ve kayan zaman penceresinde kümülatif toplamı takip
 * eder. Toplam eşiği aşınca otomatik ŞİB (Şüpheli İşlem Bildirimi) üretilir.
 */
class SmurfingDetector {
  /**
   * @param {object} opts
   * @param {number} opts.esikTL   Kümülatif ŞİB eşiği (varsayılan 15.000 TL)
   * @param {number} opts.pencereDk Zaman penceresi (dakika, varsayılan 24 saat)
   */
  constructor({ esikTL = 15000, pencereDk = 24 * 60 } = {}) {
    this.esikTL = esikTL;
    this.pencereMs = pencereDk * 60 * 1000;
    this.kayitlar = new Map(); // commitment -> [{tutar, ts, borsa}]
    this.bildirilen = new Set();
  }

  /**
   * Bir işlemi kaydeder. Kümülatif toplam eşiği aştıysa ŞİB nesnesi döner.
   * @returns {object|null} ŞİB veya null
   */
  kaydet({ commitment, tutarTL, borsaId }) {
    const now = Date.now();
    if (!this.kayitlar.has(commitment)) this.kayitlar.set(commitment, []);
    const liste = this.kayitlar.get(commitment);
    liste.push({ tutarTL, ts: now, borsaId });

    // pencere dışındaki eski işlemleri at
    const guncel = liste.filter((x) => now - x.ts <= this.pencereMs);
    this.kayitlar.set(commitment, guncel);

    const toplam = guncel.reduce((s, x) => s + x.tutarTL, 0);
    const borsalar = [...new Set(guncel.map((x) => x.borsaId))];

    // Şüphe kriteri: kümülatif toplam eşiği aşmış VE birden fazla borsa kullanılmış
    if (toplam >= this.esikTL && borsalar.length >= 2 && !this.bildirilen.has(commitment)) {
      this.bildirilen.add(commitment);
      return {
        tip: 'SIB',
        sebep: 'Cross-exchange smurfing şüphesi: eşik altı işlemlerin kümülatif toplamı eşiği aştı',
        commitment,
        kumulatifTL: toplam,
        islemSayisi: guncel.length,
        kullanilanBorsalar: borsalar,
        olusturulma: new Date(now).toISOString(),
      };
    }
    return null;
  }

  toplam(commitment) {
    const liste = this.kayitlar.get(commitment) || [];
    return liste.reduce((s, x) => s + x.tutarTL, 0);
  }
}

module.exports = { SmurfingDetector };
