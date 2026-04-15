/**
 * Graviton — mintAgent Integration Script
 *
 * Demonstrates the full pipeline from agent data to on-chain INFT:
 *   1. Upload a sample LoRA adapter to 0G Storage (encrypted)
 *   2. Get the Storage Hash (rootHash) and dataHash
 *   3. Call GravitonINFT.mint() with the generated hash
 *   4. Call GravitonRegistry.registerAgent() with metadata
 *
 * Usage:
 *   npx ts-node scripts/mintAgent.ts
 *
 * Prerequisites:
 *   - Contracts deployed (run `npx hardhat run contracts/scripts/deploy.js --network 0g-testnet`)
 *   - .env configured with PRIVATE_KEY and contract addresses
 *   - Wallet funded with 0G tokens (faucet: https://faucet.0g.ai/)
 */

import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";
import dotenv from "dotenv";
import StorageService from "../lib/storageService";

dotenv.config();

// ============================================================
//                      CONFIGURATION
// ============================================================

const NETWORK = (process.env.NETWORK || "testnet") as "testnet" | "mainnet";
const PRIVATE_KEY = process.env.PRIVATE_KEY || "";
const INFT_ADDRESS = process.env.GRAVITON_INFT_ADDRESS || "";
const REGISTRY_ADDRESS = process.env.GRAVITON_REGISTRY_ADDRESS || "";

const RPC_URLS: Record<string, string> = {
  testnet: "https://evmrpc-testnet.0g.ai",
  mainnet: "https://evmrpc.0g.ai",
};

// ============================================================
//              MINIMAL ABI (only functions we call)
// ============================================================

const INFT_ABI = [
  "function mint(address to, (string dataDescription, bytes32 dataHash)[] calldata iDatas, string calldata category, string calldata _storageRoot, string calldata uri) external payable returns (uint256)",
  "function mintFee() external view returns (uint256)",
  "function ownerOf(uint256 tokenId) external view returns (address)",
  "function tokenURI(uint256 tokenId) external view returns (string)",
  "function totalSupply() external view returns (uint256)",
  "function creatorOf(uint256 tokenId) external view returns (address)",
  "function categoryOf(uint256 tokenId) external view returns (string)",
  "function storageRootOf(uint256 tokenId) external view returns (string)",
];

const REGISTRY_ABI = [
  "function registerAgent(uint256 tokenId, string name, string description, string modelType, string[] tags, string storageHash, string metadataURI) external",
  "function getAgentMeta(uint256 tokenId) external view returns (tuple(string name, string description, string modelType, string[] tags, string storageHash, string metadataURI, uint256 registeredAt, uint256 updatedAt, uint256 version))",
  "function isRegistered(uint256 tokenId) external view returns (bool)",
  "function totalRegistered() external view returns (uint256)",
];

// ============================================================
//                    SAMPLE AGENT DATA
// ============================================================

/** A sample LoRA adapter for demonstration purposes */
function createSampleLoraData(): Buffer {
  // In production, this would be the actual safetensors/bin file.
  // For demo, we create a structured binary blob that simulates a LoRA adapter.
  const header = Buffer.from(
    JSON.stringify({
      format: "graviton-lora-demo",
      version: "1.0",
      baseModel: "Qwen2.5-0.5B-Instruct",
      rank: 8,
      alpha: 16,
      targetModules: ["q_proj", "v_proj", "k_proj", "o_proj"],
      createdAt: new Date().toISOString(),
    })
  );

  // Simulate weight data (random bytes)
  const weights = Buffer.alloc(1024, 0);
  for (let i = 0; i < weights.length; i++) {
    weights[i] = Math.floor(Math.random() * 256);
  }

  // Combine header length + header + weights
  const headerLen = Buffer.alloc(4);
  headerLen.writeUInt32LE(header.length, 0);

  return Buffer.concat([headerLen, header, weights]);
}

// ============================================================
//                       MAIN FLOW
// ============================================================

async function main() {
  console.log("=".repeat(60));
  console.log("  GRAVITON — Mint Agent Pipeline");
  console.log("=".repeat(60));

  // ---- Validate environment ----
  if (!PRIVATE_KEY) {
    throw new Error("PRIVATE_KEY not set in .env");
  }
  if (!INFT_ADDRESS) {
    throw new Error(
      "GRAVITON_INFT_ADDRESS not set in .env. Deploy contracts first."
    );
  }
  if (!REGISTRY_ADDRESS) {
    throw new Error(
      "GRAVITON_REGISTRY_ADDRESS not set in .env. Deploy contracts first."
    );
  }

  // ---- Setup provider and wallet ----
  const provider = new ethers.JsonRpcProvider(RPC_URLS[NETWORK]);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  console.log(`\nNetwork:  ${NETWORK}`);
  console.log(`Wallet:   ${wallet.address}`);

  const balance = await provider.getBalance(wallet.address);
  console.log(`Balance:  ${ethers.formatEther(balance)} 0G`);

  if (balance === 0n) {
    throw new Error(
      "Wallet has no funds. Get testnet tokens from https://faucet.0g.ai/"
    );
  }

  // ---- Connect to contracts ----
  const inft = new ethers.Contract(INFT_ADDRESS, INFT_ABI, wallet);
  const registry = new ethers.Contract(REGISTRY_ADDRESS, REGISTRY_ABI, wallet);

  // ============================================================
  //  STEP 1: Upload LoRA adapter to 0G Storage (encrypted)
  // ============================================================

  console.log("\n--- Step 1: Upload LoRA Adapter to 0G Storage ---");

  const storageService = new StorageService({
    network: NETWORK,
    privateKey: PRIVATE_KEY,
  });

  const sampleLora = createSampleLoraData();
  console.log(`Sample LoRA adapter size: ${sampleLora.length} bytes`);

  const packageResult = await storageService.uploadAgentPackage({
    name: "Graviton Demo Agent",
    description:
      "A demonstration AI agent built on Qwen2.5-0.5B-Instruct with a custom LoRA adapter for blockchain Q&A.",
    modelType: "Qwen2.5-0.5B-Instruct",
    systemPrompt:
      "You are Graviton Agent, a helpful AI assistant specialized in blockchain and Web3 topics. Provide clear, concise answers.",
    loraWeightsBuffer: sampleLora,
    metadata: {
      tags: ["blockchain", "web3", "defi", "demo"],
      category: "assistant",
      capabilities: ["text-generation", "qa", "summarization"],
    },
  });

  console.log(`\nWeights upload:`);
  console.log(`  Root Hash:      ${packageResult.weightsUpload?.rootHash}`);
  console.log(`  Data Hash:      ${packageResult.weightsUpload?.dataHash}`);
  console.log(`  Encryption Key: ${packageResult.weightsUpload?.encryptionKey?.slice(0, 16)}... (truncated)`);

  console.log(`Metadata upload:`);
  console.log(`  Root Hash:      ${packageResult.metadataUpload.rootHash}`);

  // ============================================================
  //  STEP 2: Mint the INFT on-chain
  // ============================================================

  console.log("\n--- Step 2: Mint GravitonINFT ---");

  const mintFee = await inft.mintFee();
  console.log(`Mint fee: ${ethers.formatEther(mintFee)} 0G`);

  // Build IntelligentData array for the mint call
  const intelligentData = [
    {
      dataDescription: packageResult.mintParams.dataDescription,
      dataHash: packageResult.mintParams.dataHash,
    },
  ];

  const tokenURI = packageResult.mintParams.tokenURI;
  const category = "assistant";
  const storageRoot = packageResult.mintParams.storageRoot;

  console.log(`Token URI:    ${tokenURI}`);
  console.log(`Category:     ${category}`);
  console.log(`Storage Root: ${storageRoot}`);

  // Send the mint transaction
  // Contract signature: mint(address to, IntelligentData[] iDatas, string category, string storageRoot, string uri)
  const mintTx = await inft.mint(
    wallet.address,       // to — mint to self
    intelligentData,      // iDatas
    category,             // category
    storageRoot,          // _storageRoot
    tokenURI,             // uri
    { value: mintFee }
  );

  console.log(`Mint TX sent: ${mintTx.hash}`);
  const mintReceipt = await mintTx.wait();
  console.log(`Mint TX confirmed in block ${mintReceipt!.blockNumber}`);

  // Extract tokenId from the Transfer event
  const transferLog = mintReceipt!.logs.find(
    (log: any) =>
      log.topics[0] ===
      ethers.id("Transfer(address,address,uint256)")
  );

  let tokenId: bigint;
  if (transferLog) {
    tokenId = BigInt(transferLog.topics[3]);
  } else {
    // Fallback: read totalSupply (the new token is the latest)
    const totalSupply = await inft.totalSupply();
    tokenId = totalSupply - 1n;
  }

  console.log(`\n✅ INFT Minted — Token ID: ${tokenId}`);
  console.log(`   Owner:    ${await inft.ownerOf(tokenId)}`);
  console.log(`   Creator:  ${await inft.creatorOf(tokenId)}`);
  console.log(`   Category: ${await inft.categoryOf(tokenId)}`);

  // ============================================================
  //  STEP 3: Register agent in GravitonRegistry
  // ============================================================

  console.log("\n--- Step 3: Register Agent in Registry ---");

  const regTx = await registry.registerAgent(
    tokenId,
    "Graviton Demo Agent",
    "A demonstration AI agent for blockchain Q&A, built on Qwen2.5-0.5B-Instruct with a custom LoRA adapter.",
    "Qwen2.5-0.5B-Instruct",
    ["blockchain", "web3", "defi", "demo"], // tags
    storageRoot, // 0G Storage hash
    tokenURI // metadataURI
  );

  console.log(`Register TX sent: ${regTx.hash}`);
  const regReceipt = await regTx.wait();
  console.log(`Register TX confirmed in block ${regReceipt!.blockNumber}`);

  // Verify registration
  const isRegistered = await registry.isRegistered(tokenId);
  const totalRegistered = await registry.totalRegistered();

  console.log(`\n✅ Agent Registered`);
  console.log(`   Is Registered:     ${isRegistered}`);
  console.log(`   Total Registered:  ${totalRegistered}`);

  // ============================================================
  //  SUMMARY
  // ============================================================

  const explorerBase =
    NETWORK === "mainnet"
      ? "https://chainscan.0g.ai"
      : "https://chainscan-galileo.0g.ai";

  console.log("\n" + "=".repeat(60));
  console.log("  GRAVITON — MINT COMPLETE");
  console.log("=".repeat(60));
  console.log(`  Token ID:          ${tokenId}`);
  console.log(`  INFT Contract:     ${INFT_ADDRESS}`);
  console.log(`  Registry Contract: ${REGISTRY_ADDRESS}`);
  console.log(`  Storage Root:      ${storageRoot}`);
  console.log(`  Mint TX:           ${explorerBase}/tx/${mintTx.hash}`);
  console.log(`  Register TX:       ${explorerBase}/tx/${regTx.hash}`);
  console.log(`  Encryption Key:    ${packageResult.weightsUpload?.encryptionKey}`);
  console.log("=".repeat(60));
  console.log(
    "\n⚠️  IMPORTANT: Save the encryption key! It is required to decrypt the agent weights."
  );

  // Save results to a local JSON file for reference
  const resultFile = path.join(__dirname, "..", "mint-result.json");
  const result = {
    network: NETWORK,
    tokenId: tokenId.toString(),
    contracts: {
      inft: INFT_ADDRESS,
      registry: REGISTRY_ADDRESS,
    },
    storage: {
      weightsRootHash: packageResult.weightsUpload?.rootHash,
      metadataRootHash: packageResult.metadataUpload.rootHash,
      encryptionKey: packageResult.weightsUpload?.encryptionKey,
      dataHash: packageResult.weightsUpload?.dataHash,
    },
    transactions: {
      mintTx: mintTx.hash,
      registerTx: regTx.hash,
    },
    explorer: {
      mintUrl: `${explorerBase}/tx/${mintTx.hash}`,
      registerUrl: `${explorerBase}/tx/${regTx.hash}`,
    },
    timestamp: new Date().toISOString(),
  };

  fs.writeFileSync(resultFile, JSON.stringify(result, null, 2));
  console.log(`\nResults saved to ${resultFile}`);
}

// ============================================================
//                        RUN
// ============================================================

main()
  .then(() => {
    console.log("\n✨ Mint pipeline completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Mint pipeline failed:", error.message);
    if (error.reason) console.error("Reason:", error.reason);
    if (error.data) console.error("Data:", error.data);
    process.exit(1);
  });
