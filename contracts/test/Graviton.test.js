// Comprehensive unit tests for the Graviton contract suite
// Usage: cd contracts && npx hardhat test

const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

// ============================================================
//  Shared Fixture — deploys the full contract system
// ============================================================

async function deployFullSuiteFixture() {
  const [admin, alice, bob, charlie, provider, operator] = await ethers.getSigners();

  // 1. MockVerifier
  const Verifier = await ethers.getContractFactory("MockVerifier");
  const verifier = await Verifier.deploy();

  // 2. GravitonINFT
  const INFT = await ethers.getContractFactory("GravitonINFT");
  const mintFee = ethers.parseEther("0.001");
  const inft = await INFT.deploy(
    "Graviton Agent",
    "GRVT",
    await verifier.getAddress(),
    "0G Storage v1",
    mintFee,
    admin.address
  );

  // 3. GravitonMarketplace
  const Marketplace = await ethers.getContractFactory("GravitonMarketplace");
  const marketplace = await Marketplace.deploy(await inft.getAddress(), 250, admin.address);

  // 4. GravitonRegistry
  const Registry = await ethers.getContractFactory("GravitonRegistry");
  const registry = await Registry.deploy(await inft.getAddress(), admin.address);

  // 5. GravitonMemory
  const Memory = await ethers.getContractFactory("GravitonMemory");
  const memory = await Memory.deploy(await inft.getAddress(), admin.address);

  // 6. GravitonAttestation
  const Attestation = await ethers.getContractFactory("GravitonAttestation");
  const attestation = await Attestation.deploy(await inft.getAddress(), admin.address);

  // 7. GravitonFineTuning
  const FineTuning = await ethers.getContractFactory("GravitonFineTuning");
  const fineTuning = await FineTuning.deploy(await inft.getAddress(), admin.address);

  // 8. GravitonDAO
  const DAO = await ethers.getContractFactory("GravitonDAO");
  const dao = await DAO.deploy(await inft.getAddress(), admin.address);

  // 9. GravitonMultiModal
  const MultiModal = await ethers.getContractFactory("GravitonMultiModal");
  const multimodal = await MultiModal.deploy(await inft.getAddress(), admin.address);

  // Grant marketplace the ability to call authorizeUsage
  await inft.connect(admin).grantMinterRole(await marketplace.getAddress());

  return {
    admin, alice, bob, charlie, provider, operator,
    verifier, inft, marketplace, registry, memory, attestation,
    fineTuning, dao, multimodal,
    mintFee,
  };
}

// Helper: mint an agent INFT for `to`
async function mintAgent(inft, admin, to, category = "trading") {
  const iDatas = [
    { dataDescription: "LoRA weights", dataHash: ethers.keccak256(ethers.toUtf8Bytes("weights-1")) },
  ];
  const mintFee = await inft.mintFee();
  const tx = await inft.connect(to).mint(
    to.address,
    iDatas,
    category,
    "0x_storage_root_" + Date.now(),
    "ipfs://metadata",
    { value: mintFee }
  );
  const receipt = await tx.wait();
  const event = receipt.logs.find(
    (l) => l.fragment && l.fragment.name === "AgentMinted"
  );
  return event ? event.args[0] : await inft.totalSupply();
}

// ============================================================
//  1. GravitonINFT Tests
// ============================================================

describe("GravitonINFT", function () {
  it("should deploy with correct initial state", async function () {
    const { inft, admin, verifier, mintFee } = await loadFixture(deployFullSuiteFixture);
    expect(await inft.name()).to.equal("Graviton Agent");
    expect(await inft.symbol()).to.equal("GRVT");
    expect(await inft.mintFee()).to.equal(mintFee);
    expect(await inft.storageInfo()).to.equal("0G Storage v1");
    expect(await inft.verifier()).to.equal(await verifier.getAddress());
  });

  it("should mint an INFT with correct metadata", async function () {
    const { inft, alice, mintFee } = await loadFixture(deployFullSuiteFixture);
    const iDatas = [
      { dataDescription: "LoRA weights", dataHash: ethers.keccak256(ethers.toUtf8Bytes("w1")) },
    ];
    await inft.connect(alice).mint(alice.address, iDatas, "trading", "root123", "ipfs://test", { value: mintFee });

    expect(await inft.totalSupply()).to.equal(1);
    expect(await inft.ownerOf(1)).to.equal(alice.address);
    expect(await inft.creatorOf(1)).to.equal(alice.address);
    expect(await inft.categoryOf(1)).to.equal("trading");
    expect(await inft.storageRootOf(1)).to.equal("root123");
  });

  it("should revert minting with insufficient fee", async function () {
    const { inft, alice } = await loadFixture(deployFullSuiteFixture);
    const iDatas = [
      { dataDescription: "LoRA weights", dataHash: ethers.keccak256(ethers.toUtf8Bytes("w1")) },
    ];
    await expect(
      inft.connect(alice).mint(alice.address, iDatas, "trading", "root", "uri", { value: 0 })
    ).to.be.revertedWith("GravitonINFT: insufficient mint fee");
  });

  it("should revert minting with empty data array", async function () {
    const { inft, alice, mintFee } = await loadFixture(deployFullSuiteFixture);
    await expect(
      inft.connect(alice).mint(alice.address, [], "trading", "root", "uri", { value: mintFee })
    ).to.be.revertedWith("GravitonINFT: empty data array");
  });

  it("should refund excess mint fee", async function () {
    const { inft, alice, mintFee } = await loadFixture(deployFullSuiteFixture);
    const iDatas = [
      { dataDescription: "test", dataHash: ethers.keccak256(ethers.toUtf8Bytes("data")) },
    ];
    const excessValue = mintFee + ethers.parseEther("1.0");
    const balBefore = await ethers.provider.getBalance(alice.address);
    const tx = await inft.connect(alice).mint(alice.address, iDatas, "coding", "root", "", { value: excessValue });
    const receipt = await tx.wait();
    const gasUsed = receipt.gasUsed * receipt.gasPrice;
    const balAfter = await ethers.provider.getBalance(alice.address);
    // Alice should have paid exactly mintFee + gas, not the full excessValue
    expect(balBefore - balAfter - gasUsed).to.be.closeTo(mintFee, ethers.parseEther("0.0001"));
  });

  it("should authorize and revoke usage", async function () {
    const { inft, alice, bob, mintFee } = await loadFixture(deployFullSuiteFixture);
    const iDatas = [
      { dataDescription: "test", dataHash: ethers.keccak256(ethers.toUtf8Bytes("data")) },
    ];
    await inft.connect(alice).mint(alice.address, iDatas, "trading", "root", "", { value: mintFee });

    await inft.connect(alice).authorizeUsage(1, bob.address);
    expect(await inft.isAuthorizedUser(1, bob.address)).to.be.true;

    const users = await inft.authorizedUsersOf(1);
    expect(users).to.include(bob.address);

    await inft.connect(alice).revokeAuthorization(1, bob.address);
    expect(await inft.isAuthorizedUser(1, bob.address)).to.be.false;
  });

  it("should prevent duplicate authorization", async function () {
    const { inft, alice, bob, mintFee } = await loadFixture(deployFullSuiteFixture);
    const iDatas = [
      { dataDescription: "test", dataHash: ethers.keccak256(ethers.toUtf8Bytes("data")) },
    ];
    await inft.connect(alice).mint(alice.address, iDatas, "trading", "root", "", { value: mintFee });
    await inft.connect(alice).authorizeUsage(1, bob.address);

    await expect(
      inft.connect(alice).authorizeUsage(1, bob.address)
    ).to.be.revertedWith("GravitonINFT: already authorized");
  });

  it("should update intelligent data (owner only)", async function () {
    const { inft, alice, bob, mintFee } = await loadFixture(deployFullSuiteFixture);
    const iDatas = [
      { dataDescription: "v1", dataHash: ethers.keccak256(ethers.toUtf8Bytes("v1")) },
    ];
    await inft.connect(alice).mint(alice.address, iDatas, "trading", "root", "", { value: mintFee });

    const newDatas = [
      { dataDescription: "v2", dataHash: ethers.keccak256(ethers.toUtf8Bytes("v2")) },
    ];
    await inft.connect(alice).updateIntelligentData(1, newDatas);

    const data = await inft.intelligentDatasOf(1);
    expect(data[0].dataDescription).to.equal("v2");

    // Non-owner cannot update
    await expect(
      inft.connect(bob).updateIntelligentData(1, newDatas)
    ).to.be.revertedWith("GravitonINFT: not owner");
  });

  it("should return correct royalty info", async function () {
    const { inft, alice, mintFee } = await loadFixture(deployFullSuiteFixture);
    const iDatas = [
      { dataDescription: "test", dataHash: ethers.keccak256(ethers.toUtf8Bytes("data")) },
    ];
    await inft.connect(alice).mint(alice.address, iDatas, "trading", "root", "", { value: mintFee });

    const [receiver, amount] = await inft.royaltyInfo(1, ethers.parseEther("1.0"));
    expect(receiver).to.equal(alice.address);
    // 5% royalty
    expect(amount).to.equal(ethers.parseEther("0.05"));
  });

  it("admin should update mint fee", async function () {
    const { inft, admin, alice } = await loadFixture(deployFullSuiteFixture);
    const newFee = ethers.parseEther("0.01");
    await inft.connect(admin).setMintFee(newFee);
    expect(await inft.mintFee()).to.equal(newFee);

    // Non-admin cannot
    await expect(
      inft.connect(alice).setMintFee(0)
    ).to.be.reverted;
  });

  it("admin should withdraw accumulated fees", async function () {
    const { inft, admin, alice, mintFee } = await loadFixture(deployFullSuiteFixture);
    const iDatas = [
      { dataDescription: "test", dataHash: ethers.keccak256(ethers.toUtf8Bytes("data")) },
    ];
    await inft.connect(alice).mint(alice.address, iDatas, "trading", "root", "", { value: mintFee });

    const balBefore = await ethers.provider.getBalance(admin.address);
    const tx = await inft.connect(admin).withdrawFees();
    await tx.wait();
    const balAfter = await ethers.provider.getBalance(admin.address);
    expect(balAfter).to.be.gt(balBefore);
  });

  it("should support ERC-2981 interface", async function () {
    const { inft } = await loadFixture(deployFullSuiteFixture);
    // ERC-2981 interfaceId = 0x2a55205a
    expect(await inft.supportsInterface("0x2a55205a")).to.be.true;
    // ERC-721 interfaceId = 0x80ac58cd
    expect(await inft.supportsInterface("0x80ac58cd")).to.be.true;
    // ERC-165 interfaceId = 0x01ffc9a7
    expect(await inft.supportsInterface("0x01ffc9a7")).to.be.true;
  });
});

// ============================================================
//  2. GravitonMarketplace Tests
// ============================================================

describe("GravitonMarketplace", function () {
  it("should deploy with correct initial state", async function () {
    const { marketplace, inft } = await loadFixture(deployFullSuiteFixture);
    expect(await marketplace.platformFeeBps()).to.equal(250);
    expect(await marketplace.inft()).to.equal(await inft.getAddress());
    expect(await marketplace.totalSales()).to.equal(0);
  });

  it("should list and delist an agent", async function () {
    const { inft, marketplace, alice, mintFee } = await loadFixture(deployFullSuiteFixture);
    const tokenId = await mintAgent(inft, null, alice);

    // Approve marketplace
    await inft.connect(alice).approve(await marketplace.getAddress(), tokenId);

    const price = ethers.parseEther("0.5");
    await marketplace.connect(alice).listAgent(tokenId, price);

    const listing = await marketplace.getListing(tokenId);
    expect(listing.isActive).to.be.true;
    expect(listing.seller).to.equal(alice.address);
    expect(listing.price).to.equal(price);

    // Delist
    await marketplace.connect(alice).delistAgent(tokenId);
    const delisted = await marketplace.getListing(tokenId);
    expect(delisted.isActive).to.be.false;
  });

  it("should reject listing without approval", async function () {
    const { inft, marketplace, alice } = await loadFixture(deployFullSuiteFixture);
    const tokenId = await mintAgent(inft, null, alice);

    await expect(
      marketplace.connect(alice).listAgent(tokenId, ethers.parseEther("1.0"))
    ).to.be.revertedWith("Marketplace: not approved");
  });

  it("should complete a purchase with correct fee splits", async function () {
    const { inft, marketplace, alice, bob, admin, mintFee } = await loadFixture(deployFullSuiteFixture);
    const tokenId = await mintAgent(inft, null, alice);

    await inft.connect(alice).approve(await marketplace.getAddress(), tokenId);
    const price = ethers.parseEther("1.0");
    await marketplace.connect(alice).listAgent(tokenId, price);

    const aliceBalBefore = await ethers.provider.getBalance(alice.address);

    await marketplace.connect(bob).buyAgent(tokenId, { value: price });

    // Verify ownership transferred
    expect(await inft.ownerOf(tokenId)).to.equal(bob.address);

    // Verify stats
    expect(await marketplace.totalSales()).to.equal(1);
    expect(await marketplace.totalVolume()).to.equal(price);

    // Verify platform fees accumulated (2.5% of 1 ETH = 0.025 ETH)
    expect(await marketplace.accumulatedFees()).to.equal(ethers.parseEther("0.025"));
  });

  it("should reject self-purchase", async function () {
    const { inft, marketplace, alice } = await loadFixture(deployFullSuiteFixture);
    const tokenId = await mintAgent(inft, null, alice);
    await inft.connect(alice).approve(await marketplace.getAddress(), tokenId);
    await marketplace.connect(alice).listAgent(tokenId, ethers.parseEther("1.0"));

    await expect(
      marketplace.connect(alice).buyAgent(tokenId, { value: ethers.parseEther("1.0") })
    ).to.be.revertedWith("Marketplace: cannot buy own agent");
  });

  it("should handle rental lifecycle", async function () {
    const { inft, marketplace, alice, bob, admin } = await loadFixture(deployFullSuiteFixture);
    const tokenId = await mintAgent(inft, null, alice);

    // Must approve marketplace for authorizeUsage to work via INFT
    await inft.connect(alice).approve(await marketplace.getAddress(), tokenId);

    // Set rental terms
    const pricePerDay = ethers.parseEther("0.1");
    await marketplace.connect(alice).setRentalTerms(tokenId, pricePerDay);

    // Rent for 3 days
    const totalRent = pricePerDay * 3n;
    await marketplace.connect(bob).rentAgent(tokenId, 3, { value: totalRent });

    const rental = await marketplace.getRental(tokenId);
    expect(rental.isActive).to.be.true;
    expect(rental.renter).to.equal(bob.address);

    // isRentalActive should be true
    expect(await marketplace.isRentalActive(tokenId)).to.be.true;
  });

  it("should reject renting own agent", async function () {
    const { inft, marketplace, alice } = await loadFixture(deployFullSuiteFixture);
    const tokenId = await mintAgent(inft, null, alice);
    await marketplace.connect(alice).setRentalTerms(tokenId, ethers.parseEther("0.1"));

    await expect(
      marketplace.connect(alice).rentAgent(tokenId, 1, { value: ethers.parseEther("0.1") })
    ).to.be.revertedWith("Marketplace: cannot rent own agent");
  });

  it("admin should withdraw fees", async function () {
    const { inft, marketplace, alice, bob, admin } = await loadFixture(deployFullSuiteFixture);
    const tokenId = await mintAgent(inft, null, alice);
    await inft.connect(alice).approve(await marketplace.getAddress(), tokenId);
    await marketplace.connect(alice).listAgent(tokenId, ethers.parseEther("1.0"));
    await marketplace.connect(bob).buyAgent(tokenId, { value: ethers.parseEther("1.0") });

    const fees = await marketplace.accumulatedFees();
    expect(fees).to.be.gt(0);

    await marketplace.connect(admin).withdrawFees();
    expect(await marketplace.accumulatedFees()).to.equal(0);
  });

  it("should pause and unpause", async function () {
    const { marketplace, admin, inft, alice } = await loadFixture(deployFullSuiteFixture);
    const tokenId = await mintAgent(inft, null, alice);

    await marketplace.connect(admin).pause();
    await expect(
      marketplace.connect(alice).listAgent(tokenId, ethers.parseEther("1.0"))
    ).to.be.reverted; // EnforcedPause

    await marketplace.connect(admin).unpause();
    // Now it should succeed (after approval)
    await inft.connect(alice).approve(await marketplace.getAddress(), tokenId);
    await marketplace.connect(alice).listAgent(tokenId, ethers.parseEther("1.0"));
  });
});

// ============================================================
//  3. GravitonRegistry Tests
// ============================================================

describe("GravitonRegistry", function () {
  it("should register an agent", async function () {
    const { inft, registry, alice } = await loadFixture(deployFullSuiteFixture);
    const tokenId = await mintAgent(inft, null, alice);

    await registry.connect(alice).registerAgent(
      tokenId, "TestBot", "A test agent", "Qwen2.5-0.5B", ["test", "demo"], "hash123", "ipfs://meta"
    );

    expect(await registry.isRegistered(tokenId)).to.be.true;
    expect(await registry.totalRegistered()).to.equal(1);

    const meta = await registry.getAgentMeta(tokenId);
    expect(meta.name).to.equal("TestBot");
    expect(meta.version).to.equal(1);
  });

  it("should reject duplicate registration", async function () {
    const { inft, registry, alice } = await loadFixture(deployFullSuiteFixture);
    const tokenId = await mintAgent(inft, null, alice);
    await registry.connect(alice).registerAgent(tokenId, "Bot", "desc", "model", [], "hash", "uri");

    await expect(
      registry.connect(alice).registerAgent(tokenId, "Bot2", "desc2", "model2", [], "hash2", "uri2")
    ).to.be.revertedWith("Registry: already registered");
  });

  it("should update metadata and increment version", async function () {
    const { inft, registry, alice } = await loadFixture(deployFullSuiteFixture);
    const tokenId = await mintAgent(inft, null, alice);
    await registry.connect(alice).registerAgent(tokenId, "Bot", "v1", "model", [], "hash", "uri");

    await registry.connect(alice).updateAgentMeta(tokenId, "Bot", "v2", "model2", ["updated"], "hash2", "uri2");
    const meta = await registry.getAgentMeta(tokenId);
    expect(meta.version).to.equal(2);
    expect(meta.description).to.equal("v2");
  });

  it("should rate an agent with cooldown enforcement", async function () {
    const { inft, registry, alice, bob } = await loadFixture(deployFullSuiteFixture);
    const tokenId = await mintAgent(inft, null, alice);
    await registry.connect(alice).registerAgent(tokenId, "Bot", "desc", "model", [], "hash", "uri");

    await registry.connect(bob).rateAgent(tokenId, 5);
    const avg = await registry.getAverageRating(tokenId);
    expect(avg).to.equal(500); // 5.00 * 100

    // Immediate re-rate should fail (cooldown)
    await expect(
      registry.connect(bob).rateAgent(tokenId, 3)
    ).to.be.revertedWith("Registry: rating cooldown active");
  });

  it("should reject invalid rating scores", async function () {
    const { inft, registry, alice, bob } = await loadFixture(deployFullSuiteFixture);
    const tokenId = await mintAgent(inft, null, alice);
    await registry.connect(alice).registerAgent(tokenId, "Bot", "desc", "model", [], "hash", "uri");

    await expect(registry.connect(bob).rateAgent(tokenId, 0)).to.be.revertedWith("Registry: score must be 1-5");
    await expect(registry.connect(bob).rateAgent(tokenId, 6)).to.be.revertedWith("Registry: score must be 1-5");
  });

  it("should record inference and get usage stats", async function () {
    const { inft, registry, alice } = await loadFixture(deployFullSuiteFixture);
    const tokenId = await mintAgent(inft, null, alice);
    await registry.connect(alice).registerAgent(tokenId, "Bot", "desc", "model", [], "hash", "uri");

    await registry.connect(alice).recordInference(tokenId);
    await registry.connect(alice).recordInference(tokenId);

    const stats = await registry.getUsageStats(tokenId);
    expect(stats.inferenceCount).to.equal(2);
  });

  it("should reject non-owner registration", async function () {
    const { inft, registry, alice, bob } = await loadFixture(deployFullSuiteFixture);
    const tokenId = await mintAgent(inft, null, alice);

    await expect(
      registry.connect(bob).registerAgent(tokenId, "Bot", "desc", "model", [], "hash", "uri")
    ).to.be.revertedWith("Registry: not owner or creator");
  });
});

// ============================================================
//  4. GravitonMemory Tests
// ============================================================

describe("GravitonMemory", function () {
  it("should initialize memory for an agent", async function () {
    const { inft, memory, alice } = await loadFixture(deployFullSuiteFixture);
    const tokenId = await mintAgent(inft, null, alice);

    await memory.connect(alice).initializeMemory(tokenId);
    expect(await memory.isMemoryActive(tokenId)).to.be.true;

    const state = await memory.getMemoryState(tokenId);
    expect(state.isActive).to.be.true;
    expect(state.totalSnapshots).to.equal(0);
  });

  it("should reject double initialization", async function () {
    const { inft, memory, alice } = await loadFixture(deployFullSuiteFixture);
    const tokenId = await mintAgent(inft, null, alice);
    await memory.connect(alice).initializeMemory(tokenId);

    await expect(
      memory.connect(alice).initializeMemory(tokenId)
    ).to.be.revertedWith("Memory: already initialized");
  });

  it("should commit a memory snapshot", async function () {
    const { inft, memory, alice } = await loadFixture(deployFullSuiteFixture);
    const tokenId = await mintAgent(inft, null, alice);
    await memory.connect(alice).initializeMemory(tokenId);

    const contentHash = ethers.keccak256(ethers.toUtf8Bytes("memory content"));
    await memory.connect(alice).commitMemorySnapshot(
      tokenId, "0x_storage_root", contentHash, 5, "conversation"
    );

    const state = await memory.getMemoryState(tokenId);
    expect(state.totalSnapshots).to.equal(1);
    expect(state.totalInteractions).to.equal(5);
    expect(state.latestStorageRoot).to.equal("0x_storage_root");
  });

  it("should auto-initialize on first snapshot commit", async function () {
    const { inft, memory, alice } = await loadFixture(deployFullSuiteFixture);
    const tokenId = await mintAgent(inft, null, alice);

    // No explicit initializeMemory — should auto-init
    const contentHash = ethers.keccak256(ethers.toUtf8Bytes("auto-init"));
    await memory.connect(alice).commitMemorySnapshot(tokenId, "root1", contentHash, 1, "summary");

    expect(await memory.isMemoryActive(tokenId)).to.be.true;
  });

  it("should record interactions", async function () {
    const { inft, memory, alice } = await loadFixture(deployFullSuiteFixture);
    const tokenId = await mintAgent(inft, null, alice);
    await memory.connect(alice).initializeMemory(tokenId);

    await memory.connect(alice).recordInteraction(tokenId);
    await memory.connect(alice).recordInteraction(tokenId);
    await memory.connect(alice).recordInteraction(tokenId);

    expect(await memory.getTotalInteractions(tokenId)).to.equal(3);
  });

  it("should retrieve snapshot history", async function () {
    const { inft, memory, alice } = await loadFixture(deployFullSuiteFixture);
    const tokenId = await mintAgent(inft, null, alice);
    await memory.connect(alice).initializeMemory(tokenId);

    for (let i = 0; i < 3; i++) {
      const hash = ethers.keccak256(ethers.toUtf8Bytes(`snap-${i}`));
      await memory.connect(alice).commitMemorySnapshot(tokenId, `root-${i}`, hash, i + 1, "conversation");
    }

    const history = await memory.getSnapshotHistory(tokenId, 0, 10);
    expect(history.length).to.equal(3);
    expect(history[2].storageRoot).to.equal("root-2");
  });

  it("should reject non-owner snapshot commit", async function () {
    const { inft, memory, alice, bob } = await loadFixture(deployFullSuiteFixture);
    const tokenId = await mintAgent(inft, null, alice);
    await memory.connect(alice).initializeMemory(tokenId);

    const hash = ethers.keccak256(ethers.toUtf8Bytes("unauth"));
    await expect(
      memory.connect(bob).commitMemorySnapshot(tokenId, "root", hash, 1, "conversation")
    ).to.be.revertedWith("Memory: not owner or operator");
  });
});

// ============================================================
//  5. GravitonAttestation Tests
// ============================================================

describe("GravitonAttestation", function () {
  it("should submit a TEE attestation", async function () {
    const { inft, attestation, admin, alice, provider } = await loadFixture(deployFullSuiteFixture);
    const tokenId = await mintAgent(inft, null, alice);

    const reqHash = ethers.keccak256(ethers.toUtf8Bytes("request"));
    const resHash = ethers.keccak256(ethers.toUtf8Bytes("response"));

    await attestation.connect(admin).submitAttestation(
      tokenId, provider.address, alice.address,
      reqHash, resHash, "chat-001", "qwen2.5", true, 100, 200
    );

    expect(await attestation.totalAttestations()).to.equal(1);
    expect(await attestation.totalVerified()).to.equal(1);

    const receipt = await attestation.getReceipt(0);
    expect(receipt.tokenId).to.equal(tokenId);
    expect(receipt.status).to.equal(1); // Verified
    expect(receipt.inputTokens).to.equal(100);
    expect(receipt.outputTokens).to.equal(200);
  });

  it("should reject non-attester submissions", async function () {
    const { inft, attestation, alice, provider } = await loadFixture(deployFullSuiteFixture);
    const tokenId = await mintAgent(inft, null, alice);

    const hash = ethers.keccak256(ethers.toUtf8Bytes("data"));
    await expect(
      attestation.connect(alice).submitAttestation(
        tokenId, provider.address, alice.address, hash, hash, "chat", "model", true, 10, 20
      )
    ).to.be.reverted;
  });

  it("should track agent attestation stats", async function () {
    const { inft, attestation, admin, alice, provider } = await loadFixture(deployFullSuiteFixture);
    const tokenId = await mintAgent(inft, null, alice);
    const hash = ethers.keccak256(ethers.toUtf8Bytes("data"));

    // Submit 3 attestations (2 verified, 1 unverified)
    await attestation.connect(admin).submitAttestation(tokenId, provider.address, alice.address, hash, hash, "c1", "m", true, 10, 20);
    await attestation.connect(admin).submitAttestation(tokenId, provider.address, alice.address, hash, hash, "c2", "m", true, 15, 25);
    await attestation.connect(admin).submitAttestation(tokenId, provider.address, alice.address, hash, hash, "c3", "m", false, 5, 10);

    const stats = await attestation.getAgentStats(tokenId);
    expect(stats.totalAttestations).to.equal(3);
    expect(stats.verifiedCount).to.equal(2);
    expect(stats.totalInputTokens).to.equal(30);
    expect(stats.totalOutputTokens).to.equal(55);
  });

  it("should compute verification rate", async function () {
    const { inft, attestation, admin, alice, provider } = await loadFixture(deployFullSuiteFixture);
    const tokenId = await mintAgent(inft, null, alice);
    const hash = ethers.keccak256(ethers.toUtf8Bytes("data"));

    await attestation.connect(admin).submitAttestation(tokenId, provider.address, alice.address, hash, hash, "c1", "m", true, 1, 1);
    await attestation.connect(admin).submitAttestation(tokenId, provider.address, alice.address, hash, hash, "c2", "m", false, 1, 1);

    // 1 out of 2 verified = 50% = 5000 bps
    expect(await attestation.getVerificationRate(tokenId)).to.equal(5000);
  });

  it("should update verification status", async function () {
    const { inft, attestation, admin, alice, provider } = await loadFixture(deployFullSuiteFixture);
    const tokenId = await mintAgent(inft, null, alice);
    const hash = ethers.keccak256(ethers.toUtf8Bytes("data"));

    await attestation.connect(admin).submitAttestation(tokenId, provider.address, alice.address, hash, hash, "c1", "m", false, 1, 1);
    expect((await attestation.getReceipt(0)).status).to.equal(0); // Unverified

    // Update to Verified
    await attestation.connect(admin).updateVerificationStatus(0, 1); // 1 = Verified
    expect((await attestation.getReceipt(0)).status).to.equal(1);
    expect(await attestation.totalVerified()).to.equal(1);
  });

  it("should track provider reputation", async function () {
    const { inft, attestation, admin, alice, provider } = await loadFixture(deployFullSuiteFixture);
    const tokenId = await mintAgent(inft, null, alice);
    const hash = ethers.keccak256(ethers.toUtf8Bytes("data"));

    await attestation.connect(admin).submitAttestation(tokenId, provider.address, alice.address, hash, hash, "c1", "m", true, 1, 1);

    const rep = await attestation.getProviderReputation(provider.address);
    expect(rep.totalServiced).to.equal(1);
    expect(rep.verifiedCount).to.equal(1);
    expect(rep.isActive).to.be.true;
  });
});

// ============================================================
//  6. GravitonFineTuning Tests
// ============================================================

describe("GravitonFineTuning", function () {
  it("should create a fine-tuning job", async function () {
    const { inft, fineTuning, alice, provider } = await loadFixture(deployFullSuiteFixture);
    const tokenId = await mintAgent(inft, null, alice);
    const datasetHash = ethers.keccak256(ethers.toUtf8Bytes("dataset"));

    await fineTuning.connect(alice).createJob(
      tokenId, provider.address, "Qwen2.5-7B", "dataset_root", datasetHash,
      10, 8, 200, '{"warmup": true}'
    );

    expect(await fineTuning.nextJobId()).to.equal(1);
    const job = await fineTuning.getJob(0);
    expect(job.tokenId).to.equal(tokenId);
    expect(job.epochs).to.equal(10);
    expect(job.loraRank).to.equal(8);
    expect(job.status).to.equal(0); // Created
  });

  it("should reject invalid LoRA rank", async function () {
    const { inft, fineTuning, alice, provider } = await loadFixture(deployFullSuiteFixture);
    const tokenId = await mintAgent(inft, null, alice);
    const hash = ethers.keccak256(ethers.toUtf8Bytes("d"));

    await expect(
      fineTuning.connect(alice).createJob(tokenId, provider.address, "m", "r", hash, 10, 2, 200, "{}")
    ).to.be.revertedWith("FineTuning: invalid LoRA rank");

    await expect(
      fineTuning.connect(alice).createJob(tokenId, provider.address, "m", "r", hash, 10, 256, 200, "{}")
    ).to.be.revertedWith("FineTuning: invalid LoRA rank");
  });

  it("should complete full job lifecycle", async function () {
    const { inft, fineTuning, admin, alice, provider } = await loadFixture(deployFullSuiteFixture);
    const tokenId = await mintAgent(inft, null, alice);
    const hash = ethers.keccak256(ethers.toUtf8Bytes("dataset"));

    // Create
    await fineTuning.connect(alice).createJob(tokenId, provider.address, "Qwen", "root", hash, 5, 16, 100, "{}");

    // Fund
    await fineTuning.connect(alice).fundJob(0);
    expect((await fineTuning.getJob(0)).status).to.equal(1); // Funded

    // Start training (operator)
    await fineTuning.connect(admin).startTraining(0);
    expect((await fineTuning.getJob(0)).status).to.equal(2); // Training

    // Complete
    const resultHash = ethers.keccak256(ethers.toUtf8Bytes("result"));
    await fineTuning.connect(admin).completeJob(0, "result_root", resultHash);
    expect((await fineTuning.getJob(0)).status).to.equal(3); // Completed
    expect(await fineTuning.totalCompletedJobs()).to.equal(1);

    // Finalize
    await fineTuning.connect(alice).finalizeJob(0);
    expect((await fineTuning.getJob(0)).status).to.equal(5); // Finalized

    const stats = await fineTuning.getAgentStats(tokenId);
    expect(stats.currentVersion).to.equal(1);
    expect(stats.completedJobs).to.equal(1);
    expect(stats.totalEpochsTrained).to.equal(5);
  });

  it("should reject out-of-order status transitions", async function () {
    const { inft, fineTuning, admin, alice, provider } = await loadFixture(deployFullSuiteFixture);
    const tokenId = await mintAgent(inft, null, alice);
    const hash = ethers.keccak256(ethers.toUtf8Bytes("d"));
    await fineTuning.connect(alice).createJob(tokenId, provider.address, "m", "r", hash, 5, 8, 100, "{}");

    // Can't start training before funding
    await expect(
      fineTuning.connect(admin).startTraining(0)
    ).to.be.revertedWith("FineTuning: not funded");

    // Can't finalize before completing
    await expect(
      fineTuning.connect(alice).finalizeJob(0)
    ).to.be.revertedWith("FineTuning: not completed");
  });

  it("should handle job failure", async function () {
    const { inft, fineTuning, admin, alice, provider } = await loadFixture(deployFullSuiteFixture);
    const tokenId = await mintAgent(inft, null, alice);
    const hash = ethers.keccak256(ethers.toUtf8Bytes("d"));
    await fineTuning.connect(alice).createJob(tokenId, provider.address, "m", "r", hash, 5, 8, 100, "{}");
    await fineTuning.connect(alice).fundJob(0);
    await fineTuning.connect(admin).failJob(0);

    expect((await fineTuning.getJob(0)).status).to.equal(4); // Failed
    const stats = await fineTuning.getAgentStats(tokenId);
    expect(stats.failedJobs).to.equal(1);
  });
});

// ============================================================
//  7. GravitonDAO Tests
// ============================================================

describe("GravitonDAO", function () {
  it("should have correct revenue split", async function () {
    const { dao } = await loadFixture(deployFullSuiteFixture);
    expect(await dao.creatorShareBps()).to.equal(4000);
    expect(await dao.stakerShareBps()).to.equal(4000);
    expect(await dao.treasuryShareBps()).to.equal(2000);
  });

  it("should distribute revenue correctly", async function () {
    const { dao, admin } = await loadFixture(deployFullSuiteFixture);
    const amount = ethers.parseEther("1.0");
    await dao.connect(admin).distributeRevenue({ value: amount });

    expect(await dao.creatorPool()).to.equal(ethers.parseEther("0.4"));
    expect(await dao.stakerPool()).to.equal(ethers.parseEther("0.4"));
    expect(await dao.treasuryPool()).to.equal(ethers.parseEther("0.2"));
    expect(await dao.totalRevenueDistributed()).to.equal(amount);
  });

  it("should stake and unstake INFTs", async function () {
    const { inft, dao, alice } = await loadFixture(deployFullSuiteFixture);
    const tokenId = await mintAgent(inft, null, alice);

    await inft.connect(alice).approve(await dao.getAddress(), tokenId);
    await dao.connect(alice).stake(tokenId);

    expect(await dao.totalStaked()).to.equal(1);
    expect(await dao.stakerTokenCount(alice.address)).to.equal(1);
    expect(await inft.ownerOf(tokenId)).to.equal(await dao.getAddress());

    // Unstake
    await dao.connect(alice).unstake(tokenId);
    expect(await dao.totalStaked()).to.equal(0);
    expect(await inft.ownerOf(tokenId)).to.equal(alice.address);
  });

  it("should reject staking without approval", async function () {
    const { inft, dao, alice } = await loadFixture(deployFullSuiteFixture);
    const tokenId = await mintAgent(inft, null, alice);

    await expect(
      dao.connect(alice).stake(tokenId)
    ).to.be.revertedWith("DAO: not approved");
  });

  it("should create and vote on proposals", async function () {
    const { inft, dao, alice, admin } = await loadFixture(deployFullSuiteFixture);
    const tokenId = await mintAgent(inft, null, alice);

    // Must stake to propose
    await inft.connect(alice).approve(await dao.getAddress(), tokenId);
    await dao.connect(alice).stake(tokenId);

    // Fund treasury
    await dao.connect(admin).distributeRevenue({ value: ethers.parseEther("1.0") });

    // Create proposal
    await dao.connect(alice).createProposal(
      "Fund Dev", "Build feature X",
      alice.address, ethers.parseEther("0.1")
    );

    expect(await dao.nextProposalId()).to.equal(1);

    // Vote
    await dao.connect(alice).vote(0, true);
    const proposal = await dao.getProposal(0);
    expect(proposal.votesFor).to.equal(1);
  });

  it("should reject double voting", async function () {
    const { inft, dao, alice, admin } = await loadFixture(deployFullSuiteFixture);
    const tokenId = await mintAgent(inft, null, alice);
    await inft.connect(alice).approve(await dao.getAddress(), tokenId);
    await dao.connect(alice).stake(tokenId);
    await dao.connect(admin).distributeRevenue({ value: ethers.parseEther("1.0") });
    await dao.connect(alice).createProposal("Test", "Desc", alice.address, 0);

    await dao.connect(alice).vote(0, true);
    await expect(
      dao.connect(alice).vote(0, true)
    ).to.be.revertedWith("DAO: already voted");
  });

  it("should reject proposals from non-stakers", async function () {
    const { dao, alice } = await loadFixture(deployFullSuiteFixture);
    await expect(
      dao.connect(alice).createProposal("Test", "Desc", alice.address, 0)
    ).to.be.revertedWith("DAO: must stake to propose");
  });

  it("should update revenue split (admin only)", async function () {
    const { dao, admin, alice } = await loadFixture(deployFullSuiteFixture);
    await dao.connect(admin).setRevenueSplit(5000, 3000, 2000);
    expect(await dao.creatorShareBps()).to.equal(5000);

    // Must total 10000
    await expect(
      dao.connect(admin).setRevenueSplit(5000, 3000, 3000)
    ).to.be.revertedWith("DAO: split must total 10000");

    // Non-admin
    await expect(
      dao.connect(alice).setRevenueSplit(5000, 3000, 2000)
    ).to.be.reverted;
  });

  it("should auto-distribute on receive", async function () {
    const { dao, admin } = await loadFixture(deployFullSuiteFixture);
    // Send ETH directly
    await admin.sendTransaction({ to: await dao.getAddress(), value: ethers.parseEther("0.5") });
    expect(await dao.totalRevenueDistributed()).to.equal(ethers.parseEther("0.5"));
    expect(await dao.treasuryPool()).to.be.gt(0);
  });
});

// ============================================================
//  8. GravitonMultiModal Tests
// ============================================================

describe("GravitonMultiModal", function () {
  it("should create a multi-modal profile", async function () {
    const { inft, multimodal, alice } = await loadFixture(deployFullSuiteFixture);
    const tokenId = await mintAgent(inft, null, alice);

    await multimodal.connect(alice).createProfile(tokenId);
    expect(await multimodal.hasProfile(tokenId)).to.be.true;
    expect(await multimodal.totalMultiModalAgents()).to.equal(1);
  });

  it("should reject duplicate profile creation", async function () {
    const { inft, multimodal, alice } = await loadFixture(deployFullSuiteFixture);
    const tokenId = await mintAgent(inft, null, alice);
    await multimodal.connect(alice).createProfile(tokenId);

    await expect(
      multimodal.connect(alice).createProfile(tokenId)
    ).to.be.revertedWith("MultiModal: already active");
  });

  it("should add and remove modalities", async function () {
    const { inft, multimodal, alice } = await loadFixture(deployFullSuiteFixture);
    const tokenId = await mintAgent(inft, null, alice);
    await multimodal.connect(alice).createProfile(tokenId);

    const zeroHash = ethers.ZeroHash;
    await multimodal.connect(alice).addModality(
      tokenId, 0, ["chat", "completion"], "gpt-4o", "root1", zeroHash // 0 = Text
    );

    const supported = await multimodal.getSupportedModalities(tokenId);
    expect(supported[0]).to.be.true;  // Text
    expect(supported[1]).to.be.false; // Image

    expect(await multimodal.totalModalityRegistrations()).to.equal(1);

    // Remove
    await multimodal.connect(alice).removeModality(tokenId, 0);
    const afterRemove = await multimodal.getSupportedModalities(tokenId);
    expect(afterRemove[0]).to.be.false;
  });

  it("should reject adding modality without profile", async function () {
    const { inft, multimodal, alice } = await loadFixture(deployFullSuiteFixture);
    const tokenId = await mintAgent(inft, null, alice);

    await expect(
      multimodal.connect(alice).addModality(tokenId, 0, ["chat"], "model", "", ethers.ZeroHash)
    ).to.be.revertedWith("MultiModal: no profile");
  });

  it("should add pipeline stages", async function () {
    const { inft, multimodal, alice } = await loadFixture(deployFullSuiteFixture);
    const tokenId = await mintAgent(inft, null, alice);
    await multimodal.connect(alice).createProfile(tokenId);

    const zeroHash = ethers.ZeroHash;
    // Enable Text and Image
    await multimodal.connect(alice).addModality(tokenId, 0, ["chat"], "m1", "", zeroHash);
    await multimodal.connect(alice).addModality(tokenId, 1, ["generation"], "m2", "", zeroHash);

    // Add pipeline: Text → Image
    await multimodal.connect(alice).addPipelineStage(tokenId, 0, 1, "text-to-image");

    const profile = await multimodal.getProfile(tokenId);
    expect(profile.pipelineStageCount).to.equal(1);

    const stage = await multimodal.getPipelineStage(tokenId, 0);
    expect(stage.processorName).to.equal("text-to-image");
  });

  it("should reject pipeline with disabled modality", async function () {
    const { inft, multimodal, alice } = await loadFixture(deployFullSuiteFixture);
    const tokenId = await mintAgent(inft, null, alice);
    await multimodal.connect(alice).createProfile(tokenId);

    const zeroHash = ethers.ZeroHash;
    await multimodal.connect(alice).addModality(tokenId, 0, ["chat"], "m1", "", zeroHash);

    // Try pipeline Text → Image but Image not enabled
    await expect(
      multimodal.connect(alice).addPipelineStage(tokenId, 0, 1, "text-to-image")
    ).to.be.revertedWith("MultiModal: modality not enabled");
  });

  it("should record modality usage (operator only)", async function () {
    const { inft, multimodal, admin, alice } = await loadFixture(deployFullSuiteFixture);
    const tokenId = await mintAgent(inft, null, alice);
    await multimodal.connect(alice).createProfile(tokenId);
    await multimodal.connect(alice).addModality(tokenId, 0, ["chat"], "m1", "", ethers.ZeroHash);

    // Operator records usage
    await multimodal.connect(admin).recordModalityUsage(tokenId, 0);
    await multimodal.connect(admin).recordModalityUsage(tokenId, 0);

    const usage = await multimodal.getModalityUsageStats(tokenId);
    expect(usage[0]).to.equal(2); // Text usage
  });

  it("should return agents by modality", async function () {
    const { inft, multimodal, alice, bob } = await loadFixture(deployFullSuiteFixture);
    const tokenId1 = await mintAgent(inft, null, alice);
    const tokenId2 = await mintAgent(inft, null, bob);

    await multimodal.connect(alice).createProfile(tokenId1);
    await multimodal.connect(bob).createProfile(tokenId2);

    await multimodal.connect(alice).addModality(tokenId1, 0, ["chat"], "m1", "", ethers.ZeroHash);
    await multimodal.connect(bob).addModality(tokenId2, 0, ["completion"], "m2", "", ethers.ZeroHash);

    const textAgents = await multimodal.getAgentsByModality(0);
    expect(textAgents.length).to.equal(2);
  });

  it("should reject non-owner profile creation", async function () {
    const { inft, multimodal, alice, bob } = await loadFixture(deployFullSuiteFixture);
    const tokenId = await mintAgent(inft, null, alice);

    await expect(
      multimodal.connect(bob).createProfile(tokenId)
    ).to.be.revertedWith("MultiModal: not owner");
  });
});

// ============================================================
//  9. Cross-Contract Integration Tests
// ============================================================

describe("Integration: Cross-Contract Flows", function () {
  it("full agent lifecycle: mint → register → list → buy → rate", async function () {
    const { inft, registry, marketplace, alice, bob, admin, mintFee } = await loadFixture(deployFullSuiteFixture);

    // 1. Mint
    const tokenId = await mintAgent(inft, null, alice);
    expect(await inft.ownerOf(tokenId)).to.equal(alice.address);

    // 2. Register
    await registry.connect(alice).registerAgent(
      tokenId, "TradeBot", "Crypto trading agent", "Qwen2.5-7B", ["trading", "defi"], "hash", "uri"
    );
    expect(await registry.isRegistered(tokenId)).to.be.true;

    // 3. List
    await inft.connect(alice).approve(await marketplace.getAddress(), tokenId);
    await marketplace.connect(alice).listAgent(tokenId, ethers.parseEther("0.5"));
    expect((await marketplace.getListing(tokenId)).isActive).to.be.true;

    // 4. Buy
    await marketplace.connect(bob).buyAgent(tokenId, { value: ethers.parseEther("0.5") });
    expect(await inft.ownerOf(tokenId)).to.equal(bob.address);

    // 5. Rate (alice rates after purchase)
    await registry.connect(alice).rateAgent(tokenId, 4);
    expect(await registry.getAverageRating(tokenId)).to.equal(400);
  });

  it("memory + attestation integration", async function () {
    const { inft, memory, attestation, admin, alice, provider } = await loadFixture(deployFullSuiteFixture);
    const tokenId = await mintAgent(inft, null, alice);

    // Initialize memory
    await memory.connect(alice).initializeMemory(tokenId);

    // Commit memory snapshot
    const contentHash = ethers.keccak256(ethers.toUtf8Bytes("session-1"));
    await memory.connect(alice).commitMemorySnapshot(tokenId, "mem_root_1", contentHash, 3, "conversation");

    // Submit TEE attestation for the same session
    const reqHash = ethers.keccak256(ethers.toUtf8Bytes("query"));
    const resHash = ethers.keccak256(ethers.toUtf8Bytes("answer"));
    await attestation.connect(admin).submitAttestation(
      tokenId, provider.address, alice.address, reqHash, resHash, "chat-session-1", "qwen2.5", true, 50, 100
    );

    // Both should show activity
    expect(await memory.getTotalInteractions(tokenId)).to.equal(3);
    expect(await attestation.hasVerifiedAttestations(tokenId)).to.be.true;
  });

  it("DAO staking + governance + revenue flow", async function () {
    const { inft, dao, alice, bob, admin } = await loadFixture(deployFullSuiteFixture);
    const tokenId1 = await mintAgent(inft, null, alice);
    const tokenId2 = await mintAgent(inft, null, bob);

    // Stake both
    await inft.connect(alice).approve(await dao.getAddress(), tokenId1);
    await dao.connect(alice).stake(tokenId1);

    await inft.connect(bob).approve(await dao.getAddress(), tokenId2);
    await dao.connect(bob).stake(tokenId2);

    expect(await dao.totalStaked()).to.equal(2);

    // Distribute revenue
    await dao.connect(admin).distributeRevenue({ value: ethers.parseEther("1.0") });

    // Create proposal (alice)
    await dao.connect(alice).createProposal(
      "Ecosystem Grant", "Fund dev tooling", alice.address, ethers.parseEther("0.1")
    );

    // Vote (both)
    await dao.connect(alice).vote(0, true);
    await dao.connect(bob).vote(0, true);

    const proposal = await dao.getProposal(0);
    expect(proposal.votesFor).to.equal(2);
  });

  it("fine-tuning + multi-modal integration", async function () {
    const { inft, fineTuning, multimodal, admin, alice, provider } = await loadFixture(deployFullSuiteFixture);
    const tokenId = await mintAgent(inft, null, alice);

    // Create multi-modal profile with Text and Image
    await multimodal.connect(alice).createProfile(tokenId);
    await multimodal.connect(alice).addModality(tokenId, 0, ["chat"], "qwen", "", ethers.ZeroHash);
    await multimodal.connect(alice).addModality(tokenId, 1, ["generation"], "sdxl", "", ethers.ZeroHash);

    // Create fine-tuning job for the text modality
    const dataHash = ethers.keccak256(ethers.toUtf8Bytes("training-data"));
    await fineTuning.connect(alice).createJob(
      tokenId, provider.address, "Qwen2.5", "data_root", dataHash, 10, 16, 200, "{}"
    );

    // Verify both systems are active
    expect(await multimodal.hasProfile(tokenId)).to.be.true;
    const supported = await multimodal.getSupportedModalities(tokenId);
    expect(supported[0]).to.be.true;
    expect(supported[1]).to.be.true;
    expect(await fineTuning.nextJobId()).to.equal(1);
  });
});

// ============================================================
//  E4: Cross-Contract Hooks Tests
// ============================================================

describe("E4: Cross-Contract Hooks", function () {
  /** Helper: set up hooks (grant roles + setHooks) */
  async function wireHooks(marketplace, registry, dao, admin) {
    const ADMIN_ROLE = ethers.keccak256(ethers.toUtf8Bytes("ADMIN_ROLE"));
    const OPERATOR_ROLE = ethers.keccak256(ethers.toUtf8Bytes("OPERATOR_ROLE"));
    const mpAddr = await marketplace.getAddress();

    await registry.connect(admin).grantRole(ADMIN_ROLE, mpAddr);
    await dao.connect(admin).grantRole(OPERATOR_ROLE, mpAddr);
    await marketplace.connect(admin).setHooks(
      await registry.getAddress(),
      await dao.getAddress()
    );
  }

  it("setHooks stores registry and dao addresses", async function () {
    const { marketplace, registry, dao, admin } = await loadFixture(deployFullSuiteFixture);

    // Before wiring — both zero
    expect(await marketplace.registry()).to.equal(ethers.ZeroAddress);
    expect(await marketplace.dao()).to.equal(ethers.ZeroAddress);

    await wireHooks(marketplace, registry, dao, admin);

    expect(await marketplace.registry()).to.equal(await registry.getAddress());
    expect(await marketplace.dao()).to.equal(await dao.getAddress());
  });

  it("setHooks requires ADMIN_ROLE", async function () {
    const { marketplace, registry, dao, alice } = await loadFixture(deployFullSuiteFixture);

    await expect(
      marketplace.connect(alice).setHooks(
        await registry.getAddress(),
        await dao.getAddress()
      )
    ).to.be.reverted;
  });

  it("buyAgent auto-calls registry.recordInference after hooks wired", async function () {
    const { inft, marketplace, registry, dao, admin, alice, bob } = await loadFixture(deployFullSuiteFixture);

    // Wire hooks
    await wireHooks(marketplace, registry, dao, admin);

    // Mint, register, list, buy
    const tokenId = await mintAgent(inft, null, alice);
    await registry.connect(alice).registerAgent(
      tokenId, "HookBot", "Test hook agent", "Qwen", ["test"], "hash", "uri"
    );
    await inft.connect(alice).approve(await marketplace.getAddress(), tokenId);
    await marketplace.connect(alice).listAgent(tokenId, ethers.parseEther("0.5"));

    // Check inference count before
    const statsBefore = await registry.getUsageStats(tokenId);
    expect(statsBefore.inferenceCount).to.equal(0);

    // Buy → should auto-increment inference count
    await marketplace.connect(bob).buyAgent(tokenId, { value: ethers.parseEther("0.5") });

    const statsAfter = await registry.getUsageStats(tokenId);
    expect(statsAfter.inferenceCount).to.equal(1);
  });

  it("buyAgent auto-calls dao.updateCreatorRewards after hooks wired", async function () {
    const { inft, marketplace, registry, dao, admin, alice, bob } = await loadFixture(deployFullSuiteFixture);

    // Wire hooks
    await wireHooks(marketplace, registry, dao, admin);

    // Seed DAO with creator pool funds
    await dao.connect(admin).distributeRevenue({ value: ethers.parseEther("1.0") });

    // Mint, list, buy
    const tokenId = await mintAgent(inft, null, alice);
    await inft.connect(alice).approve(await marketplace.getAddress(), tokenId);
    const price = ethers.parseEther("0.5");
    await marketplace.connect(alice).listAgent(tokenId, price);

    // Check creator rewards before
    const crBefore = await dao.getCreatorRewards(alice.address);
    expect(crBefore.totalVolume).to.equal(0);

    // Buy → should auto-update creator rewards
    await marketplace.connect(bob).buyAgent(tokenId, { value: price });

    const crAfter = await dao.getCreatorRewards(alice.address);
    expect(crAfter.totalVolume).to.equal(price);
    expect(crAfter.pendingRewards).to.be.gt(0);
  });

  it("rentAgent auto-calls registry.recordRental after hooks wired", async function () {
    const { inft, marketplace, registry, dao, admin, alice, bob } = await loadFixture(deployFullSuiteFixture);

    // Wire hooks
    await wireHooks(marketplace, registry, dao, admin);

    // Mint and set rental terms
    const tokenId = await mintAgent(inft, null, alice);
    await inft.connect(alice).approve(await marketplace.getAddress(), tokenId);
    const pricePerDay = ethers.parseEther("0.1");
    await marketplace.connect(alice).setRentalTerms(tokenId, pricePerDay);

    // Check rental count before
    const statsBefore = await registry.getUsageStats(tokenId);
    expect(statsBefore.rentalCount).to.equal(0);

    // Rent → should auto-increment rental count
    await marketplace.connect(bob).rentAgent(tokenId, 3, { value: pricePerDay * 3n });

    const statsAfter = await registry.getUsageStats(tokenId);
    expect(statsAfter.rentalCount).to.equal(1);
  });

  it("rentAgent auto-calls dao.updateCreatorRewards after hooks wired", async function () {
    const { inft, marketplace, registry, dao, admin, alice, bob } = await loadFixture(deployFullSuiteFixture);

    // Wire hooks
    await wireHooks(marketplace, registry, dao, admin);

    // Seed DAO with creator pool funds
    await dao.connect(admin).distributeRevenue({ value: ethers.parseEther("1.0") });

    // Mint and rent
    const tokenId = await mintAgent(inft, null, alice);
    await inft.connect(alice).approve(await marketplace.getAddress(), tokenId);
    const pricePerDay = ethers.parseEther("0.1");
    await marketplace.connect(alice).setRentalTerms(tokenId, pricePerDay);

    await marketplace.connect(bob).rentAgent(tokenId, 5, { value: pricePerDay * 5n });

    const cr = await dao.getCreatorRewards(alice.address);
    expect(cr.totalVolume).to.equal(pricePerDay * 5n);
    expect(cr.pendingRewards).to.be.gt(0);
  });

  it("buyAgent works gracefully when hooks are NOT wired (zero addresses)", async function () {
    const { inft, marketplace, registry, alice, bob } = await loadFixture(deployFullSuiteFixture);

    // DO NOT wire hooks — registry and dao are zero
    const tokenId = await mintAgent(inft, null, alice);
    await inft.connect(alice).approve(await marketplace.getAddress(), tokenId);
    await marketplace.connect(alice).listAgent(tokenId, ethers.parseEther("0.5"));

    // Buy should succeed without reverting (hook calls are try/catch)
    await marketplace.connect(bob).buyAgent(tokenId, { value: ethers.parseEther("0.5") });
    expect(await inft.ownerOf(tokenId)).to.equal(bob.address);

    // Stats should NOT be updated (hooks weren't wired)
    const stats = await registry.getUsageStats(tokenId);
    expect(stats.inferenceCount).to.equal(0);
  });

  it("full E4 lifecycle: wire → buy → rent → verify analytics + rewards", async function () {
    const { inft, marketplace, registry, dao, admin, alice, bob, charlie } = await loadFixture(deployFullSuiteFixture);

    // Wire hooks
    await wireHooks(marketplace, registry, dao, admin);

    // Seed DAO
    await dao.connect(admin).distributeRevenue({ value: ethers.parseEther("2.0") });

    // Mint two agents by alice
    const t1 = await mintAgent(inft, null, alice);
    const t2 = await mintAgent(inft, null, alice);

    // Register agents
    await registry.connect(alice).registerAgent(t1, "Bot1", "Agent 1", "Qwen", ["trading"], "h1", "u1");
    await registry.connect(alice).registerAgent(t2, "Bot2", "Agent 2", "Qwen", ["coding"], "h2", "u2");

    // List t1 for sale, set rental terms for t2
    await inft.connect(alice).approve(await marketplace.getAddress(), t1);
    await marketplace.connect(alice).listAgent(t1, ethers.parseEther("1.0"));

    await inft.connect(alice).approve(await marketplace.getAddress(), t2);
    await marketplace.connect(alice).setRentalTerms(t2, ethers.parseEther("0.2"));

    // Bob buys t1
    await marketplace.connect(bob).buyAgent(t1, { value: ethers.parseEther("1.0") });

    // Charlie rents t2
    await marketplace.connect(charlie).rentAgent(t2, 2, { value: ethers.parseEther("0.4") });

    // Verify all analytics
    const stats1 = await registry.getUsageStats(t1);
    expect(stats1.inferenceCount).to.equal(1); // from buy
    expect(stats1.rentalCount).to.equal(0);

    const stats2 = await registry.getUsageStats(t2);
    expect(stats2.inferenceCount).to.equal(0);
    expect(stats2.rentalCount).to.equal(1); // from rent

    // Verify creator rewards (both agents by alice)
    const cr = await dao.getCreatorRewards(alice.address);
    expect(cr.totalVolume).to.equal(ethers.parseEther("1.4")); // 1.0 sale + 0.4 rental
    expect(cr.pendingRewards).to.be.gt(0);
  });
});
