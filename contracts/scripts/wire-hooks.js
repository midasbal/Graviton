// Wire Cross-Contract Hooks (E4)
// Grants Marketplace the roles needed to call Registry + DAO,
// then tells Marketplace where they live via setHooks().
//
// Usage: cd contracts && npx hardhat run scripts/wire-hooks.js --network 0g-testnet
//
// Idempotent — safe to re-run; skips already-granted roles.

const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const balance = await hre.ethers.provider.getBalance(deployer.address);

  console.log("========================================");
  console.log("  GRAVITON — Wire Cross-Contract Hooks");
  console.log("========================================");
  console.log("Network: ", hre.network.name);
  console.log("Deployer:", deployer.address);
  console.log("Balance: ", hre.ethers.formatEther(balance), "A0GI");
  console.log("");

  // ── Load deployment addresses ──
  const deploymentsPath = path.join(__dirname, "..", "deployments.json");
  if (!fs.existsSync(deploymentsPath)) {
    console.error("❌ deployments.json not found. Deploy contracts first.");
    process.exit(1);
  }
  const deployment = JSON.parse(fs.readFileSync(deploymentsPath, "utf8"));
  const c = deployment.contracts;

  const marketplaceAddr = c.GravitonMarketplace;
  const registryAddr = c.GravitonRegistry;
  const daoAddr = c.GravitonDAO;

  if (!marketplaceAddr || !registryAddr || !daoAddr) {
    console.error("❌ Missing Marketplace, Registry, or DAO in deployments.json");
    process.exit(1);
  }

  console.log("Marketplace:", marketplaceAddr);
  console.log("Registry:   ", registryAddr);
  console.log("DAO:        ", daoAddr);
  console.log("");

  // ── Attach contracts ──
  const registry = await hre.ethers.getContractAt("GravitonRegistry", registryAddr);
  const dao = await hre.ethers.getContractAt("GravitonDAO", daoAddr);
  const marketplace = await hre.ethers.getContractAt("GravitonMarketplace", marketplaceAddr);

  const ADMIN_ROLE = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("ADMIN_ROLE"));
  const OPERATOR_ROLE = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("OPERATOR_ROLE"));

  // ── Step 1: Grant ADMIN_ROLE to Marketplace on Registry ──
  console.log("Step 1: Grant ADMIN_ROLE to Marketplace on Registry...");
  const hasRegistryRole = await registry.hasRole(ADMIN_ROLE, marketplaceAddr);
  if (hasRegistryRole) {
    console.log("  ⚡ Already granted — skipping");
  } else {
    const tx1 = await registry.grantRole(ADMIN_ROLE, marketplaceAddr);
    await tx1.wait();
    console.log("  ✅ Granted (tx:", tx1.hash, ")");
  }

  // ── Step 2: Grant OPERATOR_ROLE to Marketplace on DAO ──
  console.log("Step 2: Grant OPERATOR_ROLE to Marketplace on DAO...");
  const hasDaoRole = await dao.hasRole(OPERATOR_ROLE, marketplaceAddr);
  if (hasDaoRole) {
    console.log("  ⚡ Already granted — skipping");
  } else {
    const tx2 = await dao.grantRole(OPERATOR_ROLE, marketplaceAddr);
    await tx2.wait();
    console.log("  ✅ Granted (tx:", tx2.hash, ")");
  }

  // ── Step 3: Tell Marketplace where Registry and DAO live ──
  console.log("Step 3: Call setHooks() on Marketplace...");
  const currentRegistry = await marketplace.registry();
  const currentDao = await marketplace.dao();

  if (
    currentRegistry.toLowerCase() === registryAddr.toLowerCase() &&
    currentDao.toLowerCase() === daoAddr.toLowerCase()
  ) {
    console.log("  ⚡ Already configured — skipping");
  } else {
    const tx3 = await marketplace.setHooks(registryAddr, daoAddr);
    await tx3.wait();
    console.log("  ✅ Hooks configured (tx:", tx3.hash, ")");
  }

  // ── Verification ──
  console.log("");
  console.log("========================================");
  console.log("  VERIFICATION");
  console.log("========================================");
  const finalRegistry = await marketplace.registry();
  const finalDao = await marketplace.dao();
  console.log("Marketplace.registry():", finalRegistry);
  console.log("Marketplace.dao():     ", finalDao);
  console.log("Registry has Marketplace ADMIN_ROLE:", await registry.hasRole(ADMIN_ROLE, marketplaceAddr));
  console.log("DAO has Marketplace OPERATOR_ROLE:  ", await dao.hasRole(OPERATOR_ROLE, marketplaceAddr));
  console.log("");
  console.log("✅ Cross-contract hooks wired successfully!");
  console.log("   buyAgent()  → registry.recordInference() + dao.updateCreatorRewards()");
  console.log("   rentAgent() → registry.recordRental()    + dao.updateCreatorRewards()");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
