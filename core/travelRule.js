'use strict';
/**
 * M1 — FATF Travel Rule + IVMS101 Mesajlaşması
 * --------------------------------------------
 * MASAK eşiği (varsayılan 15.000 TL) aşıldığında, gönderici ve alıcı borsa
 * arasında IVMS101 (interVASP Messaging Standard 101) formatında bir mesaj
 * üretilir. Gerçek sistemde bu mesaj Hyperledger Fabric Private Data
 * Collection (PDC) içinde, yalnızca iki ilgili borsa + MASAK'a görünür
 * şekilde saklanır.
 */
const crypto = require('crypto');

const MASAK_ESIK_TL = 15000;

/** IVMS101 (sadeleştirilmiş) Travel Rule mesajı üretir. */
function buildIVMS101(transfer) {
  const { gonderenBorsa, alanBorsa, gonderenRef, alanRef, tutarTL, varlik } = transfer;
  return {
    standard: 'IVMS101',
    messageId: '0x' + crypto.randomBytes(12).toString('hex'),
    originatingVASP: { id: gonderenBorsa },
    beneficiaryVASP: { id: alanBorsa },
    // Travel Rule kapsamı: taraf referansları (commitment/SBT temelli), açık kişisel veri değil
    originator: { customerRef: gonderenRef },
    beneficiary: { customerRef: alanRef },
    transaction: { amountTRY: tutarTL, asset: varlik, datetime: new Date().toISOString() },
    confidentiality: 'FABRIC_PDC',  // yalnızca iki borsa + MASAK görür
  };
}

/** Transferin Travel Rule'a tabi olup olmadığını döndürür. */
function travelRuleGerekli(tutarTL, esik = MASAK_ESIK_TL) {
  return tutarTL >= esik;
}

module.exports = { buildIVMS101, travelRuleGerekli, MASAK_ESIK_TL };
