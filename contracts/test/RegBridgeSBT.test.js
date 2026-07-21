const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("RegBridgeSBT (ERC-5192 Soulbound KYC)", function () {
  let sbt, admin, borsaA, regulator, alice, bob;
  const commitment = ethers.keccak256(ethers.toUtf8Bytes("ornek-commitment"));

  beforeEach(async () => {
    [admin, borsaA, regulator, alice, bob] = await ethers.getSigners();
    const SBT = await ethers.getContractFactory("RegBridgeSBT");
    sbt = await SBT.deploy();
    await sbt.waitForDeployment();
    await sbt.setIssuer(borsaA.address, true);
    await sbt.setRegulator(regulator.address, true);
  });

  it("yetkili borsa SBT mint edebilir ve kişisel veri içermez", async () => {
    await expect(sbt.connect(borsaA).mint(alice.address, commitment, true))
      .to.emit(sbt, "Minted");
    const id = await sbt.tokenOfOwner(alice.address);
    const cert = await sbt.certificates(id);
    expect(cert.commitment).to.equal(commitment);   // yalnızca hash
    expect(cert.over18).to.equal(true);
    expect(await sbt.isValid(alice.address)).to.equal(true);
  });

  it("yetkisiz adres mint edemez", async () => {
    await expect(sbt.connect(bob).mint(alice.address, commitment, true))
      .to.be.revertedWith("yalnizca yetkili borsa");
  });

  it("token soulbound'dur — transfer reverts (ERC-5192)", async () => {
    await sbt.connect(borsaA).mint(alice.address, commitment, true);
    const id = await sbt.tokenOfOwner(alice.address);
    expect(await sbt.locked(id)).to.equal(true);
    await expect(sbt.transferFrom(alice.address, bob.address, id))
      .to.be.revertedWith("ERC-5192: soulbound token devredilemez");
  });

  it("aynı cüzdana ikinci SBT mint edilemez", async () => {
    await sbt.connect(borsaA).mint(alice.address, commitment, true);
    await expect(sbt.connect(borsaA).mint(alice.address, commitment, true))
      .to.be.revertedWith("cuzdanda zaten SBT var");
  });

  it("MASAK revoke edince tüm borsalarda anında geçersiz olur", async () => {
    await sbt.connect(borsaA).mint(alice.address, commitment, true);
    expect(await sbt.isValid(alice.address)).to.equal(true);
    await expect(sbt.connect(regulator).revoke(alice.address, "MASAK kara liste"))
      .to.emit(sbt, "Revoked");
    expect(await sbt.isValid(alice.address)).to.equal(false);
  });

  it("yetkisiz adres revoke edemez", async () => {
    await sbt.connect(borsaA).mint(alice.address, commitment, true);
    await expect(sbt.connect(bob).revoke(alice.address, "x"))
      .to.be.revertedWith("yalnizca regulator");
  });

  it("ERC-5192 arayüzünü destekler (0xb45a3c0e)", async () => {
    expect(await sbt.supportsInterface("0xb45a3c0e")).to.equal(true);
  });
});
