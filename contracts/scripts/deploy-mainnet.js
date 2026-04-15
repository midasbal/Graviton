// Deploy script for Graviton contracts on 0G MAINNET
// Usage: npx hardhat run scripts/deploy-mainnet.js --network 0g-mainnet
//
// IMPORTANT: This deploys the EXACT same contracts as testnet
// but with production-grade storageInfo pointing to 0G mainnet infrastructure.

const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  // ── Verify we are on mainnet ──
  const { chainId } = await hre.ethers.provider.getNetwork();
  if (chainId !== 16661n) {
    throw new Error(
      `Expected 0G Mainnet (chainId 16661), got chainId ${chainId}.\n` +
        "Run with: npx hardhat run scripts/deploy-mainnet.js --network 0g-mainnet"
    );
  }

  const [deployer] = await hre.ethers.getSigners();
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  const balanceEth = hre.ethers.formatEther(balance);

  console.log("========================================");
  console.log("  GRAVITON — MAINNET DEPLOYMENT");
  console.log("========================================");
  console.log("Chain:   0G Mainnet (16661)");
  console.log("Deployer:", deployer.address);
  console.log("Balance: ", balanceEth, "A0GI");
  console.log("========================================\n");

  if (balance === 0n) {
    throw new Error(
      "Deployer has 0 balance on mainnet.\n" +
        "Fund wallet at: https://faucet.0g.ai/ or bridge tokens.\n" +
        "Deployer address: " + deployer.address
    );
  }

  // ── 1. Deploy MockVerifier ──
  console.log("--- Step 1/4: Deploy MockVerifier ---");
  const MockVerifier = await hre.ethers.getContractFactory("MockVerifier");
  const verifier = await MockVerifier.deploy();
  await verifier.waitForDeployment();
  const verifierAddr = await verifier.getAddress();
  console.log("✅ MockVerifier:", verifierAddr);

  // ── 2. Deploy GravitonINFT ──
  console.log("\n--- Step 2/4: Deploy GravitonINFT ---");
  const mintFee = hre.ethers.parseEther("0.001");
  // Mainnet storage info — points to 0G mainnet storage infrastructure
  const storageInfo = JSON.stringify({
    network: "mainnet",
    chainURL: "https://evmrpc.0g.ai",
    indexerURL: "https://indexer-storage.0g.ai",
    flowContract: "0x62D4144dB0F0a6fBBaeb6296c785C71B3D57C526",
  });
  const GravitonINFT = await hre.ethers.getContractFactory("GravitonINFT");
  const inft = await GravitonINFT.deploy(
    "Graviton Agent NFT",
    "GRVT",
    verifierAddr,
    storageInfo,
    mintFee,
    deployer.address
  );
  await inft.waitForDeployment();
  const inftAddr = await inft.getAddress();
  console.log("✅ GravitonINFT:", inftAddr);

  // ── 3. Deploy GravitonMarketplace ──
  console.log("\n--- Step 3/4: Deploy GravitonMarketplace ---");
  const platformFeeBps = 250; // 2.5%
  const GravitonMarketplace = await hre.ethers.getContractFactory("GravitonMarketplace");
  const marketplace = await GravitonMarketplace.deploy(
    inftAddr,
    platformFeeBps,
    deployer.address
  );
  await marketplace.waitForDeployment();
  const marketplaceAddr = await marketplace.getAddress();
  console.log("✅ GravitonMarketplace:", marketplaceAddr);

  // ── 4. Deploy GravitonRegistry ──
  console.log("\n--- Step 4/5: Deploy GravitonRegistry ---");
  const GravitonRegistry = await hre.ethers.getContractFactory("GravitonRegistry");
  const registry = await GravitonRegistry.deploy(inftAddr, deployer.address);
  await registry.waitForDeployment();
  const registryAddr = await registry.getAddress();
  console.log("✅ GravitonRegistry:", registryAddr);

  // ── 5. Deploy GravitonMemory ──
  console.log("\n--- Step 5/5: Deploy GravitonMemory ---");
  const GravitonMemory = await hre.ethers.getContractFactory("GravitonMemory");
  const memory = await GravitonMemory.deploy(inftAddr, deployer.address);
  await memory.waitForDeployment();
  const memoryAddr = await memory.getAddress();
  console.log("✅ GravitonMemory:", memoryAddr);

  // ── 5. Grant roles ──
  console.log("\n--- Granting MINTER_ROLE to Marketplace ---");
  const MINTER_ROLE = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("MINTER_ROLE"));
  const grantTx = await inft.grantRole(MINTER_ROLE, marketplaceAddr);
  await grantTx.wait();
  console.log("✅ MINTER_ROLE granted");

  // ── Save deployment file ──
  const deployment = {
    network: "0g-mainnet",
    chainId: "16661",
    deployer: deployer.address,
    contracts: {
      MockVerifier: verifierAddr,
      GravitonINFT: inftAddr,
      GravitonMarketplace: marketplaceAddr,
      GravitonRegistry: registryAddr,
      GravitonMemory: memoryAddr,
    },
    constructorArgs: {
      MockVerifier: [],
      GravitonINFT: [
        "Graviton Agent NFT",
        "GRVT",
        verifierAddr,
        storageInfo,
        mintFee.toString(),
        deployer.address,
      ],
      GravitonMarketplace: [inftAddr, platformFeeBps, deployer.address],
      GravitonRegistry: [inftAddr, deployer.address],
      GravitonMemory: [inftAddr, deployer.address],
    },
    timestamp: new Date().toISOString(),
    explorer: "https://chainscan.0g.ai",
  };

  // Save mainnet-specific deployment file
  const mainnetDeployPath = path.join(__dirname, "..", "deployments-mainnet.json");
  fs.writeFileSync(mainnetDeployPath, JSON.stringify(deployment, null, 2));
  console.log("\n📄 Saved to deployments-mainnet.json");

  // Also overwrite deployments.json for verify/postdeploy compatibility
  const deploymentPath = path.join(__dirname, "..", "deployments.json");
  fs.writeFileSync(deploymentPath, JSON.stringify(deployment, null, 2));
  console.log("📄 Updated deployments.json");

  // ── Final summary ──
  const finalBalance = await hre.ethers.provider.getBalance(deployer.address);
  const spent = balance - finalBalance;

  console.log("\n========================================");
  console.log("  🎉 MAINNET DEPLOYMENT COMPLETE");
  console.log("========================================");
  console.log("  MockVerifier:       ", verifierAddr);
  console.log("  GravitonINFT:       ", inftAddr);
  console.log("  GravitonMarketplace:", marketplaceAddr);
  console.log("  GravitonRegistry:   ", registryAddr);
  console.log("  GravitonMemory:     ", memoryAddr);
  console.log("");
  console.log("  Gas spent:", hre.ethers.formatEther(spent), "A0GI");
  console.log("  Remaining:", hre.ethers.formatEther(finalBalance), "A0GI");
  console.log("");
  console.log("  Explorer links:");
  console.log("    INFT:        https://chainscan.0g.ai/address/" + inftAddr);
  console.log("    Marketplace: https://chainscan.0g.ai/address/" + marketplaceAddr);
  console.log("    Registry:    https://chainscan.0g.ai/address/" + registryAddr);
  console.log("========================================");
  console.log("\nNext steps:");
  console.log("  1. Verify:     npx hardhat run scripts/verify.js --network 0g-mainnet");
  console.log("  2. Post-deploy: node scripts/postdeploy-mainnet.js");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error.message || error);
    process.exit(1);
  });
