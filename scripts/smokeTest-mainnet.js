// Mainnet smoke test for Graviton
// Usage: node scripts/smokeTest-mainnet.js
//
// Reads from deployments-mainnet.json and verifies all contracts
// are responding on 0G Mainnet (chainId 16661).

const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

const DEPLOYMENTS = path.join(__dirname, "..", "contracts", "deployments-mainnet.json");

// Minimal ABIs for read-only verification
const INFT_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function totalSupply() view returns (uint256)",
  "function mintFee() view returns (uint256)",
  "function storageInfo() view returns (string)",
];

const MARKETPLACE_ABI = [
  "function inft() view returns (address)",
  "function platformFeeBps() view returns (uint256)",
];

const REGISTRY_ABI = [
  "function inft() view returns (address)",
  "function totalRegistered() view returns (uint256)",
];

async function main() {
  console.log("========================================");
  console.log("  GRAVITON — MAINNET SMOKE TEST");
  console.log("========================================\n");

  if (!fs.existsSync(DEPLOYMENTS)) {
    console.error("❌ deployments-mainnet.json not found.");
    console.error("   Deploy to mainnet first.");
    process.exit(1);
  }

  const { contracts } = JSON.parse(fs.readFileSync(DEPLOYMENTS, "utf8"));
  const provider = new ethers.JsonRpcProvider("https://evmrpc.0g.ai");
  const network = await provider.getNetwork();

  console.log(`Connected to chainId: ${network.chainId}\n`);

  let passed = 0;
  let failed = 0;

  // ── Test 1: Read INFT ──
  try {
    console.log("Test 1: Read GravitonINFT...");
    const inft = new ethers.Contract(contracts.GravitonINFT, INFT_ABI, provider);
    const [name, symbol, supply, fee, storage] = await Promise.all([
      inft.name(),
      inft.symbol(),
      inft.totalSupply(),
      inft.mintFee(),
      inft.storageInfo(),
    ]);
    console.log(`  name=${name} symbol=${symbol} supply=${supply} fee=${ethers.formatEther(fee)}`);
    console.log(`  storageInfo=${storage}`);
    console.log("  ✅ PASSED\n");
    passed++;
  } catch (e) {
    console.error(`  ❌ FAILED: ${e.message}\n`);
    failed++;
  }

  // ── Test 2: Read Marketplace ──
  try {
    console.log("Test 2: Read GravitonMarketplace...");
    const mp = new ethers.Contract(contracts.GravitonMarketplace, MARKETPLACE_ABI, provider);
    const [inftAddr, feeBps] = await Promise.all([mp.inft(), mp.platformFeeBps()]);
    console.log(`  inft=${inftAddr} feeBps=${feeBps}`);
    console.log(`  INFT match: ${inftAddr.toLowerCase() === contracts.GravitonINFT.toLowerCase()}`);
    console.log("  ✅ PASSED\n");
    passed++;
  } catch (e) {
    console.error(`  ❌ FAILED: ${e.message}\n`);
    failed++;
  }

  // ── Test 3: Read Registry ──
  try {
    console.log("Test 3: Read GravitonRegistry...");
    const reg = new ethers.Contract(contracts.GravitonRegistry, REGISTRY_ABI, provider);
    const [inftAddr, total] = await Promise.all([reg.inft(), reg.totalRegistered()]);
    console.log(`  inft=${inftAddr} totalRegistered=${total}`);
    console.log("  ✅ PASSED\n");
    passed++;
  } catch (e) {
    console.error(`  ❌ FAILED: ${e.message}\n`);
    failed++;
  }

  // ── Test 4: Mint + Register (write) ──
  const privateKey = process.env.PRIVATE_KEY;
  if (privateKey) {
    try {
      console.log("Test 4: Mint agent INFT on mainnet...");
      const wallet = new ethers.Wallet(privateKey, provider);
      const balance = await provider.getBalance(wallet.address);
      console.log(`  Deployer balance: ${ethers.formatEther(balance)} A0GI`);

      const inft = new ethers.Contract(
        contracts.GravitonINFT,
        [
          ...INFT_ABI,
          "function mint(address to, (string dataDescription, bytes32 dataHash)[] iDatas, string category, string storageRoot, string uri) payable returns (uint256)",
        ],
        wallet
      );

      const mintFee = await inft.mintFee();
      const intelligentData = [
        {
          dataDescription: "Graviton Mainnet Genesis Agent",
          dataHash: ethers.keccak256(ethers.toUtf8Bytes("graviton-mainnet-genesis-" + Date.now())),
        },
      ];

      const tx = await inft.mint(
        wallet.address,
        intelligentData,
        "assistant",
        "0g-storage://mainnet-genesis",
        "https://graviton.ai/agents/mainnet-genesis",
        { value: mintFee }
      );
      const receipt = await tx.wait();
      console.log(`  Mint TX: ${receipt.hash}`);
      console.log(`  Explorer: https://chainscan.0g.ai/tx/${receipt.hash}`);
      console.log("  ✅ PASSED\n");
      passed++;
    } catch (e) {
      console.error(`  ❌ FAILED: ${e.message}\n`);
      failed++;
    }

    try {
      console.log("Test 5: Register agent in Registry...");
      const wallet = new ethers.Wallet(privateKey, provider);
      const inft = new ethers.Contract(contracts.GravitonINFT, INFT_ABI, provider);
      const totalSupply = await inft.totalSupply();
      const tokenId = totalSupply; // latest minted token

      const reg = new ethers.Contract(
        contracts.GravitonRegistry,
        [
          ...REGISTRY_ABI,
          "function registerAgent(uint256 tokenId, string name, string description, string endpointUrl, string category) external",
        ],
        wallet
      );

      const tx = await reg.registerAgent(
        tokenId,
        "Genesis Agent",
        "First agent minted on 0G Mainnet — Graviton Marketplace",
        "https://graviton.ai/api/agents/genesis",
        "assistant"
      );
      const receipt = await tx.wait();
      console.log(`  Register TX: ${receipt.hash}`);
      console.log(`  Explorer: https://chainscan.0g.ai/tx/${receipt.hash}`);
      console.log("  ✅ PASSED\n");
      passed++;
    } catch (e) {
      console.error(`  ❌ FAILED: ${e.message}\n`);
      failed++;
    }
  } else {
    console.log("Test 4-5: SKIPPED (no PRIVATE_KEY env var for write tests)\n");
  }

  // ── Summary ──
  console.log("========================================");
  console.log(`  RESULTS: ${passed} passed, ${failed} failed`);
  console.log("========================================");
  console.log("\n  Explorer links:");
  for (const [name, addr] of Object.entries(contracts)) {
    console.log(`    ${name}: https://chainscan.0g.ai/address/${addr}`);
  }

  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
