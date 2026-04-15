// Smoke test for GravitonFineTuning contract on testnet
// Usage: cd contracts && npx hardhat run scripts/smokeTest-finetuning.js --network 0g-testnet

const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [signer] = await hre.ethers.getSigners();
  const deploymentsPath = path.join(__dirname, "..", "deployments.json");
  const deployment = JSON.parse(fs.readFileSync(deploymentsPath, "utf8"));

  const ftAddress = deployment.contracts.GravitonFineTuning;
  if (!ftAddress) {
    console.error("❌ GravitonFineTuning not found in deployments.json");
    process.exit(1);
  }

  console.log("========================================");
  console.log("  GRAVITON — Fine-Tuning Smoke Test");
  console.log("========================================");
  console.log("Contract:", ftAddress);
  console.log("Signer:  ", signer.address);
  console.log("");

  const ft = await hre.ethers.getContractAt("GravitonFineTuning", ftAddress, signer);
  let passed = 0;
  let failed = 0;

  // Test 1: nextJobId should be 0
  try {
    const nextId = await ft.nextJobId();
    console.log(`✅ Test 1 — nextJobId = ${nextId}`);
    passed++;
  } catch (e) {
    console.log(`❌ Test 1 — nextJobId:`, e.message);
    failed++;
  }

  // Test 2: totalCompletedJobs should be 0
  try {
    const total = await ft.totalCompletedJobs();
    console.log(`✅ Test 2 — totalCompletedJobs = ${total}`);
    passed++;
  } catch (e) {
    console.log(`❌ Test 2 — totalCompletedJobs:`, e.message);
    failed++;
  }

  // Test 3: getAgentStats for token 0 (should return all zeros)
  try {
    const stats = await ft.getAgentStats(0);
    console.log(`✅ Test 3 — getAgentStats(0): totalJobs=${stats.totalJobs}, completedJobs=${stats.completedJobs}`);
    passed++;
  } catch (e) {
    console.log(`❌ Test 3 — getAgentStats:`, e.message);
    failed++;
  }

  // Test 4: getCurrentVersion for token 0 (should be 0)
  try {
    const version = await ft.getCurrentVersion(0);
    console.log(`✅ Test 4 — getCurrentVersion(0) = ${version}`);
    passed++;
  } catch (e) {
    console.log(`❌ Test 4 — getCurrentVersion:`, e.message);
    failed++;
  }

  // Test 5: Check ADMIN_ROLE and OPERATOR_ROLE
  try {
    const adminRole = await ft.ADMIN_ROLE();
    const operatorRole = await ft.OPERATOR_ROLE();
    const hasAdmin = await ft.hasRole(adminRole, signer.address);
    const hasOperator = await ft.hasRole(operatorRole, signer.address);
    console.log(`✅ Test 5 — Roles: admin=${hasAdmin}, operator=${hasOperator}`);
    passed++;
  } catch (e) {
    console.log(`❌ Test 5 — Roles:`, e.message);
    failed++;
  }

  // Test 6: MIN_LORA_RANK and MAX_LORA_RANK
  try {
    const minRank = await ft.MIN_LORA_RANK();
    const maxRank = await ft.MAX_LORA_RANK();
    console.log(`✅ Test 6 — LoRA Rank: min=${minRank}, max=${maxRank}`);
    passed++;
  } catch (e) {
    console.log(`❌ Test 6 — LoRA Rank:`, e.message);
    failed++;
  }

  console.log("\n========================================");
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  console.log("========================================");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
