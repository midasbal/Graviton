/**
 * Graviton — Agent Memory Service
 *
 * Provides persistent, decentralized memory for AI agents using 0G Storage.
 * Each agent accumulates memory from conversations, which is:
 *   1. Summarized into a compact memory blob
 *   2. Encrypted and uploaded to 0G Storage
 *   3. Anchored on-chain via GravitonMemory contract
 *   4. Retrieved and injected into future conversations
 *
 * This creates evolving AI agents whose memory is verifiable on-chain
 * and stored permanently on 0G's decentralized storage.
 *
 * 0G Components Used:
 *   - 0G Storage (persistent memory blobs)
 *   - 0G Chain (memory anchor / proof of evolution)
 *   - 0G Compute (optional: summarization via inference)
 */

import { ethers } from "ethers";
import { StorageService, getStorageService, type EncryptedUploadResult } from "./storageService";
import dotenv from "dotenv";

dotenv.config();

// ============================================================
//                         TYPES
// ============================================================

/** A single conversation turn stored in memory */
export interface MemoryEntry {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  verified?: boolean;
}

/** A memory snapshot ready for storage */
export interface MemoryBlob {
  agentId: string;           // Token ID
  sessionId: string;         // Session identifier
  entries: MemoryEntry[];    // Conversation entries
  summary?: string;          // AI-generated summary of the conversation
  preferences?: Record<string, string>;  // Learned preferences
  context?: string;          // Accumulated context
  interactionCount: number;  // Number of interactions in this session
  createdAt: number;         // Timestamp
}

/** On-chain memory state mirroring GravitonMemory.AgentMemoryState */
export interface OnChainMemoryState {
  totalInteractions: bigint;
  totalSnapshots: bigint;
  lastUpdated: bigint;
  latestStorageRoot: string;
  isActive: boolean;
}

/** Result from committing memory on-chain */
export interface MemoryCommitResult {
  storageRoot: string;       // 0G Storage Merkle root
  contentHash: string;       // keccak256 of memory content
  txHash: string;            // On-chain commit transaction hash
  snapshotIndex: number;     // Index in on-chain snapshot array
  encryptionKey: string;     // Key needed to decrypt (owner-only)
}

/** Memory context injected into inference prompts */
export interface MemoryContext {
  summary: string;           // Aggregated summary of past interactions
  recentEntries: MemoryEntry[];  // Most recent conversation entries
  preferences: Record<string, string>;  // Learned preferences
  totalInteractions: number; // Lifetime interaction count
  memorySnapshots: number;   // Number of memory snapshots
}

// ============================================================
//                        CONSTANTS
// ============================================================

/** Maximum entries to keep in a single memory blob before summarizing */
const MAX_ENTRIES_PER_BLOB = 50;

/** Maximum recent entries to inject into context */
const MAX_CONTEXT_ENTRIES = 10;

/** GravitonMemory ABI (minimal for service operations) */
const MEMORY_CONTRACT_ABI = [
  "function initializeMemory(uint256 tokenId) external",
  "function commitMemorySnapshot(uint256 tokenId, string storageRoot, bytes32 contentHash, uint256 interactionCount, string snapshotType) external",
  "function recordInteraction(uint256 tokenId) external",
  "function getMemoryState(uint256 tokenId) external view returns (tuple(uint256 totalInteractions, uint256 totalSnapshots, uint256 lastUpdated, string latestStorageRoot, bool isActive))",
  "function getLatestSnapshot(uint256 tokenId) external view returns (tuple(string storageRoot, bytes32 contentHash, uint256 interactionCount, uint256 timestamp, string snapshotType))",
  "function getSnapshotHistory(uint256 tokenId, uint256 offset, uint256 limit) external view returns (tuple(string storageRoot, bytes32 contentHash, uint256 interactionCount, uint256 timestamp, string snapshotType)[])",
  "function isMemoryActive(uint256 tokenId) external view returns (bool)",
  "function getTotalInteractions(uint256 tokenId) external view returns (uint256)",
  "function totalMemoryOps() external view returns (uint256)",
];

// ============================================================
//                     MEMORY SERVICE
// ============================================================

export class MemoryService {
  private storage: StorageService;
  private wallet: ethers.Wallet;
  private memoryContract: ethers.Contract;
  private rpcUrl: string;

  /** In-memory session cache (conversation history per agent per session) */
  private sessionCache: Map<string, MemoryBlob> = new Map();

  constructor(overrides?: {
    network?: "testnet" | "mainnet";
    privateKey?: string;
    memoryContractAddress?: string;
  }) {
    const network = overrides?.network || (process.env.NETWORK as "testnet" | "mainnet") || "testnet";
    const privateKey = overrides?.privateKey || process.env.PRIVATE_KEY || "";
    const contractAddress = overrides?.memoryContractAddress ||
      process.env.GRAVITON_MEMORY_ADDRESS || "";

    if (!privateKey) {
      throw new Error("MemoryService: PRIVATE_KEY required");
    }

    this.rpcUrl = network === "mainnet"
      ? "https://evmrpc.0g.ai"
      : "https://evmrpc-testnet.0g.ai";

    const provider = new ethers.JsonRpcProvider(this.rpcUrl);
    this.wallet = new ethers.Wallet(privateKey, provider);

    this.storage = getStorageService({ network, privateKey });

    this.memoryContract = new ethers.Contract(
      contractAddress,
      MEMORY_CONTRACT_ABI,
      this.wallet
    );

    console.log(`[MemoryService] Initialized — network=${network}, contract=${contractAddress}`);
  }

  // ============================================================
  //                    SESSION MANAGEMENT
  // ============================================================

  /**
   * Get or create a session cache key.
   */
  private sessionKey(agentId: string, sessionId: string): string {
    return `${agentId}:${sessionId}`;
  }

  /**
   * Start or resume a memory session for an agent.
   * Loads existing memory context from 0G Storage if available.
   */
  async startSession(agentId: string, sessionId: string): Promise<MemoryBlob> {
    const key = this.sessionKey(agentId, sessionId);

    // Check cache first
    if (this.sessionCache.has(key)) {
      return this.sessionCache.get(key)!;
    }

    // Create new session
    const blob: MemoryBlob = {
      agentId,
      sessionId,
      entries: [],
      preferences: {},
      interactionCount: 0,
      createdAt: Date.now(),
    };

    this.sessionCache.set(key, blob);
    return blob;
  }

  /**
   * Add a conversation entry to the session.
   */
  addEntry(
    agentId: string,
    sessionId: string,
    entry: MemoryEntry
  ): void {
    const key = this.sessionKey(agentId, sessionId);
    let blob = this.sessionCache.get(key);

    if (!blob) {
      blob = {
        agentId,
        sessionId,
        entries: [],
        preferences: {},
        interactionCount: 0,
        createdAt: Date.now(),
      };
      this.sessionCache.set(key, blob);
    }

    blob.entries.push(entry);
    if (entry.role === "user") {
      blob.interactionCount++;
    }
  }

  /**
   * Get the current session state.
   */
  getSessionState(agentId: string, sessionId: string): MemoryBlob | undefined {
    return this.sessionCache.get(this.sessionKey(agentId, sessionId));
  }

  // ============================================================
  //                   MEMORY PERSISTENCE
  // ============================================================

  /**
   * Commit session memory to 0G Storage and anchor on-chain.
   *
   * Full flow:
   *   1. Serialize memory blob to JSON
   *   2. Encrypt and upload to 0G Storage
   *   3. Call GravitonMemory.commitMemorySnapshot() on-chain
   *   4. Return commit result with storage root and encryption key
   */
  async commitMemory(
    agentId: string,
    sessionId: string,
    snapshotType: string = "conversation"
  ): Promise<MemoryCommitResult> {
    const key = this.sessionKey(agentId, sessionId);
    const blob = this.sessionCache.get(key);

    if (!blob || blob.entries.length === 0) {
      throw new Error("MemoryService: No session data to commit");
    }

    console.log(`[MemoryService] Committing memory for agent #${agentId}, session=${sessionId}`);
    console.log(`[MemoryService] Entries: ${blob.entries.length}, Interactions: ${blob.interactionCount}`);

    // Step 1: Generate summary (simple extractive for now)
    blob.summary = this.generateSummary(blob);

    // Step 2: Serialize and encrypt
    const memoryJson = JSON.stringify(blob, null, 2);
    const contentHash = ethers.keccak256(ethers.toUtf8Bytes(memoryJson));

    // Step 3: Upload encrypted to 0G Storage
    const uploadResult: EncryptedUploadResult = await this.storage.uploadEncrypted(
      Buffer.from(memoryJson, "utf-8"),
      `Agent #${agentId} memory snapshot — ${snapshotType} — ${new Date().toISOString()}`
    );

    console.log(`[MemoryService] Uploaded to 0G Storage — rootHash=${uploadResult.rootHash}`);

    // Step 4: Commit on-chain
    const tx = await this.memoryContract.commitMemorySnapshot(
      BigInt(agentId),
      uploadResult.rootHash,
      contentHash,
      BigInt(blob.interactionCount),
      snapshotType
    );
    const receipt = await tx.wait();

    console.log(`[MemoryService] On-chain commit TX: ${receipt.hash}`);

    // Step 5: Get snapshot index from on-chain state
    const state = await this.memoryContract.getMemoryState(BigInt(agentId));
    const snapshotIndex = Number(state.totalSnapshots) - 1;

    return {
      storageRoot: uploadResult.rootHash,
      contentHash,
      txHash: receipt.hash,
      snapshotIndex,
      encryptionKey: uploadResult.encryptionKey,
    };
  }

  // ============================================================
  //                   MEMORY RETRIEVAL
  // ============================================================

  /**
   * Load memory context for an agent from 0G Storage.
   * This is injected into the system prompt before inference.
   */
  async loadMemoryContext(
    agentId: string,
    encryptionKey: string
  ): Promise<MemoryContext> {
    console.log(`[MemoryService] Loading memory context for agent #${agentId}`);

    // Get on-chain state
    const state = await this.memoryContract.getMemoryState(BigInt(agentId));

    if (!state.isActive || state.totalSnapshots === 0n) {
      return {
        summary: "",
        recentEntries: [],
        preferences: {},
        totalInteractions: 0,
        memorySnapshots: 0,
      };
    }

    // Download and decrypt latest snapshot from 0G Storage
    const latestRoot = state.latestStorageRoot;
    const tempPath = `/tmp/graviton-memory-${agentId}-${Date.now()}.json`;

    try {
      await this.storage.downloadAndDecrypt(latestRoot, encryptionKey, tempPath);

      // Read decrypted memory blob
      const fs = await import("fs");
      const memoryJson = fs.readFileSync(tempPath, "utf-8");
      const blob: MemoryBlob = JSON.parse(memoryJson);

      // Clean up temp file
      fs.unlinkSync(tempPath);

      // Build context from blob
      const recentEntries = blob.entries.slice(-MAX_CONTEXT_ENTRIES);

      return {
        summary: blob.summary || "",
        recentEntries,
        preferences: blob.preferences || {},
        totalInteractions: Number(state.totalInteractions),
        memorySnapshots: Number(state.totalSnapshots),
      };
    } catch (error: any) {
      console.warn(`[MemoryService] Failed to load memory: ${error.message}`);
      return {
        summary: "",
        recentEntries: [],
        preferences: {},
        totalInteractions: Number(state.totalInteractions),
        memorySnapshots: Number(state.totalSnapshots),
      };
    }
  }

  /**
   * Get on-chain memory state for an agent (no decryption needed).
   */
  async getOnChainState(agentId: string): Promise<OnChainMemoryState> {
    const state = await this.memoryContract.getMemoryState(BigInt(agentId));
    return {
      totalInteractions: state.totalInteractions,
      totalSnapshots: state.totalSnapshots,
      lastUpdated: state.lastUpdated,
      latestStorageRoot: state.latestStorageRoot,
      isActive: state.isActive,
    };
  }

  /**
   * Record a single interaction on-chain (lightweight, no storage upload).
   */
  async recordInteraction(agentId: string): Promise<string> {
    const tx = await this.memoryContract.recordInteraction(BigInt(agentId));
    const receipt = await tx.wait();
    return receipt.hash;
  }

  /**
   * Initialize memory for an agent on-chain.
   */
  async initializeMemory(agentId: string): Promise<string> {
    const tx = await this.memoryContract.initializeMemory(BigInt(agentId));
    const receipt = await tx.wait();
    console.log(`[MemoryService] Memory initialized for agent #${agentId}: ${receipt.hash}`);
    return receipt.hash;
  }

  // ============================================================
  //                 CONTEXT FORMATTING
  // ============================================================

  /**
   * Format memory context into a system prompt injection.
   * This is appended to the agent's system prompt before inference.
   */
  formatContextForPrompt(context: MemoryContext): string {
    if (!context.summary && context.recentEntries.length === 0) {
      return "";
    }

    const parts: string[] = [
      "\n\n--- PERSISTENT MEMORY (stored on 0G Storage, verified on-chain) ---",
    ];

    if (context.summary) {
      parts.push(`\nConversation Summary: ${context.summary}`);
    }

    if (Object.keys(context.preferences).length > 0) {
      parts.push(`\nUser Preferences: ${JSON.stringify(context.preferences)}`);
    }

    if (context.recentEntries.length > 0) {
      parts.push("\nRecent Conversation History:");
      for (const entry of context.recentEntries) {
        const timeStr = new Date(entry.timestamp).toLocaleString();
        parts.push(`  [${entry.role}] (${timeStr}): ${entry.content.slice(0, 200)}`);
      }
    }

    parts.push(
      `\nMemory Stats: ${context.totalInteractions} total interactions, ${context.memorySnapshots} snapshots stored on 0G`
    );
    parts.push("--- END PERSISTENT MEMORY ---\n");

    return parts.join("\n");
  }

  // ============================================================
  //                   SUMMARY GENERATION
  // ============================================================

  /**
   * Generate a simple extractive summary from conversation entries.
   * In production, this would use 0G Compute for AI summarization.
   */
  private generateSummary(blob: MemoryBlob): string {
    const userMessages = blob.entries
      .filter(e => e.role === "user")
      .map(e => e.content);

    const assistantMessages = blob.entries
      .filter(e => e.role === "assistant")
      .map(e => e.content);

    const topics = new Set<string>();
    const allText = [...userMessages, ...assistantMessages].join(" ").toLowerCase();

    // Simple topic extraction
    const topicKeywords = [
      "blockchain", "ai", "trading", "defi", "nft", "agent",
      "code", "help", "explain", "create", "build", "deploy",
      "0g", "graviton", "compute", "storage", "memory",
    ];

    for (const keyword of topicKeywords) {
      if (allText.includes(keyword)) {
        topics.add(keyword);
      }
    }

    const summary = [
      `Session with ${blob.interactionCount} interactions.`,
      topics.size > 0 ? `Topics discussed: ${Array.from(topics).join(", ")}.` : "",
      userMessages.length > 0 ? `User asked ${userMessages.length} questions.` : "",
      assistantMessages.length > 0 ? `Agent provided ${assistantMessages.length} responses.` : "",
    ].filter(Boolean).join(" ");

    return summary;
  }

  // ============================================================
  //                      CLEANUP
  // ============================================================

  /**
   * Clear session cache for an agent.
   */
  clearSession(agentId: string, sessionId: string): void {
    this.sessionCache.delete(this.sessionKey(agentId, sessionId));
  }

  /**
   * Clear all session caches.
   */
  clearAllSessions(): void {
    this.sessionCache.clear();
  }
}

// ============================================================
//                    SINGLETON EXPORT
// ============================================================

let _instance: MemoryService | null = null;

export function getMemoryService(overrides?: {
  network?: "testnet" | "mainnet";
  privateKey?: string;
  memoryContractAddress?: string;
}): MemoryService {
  if (!_instance || overrides) {
    _instance = new MemoryService(overrides);
  }
  return _instance;
}

export default MemoryService;
