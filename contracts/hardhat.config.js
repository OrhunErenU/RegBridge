require("@nomicfoundation/hardhat-toolbox");

/**
 * Polygon Amoy testnet'e deploy için:
 *   1) .env dosyasına PRIVATE_KEY ve (opsiyonel) AMOY_RPC_URL koyun
 *   2) Amoy faucet'ten test MATIC alın: https://faucet.polygon.technology
 *   3) npm run deploy:amoy
 */
const PRIVATE_KEY = process.env.PRIVATE_KEY || "";
const AMOY_RPC_URL = process.env.AMOY_RPC_URL || "https://rpc-amoy.polygon.technology";

module.exports = {
  solidity: {
    version: "0.8.24",
    settings: { optimizer: { enabled: true, runs: 200 } },
  },
  networks: {
    amoy: {
      url: AMOY_RPC_URL,
      chainId: 80002,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
    },
  },
};
