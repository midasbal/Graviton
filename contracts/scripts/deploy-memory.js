// Deploy GravitonMemory only — the other 4 contracts are already deployed.
// Usage: cd contracts && npx hardhat run scripts/deploy-memory.js --network 0g-testnet

const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const balance = await hre.ethers.provider.getBalance(deployer.address);

  console.log("========================================");
  console.log("  GRAVITON — Deploy GravitonMemory");
  console.log("========================================");
  console.log("Network: ", hre.network.name);
  console.log("Deployer:", deployer.address);
  console.log("Balance: ", hre.ethers.formatEther(balance), "A0GI");
  console.log("");

  // Load existing deployments
  const deploymentsPath = path.join(__dirname, "..", "deployments.json");
  let deployment = {};
  if (fs.existsSync(deploymentsPath)) {
    deployment = JSON.parse(fs.readFileSync(deploymentsPath, "utf8"));
  }

  const inftAddress = deployment.contracts?.GravitonINFT;
  if (!inftAddress) {
    console.error("❌ GravitonINFT address not found in deployments.json");
    console.error("   Deploy all contracts first: npx hardhat run scripts/deploy.js --network 0g-testnet");
    process.exit(1);
  }

  console.log("Using GravitonINFT:", inftAddress);
  console.log("");

  // Deploy GravitonMemory
  console.log("Deploying GravitonMemory...");
  const GravitonMemory = await hre.ethers.getContractFactory("GravitonMemory");
  const memory = await GravitonMemory.deploy(inftAddress, deployer.address);
  await memory.waitForDeployment();
  const memoryAddress = await memory.getAddress();
  console.log("✅ GravitonMemory:", memoryAddress);

  // Update deployments.json
  deployment.contracts = deployment.contracts || {};
  deployment.contracts.GravitonMemory = memoryAddress;
  deployment.constructorArgs = deployment.constructorArgs || {};
  deployment.constructorArgs.GravitonMemory = [inftAddress, deployer.address];
  deployment.timestamp = new Date().toISOString();

  fs.writeFileSync(deploymentsPath, JSON.stringify(deployment, null, 2));
  console.log("\n✅ deployments.json updated");

  // Summary
  const explorerBase =
    hre.network.name === "0g-mainnet"
      ? "https://chainscan.0g.ai"
      : "https://chainscan-galileo.0g.ai";

  console.log("\n========================================");
  console.log("  GravitonMemory:", memoryAddress);
  console.log(`  Explorer: ${explorerBase}/address/${memoryAddress}`);
  console.log("========================================");
  console.log("\nRun postdeploy to update env files:");
  console.log("  node scripts/postdeploy.js");
  console.log("\nVerify contract:");
  console.log(`  npx hardhat verify --network ${hre.network.name} ${memoryAddress} ${inftAddress} ${deployer.address}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
