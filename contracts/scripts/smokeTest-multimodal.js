// Smoke test for GravitonMultiModal on testnet
// Usage: cd contracts && npx hardhat run scripts/smokeTest-multimodal.js --network 0g-testnet

const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [signer] = await hre.ethers.getSigners();
  const deploymentsPath = path.join(__dirname, "..", "deployments.json");
  const deployment = JSON.parse(fs.readFileSync(deploymentsPath, "utf8"));

  const multimodalAddress = deployment.contracts.GravitonMultiModal;
  if (!multimodalAddress) {
    console.error("❌ GravitonMultiModal not found in deployments.json");
    process.exit(1);
  }

  console.log("========================================");
  console.log("  GRAVITON — Multi-Modal Smoke Test");
  console.log("========================================");
  console.log("Contract:", multimodalAddress);
  console.log("Signer:  ", signer.address);
  console.log("");

  const multimodal = await hre.ethers.getContractAt(
    "GravitonMultiModal",
    multimodalAddress,
    signer
  );
  let passed = 0;
  let failed = 0;

  // -----------------------------------------------------------
  // Test 1: Read INFT address
  // -----------------------------------------------------------
  try {
    const inft = await multimodal.inft();
    console.log(`✅ Test 1 — INFT reference: ${inft}`);
    passed++;
  } catch (e) {
    console.log(`❌ Test 1 — INFT reference: ${e.message}`);
    failed++;
  }

  // -----------------------------------------------------------
  // Test 2: Read totalMultiModalAgents (should be 0 initially)
  // -----------------------------------------------------------
  try {
    const total = await multimodal.totalMultiModalAgents();
    console.log(`✅ Test 2 — totalMultiModalAgents: ${total}`);
    passed++;
  } catch (e) {
    console.log(`❌ Test 2 — totalMultiModalAgents: ${e.message}`);
    failed++;
  }

  // -----------------------------------------------------------
  // Test 3: Read totalModalityRegistrations
  // -----------------------------------------------------------
  try {
    const totalReg = await multimodal.totalModalityRegistrations();
    console.log(`✅ Test 3 — totalModalityRegistrations: ${totalReg}`);
    passed++;
  } catch (e) {
    console.log(`❌ Test 3 — totalModalityRegistrations: ${e.message}`);
    failed++;
  }

  // -----------------------------------------------------------
  // Test 4: Check hasProfile for non-existent agent (false)
  // -----------------------------------------------------------
  try {
    const has = await multimodal.hasProfile(999);
    const ok = has === false;
    console.log(`${ok ? "✅" : "❌"} Test 4 — hasProfile(999) = ${has} (expected false)`);
    ok ? passed++ : failed++;
  } catch (e) {
    console.log(`❌ Test 4 — hasProfile: ${e.message}`);
    failed++;
  }

  // -----------------------------------------------------------
  // Test 5: getSupportedModalities for non-profiled agent (all false)
  // -----------------------------------------------------------
  try {
    const mods = await multimodal.getSupportedModalities(999);
    const allFalse = mods.every((m) => m === false);
    console.log(
      `${allFalse ? "✅" : "❌"} Test 5 — getSupportedModalities(999) all false: ${allFalse}`
    );
    allFalse ? passed++ : failed++;
  } catch (e) {
    console.log(`❌ Test 5 — getSupportedModalities: ${e.message}`);
    failed++;
  }

  // -----------------------------------------------------------
  // Test 6: getModalityUsageStats (all zeros)
  // -----------------------------------------------------------
  try {
    const stats = await multimodal.getModalityUsageStats(999);
    const allZero = stats.every((s) => s === 0n);
    console.log(
      `${allZero ? "✅" : "❌"} Test 6 — getModalityUsageStats(999) all zero: ${allZero}`
    );
    allZero ? passed++ : failed++;
  } catch (e) {
    console.log(`❌ Test 6 — getModalityUsageStats: ${e.message}`);
    failed++;
  }

  // -----------------------------------------------------------
  // Test 7: getAgentsByModality for Text (should be empty array)
  // -----------------------------------------------------------
  try {
    const agents = await multimodal.getAgentsByModality(0); // Text = 0
    console.log(`✅ Test 7 — getAgentsByModality(Text): ${agents.length} agents`);
    passed++;
  } catch (e) {
    console.log(`❌ Test 7 — getAgentsByModality: ${e.message}`);
    failed++;
  }

  // -----------------------------------------------------------
  // Test 8: Verify admin role
  // -----------------------------------------------------------
  try {
    const DEFAULT_ADMIN_ROLE = "0x0000000000000000000000000000000000000000000000000000000000000000";
    const isAdmin = await multimodal.hasRole(DEFAULT_ADMIN_ROLE, signer.address);
    console.log(`${isAdmin ? "✅" : "❌"} Test 8 — deployer is admin: ${isAdmin}`);
    isAdmin ? passed++ : failed++;
  } catch (e) {
    console.log(`❌ Test 8 — hasRole: ${e.message}`);
    failed++;
  }

  // -----------------------------------------------------------
  console.log("");
  console.log("========================================");
  console.log(`  Results: ${passed}/${passed + failed} passed`);
  console.log("========================================");

  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
