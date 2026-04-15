/** Mirrors the GravitonRegistry.AgentMeta struct */
export interface AgentMeta {
  name: string;
  description: string;
  modelType: string;
  tags: string[];
  storageHash: string;
  metadataURI: string;
  registeredAt: bigint;
  updatedAt: bigint;
  version: bigint;
}

/** Marketplace listing struct */
export interface Listing {
  seller: `0x${string}`;
  price: bigint;
  category: string;
  isActive: boolean;
  listedAt: bigint;
}

/** Marketplace rental struct */
export interface RentalTerms {
  renter: `0x${string}`;
  pricePerDay: bigint;
  startTime: bigint;
  endTime: bigint;
  isActive: boolean;
}

/** Rating data */
export interface RatingData {
  totalScore: bigint;
  ratingCount: bigint;
}

/** Usage stats */
export interface UsageStats {
  inferenceCount: bigint;
  rentalCount: bigint;
  cloneCount: bigint;
}

/** Hydrated agent card data used across the UI */
export interface AgentCardData {
  tokenId: bigint;
  meta: AgentMeta;
  owner: `0x${string}`;
  creator: `0x${string}`;
  category: string;
  storageRoot: string;
  listing: Listing | null;
  averageRating: number; // 0-5 float
  ratingCount: bigint;
  stats: UsageStats;
}

/** Chat message in test-drive */
export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  verified?: boolean;
}

// ============================================================
//  Memory types (GravitonMemory contract)
// ============================================================

/** On-chain memory snapshot struct */
export interface MemorySnapshot {
  storageRoot: string;
  contentHash: `0x${string}`;
  interactionCount: bigint;
  timestamp: bigint;
  snapshotType: string;
}

/** On-chain agent memory state struct */
export interface AgentMemoryState {
  totalInteractions: bigint;
  totalSnapshots: bigint;
  lastUpdated: bigint;
  latestStorageRoot: string;
  isActive: boolean;
}

/** Memory context used in the UI */
export interface MemoryContext {
  summary: string;
  recentEntries: ChatMessage[];
  preferences: Record<string, string>;
  totalInteractions: number;
  memorySnapshots: number;
}

/** Memory commit result from the API */
export interface MemoryCommitResult {
  status: string;
  storageRoot: string;
  contentHash: string;
  snapshotType: string;
  interactionCount: number;
  totalEntries: number;
  encryptionKey: string;
  txHash: string;
}

// ============================================================
//  Attestation types (GravitonAttestation contract)
// ============================================================

/** TEE attestation receipt */
export interface AttestationReceipt {
  receiptId: number;
  tokenId: string;
  provider: string;
  requester: string;
  requestHash: string;
  responseHash: string;
  chatId: string;
  model: string;
  timestamp: number;
  status: number;
  statusLabel: string;
  inputTokens: number;
  outputTokens: number;
}

/** Agent attestation stats */
export interface AgentAttestationStats {
  totalAttestations: number;
  verifiedCount: number;
  failedCount: number;
  disputedCount: number;
  lastAttestationTime: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  verificationRate: number;
}

/** Attestation submit result from the API */
export interface AttestationSubmitResult {
  receiptId: number;
  txHash: string;
  verified: boolean;
  requestHash: string;
  responseHash: string;
  status: string;
}

// ============================================================
//  Fine-Tuning types (GravitonFineTuning contract)
// ============================================================

/** Fine-tuning training configuration (matches 0G Compute) */
export interface FineTuneConfig {
  neftune_noise_alpha: number;
  num_train_epochs: number;
  per_device_train_batch_size: number;
  learning_rate: number;
  max_steps: number;
}

/** Fine-tuning job state */
export interface FineTuneJob {
  jobId: string;
  tokenId: number;
  baseModel: string;
  status: string;
  progress: number;
  provider: string;
  datasetHash: string;
  datasetStorageRoot: string;
  resultStorageRoot: string;
  resultHash: string;
  onChainJobId: number;
  config: FineTuneConfig;
  datasetSize: number;
  tokenCount: number;
  estimatedFee: string;
  createdAt: number;
  updatedAt: number;
  error?: string;
  logs: string[];
}

/** On-chain fine-tuning stats per agent */
export interface FineTuneStats {
  totalJobs: number;
  completedJobs: number;
  failedJobs: number;
  totalEpochsTrained: number;
  lastFineTunedAt: number;
  currentVersion: number;
}

/** Cost estimate response */
export interface FineTuneCostEstimate {
  model: string;
  datasetSize: number;
  tokenCount: number;
  epochs: number;
  estimatedFee: string;
  currency: string;
}

// ============================================================
//  DAO types (GravitonDAO contract)
// ============================================================

/** Proposal status enum matching Solidity */
export enum ProposalStatus {
  Active = 0,
  Passed = 1,
  Rejected = 2,
  Executed = 3,
  Cancelled = 4,
}

/** Staked INFT info */
export interface DAOStakeInfo {
  owner: `0x${string}`;
  tokenId: bigint;
  stakedAt: bigint;
  lastClaimedAt: bigint;
  isActive: boolean;
}

/** Creator reward tracking */
export interface DAOCreatorRewards {
  totalEarned: bigint;
  pendingRewards: bigint;
  agentCount: bigint;
  totalVolume: bigint;
  lastUpdatedAt: bigint;
}

/** Governance proposal */
export interface DAOProposal {
  id: bigint;
  proposer: `0x${string}`;
  title: string;
  description: string;
  recipient: `0x${string}`;
  amount: bigint;
  votesFor: bigint;
  votesAgainst: bigint;
  createdAt: bigint;
  deadline: bigint;
  status: ProposalStatus;
}

/** Pool balances */
export interface DAOPoolBalances {
  creators: bigint;
  stakers: bigint;
  treasury: bigint;
  totalDistributed: bigint;
}

/** DAO global stats */
export interface DAOStats {
  totalStaked: bigint;
  totalRevenueDistributed: bigint;
  totalStakerRewardsPaid: bigint;
  totalCreatorRewardsPaid: bigint;
  totalProposals: bigint;
  treasuryBalance: bigint;
}

// ============================================================
//  Multi-Modal types (GravitonMultiModal contract)
// ============================================================

/** Modality enum matching Solidity */
export enum Modality {
  Text = 0,
  Image = 1,
  Audio = 2,
  Video = 3,
  Code = 4,
}

/** Modality labels for UI */
export const MODALITY_LABELS: Record<number, string> = {
  0: "Text",
  1: "Image",
  2: "Audio",
  3: "Video",
  4: "Code",
};

/** Modality icons (emoji for simplicity) */
export const MODALITY_ICONS: Record<number, string> = {
  0: "💬",
  1: "🖼️",
  2: "🎵",
  3: "🎬",
  4: "💻",
};

/** Agent modal profile */
export interface AgentModalProfile {
  tokenId: bigint;
  modalityCount: bigint;
  pipelineStageCount: bigint;
  totalUsage: bigint;
  registeredAt: bigint;
  updatedAt: bigint;
  isActive: boolean;
}

/** Modality configuration */
export interface ModalityConfig {
  modality: number;
  enabled: boolean;
  capabilities: string[];
  modelReference: string;
  storageRoot: string;
  weightsHash: `0x${string}`;
  addedAt: bigint;
  updatedAt: bigint;
}

/** Pipeline stage */
export interface PipelineStage {
  inputModality: number;
  outputModality: number;
  processorName: string;
  orderIndex: bigint;
}
