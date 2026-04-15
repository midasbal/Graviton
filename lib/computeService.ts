/**
 * Graviton — 0G Compute Service
 *
 * Interfaces with the 0G Compute Network for decentralized AI inference:
 *   - Broker initialization and ledger management
 *   - Provider discovery and acknowledgment
 *   - OpenAI-compatible chat completion via 0G providers
 *   - TEE (Trusted Execution Environment) response verification
 *   - "Sealed Inference" for test-drive feature (interact without seeing weights)
 *   - Session management for compute tasks
 *
 * SDK: @0glabs/0g-serving-broker v0.6.2
 * Auth: Single-use authentication headers per request
 * Payment: Automatic micropayments with delayed batch settlement
 */

import { ethers } from "ethers";
import {
  createZGComputeNetworkBroker,
  type ZGComputeNetworkBroker,
} from "@0glabs/0g-serving-broker";
import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

// ============================================================
//                       CONSTANTS
// ============================================================

/** Minimum OG required to create a ledger (contract requirement in v0.6.x) */
const MIN_LEDGER_AMOUNT = 3;

/** Minimum OG to transfer per provider before first query */
const MIN_PROVIDER_TRANSFER = 1;

/** Default fallback fee if response processing fails */
const DEFAULT_FALLBACK_FEE = 0.01;

// ============================================================
//              OFFICIAL 0G PROVIDERS (TESTNET)
// ============================================================

export const TESTNET_PROVIDERS: Record<string, string> = {
  "qwen/qwen-2.5-7b-instruct":
    "0xa48f01287233509FD694a22Bf840225062E67836",
  "openai/gpt-oss-20b":
    "0x8e60d466FD16798Bec4868aa4CE38586D5590049",
  "google/gemma-3-27b-it":
    "0x69Eb5a0BD7d0f4bF39eD5CE9Bd3376c61863aE08",
};

// ============================================================
//              OFFICIAL 0G PROVIDERS (MAINNET)
// ============================================================

export const MAINNET_PROVIDERS: Record<string, string> = {
  "deepseek-ai/DeepSeek-V3.1":
    "0xd9966e13a6026Fcca4b13E7ff95c94DE268C471C",
  "openai/whisper-large-v3":
    "0x36aCffCEa3CCe07cAdd1740Ad992dB16Ab324517",
  "openai/gpt-oss-120b":
    "0xBB3f5b0b5062CB5B3245222C5917afD1f6e13aF6",
  "qwen/qwen2.5-vl-72b-instruct":
    "0x4415ef5CBb415347bb18493af7cE01f225Fc0868",
  "deepseek/deepseek-chat-v3-0324":
    "0x1B3AAef3ae5050EEE04ea38cD4B087472BD85EB0",
  "flux-turbo":
    "0xE29a72c7629815Eb480aE5b1F2dfA06f06cdF974",
  "openai/gpt-oss-20b":
    "0x44ba5021daDa2eDc84b4f5FC170b85F7bC51ef64",
};

// ============================================================
//                          TYPES
// ============================================================

export interface ComputeConfig {
  network: "testnet" | "mainnet";
  privateKey: string;
}

export interface ServiceInfo {
  provider: string;
  model: string;
  serviceType: string;
  url: string;
  inputPrice: string;
  outputPrice: string;
  verifiability: string;
}

export interface InferenceResult {
  content: string;
  chatId: string;
  model: string;
  provider: string;
  isValid: boolean;
  tokensUsed?: number;
}

export interface SealedInferenceResult extends InferenceResult {
  /** TEE attestation that the agent's weights were used without exposing them */
  teeVerified: boolean;
}

export interface SessionState {
  sessionId: string;
  providerAddress: string;
  model: string;
  messages: Array<{ role: string; content: string }>;
  createdAt: number;
  lastActivityAt: number;
  totalQueries: number;
  totalCost: number;
}

// ============================================================
//                    COMPUTE SERVICE
// ============================================================

export class ComputeService {
  private config: ComputeConfig;
  private wallet: ethers.Wallet;
  private broker: ZGComputeNetworkBroker | null = null;
  private initialized = false;
  private initPromise: Promise<void> | null = null;

  /** Active inference sessions (for multi-turn conversations) */
  private sessions: Map<string, SessionState> = new Map();

  /** Acknowledged providers (to avoid redundant on-chain txs) */
  private acknowledgedProviders: Set<string> = new Set();

  constructor(overrides?: Partial<ComputeConfig>) {
    const network = (overrides?.network ||
      process.env.NETWORK ||
      "testnet") as ComputeConfig["network"];
    const privateKey =
      overrides?.privateKey || process.env.PRIVATE_KEY || "";

    if (!privateKey) {
      throw new Error(
        "ComputeService: PRIVATE_KEY is required. Set it in .env or pass via overrides."
      );
    }

    this.config = { network, privateKey };

    const rpcUrl =
      network === "mainnet"
        ? "https://evmrpc.0g.ai"
        : "https://evmrpc-testnet.0g.ai";

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    this.wallet = new ethers.Wallet(privateKey, provider);

    // Start async initialization
    this.initPromise = this.initialize();
  }

  // ============================================================
  //                    INITIALIZATION
  // ============================================================

  private async initialize(): Promise<void> {
    try {
      console.log(
        `[ComputeService] Initializing broker — network=${this.config.network}, wallet=${this.wallet.address}`
      );
      this.broker = await createZGComputeNetworkBroker(this.wallet);
      this.initialized = true;
      console.log("[ComputeService] Broker initialized successfully");
    } catch (error: any) {
      console.error(
        `[ComputeService] Broker initialization failed: ${error.message}`
      );
      throw error;
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized && this.initPromise) {
      await this.initPromise;
    }
    if (!this.broker) {
      throw new Error("ComputeService: Broker not initialized");
    }
  }

  // ============================================================
  //                   LEDGER MANAGEMENT
  // ============================================================

  /**
   * Create a new ledger with initial funds.
   * Minimum 3 OG required (contract requirement in SDK v0.6.x).
   */
  async createLedger(amountOG: number = MIN_LEDGER_AMOUNT): Promise<void> {
    await this.ensureInitialized();
    if (amountOG < MIN_LEDGER_AMOUNT) {
      throw new Error(
        `ComputeService: Minimum ${MIN_LEDGER_AMOUNT} OG required to create ledger`
      );
    }
    await this.broker!.ledger.addLedger(amountOG);
    console.log(`[ComputeService] Ledger created with ${amountOG} OG`);
  }

  /**
   * Deposit additional funds to existing ledger.
   */
  async depositFunds(amountOG: number): Promise<void> {
    await this.ensureInitialized();
    await this.broker!.ledger.depositFund(amountOG);
    console.log(`[ComputeService] Deposited ${amountOG} OG to ledger`);
  }

  /**
   * Get current ledger balance and account info.
   */
  async getLedgerInfo(): Promise<any> {
    await this.ensureInitialized();
    return await this.broker!.ledger.getLedger();
  }

  /**
   * Ensure the ledger exists and has sufficient funds.
   * Creates one if it doesn't exist yet.
   */
  async ensureLedger(minBalanceOG: number = MIN_LEDGER_AMOUNT): Promise<void> {
    await this.ensureInitialized();
    try {
      const info = await this.broker!.ledger.getLedger();
      const currentBalance = info[1]; // Available balance
      const required = ethers.parseEther(minBalanceOG.toString());
      if (currentBalance < required) {
        console.log(
          `[ComputeService] Balance insufficient, depositing ${minBalanceOG} OG...`
        );
        await this.broker!.ledger.depositFund(minBalanceOG);
      }
    } catch {
      console.log("[ComputeService] No ledger found, creating...");
      await this.createLedger(minBalanceOG);
    }
  }

  // ============================================================
  //                  SERVICE DISCOVERY
  // ============================================================

  /**
   * List all available AI services on the network.
   */
  async listServices(): Promise<ServiceInfo[]> {
    await this.ensureInitialized();
    const services = await this.broker!.inference.listService();

    const providerMap =
      this.config.network === "mainnet"
        ? MAINNET_PROVIDERS
        : TESTNET_PROVIDERS;

    return services.map((s: any) => ({
      provider: s.provider,
      model: s.model || s.name || "unknown",
      serviceType: s.serviceType || "inference",
      url: s.url || "",
      inputPrice: ethers.formatEther(s.inputPrice || 0),
      outputPrice: ethers.formatEther(s.outputPrice || 0),
      verifiability: s.verifiability || "None",
    }));
  }

  /**
   * Acknowledge a provider (required once per provider, on-chain tx).
   * Idempotent — skips if already acknowledged in this session.
   */
  async acknowledgeProvider(providerAddress: string): Promise<void> {
    await this.ensureInitialized();

    if (this.acknowledgedProviders.has(providerAddress)) {
      console.log(
        `[ComputeService] Provider ${providerAddress} already acknowledged`
      );
      return;
    }

    try {
      await this.broker!.inference.acknowledgeProviderSigner(providerAddress);
      this.acknowledgedProviders.add(providerAddress);
      console.log(
        `[ComputeService] Provider ${providerAddress} acknowledged`
      );
    } catch (error: any) {
      if (error.message?.includes("already acknowledged")) {
        this.acknowledgedProviders.add(providerAddress);
        console.log(
          `[ComputeService] Provider ${providerAddress} was already acknowledged`
        );
      } else {
        throw error;
      }
    }
  }

  /**
   * Transfer funds to a specific provider (required before first query).
   * Minimum 1 OG per provider.
   */
  async fundProvider(
    providerAddress: string,
    amountOG: number = MIN_PROVIDER_TRANSFER
  ): Promise<void> {
    await this.ensureInitialized();
    const amount = ethers.parseEther(amountOG.toString());
    await this.broker!.ledger.transferFund(
      providerAddress,
      "inference",
      amount
    );
    console.log(
      `[ComputeService] Transferred ${amountOG} OG to provider ${providerAddress}`
    );
  }

  // ============================================================
  //                      INFERENCE
  // ============================================================

  /**
   * Send a single inference query to a provider.
   *
   * Full flow:
   *   1. Get service metadata (endpoint + model)
   *   2. Generate single-use auth headers
   *   3. Call OpenAI-compatible API
   *   4. Process response + verify via TEE
   */
  async query(
    providerAddress: string,
    prompt: string,
    systemPrompt?: string
  ): Promise<InferenceResult> {
    await this.ensureInitialized();

    // Get service endpoint and model
    const { endpoint, model } =
      await this.broker!.inference.getServiceMetadata(providerAddress);

    // Generate single-use auth headers
    const headers = await this.broker!.inference.getRequestHeaders(
      providerAddress,
      prompt
    );

    // Prepare headers in Record<string, string> format
    const requestHeaders: Record<string, string> = {};
    Object.entries(headers).forEach(([key, value]) => {
      if (typeof value === "string") {
        requestHeaders[key] = value;
      }
    });

    // Build messages
    const messages: Array<{ role: "system" | "user"; content: string }> = [];
    if (systemPrompt) {
      messages.push({ role: "system", content: systemPrompt });
    }
    messages.push({ role: "user", content: prompt });

    // Call OpenAI-compatible API through the provider
    const openai = new OpenAI({
      baseURL: endpoint,
      apiKey: "", // Empty as per 0G docs
    });

    const completion = await openai.chat.completions.create(
      { messages, model },
      { headers: requestHeaders }
    );

    const content = completion.choices[0].message.content || "";
    const chatId = completion.id;

    // Process response and verify via TEE
    let isValid = false;
    try {
      const result = await this.broker!.inference.processResponse(
        providerAddress,
        chatId,
        content
      );
      isValid = result === true;
    } catch (error: any) {
      console.warn(
        `[ComputeService] Response verification failed: ${error.message}`
      );
    }

    return {
      content,
      chatId,
      model,
      provider: providerAddress,
      isValid,
    };
  }

  // ============================================================
  //               SEALED INFERENCE (TEST-DRIVE)
  // ============================================================

  /**
   * Sealed Inference — "Test-drive" an AI agent without accessing its weights.
   *
   * The agent's LoRA weights remain encrypted in 0G Storage. The user
   * interacts with the agent via the compute network, and the provider
   * runs inference inside a TEE. The response is signed and verifiable,
   * but the weights are never exposed to the user.
   *
   * This is the core mechanism for Graviton's marketplace:
   * buyers can test an agent's capabilities before purchasing the INFT.
   *
   * @param providerAddress The compute provider running the agent
   * @param agentSystemPrompt The agent's system prompt (public metadata)
   * @param userPrompt The user's query to the agent
   * @param sessionId Optional session ID for multi-turn conversations
   */
  async sealedInference(
    providerAddress: string,
    agentSystemPrompt: string,
    userPrompt: string,
    sessionId?: string
  ): Promise<SealedInferenceResult> {
    await this.ensureInitialized();

    // Manage session state for multi-turn
    let session: SessionState | undefined;
    if (sessionId) {
      session = this.sessions.get(sessionId);
    }

    // If no session exists, create one
    if (!session) {
      const sid =
        sessionId ||
        `grvt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const { model } =
        await this.broker!.inference.getServiceMetadata(providerAddress);
      session = {
        sessionId: sid,
        providerAddress,
        model,
        messages: [{ role: "system", content: agentSystemPrompt }],
        createdAt: Date.now(),
        lastActivityAt: Date.now(),
        totalQueries: 0,
        totalCost: 0,
      };
      this.sessions.set(sid, session);
    }

    // Add user message to conversation history
    session.messages.push({ role: "user", content: userPrompt });

    // Generate headers and send request
    const headers = await this.broker!.inference.getRequestHeaders(
      providerAddress,
      userPrompt
    );

    const requestHeaders: Record<string, string> = {};
    Object.entries(headers).forEach(([key, value]) => {
      if (typeof value === "string") {
        requestHeaders[key] = value;
      }
    });

    const { endpoint, model } =
      await this.broker!.inference.getServiceMetadata(providerAddress);

    const openai = new OpenAI({
      baseURL: endpoint,
      apiKey: "",
    });

    const completion = await openai.chat.completions.create(
      {
        messages: session.messages as OpenAI.ChatCompletionMessageParam[],
        model,
      },
      { headers: requestHeaders }
    );

    const content = completion.choices[0].message.content || "";
    const chatId = completion.id;

    // Add assistant response to session
    session.messages.push({ role: "assistant", content });
    session.totalQueries++;
    session.lastActivityAt = Date.now();

    // TEE verification
    let isValid = false;
    try {
      const result = await this.broker!.inference.processResponse(
        providerAddress,
        chatId,
        content
      );
      isValid = result === true;
    } catch (error: any) {
      console.warn(
        `[ComputeService] TEE verification warning: ${error.message}`
      );
    }

    return {
      content,
      chatId,
      model,
      provider: providerAddress,
      isValid,
      teeVerified: isValid,
    };
  }

  // ============================================================
  //                  SESSION MANAGEMENT
  // ============================================================

  /**
   * Get an active session by ID.
   */
  getSession(sessionId: string): SessionState | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * List all active sessions.
   */
  listSessions(): SessionState[] {
    return Array.from(this.sessions.values());
  }

  /**
   * End and clean up a session.
   */
  endSession(sessionId: string): void {
    this.sessions.delete(sessionId);
    console.log(`[ComputeService] Session ${sessionId} ended`);
  }

  /**
   * Clean up sessions that have been inactive for longer than maxAge.
   * @param maxAgeMs Maximum inactive time in milliseconds (default: 1 hour)
   */
  cleanupSessions(maxAgeMs: number = 3600000): number {
    const now = Date.now();
    let cleaned = 0;
    for (const [id, session] of this.sessions) {
      if (now - session.lastActivityAt > maxAgeMs) {
        this.sessions.delete(id);
        cleaned++;
      }
    }
    if (cleaned > 0) {
      console.log(`[ComputeService] Cleaned up ${cleaned} stale sessions`);
    }
    return cleaned;
  }

  // ============================================================
  //                    FULL SETUP FLOW
  // ============================================================

  /**
   * Complete setup flow for a new wallet:
   *   1. Create ledger (min 3 OG)
   *   2. Acknowledge provider
   *   3. Transfer funds to provider (min 1 OG)
   *
   * Call this once per provider before making queries.
   */
  async setupForProvider(
    providerAddress: string,
    ledgerAmount: number = MIN_LEDGER_AMOUNT,
    providerFund: number = MIN_PROVIDER_TRANSFER
  ): Promise<void> {
    console.log(
      `[ComputeService] Full setup for provider ${providerAddress}...`
    );

    // Step 1: Ensure ledger exists
    await this.ensureLedger(ledgerAmount);

    // Step 2: Acknowledge provider
    await this.acknowledgeProvider(providerAddress);

    // Step 3: Fund provider
    try {
      await this.fundProvider(providerAddress, providerFund);
    } catch (error: any) {
      // May fail if already funded — continue
      console.warn(
        `[ComputeService] Fund transfer info: ${error.message}`
      );
    }

    console.log("[ComputeService] Setup complete");
  }

  // ============================================================
  //                      UTILITIES
  // ============================================================

  /**
   * Get the wallet address being used for compute.
   */
  getWalletAddress(): string {
    return this.wallet.address;
  }

  /**
   * Get the current network.
   */
  getNetwork(): string {
    return this.config.network;
  }
}

// ============================================================
//                    SINGLETON EXPORT
// ============================================================

let _defaultInstance: ComputeService | null = null;

export function getComputeService(
  overrides?: Partial<ComputeConfig>
): ComputeService {
  if (!_defaultInstance || overrides) {
    _defaultInstance = new ComputeService(overrides);
  }
  return _defaultInstance;
}

export default ComputeService;
