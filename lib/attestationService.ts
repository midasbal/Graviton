/**
 * Graviton — TEE Attestation Service
 *
 * Manages the full lifecycle of TEE attestation proofs:
 *   1. After each inference, verifies the response via 0G Compute SDK
 *   2. Submits attestation receipts to GravitonAttestation contract
 *   3. Provides verification status lookups for the frontend
 *   4. Tracks provider reputation across sessions
 *
 * The attestation flow proves that inference happened inside a
 * Trusted Execution Environment (TEE) using the correct model weights,
 * without exposing those weights to the user or provider operator.
 *
 * 0G Components Used:
 *   - 0G Compute SDK (broker.inference.processResponse for TEE verification)
 *   - 0G Chain (GravitonAttestation contract for on-chain anchoring)
 */

import { ethers } from "ethers";
import dotenv from "dotenv";

dotenv.config();

// ============================================================
//                         TYPES
// ============================================================

/** Input data to create an attestation */
export interface AttestationInput {
  tokenId: string;          // Agent INFT token ID
  provider: string;         // 0G Compute provider address
  requester: string;        // User wallet address
  requestContent: string;   // Raw request prompt
  responseContent: string;  // Raw response content
  chatId: string;           // 0G Compute chat ID
  model: string;            // Model name
  verified: boolean;        // Whether SDK verified the TEE proof
  inputTokens: number;      // Input token count
  outputTokens: number;     // Output token count
}

/** On-chain attestation receipt (mirrors contract struct) */
export interface AttestationReceipt {
  tokenId: bigint;
  provider: string;
  requester: string;
  requestHash: string;
  responseHash: string;
  chatId: string;
  model: string;
  timestamp: bigint;
  status: number;          // 0=Unverified, 1=Verified, 2=Failed, 3=Disputed
  inputTokens: bigint;
  outputTokens: bigint;
}

/** Agent attestation statistics */
export interface AgentAttestationStats {
  totalAttestations: bigint;
  verifiedCount: bigint;
  failedCount: bigint;
  disputedCount: bigint;
  lastAttestationTime: bigint;
  totalInputTokens: bigint;
  totalOutputTokens: bigint;
}

/** Provider reputation */
export interface ProviderReputation {
  totalServiced: bigint;
  verifiedCount: bigint;
  failedCount: bigint;
  firstSeen: bigint;
  lastSeen: bigint;
  isActive: boolean;
}

/** Attestation submission result */
export interface AttestationResult {
  receiptId: number;
  txHash: string;
  verified: boolean;
  requestHash: string;
  responseHash: string;
}

/** Verification status string */
export type VerificationStatusLabel = "Unverified" | "Verified" | "Failed" | "Disputed";

// ============================================================
//                        CONSTANTS
// ============================================================

const STATUS_LABELS: VerificationStatusLabel[] = [
  "Unverified",
  "Verified",
  "Failed",
  "Disputed",
];

/** GravitonAttestation ABI (minimal for service operations) */
const ATTESTATION_CONTRACT_ABI = [
  "function submitAttestation(uint256 tokenId, address provider, address requester, bytes32 requestHash, bytes32 responseHash, string chatId, string model, bool verified, uint256 inputTokens, uint256 outputTokens) external",
  "function updateVerificationStatus(uint256 receiptId, uint8 newStatus) external",
  "function getReceipt(uint256 receiptId) external view returns (tuple(uint256 tokenId, address provider, address requester, bytes32 requestHash, bytes32 responseHash, string chatId, string model, uint256 timestamp, uint8 status, uint256 inputTokens, uint256 outputTokens))",
  "function getAgentStats(uint256 tokenId) external view returns (tuple(uint256 totalAttestations, uint256 verifiedCount, uint256 failedCount, uint256 disputedCount, uint256 lastAttestationTime, uint256 totalInputTokens, uint256 totalOutputTokens))",
  "function getAgentAttestations(uint256 tokenId, uint256 offset, uint256 limit) external view returns (uint256[])",
  "function getUserAttestations(address user, uint256 offset, uint256 limit) external view returns (uint256[])",
  "function getVerificationRate(uint256 tokenId) external view returns (uint256)",
  "function getProviderReputation(address provider) external view returns (tuple(uint256 totalServiced, uint256 verifiedCount, uint256 failedCount, uint256 firstSeen, uint256 lastSeen, bool isActive))",
  "function hasVerifiedAttestations(uint256 tokenId) external view returns (bool)",
  "function totalAttestations() external view returns (uint256)",
  "function totalVerified() external view returns (uint256)",
  "function nextReceiptId() external view returns (uint256)",
];

// ============================================================
//                   ATTESTATION SERVICE
// ============================================================

export class AttestationService {
  private wallet: ethers.Wallet;
  private contract: ethers.Contract;

  constructor(overrides?: {
    network?: "testnet" | "mainnet";
    privateKey?: string;
    contractAddress?: string;
  }) {
    const network = overrides?.network || (process.env.NETWORK as "testnet" | "mainnet") || "testnet";
    const privateKey = overrides?.privateKey || process.env.PRIVATE_KEY || "";
    const contractAddress = overrides?.contractAddress ||
      process.env.GRAVITON_ATTESTATION_ADDRESS || "";

    if (!privateKey) {
      throw new Error("AttestationService: PRIVATE_KEY required");
    }

    const rpcUrl = network === "mainnet"
      ? "https://evmrpc.0g.ai"
      : "https://evmrpc-testnet.0g.ai";

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    this.wallet = new ethers.Wallet(privateKey, provider);

    this.contract = new ethers.Contract(
      contractAddress,
      ATTESTATION_CONTRACT_ABI,
      this.wallet
    );

    console.log(`[AttestationService] Initialized — network=${network}, contract=${contractAddress}`);
  }

  // ============================================================
  //                 ATTESTATION SUBMISSION
  // ============================================================

  /**
   * Submit a TEE attestation receipt after an inference session.
   *
   * Flow:
   *   1. Hash the request and response content
   *   2. Call GravitonAttestation.submitAttestation() on-chain
   *   3. Return the receipt ID and transaction hash
   */
  async submitAttestation(input: AttestationInput): Promise<AttestationResult> {
    console.log(`[AttestationService] Submitting attestation for agent #${input.tokenId}`);
    console.log(`[AttestationService] Provider: ${input.provider}, ChatID: ${input.chatId}, Verified: ${input.verified}`);

    const requestHash = ethers.keccak256(ethers.toUtf8Bytes(input.requestContent));
    const responseHash = ethers.keccak256(ethers.toUtf8Bytes(input.responseContent));

    const tx = await this.contract.submitAttestation(
      BigInt(input.tokenId),
      input.provider,
      input.requester,
      requestHash,
      responseHash,
      input.chatId,
      input.model,
      input.verified,
      BigInt(input.inputTokens),
      BigInt(input.outputTokens)
    );

    const receipt = await tx.wait();

    // Get the receipt ID (nextReceiptId - 1 after submission)
    const nextId = await this.contract.nextReceiptId();
    const receiptId = Number(nextId) - 1;

    console.log(`[AttestationService] Attestation submitted — receiptId=${receiptId}, tx=${receipt.hash}`);

    return {
      receiptId,
      txHash: receipt.hash,
      verified: input.verified,
      requestHash,
      responseHash,
    };
  }

  // ============================================================
  //                   READ OPERATIONS
  // ============================================================

  /**
   * Get a specific attestation receipt.
   */
  async getReceipt(receiptId: number): Promise<AttestationReceipt> {
    const r = await this.contract.getReceipt(BigInt(receiptId));
    return {
      tokenId: r.tokenId,
      provider: r.provider,
      requester: r.requester,
      requestHash: r.requestHash,
      responseHash: r.responseHash,
      chatId: r.chatId,
      model: r.model,
      timestamp: r.timestamp,
      status: Number(r.status),
      inputTokens: r.inputTokens,
      outputTokens: r.outputTokens,
    };
  }

  /**
   * Get attestation stats for an agent.
   */
  async getAgentStats(tokenId: string): Promise<AgentAttestationStats> {
    const s = await this.contract.getAgentStats(BigInt(tokenId));
    return {
      totalAttestations: s.totalAttestations,
      verifiedCount: s.verifiedCount,
      failedCount: s.failedCount,
      disputedCount: s.disputedCount,
      lastAttestationTime: s.lastAttestationTime,
      totalInputTokens: s.totalInputTokens,
      totalOutputTokens: s.totalOutputTokens,
    };
  }

  /**
   * Get the verification rate for an agent (0-10000 basis points).
   */
  async getVerificationRate(tokenId: string): Promise<number> {
    const rate = await this.contract.getVerificationRate(BigInt(tokenId));
    return Number(rate);
  }

  /**
   * Check if an agent has any verified attestations.
   */
  async hasVerifiedAttestations(tokenId: string): Promise<boolean> {
    return await this.contract.hasVerifiedAttestations(BigInt(tokenId));
  }

  /**
   * Get provider reputation.
   */
  async getProviderReputation(provider: string): Promise<ProviderReputation> {
    const r = await this.contract.getProviderReputation(provider);
    return {
      totalServiced: r.totalServiced,
      verifiedCount: r.verifiedCount,
      failedCount: r.failedCount,
      firstSeen: r.firstSeen,
      lastSeen: r.lastSeen,
      isActive: r.isActive,
    };
  }

  /**
   * Get recent attestation IDs for an agent.
   */
  async getAgentAttestationIds(tokenId: string, offset = 0, limit = 20): Promise<number[]> {
    const ids = await this.contract.getAgentAttestations(BigInt(tokenId), BigInt(offset), BigInt(limit));
    return ids.map((id: bigint) => Number(id));
  }

  /**
   * Get global attestation counters.
   */
  async getGlobalStats(): Promise<{ total: number; verified: number }> {
    const [total, verified] = await Promise.all([
      this.contract.totalAttestations(),
      this.contract.totalVerified(),
    ]);
    return {
      total: Number(total),
      verified: Number(verified),
    };
  }

  // ============================================================
  //                      HELPERS
  // ============================================================

  /**
   * Convert numeric status to human-readable label.
   */
  static statusLabel(status: number): VerificationStatusLabel {
    return STATUS_LABELS[status] || "Unverified";
  }
}

// ============================================================
//                    SINGLETON EXPORT
// ============================================================

let _instance: AttestationService | null = null;

export function getAttestationService(overrides?: {
  network?: "testnet" | "mainnet";
  privateKey?: string;
  contractAddress?: string;
}): AttestationService {
  if (!_instance || overrides) {
    _instance = new AttestationService(overrides);
  }
  return _instance;
}

export default AttestationService;
