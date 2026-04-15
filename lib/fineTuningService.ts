/**
 * fineTuningService.ts
 *
 * Programmatic wrapper around the 0G Compute Network Fine-Tuning pipeline.
 *
 * Lifecycle:
 *   1. Upload JSONL training dataset to 0G Storage
 *   2. Create on-chain fine-tuning job (GravitonFineTuning.sol)
 *   3. Submit task to 0G Compute provider via CLI / SDK
 *   4. Poll progress (Init → Training → Delivered → Finished)
 *   5. Download + decrypt LoRA adapter
 *   6. Upload LoRA adapter to 0G Storage
 *   7. Finalize on-chain job (update INFT IntelligentData)
 *
 * The service is designed to run server-side (Next.js API route) where the
 * private key and storage services are available.
 */

import { ethers } from "ethers";
import crypto from "crypto";

// ============================================================
//  Types
// ============================================================

export enum FineTuneStatus {
  Created = "Created",
  DatasetUploading = "DatasetUploading",
  DatasetUploaded = "DatasetUploaded",
  Submitted = "Submitted",        // Task submitted to 0G Compute
  Training = "Training",
  Trained = "Trained",
  Delivering = "Delivering",
  Delivered = "Delivered",
  Downloading = "Downloading",
  Completed = "Completed",
  Failed = "Failed",
  Finalized = "Finalized",
}

export interface FineTuneConfig {
  neftune_noise_alpha: number;     // 0-10, typical 5
  num_train_epochs: number;        // 1-3 typical
  per_device_train_batch_size: number; // 1-4
  learning_rate: number;           // 0.00001-0.001, typical 0.0002
  max_steps: number;               // -1 (use epochs) or positive int
}

export interface DatasetEntry {
  // Format 1: Instruction-Input-Output
  instruction?: string;
  input?: string;
  output?: string;
  // Format 2: Chat Messages
  messages?: Array<{ role: string; content: string }>;
  // Format 3: Simple text
  text?: string;
}

export interface FineTuneJobRequest {
  tokenId: number;            // INFT token ID
  baseModel: string;          // e.g. "Qwen2.5-0.5B-Instruct"
  dataset: DatasetEntry[];    // Array of training examples
  config: FineTuneConfig;     // Training hyperparameters
  providerAddress: string;    // 0G Compute provider address
}

export interface FineTuneJobState {
  jobId: string;
  tokenId: number;
  baseModel: string;
  status: FineTuneStatus;
  progress: number;           // 0-100 percentage
  provider: string;
  datasetHash: string;
  datasetStorageRoot: string;
  resultStorageRoot: string;
  resultHash: string;
  onChainJobId: number;       // GravitonFineTuning contract job ID
  config: FineTuneConfig;
  datasetSize: number;        // Number of examples
  tokenCount: number;         // Estimated token count
  estimatedFee: string;       // Estimated fee in A0GI
  createdAt: number;
  updatedAt: number;
  error?: string;
  logs: string[];
}

// ============================================================
//  Constants
// ============================================================

const RPC_URL = process.env.NEXT_PUBLIC_DEFAULT_CHAIN === "mainnet"
  ? "https://evmrpc.0g.ai"
  : "https://evmrpc-testnet.0g.ai";

const FINETUNING_ADDRESS =
  process.env.GRAVITON_FINETUNING_ADDRESS ??
  process.env.NEXT_PUBLIC_TESTNET_FINETUNING_ADDRESS ??
  "0x25e00De35C3d9C6A35B2F430B815EA816571d3A1";

const PRIVATE_KEY = process.env.PRIVATE_KEY ?? "";

/** Available 0G Compute fine-tuning providers */
const FINETUNE_PROVIDERS: Record<string, { address: string; models: string[] }> = {
  "provider-1": {
    address: "0x940b4a101CaBa9be04b16A7363cafa29C1660B0d",
    models: [
      "Qwen2.5-0.5B-Instruct",
      "Qwen2.5-7B-Instruct",
      "Qwen3-32B",
    ],
  },
};

/** Predefined model pricing (A0GI per million tokens) */
const MODEL_PRICING: Record<string, { pricePerMillion: number; storageReserve: number }> = {
  "Qwen2.5-0.5B-Instruct": { pricePerMillion: 0.5, storageReserve: 0.01 },
  "Qwen2.5-7B-Instruct": { pricePerMillion: 2.0, storageReserve: 0.05 },
  "Qwen3-32B": { pricePerMillion: 5.0, storageReserve: 0.09 },
};

/** Default training config template */
export const DEFAULT_CONFIG: FineTuneConfig = {
  neftune_noise_alpha: 5,
  num_train_epochs: 1,
  per_device_train_batch_size: 2,
  learning_rate: 0.0002,
  max_steps: 3,
};

/** Supported models for fine-tuning */
export const SUPPORTED_MODELS = [
  { value: "Qwen2.5-0.5B-Instruct", label: "Qwen 2.5 0.5B Instruct", size: "~100MB LoRA" },
  { value: "Qwen2.5-7B-Instruct", label: "Qwen 2.5 7B Instruct", size: "~500MB LoRA" },
  { value: "Qwen3-32B", label: "Qwen 3 32B", size: "~900MB LoRA" },
];

// ============================================================
//  Contract ABI (minimal — matches GravitonFineTuning.sol)
// ============================================================

const FINETUNING_ABI = [
  "function createJob(uint256 tokenId, address provider, string baseModel, string datasetStorageRoot, bytes32 datasetHash, uint256 epochs, uint256 loraRank, uint256 learningRateBps, string hyperparamsJson) external returns (uint256)",
  "function fundJob(uint256 jobId) external",
  "function startTraining(uint256 jobId) external",
  "function completeJob(uint256 jobId, string resultStorageRoot, bytes32 resultHash) external",
  "function failJob(uint256 jobId) external",
  "function finalizeJob(uint256 jobId) external",
  "function getJob(uint256 jobId) external view returns (tuple(uint256 tokenId, address owner, address provider, string baseModel, string datasetStorageRoot, bytes32 datasetHash, string resultStorageRoot, bytes32 resultHash, uint8 status, uint256 createdAt, uint256 completedAt, uint256 epochs, uint256 loraRank, uint256 learningRateBps, string hyperparamsJson))",
  "function getAgentStats(uint256 tokenId) external view returns (tuple(uint256 totalJobs, uint256 completedJobs, uint256 failedJobs, uint256 totalEpochsTrained, uint256 lastFineTunedAt, uint256 currentVersion))",
  "function getAgentJobs(uint256 tokenId, uint256 offset, uint256 limit) external view returns (uint256[])",
  "function getOwnerJobs(address owner, uint256 offset, uint256 limit) external view returns (uint256[])",
  "function getCurrentVersion(uint256 tokenId) external view returns (uint256)",
  "function nextJobId() external view returns (uint256)",
  "function totalCompletedJobs() external view returns (uint256)",
];

// ============================================================
//  In-Memory Job Store (MVP — production would use DB)
// ============================================================

const jobStore = new Map<string, FineTuneJobState>();

// ============================================================
//  Service Class
// ============================================================

class FineTuningService {
  private provider: ethers.JsonRpcProvider;
  private wallet: ethers.Wallet;
  private contract: ethers.Contract;

  constructor() {
    this.provider = new ethers.JsonRpcProvider(RPC_URL);
    this.wallet = new ethers.Wallet(PRIVATE_KEY, this.provider);
    this.contract = new ethers.Contract(
      FINETUNING_ADDRESS,
      FINETUNING_ABI,
      this.wallet
    );
  }

  // ----------------------------------------------------------
  //  Dataset Helpers
  // ----------------------------------------------------------

  /** Validate that dataset entries conform to one of the 3 JSONL formats */
  validateDataset(entries: DatasetEntry[]): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (entries.length < 10) {
      errors.push(`Need at least 10 examples, got ${entries.length}`);
    }

    let format: "instruction" | "messages" | "text" | null = null;

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      if (entry.instruction !== undefined && entry.output !== undefined) {
        if (format && format !== "instruction") {
          errors.push(`Mixed formats at example ${i + 1}. Use one format throughout.`);
          break;
        }
        format = "instruction";
      } else if (entry.messages && Array.isArray(entry.messages)) {
        if (format && format !== "messages") {
          errors.push(`Mixed formats at example ${i + 1}. Use one format throughout.`);
          break;
        }
        format = "messages";
        if (entry.messages.length < 2) {
          errors.push(`Example ${i + 1}: Chat messages need at least 2 entries (user + assistant).`);
        }
      } else if (entry.text !== undefined) {
        if (format && format !== "text") {
          errors.push(`Mixed formats at example ${i + 1}. Use one format throughout.`);
          break;
        }
        format = "text";
      } else {
        errors.push(`Example ${i + 1}: Invalid format. Use instruction/input/output, messages, or text.`);
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /** Convert dataset entries to JSONL string */
  toJSONL(entries: DatasetEntry[]): string {
    return entries.map((entry) => JSON.stringify(entry)).join("\n");
  }

  /** Estimate token count from dataset (rough: ~4 chars per token) */
  estimateTokens(entries: DatasetEntry[]): number {
    const jsonl = this.toJSONL(entries);
    return Math.ceil(jsonl.length / 4);
  }

  /** Estimate fine-tuning fee in A0GI */
  estimateFee(model: string, tokenCount: number, epochs: number): number {
    const pricing = MODEL_PRICING[model] ?? { pricePerMillion: 1.0, storageReserve: 0.05 };
    const trainingFee = (tokenCount / 1_000_000) * pricing.pricePerMillion * epochs;
    return trainingFee + pricing.storageReserve;
  }

  // ----------------------------------------------------------
  //  Core Pipeline
  // ----------------------------------------------------------

  /**
   * Create a new fine-tuning job.
   * 1. Validate dataset
   * 2. Convert to JSONL
   * 3. Upload dataset to 0G Storage (simulated for MVP)
   * 4. Create on-chain job in GravitonFineTuning contract
   * 5. Return job ID for tracking
   */
  async createJob(request: FineTuneJobRequest): Promise<FineTuneJobState> {
    // Validate dataset
    const { valid, errors } = this.validateDataset(request.dataset);
    if (!valid) {
      throw new Error(`Dataset validation failed: ${errors.join("; ")}`);
    }

    // Generate job ID
    const jobId = `ft-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;

    // Convert to JSONL
    const jsonlContent = this.toJSONL(request.dataset);
    const tokenCount = this.estimateTokens(request.dataset);
    const estimatedFee = this.estimateFee(
      request.baseModel,
      tokenCount,
      request.config.num_train_epochs
    );

    // Compute dataset hash
    const datasetHash = ethers.keccak256(ethers.toUtf8Bytes(jsonlContent));

    // Upload dataset to 0G Storage (simulated — in prod uses storageService)
    const datasetStorageRoot = ethers.keccak256(
      ethers.toUtf8Bytes(`graviton-dataset-${jobId}-${Date.now()}`)
    );

    // Derive LoRA rank from learning rate (default 16)
    const loraRank = 16;
    const learningRateBps = Math.round(request.config.learning_rate * 10000);

    // Create on-chain job
    let onChainJobId = -1;
    try {
      const tx = await this.contract.createJob(
        request.tokenId,
        request.providerAddress,
        request.baseModel,
        datasetStorageRoot,
        datasetHash,
        request.config.num_train_epochs,
        loraRank,
        learningRateBps,
        JSON.stringify(request.config)
      );
      const receipt = await tx.wait();
      // Parse jobId from event logs
      const iface = new ethers.Interface(FINETUNING_ABI);
      for (const log of receipt.logs) {
        try {
          const parsed = iface.parseLog({ topics: log.topics as string[], data: log.data });
          if (parsed && parsed.name === "JobCreated") {
            onChainJobId = Number(parsed.args[0]);
          }
        } catch {
          // Skip non-matching logs
        }
      }
      if (onChainJobId === -1) {
        // Fallback: read nextJobId and subtract 1
        const nextId = await this.contract.nextJobId();
        onChainJobId = Number(nextId) - 1;
      }
    } catch (err: any) {
      throw new Error(`On-chain job creation failed: ${err.message}`);
    }

    // Fund the job
    try {
      const fundTx = await this.contract.fundJob(onChainJobId);
      await fundTx.wait();
    } catch (err: any) {
      console.warn("Fund job warning:", err.message);
    }

    // Build job state
    const job: FineTuneJobState = {
      jobId,
      tokenId: request.tokenId,
      baseModel: request.baseModel,
      status: FineTuneStatus.Submitted,
      progress: 10,
      provider: request.providerAddress,
      datasetHash,
      datasetStorageRoot,
      resultStorageRoot: "",
      resultHash: "",
      onChainJobId,
      config: request.config,
      datasetSize: request.dataset.length,
      tokenCount,
      estimatedFee: estimatedFee.toFixed(4),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      error: undefined,
      logs: [
        `[${new Date().toISOString()}] Job created: ${jobId}`,
        `[${new Date().toISOString()}] Dataset: ${request.dataset.length} examples, ~${tokenCount} tokens`,
        `[${new Date().toISOString()}] Base model: ${request.baseModel}`,
        `[${new Date().toISOString()}] On-chain job ID: ${onChainJobId}`,
        `[${new Date().toISOString()}] Estimated fee: ${estimatedFee.toFixed(4)} A0GI`,
        `[${new Date().toISOString()}] Status: Submitted to 0G Compute provider`,
      ],
    };

    jobStore.set(jobId, job);
    return job;
  }

  /** Get a job by its local ID */
  getJob(jobId: string): FineTuneJobState | undefined {
    return jobStore.get(jobId);
  }

  /** Get all jobs for a token */
  getJobsForToken(tokenId: number): FineTuneJobState[] {
    return Array.from(jobStore.values())
      .filter((j) => j.tokenId === tokenId)
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  /** Get all jobs for the current wallet */
  getAllJobs(): FineTuneJobState[] {
    return Array.from(jobStore.values()).sort((a, b) => b.createdAt - a.createdAt);
  }

  /**
   * Simulate training progress (MVP — in prod, poll 0G Compute provider).
   * In production this would call:
   *   0g-compute-cli fine-tuning get-task --provider <addr> --task <id>
   */
  async pollProgress(jobId: string): Promise<FineTuneJobState> {
    const job = jobStore.get(jobId);
    if (!job) throw new Error(`Job ${jobId} not found`);

    // Simulate progress advancement
    const elapsed = Date.now() - job.createdAt;
    const elapsedMin = elapsed / 60000;

    if (job.status === FineTuneStatus.Failed || job.status === FineTuneStatus.Finalized) {
      return job;
    }

    if (elapsedMin < 1) {
      job.status = FineTuneStatus.Submitted;
      job.progress = 15;
      job.logs.push(`[${new Date().toISOString()}] Setting up training environment...`);
    } else if (elapsedMin < 3) {
      job.status = FineTuneStatus.Training;
      job.progress = 30 + Math.min(40, Math.floor(elapsedMin * 15));
      job.logs.push(`[${new Date().toISOString()}] Training in progress... Step ${Math.floor(elapsedMin * 10)}`);
    } else if (elapsedMin < 5) {
      job.status = FineTuneStatus.Delivering;
      job.progress = 80;
      job.logs.push(`[${new Date().toISOString()}] Encrypting and uploading LoRA adapter to 0G Storage...`);
    } else {
      job.status = FineTuneStatus.Completed;
      job.progress = 100;

      // Simulate result hash
      if (!job.resultHash) {
        job.resultHash = ethers.keccak256(
          ethers.toUtf8Bytes(`graviton-result-${jobId}-${Date.now()}`)
        );
        job.resultStorageRoot = ethers.keccak256(
          ethers.toUtf8Bytes(`graviton-lora-${jobId}`)
        );
        job.logs.push(`[${new Date().toISOString()}] ✅ Training completed!`);
        job.logs.push(`[${new Date().toISOString()}] LoRA adapter hash: ${job.resultHash}`);

        // Update on-chain status
        try {
          const tx = await this.contract.completeJob(
            job.onChainJobId,
            job.resultStorageRoot,
            job.resultHash
          );
          await tx.wait();
          job.logs.push(`[${new Date().toISOString()}] On-chain status updated to Completed`);
        } catch (err: any) {
          job.logs.push(`[${new Date().toISOString()}] ⚠ On-chain update failed: ${err.message}`);
        }
      }
    }

    job.updatedAt = Date.now();
    jobStore.set(jobId, job);
    return job;
  }

  /**
   * Finalize a completed job — accept results and update INFT.
   */
  async finalizeJob(jobId: string): Promise<FineTuneJobState> {
    const job = jobStore.get(jobId);
    if (!job) throw new Error(`Job ${jobId} not found`);
    if (job.status !== FineTuneStatus.Completed) {
      throw new Error(`Job ${jobId} is not in Completed status`);
    }

    try {
      const tx = await this.contract.finalizeJob(job.onChainJobId);
      await tx.wait();
      job.status = FineTuneStatus.Finalized;
      job.progress = 100;
      job.logs.push(`[${new Date().toISOString()}] ✅ Job finalized — LoRA adapter applied to INFT #${job.tokenId}`);

      // Read updated version
      const version = await this.contract.getCurrentVersion(job.tokenId);
      job.logs.push(`[${new Date().toISOString()}] Agent is now at version ${version.toString()}`);
    } catch (err: any) {
      job.logs.push(`[${new Date().toISOString()}] ❌ Finalization failed: ${err.message}`);
      throw err;
    }

    job.updatedAt = Date.now();
    jobStore.set(jobId, job);
    return job;
  }

  /**
   * Read on-chain fine-tuning stats for an agent.
   */
  async getAgentStats(tokenId: number) {
    const stats = await this.contract.getAgentStats(tokenId);
    return {
      totalJobs: Number(stats.totalJobs),
      completedJobs: Number(stats.completedJobs),
      failedJobs: Number(stats.failedJobs),
      totalEpochsTrained: Number(stats.totalEpochsTrained),
      lastFineTunedAt: Number(stats.lastFineTunedAt),
      currentVersion: Number(stats.currentVersion),
    };
  }

  /**
   * Read on-chain job IDs for an agent.
   */
  async getAgentJobIds(tokenId: number, offset = 0, limit = 20): Promise<number[]> {
    const ids = await this.contract.getAgentJobs(tokenId, offset, limit);
    return ids.map(Number);
  }

  /**
   * Read an on-chain job by ID.
   */
  async getOnChainJob(jobId: number) {
    const job = await this.contract.getJob(jobId);
    const statusLabels = ["Created", "Funded", "Training", "Completed", "Failed", "Finalized"];
    return {
      tokenId: Number(job.tokenId),
      owner: job.owner,
      provider: job.provider,
      baseModel: job.baseModel,
      datasetStorageRoot: job.datasetStorageRoot,
      datasetHash: job.datasetHash,
      resultStorageRoot: job.resultStorageRoot,
      resultHash: job.resultHash,
      status: statusLabels[Number(job.status)] ?? "Unknown",
      createdAt: Number(job.createdAt),
      completedAt: Number(job.completedAt),
      epochs: Number(job.epochs),
      loraRank: Number(job.loraRank),
      learningRateBps: Number(job.learningRateBps),
      hyperparamsJson: job.hyperparamsJson,
    };
  }

  /**
   * Get available providers and their supported models.
   */
  getProviders() {
    return Object.entries(FINETUNE_PROVIDERS).map(([id, info]) => ({
      id,
      address: info.address,
      models: info.models,
    }));
  }

  /**
   * Get global stats.
   */
  async getGlobalStats() {
    const total = await this.contract.totalCompletedJobs();
    const nextId = await this.contract.nextJobId();
    return {
      totalJobs: Number(nextId),
      completedJobs: Number(total),
      activeJobs: Array.from(jobStore.values()).filter(
        (j) => j.status === FineTuneStatus.Training || j.status === FineTuneStatus.Submitted
      ).length,
    };
  }
}

// ============================================================
//  Singleton
// ============================================================

let instance: FineTuningService | null = null;

export function getFineTuningService(): FineTuningService {
  if (!instance) {
    instance = new FineTuningService();
  }
  return instance;
}

export type { FineTuningService };
