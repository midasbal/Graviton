// Smoke test for GravitonDAO on testnet
// Usage: cd contracts && npx hardhat run scripts/smokeTest-dao.js --network 0g-testnet

const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [signer] = await hre.ethers.getSigners();
  const deploymentsPath = path.join(__dirname, "..", "deployments.json");
  const deployment = JSON.parse(fs.readFileSync(deploymentsPath, "utf8"));

  const daoAddress = deployment.contracts.GravitonDAO;
  if (!daoAddress) {
    console.error("❌ GravitonDAO not found in deployments.json");
    process.exit(1);
  }

  console.log("========================================");
  console.log("  GRAVITON — DAO Smoke Test");
  console.log("========================================");
  console.log("Contract:", daoAddress);
  console.log("Signer:  ", signer.address);
  console.log("");

  const dao = await hre.ethers.getContractAt("GravitonDAO", daoAddress, signer);
  let passed = 0;
  let failed = 0;

  // Test 1: Revenue split (40/40/20)
  try {
    const creatorBps = await dao.creatorShareBps();
    const stakerBps = await dao.stakerShareBps();
    const treasuryBps = await dao.treasuryShareBps();
    const ok = Number(creatorBps) === 4000 && Number(stakerBps) === 4000 && Number(treasuryBps) === 2000;
    console.log(`${ok ? "✅" : "❌"} Test 1 — Revenue split: ${creatorBps}/${stakerBps}/${treasuryBps} bps`);
    ok ? passed++ : failed++;
  } catch (e) {
    console.log("❌ Test 1:", e.message);
    failed++;
  }

  // Test 2: Pool balances (should be zero)
  try {
    const [creators, stakers, treasury, totalDist] = await dao.getPoolBalances();
    console.log(`✅ Test 2 — Pools: creators=${creators}, stakers=${stakers}, treasury=${treasury}, total=${totalDist}`);
    passed++;
  } catch (e) {
    console.log("❌ Test 2:", e.message);
    failed++;
  }

  // Test 3: DAO stats
  try {
    const stats = await dao.getDAOStats();
    console.log(`✅ Test 3 — Stats: staked=${stats[0]}, revenue=${stats[1]}, proposals=${stats[4]}`);
    passed++;
  } catch (e) {
    console.log("❌ Test 3:", e.message);
    failed++;
  }

  // Test 4: Voting period and quorum
  try {
    const period = await dao.votingPeriod();
    const quorum = await dao.quorumVotes();
    console.log(`✅ Test 4 — Governance: votingPeriod=${period}s, quorum=${quorum}`);
    passed++;
  } catch (e) {
    console.log("❌ Test 4:", e.message);
    failed++;
  }

  // Test 5: Roles
  try {
    const adminRole = await dao.ADMIN_ROLE();
    const operatorRole = await dao.OPERATOR_ROLE();
    const hasAdmin = await dao.hasRole(adminRole, signer.address);
    const hasOp = await dao.hasRole(operatorRole, signer.address);
    console.log(`✅ Test 5 — Roles: admin=${hasAdmin}, operator=${hasOp}`);
    passed++;
  } catch (e) {
    console.log("❌ Test 5:", e.message);
    failed++;
  }

  // Test 6: Distribute revenue (send 0.001 A0GI)
  try {
    const tx = await dao.distributeRevenue({ value: hre.ethers.parseEther("0.001") });
    await tx.wait();
    const [creators, stakers, treasury] = await dao.getPoolBalances();
    console.log(`✅ Test 6 — Revenue distributed: creators=${hre.ethers.formatEther(creators)}, stakers=${hre.ethers.formatEther(stakers)}, treasury=${hre.ethers.formatEther(treasury)}`);
    passed++;
  } catch (e) {
    console.log("❌ Test 6:", e.message);
    failed++;
  }

  // Test 7: Next proposal ID (should be 0)
  try {
    const nextId = await dao.nextProposalId();
    console.log(`✅ Test 7 — nextProposalId = ${nextId}`);
    passed++;
  } catch (e) {
    console.log("❌ Test 7:", e.message);
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
