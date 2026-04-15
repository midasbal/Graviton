// Post-deployment integration for MAINNET
// Usage: node scripts/postdeploy-mainnet.js
//
// Updates .env.local and .env with MAINNET contract addresses
// while preserving existing testnet addresses.

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "..");
const DEPLOYMENTS_PATH = path.join(ROOT, "contracts", "deployments-mainnet.json");

function upsertEnvVar(content, key, value) {
  const regex = new RegExp(`^${key}=.*$`, "m");
  if (regex.test(content)) {
    return content.replace(regex, `${key}=${value}`);
  }
  return content + `${key}=${value}\n`;
}

function main() {
  if (!fs.existsSync(DEPLOYMENTS_PATH)) {
    console.error("❌ deployments-mainnet.json not found.");
    console.error("   Deploy to mainnet first:");
    console.error("   cd contracts && npx hardhat run scripts/deploy-mainnet.js --network 0g-mainnet");
    process.exit(1);
  }

  const deployment = JSON.parse(fs.readFileSync(DEPLOYMENTS_PATH, "utf8"));
  const { contracts, deployer } = deployment;

  console.log("========================================");
  console.log("  GRAVITON — Mainnet Post-Deploy");
  console.log("========================================");
  console.log("Network:  0G Mainnet (16661)");
  console.log("Deployer:", deployer);
  console.log("");

  // ── 1. Update .env.local (Next.js frontend) ──
  const envLocalPath = path.join(ROOT, ".env.local");
  let envLocal = fs.existsSync(envLocalPath) ? fs.readFileSync(envLocalPath, "utf8") : "";

  // Add mainnet addresses with MAINNET_ prefix
  envLocal = upsertEnvVar(envLocal, "NEXT_PUBLIC_MAINNET_INFT_ADDRESS", contracts.GravitonINFT);
  envLocal = upsertEnvVar(envLocal, "NEXT_PUBLIC_MAINNET_MARKETPLACE_ADDRESS", contracts.GravitonMarketplace);
  envLocal = upsertEnvVar(envLocal, "NEXT_PUBLIC_MAINNET_REGISTRY_ADDRESS", contracts.GravitonRegistry);

  // Set the "active" contract addresses to mainnet for production
  envLocal = upsertEnvVar(envLocal, "NEXT_PUBLIC_INFT_ADDRESS", contracts.GravitonINFT);
  envLocal = upsertEnvVar(envLocal, "NEXT_PUBLIC_MARKETPLACE_ADDRESS", contracts.GravitonMarketplace);
  envLocal = upsertEnvVar(envLocal, "NEXT_PUBLIC_REGISTRY_ADDRESS", contracts.GravitonRegistry);

  // Default to mainnet
  envLocal = upsertEnvVar(envLocal, "NEXT_PUBLIC_DEFAULT_CHAIN", "mainnet");

  fs.writeFileSync(envLocalPath, envLocal);
  console.log("✅ .env.local updated with mainnet addresses");

  // ── 2. Update .env (backend) ──
  const envPath = path.join(ROOT, ".env");
  let env = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";

  // Preserve testnet addresses with prefix, add mainnet
  env = upsertEnvVar(env, "MAINNET_INFT_ADDRESS", contracts.GravitonINFT);
  env = upsertEnvVar(env, "MAINNET_MARKETPLACE_ADDRESS", contracts.GravitonMarketplace);
  env = upsertEnvVar(env, "MAINNET_REGISTRY_ADDRESS", contracts.GravitonRegistry);

  // Update "active" to mainnet
  env = upsertEnvVar(env, "GRAVITON_INFT_ADDRESS", contracts.GravitonINFT);
  env = upsertEnvVar(env, "GRAVITON_MARKETPLACE_ADDRESS", contracts.GravitonMarketplace);
  env = upsertEnvVar(env, "GRAVITON_REGISTRY_ADDRESS", contracts.GravitonRegistry);
  env = upsertEnvVar(env, "NETWORK", "mainnet");

  fs.writeFileSync(envPath, env);
  console.log("✅ .env updated with mainnet addresses");

  // ── 3. Summary ──
  console.log("\n========================================");
  console.log("  MAINNET CONTRACT ADDRESSES");
  console.log("========================================");
  console.log(`  GravitonINFT:        ${contracts.GravitonINFT}`);
  console.log(`  GravitonMarketplace: ${contracts.GravitonMarketplace}`);
  console.log(`  GravitonRegistry:    ${contracts.GravitonRegistry}`);
  console.log(`  MockVerifier:        ${contracts.MockVerifier}`);
  console.log("");
  console.log("  Explorer links:");
  for (const [name, address] of Object.entries(contracts)) {
    console.log(`    ${name}: https://chainscan.0g.ai/address/${address}`);
  }
  console.log("========================================");
  console.log("\n✨ Mainnet integration complete. Restart the dev server.");
}

main();
