const hre = require("hardhat");

async function main() {
  const SBT = await hre.ethers.getContractFactory("RegBridgeSBT");
  const sbt = await SBT.deploy();
  await sbt.waitForDeployment();
  const addr = await sbt.getAddress();
  console.log("RegBridgeSBT deploy edildi →", addr);
  console.log("Ağ:", hre.network.name);
  if (hre.network.name === "amoy") {
    console.log("Polygonscan (Amoy): https://amoy.polygonscan.com/address/" + addr);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
