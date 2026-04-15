// Deploy GravitonFineTuning only — other contracts are already deployed.
// Usage: cd contracts && npx hardhat run scripts/deploy-finetuning.js --network 0g-testnet

const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const balance = await hre.ethers.provider.getBalance(deployer.address);

  console.log("========================================");
  console.log("  GRAVITON — Deploy GravitonFineTuning");
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
    process.exit(1);
  }

  console.log("Using GravitonINFT:", inftAddress);
  console.log("");

  // Deploy GravitonFineTuning
  console.log("Deploying GravitonFineTuning...");
  const GravitonFineTuning = await hre.ethers.getContractFactory("GravitonFineTuning");
  const fineTuning = await GravitonFineTuning.deploy(inftAddress, deployer.address);
  await fineTuning.waitForDeployment();
  const fineTuningAddress = await fineTuning.getAddress();
  console.log("✅ GravitonFineTuning:", fineTuningAddress);

  // Update deployments.json
  deployment.contracts = deployment.contracts || {};
  deployment.contracts.GravitonFineTuning = fineTuningAddress;
  deployment.constructorArgs = deployment.constructorArgs || {};
  deployment.constructorArgs.GravitonFineTuning = [inftAddress, deployer.address];
  deployment.timestamp = new Date().toISOString();

  fs.writeFileSync(deploymentsPath, JSON.stringify(deployment, null, 2));
  console.log("\n✅ deployments.json updated");

  const explorerBase =
    hre.network.name === "0g-mainnet"
      ? "https://chainscan.0g.ai"
      : "https://chainscan-galileo.0g.ai";

  console.log("\n========================================");
  console.log("  GravitonFineTuning:", fineTuningAddress);
  console.log(`  Explorer: ${explorerBase}/address/${fineTuningAddress}`);
  console.log("========================================");
  console.log("\nRun postdeploy to update env files:");
  console.log("  node scripts/postdeploy.js");
  console.log("\nVerify contract:");
  console.log(`  npx hardhat verify --network ${hre.network.name} ${fineTuningAddress} ${inftAddress} ${deployer.address}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
