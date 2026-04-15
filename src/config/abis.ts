/**
 * Contract ABIs — minimal human-readable ABI fragments for each contract.
 * These match the Solidity contracts exactly (GravitonINFT, GravitonMarketplace, GravitonRegistry).
 */

// ============================================================
//  GravitonINFT ABI
// ============================================================

export const INFT_ABI = [
  // Minting
  "function mint(address to, (string dataDescription, bytes32 dataHash)[] iDatas, string category, string storageRoot, string uri) external payable returns (uint256)",
  "function mintFee() external view returns (uint256)",

  // Views
  "function ownerOf(uint256 tokenId) external view returns (address)",
  "function balanceOf(address owner) external view returns (uint256)",
  "function tokenOfOwnerByIndex(address owner, uint256 index) external view returns (uint256)",
  "function tokenURI(uint256 tokenId) external view returns (string)",
  "function totalSupply() external view returns (uint256)",
  "function creatorOf(uint256 tokenId) external view returns (address)",
  "function categoryOf(uint256 tokenId) external view returns (string)",
  "function storageRootOf(uint256 tokenId) external view returns (string)",
  "function getIntelligentDatas(uint256 tokenId) external view returns ((string dataDescription, bytes32 dataHash)[])",
  "function authorizedUsersOf(uint256 tokenId) external view returns (address[])",
  "function isAuthorizedUser(uint256 tokenId, address user) external view returns (bool)",

  // Approval
  "function approve(address to, uint256 tokenId) external",
  "function setApprovalForAll(address operator, bool approved) external",
  "function getApproved(uint256 tokenId) external view returns (address)",
  "function isApprovedForAll(address owner, address operator) external view returns (bool)",

  // Events
  "event AgentMinted(uint256 indexed tokenId, address indexed creator, string category, string storageRoot)",
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
] as const;

// ============================================================
//  GravitonMarketplace ABI
// ============================================================

export const MARKETPLACE_ABI = [
  // Listing
  "function listAgent(uint256 tokenId, uint256 price) external",
  "function delistAgent(uint256 tokenId) external",
  "function getListing(uint256 tokenId) external view returns ((address seller, uint256 price, string category, bool isActive, uint256 listedAt))",

  // Purchase
  "function buyAgent(uint256 tokenId) external payable",

  // Rental
  "function setRentalTerms(uint256 tokenId, uint256 pricePerDay) external",
  "function rentAgent(uint256 tokenId, uint256 durationDays) external payable",
  "function endRental(uint256 tokenId) external",
  "function getRental(uint256 tokenId) external view returns ((address renter, uint256 pricePerDay, uint256 startTime, uint256 endTime, bool isActive))",
  "function isRentalActive(uint256 tokenId) external view returns (bool)",

  // Stats
  "function platformFeeBps() external view returns (uint256)",
  "function totalSales() external view returns (uint256)",
  "function totalVolume() external view returns (uint256)",

  // Cross-Contract Hooks (E4)
  "function registry() external view returns (address)",
  "function dao() external view returns (address)",
  "function setHooks(address _registry, address _dao) external",

  // Events
  "event AgentListed(uint256 indexed tokenId, address indexed seller, uint256 price, string category)",
  "event AgentSold(uint256 indexed tokenId, address indexed seller, address indexed buyer, uint256 price, uint256 royaltyAmount, uint256 platformFee)",
  "event AgentRented(uint256 indexed tokenId, address indexed owner, address indexed renter, uint256 pricePerDay, uint256 duration)",
  "event HooksConfigured(address indexed registry, address indexed dao)",
] as const;

// ============================================================
//  GravitonRegistry ABI
// ============================================================

export const REGISTRY_ABI = [
  // Registration
  "function registerAgent(uint256 tokenId, string name, string description, string modelType, string[] tags, string storageHash, string metadataURI) external",
  "function updateAgentMeta(uint256 tokenId, string name, string description, string modelType, string[] tags, string storageHash, string metadataURI) external",

  // Views
  "function getAgentMeta(uint256 tokenId) external view returns ((string name, string description, string modelType, string[] tags, string storageHash, string metadataURI, uint256 registeredAt, uint256 updatedAt, uint256 version))",
  "function isRegistered(uint256 tokenId) external view returns (bool)",
  "function totalRegistered() external view returns (uint256)",
  "function getAgentsByCategory(string category) external view returns (uint256[])",
  "function getAgentsByCreator(address creator) external view returns (uint256[])",

  // Ratings
  "function rateAgent(uint256 tokenId, uint8 score) external",
  "function ratings(uint256 tokenId) external view returns (uint256 totalScore, uint256 ratingCount)",
  "function getAverageRating(uint256 tokenId) external view returns (uint256)",

  // Usage stats
  "function getUsageStats(uint256 tokenId) external view returns ((uint256 inferenceCount, uint256 rentalCount, uint256 cloneCount))",

  // Events
  "event AgentRegistered(uint256 indexed tokenId, string name, string modelType, address indexed creator)",
  "event AgentRated(uint256 indexed tokenId, address indexed rater, uint8 score)",
] as const;

// ============================================================
//  GravitonMemory ABI
// ============================================================

export const MEMORY_ABI = [
  // Write
  "function initializeMemory(uint256 tokenId) external",
  "function commitMemorySnapshot(uint256 tokenId, string storageRoot, bytes32 contentHash, uint256 interactionCount, string snapshotType) external",
  "function recordInteraction(uint256 tokenId) external",

  // Views
  "function getMemoryState(uint256 tokenId) external view returns ((uint256 totalInteractions, uint256 totalSnapshots, uint256 lastUpdated, string latestStorageRoot, bool isActive))",
  "function getLatestSnapshot(uint256 tokenId) external view returns ((string storageRoot, bytes32 contentHash, uint256 interactionCount, uint256 timestamp, string snapshotType))",
  "function getSnapshotHistory(uint256 tokenId, uint256 offset, uint256 limit) external view returns ((string storageRoot, bytes32 contentHash, uint256 interactionCount, uint256 timestamp, string snapshotType)[])",
  "function isMemoryActive(uint256 tokenId) external view returns (bool)",
  "function getTotalInteractions(uint256 tokenId) external view returns (uint256)",
  "function totalMemoryOps() external view returns (uint256)",

  // Events
  "event MemoryInitialized(uint256 indexed tokenId, address indexed owner)",
  "event MemorySnapshotCommitted(uint256 indexed tokenId, string storageRoot, bytes32 contentHash, uint256 interactionCount, string snapshotType)",
  "event InteractionRecorded(uint256 indexed tokenId, uint256 newCount)",
] as const;

// ============================================================
//  GravitonAttestation ABI
// ============================================================

export const ATTESTATION_ABI = [
  // Write
  "function submitAttestation(uint256 tokenId, address provider, address requester, bytes32 requestHash, bytes32 responseHash, string chatId, string model, bool verified, uint256 inputTokens, uint256 outputTokens) external",

  // Views
  "function getReceipt(uint256 receiptId) external view returns ((uint256 tokenId, address provider, address requester, bytes32 requestHash, bytes32 responseHash, string chatId, string model, uint256 timestamp, uint8 status, uint256 inputTokens, uint256 outputTokens))",
  "function getAgentStats(uint256 tokenId) external view returns ((uint256 totalAttestations, uint256 verifiedCount, uint256 failedCount, uint256 disputedCount, uint256 lastAttestationTime, uint256 totalInputTokens, uint256 totalOutputTokens))",
  "function getAgentAttestations(uint256 tokenId, uint256 offset, uint256 limit) external view returns (uint256[])",
  "function getUserAttestations(address user, uint256 offset, uint256 limit) external view returns (uint256[])",
  "function getVerificationRate(uint256 tokenId) external view returns (uint256)",
  "function getProviderReputation(address provider) external view returns ((uint256 totalServiced, uint256 verifiedCount, uint256 failedCount, uint256 firstSeen, uint256 lastSeen, bool isActive))",
  "function hasVerifiedAttestations(uint256 tokenId) external view returns (bool)",
  "function totalAttestations() external view returns (uint256)",
  "function totalVerified() external view returns (uint256)",

  // Events
  "event AttestationSubmitted(uint256 indexed receiptId, uint256 indexed tokenId, address indexed provider, address requester, string chatId, uint8 status)",
  "event AttestationVerified(uint256 indexed receiptId, uint256 indexed tokenId, uint8 newStatus)",
] as const;

// ============================================================
//  GravitonFineTuning ABI
// ============================================================

export const FINE_TUNING_ABI = [
  // Write
  "function createJob(uint256 tokenId, address provider, string baseModel, string datasetStorageRoot, bytes32 datasetHash, uint256 epochs, uint256 loraRank, uint256 learningRateBps, string hyperparamsJson) external returns (uint256)",
  "function fundJob(uint256 jobId) external",
  "function startTraining(uint256 jobId) external",
  "function completeJob(uint256 jobId, string resultStorageRoot, bytes32 resultHash) external",
  "function failJob(uint256 jobId) external",
  "function finalizeJob(uint256 jobId) external",

  // Views
  "function getJob(uint256 jobId) external view returns ((uint256 tokenId, address owner, address provider, string baseModel, string datasetStorageRoot, bytes32 datasetHash, string resultStorageRoot, bytes32 resultHash, uint8 status, uint256 createdAt, uint256 completedAt, uint256 epochs, uint256 loraRank, uint256 learningRateBps, string hyperparamsJson))",
  "function getAgentStats(uint256 tokenId) external view returns ((uint256 totalJobs, uint256 completedJobs, uint256 failedJobs, uint256 totalEpochsTrained, uint256 lastFineTunedAt, uint256 currentVersion))",
  "function getAgentJobs(uint256 tokenId, uint256 offset, uint256 limit) external view returns (uint256[])",
  "function getOwnerJobs(address owner, uint256 offset, uint256 limit) external view returns (uint256[])",
  "function getCurrentVersion(uint256 tokenId) external view returns (uint256)",
  "function nextJobId() external view returns (uint256)",
  "function totalCompletedJobs() external view returns (uint256)",

  // Events
  "event JobCreated(uint256 indexed jobId, uint256 indexed tokenId, address indexed owner, string baseModel, uint256 epochs, uint256 loraRank)",
  "event JobStatusUpdated(uint256 indexed jobId, uint256 indexed tokenId, uint8 oldStatus, uint8 newStatus)",
  "event JobCompleted(uint256 indexed jobId, uint256 indexed tokenId, string resultStorageRoot, bytes32 resultHash)",
  "event JobFinalized(uint256 indexed jobId, uint256 indexed tokenId, uint256 newVersion)",
] as const;

// ============================================================
//  GravitonDAO ABI
// ============================================================

export const DAO_ABI = [
  // Revenue
  "function distributeRevenue() external payable",

  // Staking
  "function stake(uint256 tokenId) external",
  "function unstake(uint256 tokenId) external",
  "function claimStakerRewards(uint256 tokenId) external",
  "function pendingStakerReward(uint256 tokenId) external view returns (uint256)",
  "function totalStaked() external view returns (uint256)",
  "function stakerTokenCount(address) external view returns (uint256)",
  "function getStakeInfo(uint256 tokenId) external view returns ((address owner, uint256 tokenId, uint256 stakedAt, uint256 lastClaimedAt, bool isActive))",

  // Creator Rewards
  "function claimCreatorRewards() external",
  "function getCreatorRewards(address creator) external view returns ((uint256 totalEarned, uint256 pendingRewards, uint256 agentCount, uint256 totalVolume, uint256 lastUpdatedAt))",

  // Governance
  "function createProposal(string title, string description, address recipient, uint256 amount) external returns (uint256)",
  "function vote(uint256 proposalId, bool support) external",
  "function executeProposal(uint256 proposalId) external",
  "function cancelProposal(uint256 proposalId) external",
  "function getProposal(uint256 proposalId) external view returns ((uint256 id, address proposer, string title, string description, address recipient, uint256 amount, uint256 votesFor, uint256 votesAgainst, uint256 createdAt, uint256 deadline, uint8 status))",
  "function hasVoted(uint256 proposalId, address voter) external view returns (bool)",
  "function nextProposalId() external view returns (uint256)",

  // Pools & Stats
  "function getPoolBalances() external view returns (uint256 creators, uint256 stakers, uint256 treasury, uint256 totalDistributed)",
  "function getDAOStats() external view returns (uint256 totalStaked, uint256 totalRevenueDistributed, uint256 totalStakerRewardsPaid, uint256 totalCreatorRewardsPaid, uint256 totalProposals, uint256 treasuryBalance)",

  // Split config
  "function creatorShareBps() external view returns (uint256)",
  "function stakerShareBps() external view returns (uint256)",
  "function treasuryShareBps() external view returns (uint256)",
  "function votingPeriod() external view returns (uint256)",
  "function quorumVotes() external view returns (uint256)",

  // Events
  "event RevenueDistributed(uint256 total, uint256 toCreators, uint256 toStakers, uint256 toTreasury)",
  "event INFTStaked(uint256 indexed tokenId, address indexed owner)",
  "event INFTUnstaked(uint256 indexed tokenId, address indexed owner, uint256 rewardsEarned)",
  "event StakerRewardsClaimed(address indexed staker, uint256 amount)",
  "event CreatorRewardsClaimed(address indexed creator, uint256 amount)",
  "event ProposalCreated(uint256 indexed proposalId, address indexed proposer, string title, uint256 amount)",
  "event Voted(uint256 indexed proposalId, address indexed voter, bool support)",
  "event ProposalExecuted(uint256 indexed proposalId, address indexed recipient, uint256 amount)",
  "event ProposalCancelled(uint256 indexed proposalId)",
] as const;

// ============================================================
//  GravitonMultiModal ABI
// ============================================================

export const MULTIMODAL_ABI = [
  // Profile
  "function createProfile(uint256 tokenId) external",
  "function getProfile(uint256 tokenId) external view returns ((uint256 tokenId, uint256 modalityCount, uint256 pipelineStageCount, uint256 totalUsage, uint256 registeredAt, uint256 updatedAt, bool isActive))",
  "function hasProfile(uint256 tokenId) external view returns (bool)",

  // Modality
  "function addModality(uint256 tokenId, uint8 modality, string[] capabilities, string modelReference, string storageRoot, bytes32 weightsHash) external",
  "function updateModality(uint256 tokenId, uint8 modality, string[] capabilities, string modelReference, string storageRoot, bytes32 weightsHash) external",
  "function removeModality(uint256 tokenId, uint8 modality) external",
  "function getModalityConfig(uint256 tokenId, uint8 modality) external view returns ((uint8 modality, bool enabled, string[] capabilities, string modelReference, string storageRoot, bytes32 weightsHash, uint256 addedAt, uint256 updatedAt))",
  "function supportsModality(uint256 tokenId, uint8 modality) external view returns (bool)",
  "function getSupportedModalities(uint256 tokenId) external view returns (bool[5])",
  "function getModalityUsageStats(uint256 tokenId) external view returns (uint256[5])",

  // Pipeline
  "function addPipelineStage(uint256 tokenId, uint8 inputModality, uint8 outputModality, string processorName) external",
  "function getPipelineStage(uint256 tokenId, uint256 stageIndex) external view returns ((uint8 inputModality, uint8 outputModality, string processorName, uint256 orderIndex))",

  // Index & Stats
  "function getAgentsByModality(uint8 modality) external view returns (uint256[])",
  "function totalMultiModalAgents() external view returns (uint256)",
  "function totalModalityRegistrations() external view returns (uint256)",

  // Events
  "event ModalProfileCreated(uint256 indexed tokenId, address indexed owner)",
  "event ModalityAdded(uint256 indexed tokenId, uint8 indexed modality, string modelReference, string[] capabilities)",
  "event ModalityUpdated(uint256 indexed tokenId, uint8 indexed modality, string modelReference)",
  "event ModalityRemoved(uint256 indexed tokenId, uint8 indexed modality)",
  "event PipelineStageAdded(uint256 indexed tokenId, uint256 stageIndex, uint8 inputModality, uint8 outputModality, string processorName)",
  "event ModalityUsageRecorded(uint256 indexed tokenId, uint8 indexed modality, uint256 newCount)",
] as const;
