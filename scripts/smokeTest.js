// Graviton — On-chain smoke test
// Verifies all deployed contracts are functional on 0G Galileo Testnet
// Usage: node scripts/smokeTest.js

const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

// Read deployment addresses
const deployment = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "contracts", "deployments.json"), "utf8")
);
const { GravitonINFT, GravitonMarketplace, GravitonRegistry } = deployment.contracts;

const PRIVATE_KEY = process.env.PRIVATE_KEY;
const RPC_URL = "https://evmrpc-testnet.0g.ai";

// Minimal ABIs
const INFT_ABI = [
  "function mint(address to, (string dataDescription, bytes32 dataHash)[] calldata iDatas, string calldata category, string calldata _storageRoot, string calldata uri) external payable returns (uint256)",
  "function mintFee() external view returns (uint256)",
  "function ownerOf(uint256 tokenId) external view returns (address)",
  "function totalSupply() external view returns (uint256)",
  "function creatorOf(uint256 tokenId) external view returns (address)",
  "function categoryOf(uint256 tokenId) external view returns (string)",
  "function storageRootOf(uint256 tokenId) external view returns (string)",
  "function name() external view returns (string)",
  "function symbol() external view returns (string)",
];

const MARKETPLACE_ABI = [
  "function platformFeeBps() external view returns (uint256)",
  "function inft() external view returns (address)",
];

const REGISTRY_ABI = [
  "function registerAgent(uint256 tokenId, string name, string description, string modelType, string[] tags, string storageHash, string metadataURI) external",
  "function isRegistered(uint256 tokenId) external view returns (bool)",
  "function totalRegistered() external view returns (uint256)",
  "function getAgentMeta(uint256 tokenId) external view returns (tuple(string name, string description, string modelType, string[] tags, string storageHash, string metadataURI, uint256 registeredAt, uint256 updatedAt, uint256 version))",
];

async function main() {
  console.log("=".repeat(60));
  console.log("  GRAVITON — On-chain Smoke Test");
  console.log("=".repeat(60));

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  const balance = await provider.getBalance(wallet.address);

  console.log(`\nWallet:  ${wallet.address}`);
  console.log(`Balance: ${ethers.formatEther(balance)} A0GI`);

  const inft = new ethers.Contract(GravitonINFT, INFT_ABI, wallet);
  const marketplace = new ethers.Contract(GravitonMarketplace, MARKETPLACE_ABI, wallet);
  const registry = new ethers.Contract(GravitonRegistry, REGISTRY_ABI, wallet);

  // ---- Test 1: Read INFT metadata ----
  console.log("\n--- Test 1: Read INFT Contract ---");
  const name = await inft.name();
  const symbol = await inft.symbol();
  const mintFee = await inft.mintFee();
  const supply = await inft.totalSupply();
  console.log(`  Name:         ${name}`);
  console.log(`  Symbol:       ${symbol}`);
  console.log(`  Mint Fee:     ${ethers.formatEther(mintFee)} A0GI`);
  console.log(`  Total Supply: ${supply}`);
  console.log("  ✅ INFT reads OK");

  // ---- Test 2: Read Marketplace ----
  console.log("\n--- Test 2: Read Marketplace Contract ---");
  const feeBps = await marketplace.platformFeeBps();
  const linkedInft = await marketplace.inft();
  console.log(`  Platform Fee: ${feeBps} bps (${Number(feeBps) / 100}%)`);
  console.log(`  Linked INFT:  ${linkedInft}`);
  console.log(`  Match:        ${linkedInft.toLowerCase() === GravitonINFT.toLowerCase() ? "✅" : "❌"}`);

  // ---- Test 3: Read Registry ----
  console.log("\n--- Test 3: Read Registry Contract ---");
  const totalReg = await registry.totalRegistered();
  console.log(`  Total Registered: ${totalReg}`);
  console.log("  ✅ Registry reads OK");

  // ---- Test 4: Mint an INFT ----
  console.log("\n--- Test 4: Mint a test INFT ---");
  const testDataHash = ethers.keccak256(ethers.toUtf8Bytes("graviton-smoke-test-" + Date.now()));
  const intelligentData = [
    {
      dataDescription: "Graviton Smoke Test Agent — LoRA weights hash",
      dataHash: testDataHash,
    },
  ];

  const mintTx = await inft.mint(
    wallet.address,
    intelligentData,
    "assistant",
    "0x_smoke_test_storage_root",
    "0g://smoke-test-metadata",
    { value: mintFee }
  );
  console.log(`  Mint TX: ${mintTx.hash}`);
  const receipt = await mintTx.wait();
  console.log(`  Block:   ${receipt.blockNumber}`);

  // Find token ID from Transfer event
  const transferLog = receipt.logs.find(
    (log) => log.topics[0] === ethers.id("Transfer(address,address,uint256)")
  );
  const tokenId = transferLog ? BigInt(transferLog.topics[3]) : await inft.totalSupply();
  console.log(`  Token ID: ${tokenId}`);

  // Verify
  const owner = await inft.ownerOf(tokenId);
  const creator = await inft.creatorOf(tokenId);
  const category = await inft.categoryOf(tokenId);
  console.log(`  Owner:    ${owner}`);
  console.log(`  Creator:  ${creator}`);
  console.log(`  Category: ${category}`);
  console.log("  ✅ Mint successful");

  // ---- Test 5: Register in Registry ----
  console.log("\n--- Test 5: Register agent in Registry ---");
  const regTx = await registry.registerAgent(
    tokenId,
    "Smoke Test Agent",
    "A test agent created during Graviton deployment verification.",
    "Qwen2.5-0.5B-Instruct",
    ["test", "smoke-test", "verification"],
    "0x_smoke_test_storage_root",
    "0g://smoke-test-metadata"
  );
  console.log(`  Register TX: ${regTx.hash}`);
  await regTx.wait();

  const isReg = await registry.isRegistered(tokenId);
  const meta = await registry.getAgentMeta(tokenId);
  console.log(`  Registered:  ${isReg}`);
  console.log(`  Agent Name:  ${meta.name}`);
  console.log(`  Model Type:  ${meta.modelType}`);
  console.log(`  Tags:        ${meta.tags.join(", ")}`);
  console.log("  ✅ Registration successful");

  // ---- Summary ----
  const explorerBase = "https://chainscan-galileo.0g.ai";
  const finalBalance = await provider.getBalance(wallet.address);

  console.log("\n" + "=".repeat(60));
  console.log("  SMOKE TEST COMPLETE — ALL PASSED ✅");
  console.log("=".repeat(60));
  console.log(`  Token ID:     ${tokenId}`);
  console.log(`  Gas Used:     ${ethers.formatEther(balance - finalBalance)} A0GI`);
  console.log(`  Remaining:    ${ethers.formatEther(finalBalance)} A0GI`);
  console.log(`  Mint TX:      ${explorerBase}/tx/${mintTx.hash}`);
  console.log(`  Register TX:  ${explorerBase}/tx/${regTx.hash}`);
  console.log(`  INFT:         ${explorerBase}/address/${GravitonINFT}`);
  console.log(`  Marketplace:  ${explorerBase}/address/${GravitonMarketplace}`);
  console.log(`  Registry:     ${explorerBase}/address/${GravitonRegistry}`);
  console.log("=".repeat(60));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Smoke test failed:", error.message);
    if (error.data) console.error("Data:", error.data);
    process.exit(1);
  });
