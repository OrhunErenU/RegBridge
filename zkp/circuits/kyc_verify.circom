pragma circom 2.1.6;

include "circomlib/circuits/poseidon.circom";
include "circomlib/circuits/comparators.circom";

/*
 * kyc_verify.circom — Gizlilik Koruyan KYC Devresi (Groth16)
 * ----------------------------------------------------------
 * Amaç: Kullanıcının kimliğini İFŞA ETMEDEN şunları kanıtlamak:
 *   1) Borsa A'da üretilen "commitment"ın gerçek kişisel verilere ait olduğu
 *      (commitment = Poseidon(tckn, dogumYili, salt)),
 *   2) Kullanıcının 18 yaşından büyük olduğu (dogumYili <= esikYili).
 *
 * Private inputs (asla ifşa edilmez):  tckn, dogumYili, salt
 * Public inputs (paylaşılır):          commitment, esikYili
 * Public output:                       over18 (1/0)
 *
 * Bu sayede Borsa B yalnızca commitment + "18+" kanıtını görür; doğum tarihi
 * veya TC kimlik numarası ZİNCİRE/SBT'ye hiç girmez.
 */

template KycVerify() {
    // --- gizli girdiler ---
    signal input tckn;
    signal input dogumYili;
    signal input salt;

    // --- açık girdiler ---
    signal input commitment;   // beklenen Poseidon hash
    signal input esikYili;     // örn. (gununYili - 18)

    // --- çıktı ---
    signal output over18;

    // 1) commitment doğrulaması: Poseidon(tckn, dogumYili, salt) == commitment
    component h = Poseidon(3);
    h.inputs[0] <== tckn;
    h.inputs[1] <== dogumYili;
    h.inputs[2] <== salt;
    h.out === commitment;

    // 2) yaş kontrolü: dogumYili <= esikYili  →  over18 = 1
    component le = LessEqThan(32);
    le.in[0] <== dogumYili;
    le.in[1] <== esikYili;
    over18 <== le.out;

    // güvenlik: kanıt yalnızca 18+ ise kabul edilsin
    over18 === 1;
}

component main { public [commitment, esikYili] } = KycVerify();
