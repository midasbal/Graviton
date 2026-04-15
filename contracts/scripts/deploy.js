// Deploy script for Graviton contracts on 0G Chain
// Usage: npx hardhat run scripts/deploy.js --network 0g-testnet

const hre = require("hardhat");
const fs = require("fs");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", (await hre.ethers.provider.getBalance(deployer.address)).toString());

  // 1. Deploy MockVerifier (testnet only)
  console.log("\n--- Step 1: Deploy MockVerifier ---");
  const MockVerifier = await hre.ethers.getContractFactory("MockVerifier");
  const verifier = await MockVerifier.deploy();
  await verifier.waitForDeployment();
  const verifierAddr = await verifier.getAddress();
  console.log("MockVerifier deployed to:", verifierAddr);

  // 2. Deploy GravitonINFT
  console.log("\n--- Step 2: Deploy GravitonINFT ---");
  const mintFee = hre.ethers.parseEther("0.001"); // 0.001 0G
  const GravitonINFT = await hre.ethers.getContractFactory("GravitonINFT");
  const storageInfo = "0G-Storage-Testnet";  // description of storage layer
  const inft = await GravitonINFT.deploy(
    "Graviton Agent NFT",        // name
    "GRVT",                      // symbol
    verifierAddr,                // verifier
    storageInfo,                 // storageInfo
    mintFee,                     // mintFee
    deployer.address             // admin
  );
  await inft.waitForDeployment();
  const inftAddr = await inft.getAddress();
  console.log("GravitonINFT deployed to:", inftAddr);

  // 3. Deploy GravitonMarketplace
  console.log("\n--- Step 3: Deploy GravitonMarketplace ---");
  const platformFeeBps = 250; // 2.5%
  const GravitonMarketplace = await hre.ethers.getContractFactory("GravitonMarketplace");
  const marketplace = await GravitonMarketplace.deploy(
    inftAddr,
    platformFeeBps,
    deployer.address
  );
  await marketplace.waitForDeployment();
  const marketplaceAddr = await marketplace.getAddress();
  console.log("GravitonMarketplace deployed to:", marketplaceAddr);

  // 4. Deploy GravitonRegistry
  console.log("\n--- Step 4: Deploy GravitonRegistry ---");
  const GravitonRegistry = await hre.ethers.getContractFactory("GravitonRegistry");
  const registry = await GravitonRegistry.deploy(
    inftAddr,
    deployer.address
  );
  await registry.waitForDeployment();
  const registryAddr = await registry.getAddress();
  console.log("GravitonRegistry deployed to:", registryAddr);

  // 4b. Deploy GravitonMemory
  console.log("\n--- Step 4b: Deploy GravitonMemory ---");
  const GravitonMemory = await hre.ethers.getContractFactory("GravitonMemory");
  const memory = await GravitonMemory.deploy(
    inftAddr,
    deployer.address
  );
  await memory.waitForDeployment();
  const memoryAddr = await memory.getAddress();
  console.log("GravitonMemory deployed to:", memoryAddr);

  // 5. Grant MINTER_ROLE to marketplace so it can mint on behalf of sellers
  console.log("\n--- Step 5: Grant roles ---");
  const MINTER_ROLE = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("MINTER_ROLE"));
  const grantTx = await inft.grantRole(MINTER_ROLE, marketplaceAddr);
  await grantTx.wait();
  console.log("MINTER_ROLE granted to Marketplace");

  // Summary
  console.log("\n========================================");
  console.log("        GRAVITON DEPLOYMENT COMPLETE     ");
  console.log("========================================");
  console.log("Network:            ", hre.network.name);
  console.log("Deployer:           ", deployer.address);
  console.log("MockVerifier:       ", verifierAddr);
  console.log("GravitonINFT:       ", inftAddr);
  console.log("GravitonMarketplace:", marketplaceAddr);
  console.log("GravitonRegistry:   ", registryAddr);
  console.log("GravitonMemory:     ", memoryAddr);
  console.log("========================================");

  // Save deployment addresses to file
  const deployment = {
    network: hre.network.name,
    chainId: (await hre.ethers.provider.getNetwork()).chainId.toString(),
    deployer: deployer.address,
    contracts: {
      MockVerifier: verifierAddr,
      GravitonINFT: inftAddr,
      GravitonMarketplace: marketplaceAddr,
      GravitonRegistry: registryAddr,
      GravitonMemory: memoryAddr,
    },
    constructorArgs: {
      MockVerifier: [],
      GravitonINFT: [
        "Graviton Agent NFT",
        "GRVT",
        verifierAddr,
        storageInfo,
        mintFee.toString(),
        deployer.address,
      ],
      GravitonMarketplace: [inftAddr, platformFeeBps, deployer.address],
      GravitonRegistry: [inftAddr, deployer.address],
      GravitonMemory: [inftAddr, deployer.address],
    },
    timestamp: new Date().toISOString(),
  };

  const deploymentPath = require("path").join(__dirname, "..", "deployments.json");
  fs.writeFileSync(deploymentPath, JSON.stringify(deployment, null, 2));
  console.log("\nDeployment addresses saved to deployments.json");

  // Also generate a .env.deployed file for easy import
  const envContent = [
    "# Auto-generated after deployment — " + new Date().toISOString(),
    "# Network: " + hre.network.name,
    "",
    "# Contract addresses (for backend .env)",
    "GRAVITON_INFT_ADDRESS=" + inftAddr,
    "GRAVITON_MARKETPLACE_ADDRESS=" + marketplaceAddr,
    "GRAVITON_REGISTRY_ADDRESS=" + registryAddr,
    "",
    "# Contract addresses (for Next.js frontend .env.local)",
    "NEXT_PUBLIC_INFT_ADDRESS=" + inftAddr,
    "NEXT_PUBLIC_MARKETPLACE_ADDRESS=" + marketplaceAddr,
    "NEXT_PUBLIC_REGISTRY_ADDRESS=" + registryAddr,
  ].join("\n") + "\n";

  const envDeployedPath = require("path").join(__dirname, "..", ".env.deployed");
  fs.writeFileSync(envDeployedPath, envContent);
  console.log("Environment variables saved to .env.deployed");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
