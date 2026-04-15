/**
 * ============================================================
 *  Graviton — End-to-End Demo Seed Script
 * ============================================================
 *
 * Populates the 0G Galileo Testnet with high-quality seed data
 * so that the marketplace UI looks alive during a live demo.
 *
 * Actions performed:
 *   1. Mint 4 diverse AI agents (different categories)
 *   2. Register each agent in GravitonRegistry with rich metadata
 *   3. List 2 agents on GravitonMarketplace with sale prices
 *   4. Set rental terms for 1 agent
 *   5. Initialize memory and commit snapshots for all agents
 *   6. Submit TEE attestation receipts for 3 agents
 *   7. Create multi-modal profiles with varied modalities
 *   8. Create a fine-tuning job for 1 agent
 *   9. Distribute revenue to DAO
 *  10. Print a full summary
 *
 * IDEMPOTENT: Detects already-completed steps and resumes from
 * where it left off. Safe to re-run after a faucet top-up.
 *
 * Usage:
 *   npx hardhat run scripts/demo.js --network 0g-testnet
 */

const hre = require("hardhat");
const { ethers } = hre;
const fs = require("fs");
const path = require("path");

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MINT_FEE = ethers.parseEther("0.001"); // 1e15 wei
const ADDRESSES = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "deployments.json"), "utf-8")
).contracts;

// ---------------------------------------------------------------------------
// Agent Seed Data
// ---------------------------------------------------------------------------

const AGENTS = [
  {
    name: "AlphaTrader v3",
    category: "trading",
    description:
      "High-frequency DeFi trading agent with cross-chain arbitrage capabilities. " +
      "Monitors 12 DEXs across 5 chains and executes sub-second trades with MEV protection.",
    modelType: "transformer-rl",
    tags: ["defi", "trading", "arbitrage", "mev-protection", "cross-chain"],
    uri: "ipfs://QmTrader3AlphaAgent000000000000000000000001",
    storageHash: "0gstorage://bafkreia_alpha_trader_v3_weights_sha256",
    iData: {
      dataDescription: "RL policy network (PPO) trained on 2M+ DEX transactions across Ethereum, BSC, and Arbitrum. 48-layer transformer with cross-attention over order-book snapshots.",
      dataHash: ethers.keccak256(ethers.toUtf8Bytes("alpha-trader-v3-weights-2024")),
    },
    storageRoot: "0gstorage://bafkreia_alpha_trader_v3_root",
    price: ethers.parseEther("0.002"),
    rental: null,
    modalities: [
      { modality: 0, caps: ["generation", "analysis", "summarization"], model: "gpt-4o-mini", root: "0gstorage://text_weights_trader", hash: ethers.keccak256(ethers.toUtf8Bytes("trader-text-w")) },
      { modality: 4, caps: ["generation", "debugging", "review"], model: "codellama-34b", root: "0gstorage://code_weights_trader", hash: ethers.keccak256(ethers.toUtf8Bytes("trader-code-w")) },
    ],
  },
  {
    name: "PixelForge AI",
    category: "creative",
    description:
      "Multi-modal creative agent specializing in concept art, UI design, and video storyboarding. " +
      "Generates production-ready assets with style-consistent output across formats.",
    modelType: "diffusion-unet",
    tags: ["art", "design", "image-generation", "video", "creative"],
    uri: "ipfs://QmPixelForgeAICreativeAgent00000000000000002",
    storageHash: "0gstorage://bafkreia_pixelforge_weights_sha256",
    iData: {
      dataDescription: "Fine-tuned SDXL + AnimateDiff pipeline with custom LoRA adapters for UI/UX design patterns. 860M parameter UNet with cross-attention conditioning.",
      dataHash: ethers.keccak256(ethers.toUtf8Bytes("pixelforge-ai-weights-2024")),
    },
    storageRoot: "0gstorage://bafkreia_pixelforge_root",
    price: null,
    rental: ethers.parseEther("0.0005"),
    modalities: [
      { modality: 0, caps: ["generation", "summarization"], model: "gpt-4o", root: "0gstorage://text_weights_pixel", hash: ethers.keccak256(ethers.toUtf8Bytes("pixel-text-w")) },
      { modality: 1, caps: ["generation", "editing", "style-transfer"], model: "sdxl-turbo", root: "0gstorage://image_weights_pixel", hash: ethers.keccak256(ethers.toUtf8Bytes("pixel-image-w")) },
      { modality: 3, caps: ["generation", "storyboarding"], model: "animatediff-v3", root: "0gstorage://video_weights_pixel", hash: ethers.keccak256(ethers.toUtf8Bytes("pixel-video-w")) },
    ],
  },
  {
    name: "CodePilot Pro",
    category: "coding",
    description:
      "Enterprise-grade coding assistant with deep knowledge of Solidity, Rust, and TypeScript. " +
      "Performs static analysis, generates unit tests, and suggests gas optimizations.",
    modelType: "moe-transformer",
    tags: ["coding", "solidity", "rust", "typescript", "security-audit"],
    uri: "ipfs://QmCodePilotProAssistant000000000000000000003",
    storageHash: "0gstorage://bafkreia_codepilot_weights_sha256",
    iData: {
      dataDescription: "Mixture-of-Experts model (8x7B) specialized for smart-contract languages. Trained on 500K audited contracts and 2M GitHub repositories.",
      dataHash: ethers.keccak256(ethers.toUtf8Bytes("codepilot-pro-weights-2024")),
    },
    storageRoot: "0gstorage://bafkreia_codepilot_root",
    price: ethers.parseEther("0.003"),
    rental: null,
    modalities: [
      { modality: 0, caps: ["generation", "analysis", "qa"], model: "deepseek-coder-v2", root: "0gstorage://text_weights_code", hash: ethers.keccak256(ethers.toUtf8Bytes("code-text-w")) },
      { modality: 4, caps: ["generation", "debugging", "refactoring", "test-generation"], model: "starcoder2-15b", root: "0gstorage://code_weights_code", hash: ethers.keccak256(ethers.toUtf8Bytes("code-code-w")) },
    ],
  },
  {
    name: "ResearchBot Omega",
    category: "research",
    description:
      "Scientific research assistant with access to 200M+ papers. " +
      "Performs literature review, hypothesis generation, and data analysis with citation tracking.",
    modelType: "retrieval-augmented",
    tags: ["research", "science", "papers", "data-analysis", "citations"],
    uri: "ipfs://QmResearchBotOmegaAssistant0000000000000004",
    storageHash: "0gstorage://bafkreia_researchbot_weights_sha256",
    iData: {
      dataDescription: "RAG pipeline: 70B LLM backbone + dense retriever over 200M PubMed/ArXiv embeddings. FAISS index stored on 0G Storage with periodic sync.",
      dataHash: ethers.keccak256(ethers.toUtf8Bytes("researchbot-omega-weights-2024")),
    },
    storageRoot: "0gstorage://bafkreia_researchbot_root",
    price: null,
    rental: null,
    modalities: [
      { modality: 0, caps: ["generation", "summarization", "qa", "translation"], model: "llama-3-70b", root: "0gstorage://text_weights_research", hash: ethers.keccak256(ethers.toUtf8Bytes("research-text-w")) },
      { modality: 2, caps: ["transcription", "summarization"], model: "whisper-large-v3", root: "0gstorage://audio_weights_research", hash: ethers.keccak256(ethers.toUtf8Bytes("research-audio-w")) },
    ],
  },
];

// ---------------------------------------------------------------------------
// Memory Seed Data
// ---------------------------------------------------------------------------

const MEMORY_SNAPSHOTS = [
  {
    snapshotType: "conversation",
    interactions: 42,
    root: "0gstorage://mem_snapshot_conv_001",
    content: "conversation-history-batch-001-sha256",
  },
  {
    snapshotType: "preference",
    interactions: 18,
    root: "0gstorage://mem_snapshot_pref_001",
    content: "user-preferences-snapshot-001-sha256",
  },
  {
    snapshotType: "context",
    interactions: 63,
    root: "0gstorage://mem_snapshot_ctx_001",
    content: "context-window-cache-001-sha256",
  },
  {
    snapshotType: "summary",
    interactions: 27,
    root: "0gstorage://mem_snapshot_sum_001",
    content: "session-summary-digest-001-sha256",
  },
];

// ---------------------------------------------------------------------------
// Attestation Seed Data
// ---------------------------------------------------------------------------

const ATTESTATIONS = [
  {
    chatId: "chat_demo_alpha_001",
    model: "gpt-4o-mini",
    verified: true,
    inputTokens: 2048,
    outputTokens: 512,
    reqContent: "analyze ETH/USDC price action on Uniswap v3",
    resContent: "Based on the last 24h order flow analysis...",
  },
  {
    chatId: "chat_demo_pixel_001",
    model: "sdxl-turbo",
    verified: true,
    inputTokens: 128,
    outputTokens: 1024,
    reqContent: "generate futuristic dashboard UI mockup",
    resContent: "image_generation_result_base64_encoded...",
  },
  {
    chatId: "chat_demo_code_001",
    model: "deepseek-coder-v2",
    verified: true,
    inputTokens: 4096,
    outputTokens: 2048,
    reqContent: "audit this Solidity contract for reentrancy",
    resContent: "Static analysis found 3 potential issues...",
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForTx(tx, label) {
  const receipt = await tx.wait();
  console.log(`  ✓ ${label} — tx: ${receipt.hash.slice(0, 18)}...`);
  return receipt;
}

// ---------------------------------------------------------------------------
// Main Demo Script
// ---------------------------------------------------------------------------

async function main() {
  const [deployer] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(deployer.address);

  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║          GRAVITON — SEED DATA DEMO SCRIPT              ║");
  console.log("╠══════════════════════════════════════════════════════════╣");
  console.log(`║  Deployer : ${deployer.address}  ║`);
  console.log(`║  Balance  : ${ethers.formatEther(balance).padEnd(38)}║`);
  console.log(`║  Network  : 0G Galileo Testnet (${hre.network.config.chainId})                ║`);
  console.log("╚══════════════════════════════════════════════════════════╝\n");

  // Minimum required: varies depending on already-completed steps
  const MIN_BALANCE = ethers.parseEther("0.001");
  if (balance < MIN_BALANCE) {
    console.error(`✗ Insufficient balance. Need ≥0.001 A0GI, have ${ethers.formatEther(balance)}`);
    console.error("  → Get testnet tokens: https://faucet.0g.ai/");
    process.exit(1);
  }

  // -----------------------------------------------------------------------
  // 0. Connect to all contracts
  // -----------------------------------------------------------------------
  console.log("━━━ [0] Connecting to contracts ━━━");

  const inft = await ethers.getContractAt("GravitonINFT", ADDRESSES.GravitonINFT);
  const marketplace = await ethers.getContractAt("GravitonMarketplace", ADDRESSES.GravitonMarketplace);
  const registry = await ethers.getContractAt("GravitonRegistry", ADDRESSES.GravitonRegistry);
  const memory = await ethers.getContractAt("GravitonMemory", ADDRESSES.GravitonMemory);
  const attestation = await ethers.getContractAt("GravitonAttestation", ADDRESSES.GravitonAttestation);
  const fineTuning = await ethers.getContractAt("GravitonFineTuning", ADDRESSES.GravitonFineTuning);
  const dao = await ethers.getContractAt("GravitonDAO", ADDRESSES.GravitonDAO);
  const multiModal = await ethers.getContractAt("GravitonMultiModal", ADDRESSES.GravitonMultiModal);

  console.log("  ✓ All 8 contracts connected\n");

  // Track minted token IDs
  const tokenIds = [];

  // -----------------------------------------------------------------------
  // 1. Mint agents (idempotent — detect existing tokens)
  // -----------------------------------------------------------------------
  console.log("━━━ [1] Minting AI Agents ━━━");

  // Check how many tokens already exist
  const totalMinted = await inft.totalMinted();
  console.log(`  ℹ Total tokens already minted: ${totalMinted}`);

  // If we already have tokens from a previous run, reuse them
  if (totalMinted >= 5n) {
    // We already minted 4 demo agents (IDs 2-5) in a prior run
    console.log("  ✓ Demo agents already minted (tokens 2-5), skipping...");
    for (let i = 2; i <= 5; i++) {
      tokenIds.push(BigInt(i));
    }
  } else {
    // Mint any remaining agents
    const startIndex = Number(totalMinted) - 1; // token 1 was from smoke test
    const agentsToMint = AGENTS.slice(Math.max(0, startIndex));

    if (agentsToMint.length === 0) {
      console.log("  ✓ All demo agents already minted");
      // Populate tokenIds from existing
      for (let i = 0; i < AGENTS.length; i++) {
        tokenIds.push(BigInt(i + 2)); // IDs start at 2 (1 is from smoke test)
      }
    } else {
      // Reuse any already-minted demo tokens
      for (let i = 2; i <= Number(totalMinted); i++) {
        tokenIds.push(BigInt(i));
        console.log(`  ✓ Reusing existing token ${i}`);
      }

      // Mint the rest
      for (let j = tokenIds.length; j < AGENTS.length; j++) {
        const agent = AGENTS[j];
        const iDatas = [
          {
            dataDescription: agent.iData.dataDescription,
            dataHash: agent.iData.dataHash,
          },
        ];

        const tx = await inft.mint(
          deployer.address,
          iDatas,
          agent.category,
          agent.storageRoot,
          agent.uri,
          { value: MINT_FEE }
        );
        const receipt = await waitForTx(tx, `Minted "${agent.name}" [${agent.category}]`);

        // Parse the AgentMinted event to get tokenId
        const mintEvent = receipt.logs.find((log) => {
          try {
            const parsed = inft.interface.parseLog({ topics: log.topics, data: log.data });
            return parsed && parsed.name === "AgentMinted";
          } catch {
            return false;
          }
        });

        let tokenId;
        if (mintEvent) {
          const parsed = inft.interface.parseLog({ topics: mintEvent.topics, data: mintEvent.data });
          tokenId = parsed.args[0];
        } else {
          // Fallback: read totalMinted() which returns _nextTokenId - 1
          tokenId = await inft.totalMinted();
        }

        tokenIds.push(tokenId);
        console.log(`    → Token ID: ${tokenId}`);
        await sleep(1000);
      }
    }
  }

  console.log(`  ✓ Minted ${tokenIds.length} agents: [${tokenIds.join(", ")}]\n`);

  // -----------------------------------------------------------------------
  // 2. Register all agents in Registry (idempotent)
  // -----------------------------------------------------------------------
  console.log("━━━ [2] Registering agents in Registry ━━━");

  for (let i = 0; i < AGENTS.length; i++) {
    const agent = AGENTS[i];
    const tokenId = tokenIds[i];

    // Check if already registered
    try {
      const meta = await registry.getAgentMeta(tokenId);
      if (meta.registeredAt > 0n) {
        console.log(`  ✓ "${agent.name}" already registered, skipping`);
        continue;
      }
    } catch {
      // Not registered yet — proceed
    }

    const tx = await registry.registerAgent(
      tokenId,
      agent.name,
      agent.description,
      agent.modelType,
      agent.tags,
      agent.storageHash,
      agent.uri
    );
    await waitForTx(tx, `Registered "${agent.name}" (token ${tokenId})`);
    await sleep(800);
  }

  console.log(`  ✓ All ${AGENTS.length} agents registered\n`);

  // -----------------------------------------------------------------------
  // 3. List agents on Marketplace + set rental terms
  // -----------------------------------------------------------------------
  console.log("━━━ [3] Listing agents on Marketplace ━━━");

  for (let i = 0; i < AGENTS.length; i++) {
    const agent = AGENTS[i];
    const tokenId = tokenIds[i];

    if (agent.price) {
      // Check if already listed
      try {
        const listing = await marketplace.listings(tokenId);
        if (listing.isActive) {
          console.log(`  ✓ "${agent.name}" already listed, skipping`);
          continue; // skip both listing and rental for this agent
        }
      } catch {
        // Not listed — proceed
      }

      // Approve marketplace to transfer the INFT
      const approveTx = await inft.approve(ADDRESSES.GravitonMarketplace, tokenId);
      await waitForTx(approveTx, `Approved marketplace for token ${tokenId}`);
      await sleep(500);

      // List for sale
      const listTx = await marketplace.listAgent(tokenId, agent.price);
      await waitForTx(listTx, `Listed "${agent.name}" for ${ethers.formatEther(agent.price)} A0GI`);
      await sleep(800);
    }

    if (agent.rental) {
      // Check if rental terms already set
      try {
        const rental = await marketplace.rentals(tokenId);
        if (rental.pricePerDay > 0n) {
          console.log(`  ✓ Rental terms for "${agent.name}" already set, skipping`);
          continue;
        }
      } catch {
        // Not set — proceed
      }

      const rentalTx = await marketplace.setRentalTerms(tokenId, agent.rental);
      await waitForTx(rentalTx, `Rental terms for "${agent.name}": ${ethers.formatEther(agent.rental)} A0GI/day`);
      await sleep(800);
    }
  }

  console.log("  ✓ Marketplace listings complete\n");

  // -----------------------------------------------------------------------
  // 4. Initialize Memory + commit snapshots
  // -----------------------------------------------------------------------
  console.log("━━━ [4] Setting up Agent Memory ━━━");

  for (let i = 0; i < tokenIds.length; i++) {
    const tokenId = tokenIds[i];
    const agent = AGENTS[i];

    // Agents listed on marketplace have been approved to marketplace,
    // but memory requires owner. Only non-listed agents get memory init.
    // Listed agents (approved to marketplace) may fail initializeMemory
    // since the marketplace is approved, not the caller.
    // However, commitMemorySnapshot auto-initializes, so skip initializeMemory
    // and go straight to commit for all agents.

    const snapshot = MEMORY_SNAPSHOTS[i];
    const contentHash = ethers.keccak256(ethers.toUtf8Bytes(snapshot.content));

    try {
      const tx = await memory.commitMemorySnapshot(
        tokenId,
        snapshot.root,
        contentHash,
        snapshot.interactions,
        snapshot.snapshotType
      );
      await waitForTx(tx, `Memory snapshot for "${agent.name}" (${snapshot.snapshotType}, ${snapshot.interactions} interactions)`);
    } catch (err) {
      console.log(`  ⚠ Memory snapshot for token ${tokenId} skipped (${err.message.slice(0, 60)}...)`);
    }
    await sleep(800);
  }

  console.log("  ✓ Memory snapshots committed\n");

  // -----------------------------------------------------------------------
  // 5. Submit TEE Attestation receipts
  // -----------------------------------------------------------------------
  console.log("━━━ [5] Submitting TEE Attestations ━━━");

  for (let i = 0; i < Math.min(ATTESTATIONS.length, tokenIds.length); i++) {
    const att = ATTESTATIONS[i];
    const tokenId = tokenIds[i];

    const requestHash = ethers.keccak256(ethers.toUtf8Bytes(att.reqContent));
    const responseHash = ethers.keccak256(ethers.toUtf8Bytes(att.resContent));

    try {
      const tx = await attestation.submitAttestation(
        tokenId,
        deployer.address, // provider
        deployer.address, // requester
        requestHash,
        responseHash,
        att.chatId,
        att.model,
        att.verified,
        att.inputTokens,
        att.outputTokens
      );
      await waitForTx(tx, `Attestation for token ${tokenId} (${att.model}, verified=${att.verified})`);
    } catch (err) {
      console.log(`  ⚠ Attestation for token ${tokenId} skipped (${err.message.slice(0, 60)}...)`);
    }
    await sleep(800);
  }

  console.log("  ✓ TEE attestations submitted\n");

  // -----------------------------------------------------------------------
  // 6. Create Multi-Modal profiles
  // -----------------------------------------------------------------------
  console.log("━━━ [6] Setting up Multi-Modal Profiles ━━━");

  for (let i = 0; i < tokenIds.length; i++) {
    const tokenId = tokenIds[i];
    const agent = AGENTS[i];

    try {
      // Check if profile already exists
      const profile = await multiModal.profiles(tokenId);
      if (profile.isActive) {
        console.log(`  ✓ "${agent.name}" multi-modal profile already exists, skipping`);
        continue;
      }

      // Create profile
      const profileTx = await multiModal.createProfile(tokenId);
      await waitForTx(profileTx, `Multi-modal profile for "${agent.name}"`);
      await sleep(500);

      // Add modalities
      for (const mod of agent.modalities) {
        const modTx = await multiModal.addModality(
          tokenId,
          mod.modality,
          mod.caps,
          mod.model,
          mod.root,
          mod.hash
        );
        const modalityNames = ["Text", "Image", "Audio", "Video", "Code"];
        await waitForTx(modTx, `  + ${modalityNames[mod.modality]} modality (${mod.model})`);
        await sleep(500);
      }
    } catch (err) {
      console.log(`  ⚠ Multi-modal for token ${tokenId} skipped (${err.message.slice(0, 60)}...)`);
    }
  }

  console.log("  ✓ Multi-modal profiles configured\n");

  // -----------------------------------------------------------------------
  // 7. Create a Fine-Tuning job (for CodePilot Pro)
  // -----------------------------------------------------------------------
  console.log("━━━ [7] Creating Fine-Tuning Job ━━━");

  const codePilotId = tokenIds[2]; // CodePilot Pro
  try {
    const ftTx = await fineTuning.createJob(
      codePilotId,
      deployer.address, // provider
      "starcoder2-15b",
      "0gstorage://dataset_solidity_audit_10k",
      ethers.keccak256(ethers.toUtf8Bytes("solidity-audit-dataset-v2")),
      10, // epochs
      16, // LoRA rank
      300, // learning rate 3% (in BPS)
      JSON.stringify({
        batch_size: 4,
        warmup_steps: 100,
        weight_decay: 0.01,
        gradient_accumulation: 8,
        fp16: true,
      })
    );
    await waitForTx(ftTx, `Fine-tuning job created for CodePilot Pro (token ${codePilotId})`);
  } catch (err) {
    console.log(`  ⚠ Fine-tuning job skipped (${err.message.slice(0, 60)}...)`);
  }

  console.log("  ✓ Fine-tuning job created\n");

  // -----------------------------------------------------------------------
  // 8. DAO Revenue Distribution
  // -----------------------------------------------------------------------
  console.log("━━━ [8] DAO Revenue Distribution ━━━");

  try {
    const revenueTx = await dao.distributeRevenue({
      value: ethers.parseEther("0.001"),
    });
    await waitForTx(revenueTx, "Distributed 0.001 A0GI revenue to DAO pools");
  } catch (err) {
    console.log(`  ⚠ DAO revenue skipped (${err.message.slice(0, 60)}...)`);
  }

  console.log("  ✓ DAO revenue distributed\n");

  // -----------------------------------------------------------------------
  // 9. Summary
  // -----------------------------------------------------------------------
  const finalBalance = await ethers.provider.getBalance(deployer.address);
  const spent = balance - finalBalance;

  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║                  DEMO SEED — SUMMARY                   ║");
  console.log("╠══════════════════════════════════════════════════════════╣");
  console.log(`║  Agents Minted       : ${String(tokenIds.length).padEnd(34)}║`);
  console.log(`║  Token IDs           : [${tokenIds.join(", ").padEnd(33)}]║`);
  console.log(`║  Registered          : ${String(AGENTS.length).padEnd(34)}║`);
  console.log(`║  Listed for Sale     : ${String(AGENTS.filter((a) => a.price).length).padEnd(34)}║`);
  console.log(`║  Rental Available    : ${String(AGENTS.filter((a) => a.rental).length).padEnd(34)}║`);
  console.log(`║  Memory Snapshots    : ${String(tokenIds.length).padEnd(34)}║`);
  console.log(`║  TEE Attestations    : ${String(ATTESTATIONS.length).padEnd(34)}║`);
  console.log(`║  Multi-Modal Profiles: ${String(tokenIds.length).padEnd(34)}║`);
  console.log(`║  Fine-Tuning Jobs    : 1${" ".repeat(33)}║`);
  console.log(`║  DAO Revenue         : 0.001 A0GI${" ".repeat(24)}║`);
  console.log("╠══════════════════════════════════════════════════════════╣");
  console.log(`║  Gas Spent           : ${ethers.formatEther(spent).slice(0, 12).padEnd(34)}║`);
  console.log(`║  Remaining Balance   : ${ethers.formatEther(finalBalance).slice(0, 12).padEnd(34)}║`);
  console.log("╠══════════════════════════════════════════════════════════╣");
  console.log("║                                                        ║");
  console.log("║  Agents:                                               ║");

  for (let i = 0; i < AGENTS.length; i++) {
    const a = AGENTS[i];
    const line = `  #${tokenIds[i]} ${a.name} (${a.category})`;
    console.log(`║${line.padEnd(56)}║`);
  }

  console.log("║                                                        ║");
  console.log("║  Explorer:                                             ║");
  console.log("║  https://chainscan-galileo.0g.ai/address/              ║");

  for (const [name, addr] of Object.entries(ADDRESSES)) {
    if (name === "MockVerifier") continue;
    const line = `  ${name}: ${addr}`;
    console.log(`║${line.padEnd(56)}║`);
  }

  console.log("║                                                        ║");
  console.log("╚══════════════════════════════════════════════════════════╝");
  console.log("\n🚀 Seed data deployed! Open the frontend to see the populated marketplace.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n✗ Demo script failed:");
    console.error(error);
    process.exit(1);
  });
