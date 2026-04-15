// Deploy GravitonMultiModal to testnet
// Usage: npx hardhat run scripts/deploy-multimodal.js --network 0g-testnet

const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying GravitonMultiModal with:", deployer.address);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Balance:", hre.ethers.formatEther(balance), "A0GI");

  // Load existing deployments
  const deploymentsPath = path.join(__dirname, "..", "deployments.json");
  const deployment = JSON.parse(fs.readFileSync(deploymentsPath, "utf8"));
  const inftAddress = deployment.contracts.GravitonINFT;

  console.log("Using GravitonINFT at:", inftAddress);

  const MultiModal = await hre.ethers.getContractFactory("GravitonMultiModal");
  const multimodal = await MultiModal.deploy(inftAddress, deployer.address);
  await multimodal.waitForDeployment();

  const multimodalAddress = await multimodal.getAddress();
  console.log("GravitonMultiModal deployed to:", multimodalAddress);

  // Save to deployments.json
  deployment.contracts.GravitonMultiModal = multimodalAddress;
  fs.writeFileSync(deploymentsPath, JSON.stringify(deployment, null, 2));
  console.log("Updated deployments.json");

  const balanceAfter = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Balance after:", hre.ethers.formatEther(balanceAfter), "A0GI");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
