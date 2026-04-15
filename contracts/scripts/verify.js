// Verify all Graviton contracts on 0G Explorer
// Usage: npx hardhat run scripts/verify.js --network 0g-testnet
//
// Prerequisites: Run deploy.js first to generate deployments.json

const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const deploymentPath = path.join(__dirname, "..", "deployments.json");
  if (!fs.existsSync(deploymentPath)) {
    throw new Error(
      "deployments.json not found. Deploy contracts first with:\n" +
        "  npx hardhat run scripts/deploy.js --network 0g-testnet"
    );
  }

  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  const { contracts, constructorArgs } = deployment;

  console.log("========================================");
  console.log("  GRAVITON — CONTRACT VERIFICATION");
  console.log("========================================");
  console.log("Network:", deployment.network);
  console.log("");

  const toVerify = [
    {
      name: "MockVerifier",
      address: contracts.MockVerifier,
      args: constructorArgs.MockVerifier,
    },
    {
      name: "GravitonINFT",
      address: contracts.GravitonINFT,
      args: constructorArgs.GravitonINFT,
    },
    {
      name: "GravitonMarketplace",
      address: contracts.GravitonMarketplace,
      args: constructorArgs.GravitonMarketplace,
    },
    {
      name: "GravitonRegistry",
      address: contracts.GravitonRegistry,
      args: constructorArgs.GravitonRegistry,
    },
  ];

  const results = [];

  for (const contract of toVerify) {
    console.log(`\n--- Verifying ${contract.name} at ${contract.address} ---`);
    try {
      await hre.run("verify:verify", {
        address: contract.address,
        constructorArguments: contract.args,
      });
      console.log(`✅ ${contract.name} verified successfully`);
      results.push({ name: contract.name, status: "verified" });
    } catch (error) {
      if (error.message.includes("Already Verified") || error.message.includes("already verified")) {
        console.log(`✅ ${contract.name} already verified`);
        results.push({ name: contract.name, status: "already verified" });
      } else {
        console.error(`❌ ${contract.name} verification failed:`, error.message);
        results.push({ name: contract.name, status: "failed", error: error.message });
      }
    }
  }

  // Summary
  const explorerBase =
    deployment.network === "0g-mainnet"
      ? "https://chainscan.0g.ai"
      : "https://chainscan-galileo.0g.ai";

  console.log("\n========================================");
  console.log("  VERIFICATION RESULTS");
  console.log("========================================");
  for (const r of results) {
    const icon = r.status.includes("verified") ? "✅" : "❌";
    console.log(`  ${icon} ${r.name}: ${r.status}`);
  }
  console.log("\nExplorer links:");
  for (const [name, address] of Object.entries(contracts)) {
    console.log(`  ${name}: ${explorerBase}/address/${address}`);
  }
  console.log("========================================");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
