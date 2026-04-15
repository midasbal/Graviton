// Post-deployment integration: Update frontend and root .env files with deployed addresses
// Usage: node scripts/postdeploy.js
//
// Reads contracts/deployments.json and writes:
//   1. .env.local (Next.js frontend)
//   2. .env (root — for mintAgent.ts and backend services)

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "..");
const DEPLOYMENTS_PATH = path.join(ROOT, "contracts", "deployments.json");

function main() {
  if (!fs.existsSync(DEPLOYMENTS_PATH)) {
    console.error("❌ contracts/deployments.json not found.");
    console.error("   Deploy contracts first:");
    console.error("   cd contracts && npx hardhat run scripts/deploy.js --network 0g-testnet");
    process.exit(1);
  }

  const deployment = JSON.parse(fs.readFileSync(DEPLOYMENTS_PATH, "utf8"));
  const { contracts, network, deployer } = deployment;

  console.log("========================================");
  console.log("  GRAVITON — Post-Deploy Integration");
  console.log("========================================");
  console.log("Network: ", network);
  console.log("Deployer:", deployer);
  console.log("");

  // ---- 1. Write .env.local for Next.js frontend ----
  const envLocalPath = path.join(ROOT, ".env.local");

  // Preserve existing .env.local content (if any)
  let existingEnvLocal = "";
  if (fs.existsSync(envLocalPath)) {
    existingEnvLocal = fs.readFileSync(envLocalPath, "utf8");
  }

  // Replace or append contract addresses
  const envVars = {
    NEXT_PUBLIC_INFT_ADDRESS: contracts.GravitonINFT,
    NEXT_PUBLIC_MARKETPLACE_ADDRESS: contracts.GravitonMarketplace,
    NEXT_PUBLIC_REGISTRY_ADDRESS: contracts.GravitonRegistry,
    NEXT_PUBLIC_TESTNET_MEMORY_ADDRESS: contracts.GravitonMemory || "0x0000000000000000000000000000000000000000",
    NEXT_PUBLIC_TESTNET_ATTESTATION_ADDRESS: contracts.GravitonAttestation || "0x0000000000000000000000000000000000000000",
    NEXT_PUBLIC_TESTNET_FINETUNING_ADDRESS: contracts.GravitonFineTuning || "0x0000000000000000000000000000000000000000",
    NEXT_PUBLIC_TESTNET_DAO_ADDRESS: contracts.GravitonDAO || "0x0000000000000000000000000000000000000000",
    NEXT_PUBLIC_TESTNET_MULTIMODAL_ADDRESS: contracts.GravitonMultiModal || "0x0000000000000000000000000000000000000000",
    NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID: "graviton-hackathon",
  };

  let envLocalContent = existingEnvLocal;
  for (const [key, value] of Object.entries(envVars)) {
    const regex = new RegExp(`^${key}=.*$`, "m");
    if (regex.test(envLocalContent)) {
      envLocalContent = envLocalContent.replace(regex, `${key}=${value}`);
    } else {
      envLocalContent += `${key}=${value}\n`;
    }
  }

  // Add header if file was empty
  if (!existingEnvLocal) {
    envLocalContent =
      `# Graviton — Frontend Environment (auto-generated)\n` +
      `# Network: ${network}\n` +
      `# Deployed: ${deployment.timestamp}\n\n` +
      envLocalContent;
  }

  fs.writeFileSync(envLocalPath, envLocalContent);
  console.log("✅ .env.local updated with contract addresses");

  // ---- 2. Write/update root .env for backend scripts ----
  const envPath = path.join(ROOT, ".env");

  let existingEnv = "";
  if (fs.existsSync(envPath)) {
    existingEnv = fs.readFileSync(envPath, "utf8");
  }

  const backendVars = {
    GRAVITON_INFT_ADDRESS: contracts.GravitonINFT,
    GRAVITON_MARKETPLACE_ADDRESS: contracts.GravitonMarketplace,
    GRAVITON_REGISTRY_ADDRESS: contracts.GravitonRegistry,
    GRAVITON_MEMORY_ADDRESS: contracts.GravitonMemory || "",
    GRAVITON_ATTESTATION_ADDRESS: contracts.GravitonAttestation || "",
    GRAVITON_FINETUNING_ADDRESS: contracts.GravitonFineTuning || "",
    GRAVITON_DAO_ADDRESS: contracts.GravitonDAO || "",
    GRAVITON_MULTIMODAL_ADDRESS: contracts.GravitonMultiModal || "",
    NETWORK: network === "0g-mainnet" ? "mainnet" : "testnet",
  };

  let envContent = existingEnv;
  for (const [key, value] of Object.entries(backendVars)) {
    const regex = new RegExp(`^${key}=.*$`, "m");
    if (regex.test(envContent)) {
      envContent = envContent.replace(regex, `${key}=${value}`);
    } else {
      envContent += `${key}=${value}\n`;
    }
  }

  if (!existingEnv) {
    envContent =
      `# Graviton — Backend Environment (auto-generated)\n` +
      `# Network: ${network}\n` +
      `# Deployed: ${deployment.timestamp}\n\n` +
      `# Wallet private key (WITH 0x prefix)\n` +
      `PRIVATE_KEY=\n\n` +
      envContent;
  }

  fs.writeFileSync(envPath, envContent);
  console.log("✅ .env updated with contract addresses");

  // ---- 3. Summary ----
  const explorerBase =
    network === "0g-mainnet"
      ? "https://chainscan.0g.ai"
      : "https://chainscan-galileo.0g.ai";

  console.log("\n========================================");
  console.log("  CONTRACT ADDRESSES");
  console.log("========================================");
  console.log(`  GravitonINFT:        ${contracts.GravitonINFT}`);
  console.log(`  GravitonMarketplace: ${contracts.GravitonMarketplace}`);
  console.log(`  GravitonRegistry:    ${contracts.GravitonRegistry}`);
  console.log(`  MockVerifier:        ${contracts.MockVerifier}`);
  console.log("");
  console.log("  Explorer links:");
  for (const [name, address] of Object.entries(contracts)) {
    console.log(`    ${name}: ${explorerBase}/address/${address}`);
  }
  console.log("========================================");
  console.log("\n✨ Integration complete. Restart the dev server to pick up new env vars.");
}

main();
