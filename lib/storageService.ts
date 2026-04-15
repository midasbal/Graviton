/**
 * Graviton — 0G Storage Service
 *
 * Handles all interactions with 0G decentralized storage:
 *   - Encrypted upload of AI agent weights (LoRA adapters) and metadata
 *   - Merkle root hash generation for on-chain references
 *   - Download and decryption for authorized INFT holders
 *
 * SDK: @0gfoundation/0g-ts-sdk v1.2.1
 * Modes: Turbo (fast, higher fee) | Standard (slower, cheaper)
 * Networks: Testnet (Galileo) | Mainnet
 */

import { ZgFile, Indexer, MemData } from "@0gfoundation/0g-ts-sdk";
import { ethers } from "ethers";
import CryptoJS from "crypto-js";
import * as fs from "fs";
import * as path from "path";
import dotenv from "dotenv";

dotenv.config();

// ============================================================
//                    NETWORK CONFIGURATION
// ============================================================

interface NetworkConfig {
  rpcUrl: string;
  chainId: number;
  indexerUrl: string;
}

const NETWORKS: Record<string, NetworkConfig> = {
  testnet: {
    rpcUrl: "https://evmrpc-testnet.0g.ai",
    chainId: 16602,
    indexerUrl: "https://indexer-storage-testnet-turbo.0g.ai",
  },
  mainnet: {
    rpcUrl: "https://evmrpc.0g.ai",
    chainId: 16661,
    indexerUrl: "https://indexer-storage-turbo.0g.ai",
  },
};

const STANDARD_INDEXERS: Record<string, string> = {
  testnet: "https://indexer-storage-testnet-standard.0g.ai",
  mainnet: "https://indexer-storage.0g.ai",
};

// ============================================================
//                         TYPES
// ============================================================

export interface StorageConfig {
  network: "testnet" | "mainnet";
  mode: "turbo" | "standard";
  privateKey: string;
}

export interface UploadResult {
  rootHash: string;
  txHash: string;
  encryptionKey?: string; // Only returned for encrypted uploads
  fileSize: number;
  timestamp: number;
}

export interface AgentPackage {
  name: string;
  description: string;
  modelType: string;
  systemPrompt: string;
  loraWeightsPath?: string; // Path to LoRA adapter file
  loraWeightsBuffer?: Buffer; // Or raw buffer
  metadata: Record<string, unknown>;
}

export interface EncryptedUploadResult extends UploadResult {
  encryptionKey: string;
  dataHash: string; // keccak256 of the original data (for on-chain IntelligentData)
  dataDescription: string; // Human-readable description for ERC-7857
}

// ============================================================
//                     STORAGE SERVICE
// ============================================================

export class StorageService {
  private config: StorageConfig;
  private networkConfig: NetworkConfig;
  private signer: ethers.Wallet;
  private indexer: Indexer;

  constructor(overrides?: Partial<StorageConfig>) {
    const network = (overrides?.network ||
      process.env.NETWORK ||
      "testnet") as StorageConfig["network"];
    const mode = (overrides?.mode ||
      process.env.STORAGE_MODE ||
      "turbo") as StorageConfig["mode"];
    const privateKey =
      overrides?.privateKey || process.env.PRIVATE_KEY || "";

    if (!privateKey) {
      throw new Error(
        "StorageService: PRIVATE_KEY is required. Set it in .env or pass via overrides."
      );
    }

    this.config = { network, mode, privateKey };
    this.networkConfig = NETWORKS[network];

    // Create ethers signer
    const provider = new ethers.JsonRpcProvider(this.networkConfig.rpcUrl);
    this.signer = new ethers.Wallet(privateKey, provider);

    // Create indexer — pick URL based on storage mode
    const indexerUrl =
      mode === "standard"
        ? STANDARD_INDEXERS[network]
        : this.networkConfig.indexerUrl;

    // The SDK auto-discovers the flow contract from the indexer
    this.indexer = new Indexer(indexerUrl);

    console.log(
      `[StorageService] Initialized — network=${network}, mode=${mode}, wallet=${this.signer.address}`
    );
  }

  // ============================================================
  //                       FILE UPLOAD
  // ============================================================

  /**
   * Upload a file from the filesystem to 0G Storage.
   * @returns rootHash (permanent file identifier) and txHash
   */
  async uploadFile(filePath: string): Promise<UploadResult> {
    if (!fs.existsSync(filePath)) {
      throw new Error(`StorageService: File not found — ${filePath}`);
    }

    const file = await ZgFile.fromFilePath(filePath);
    // merkleTree() must be called before upload (populates internal state)
    const [tree, treeErr] = await file.merkleTree();
    if (treeErr) {
      await file.close();
      throw new Error(`StorageService: Merkle tree generation failed — ${treeErr}`);
    }

    const rootHashBeforeUpload = tree!.rootHash();
    console.log(`[StorageService] Uploading file: ${filePath}`);
    console.log(`[StorageService] Pre-computed root hash: ${rootHashBeforeUpload}`);

    const [tx, uploadErr] = await this.indexer.upload(
      file,
      this.networkConfig.rpcUrl,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- SDK expects ethers v5 Signer; runtime-compatible
      this.signer as unknown as Parameters<typeof this.indexer.upload>[2]
    );
    await file.close();

    if (uploadErr) {
      throw new Error(`StorageService: Upload failed — ${uploadErr}`);
    }

    // Handle both single file and fragmented file result shapes
    interface FragmentedResult { rootHashes: string[]; txHashes: string[]; }
    let rootHash: string;
    let txHash: string;
    if ("rootHash" in tx!) {
      rootHash = tx.rootHash as string;
      txHash = tx.txHash as string;
    } else {
      // Fragmented file (>4GB) — take first root hash
      const frag = tx as unknown as FragmentedResult;
      rootHash = frag.rootHashes[0];
      txHash = frag.txHashes[0];
    }

    const stats = fs.statSync(filePath);
    console.log(`[StorageService] Upload complete — rootHash=${rootHash}`);

    return {
      rootHash,
      txHash,
      fileSize: stats.size,
      timestamp: Date.now(),
    };
  }

  // ============================================================
  //                      DATA UPLOAD
  // ============================================================

  /**
   * Upload raw data (string or buffer) to 0G Storage via MemData.
   * Useful for uploading JSON metadata, system prompts, etc.
   */
  async uploadData(data: string | Uint8Array): Promise<UploadResult> {
    const buffer =
      typeof data === "string" ? new TextEncoder().encode(data) : data;

    const memData = new MemData(buffer);

    console.log(`[StorageService] Uploading in-memory data (${buffer.length} bytes)`);

    const [tx, uploadErr] = await this.indexer.upload(
      memData,
      this.networkConfig.rpcUrl,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- SDK expects ethers v5 Signer
      this.signer as unknown as Parameters<typeof this.indexer.upload>[2]
    );

    if (uploadErr) {
      throw new Error(`StorageService: MemData upload failed — ${uploadErr}`);
    }

    interface FragmentedResult { rootHashes: string[]; txHashes: string[]; }
    let rootHash: string;
    let txHash: string;
    if ("rootHash" in tx!) {
      rootHash = tx.rootHash as string;
      txHash = tx.txHash as string;
    } else {
      const frag = tx as unknown as FragmentedResult;
      rootHash = frag.rootHashes[0];
      txHash = frag.txHashes[0];
    }

    console.log(`[StorageService] Data upload complete — rootHash=${rootHash}`);

    return {
      rootHash,
      txHash,
      fileSize: buffer.length,
      timestamp: Date.now(),
    };
  }

  // ============================================================
  //                    ENCRYPTED UPLOAD
  // ============================================================

  /**
   * Encrypt data with AES-256 and upload to 0G Storage.
   * Returns the rootHash (for on-chain storage reference) and the
   * encryption key (which should be stored off-chain or in TEE).
   *
   * This is the primary method for uploading AI agent weights,
   * since LoRA adapters must be encrypted before decentralized storage.
   */
  async uploadEncrypted(
    data: Buffer | string,
    description: string
  ): Promise<EncryptedUploadResult> {
    const rawBuffer =
      typeof data === "string" ? Buffer.from(data, "utf-8") : data;

    // Generate a random AES-256 encryption key
    const encryptionKey = CryptoJS.lib.WordArray.random(32).toString(
      CryptoJS.enc.Hex
    );

    // Compute dataHash BEFORE encryption (for ERC-7857 IntelligentData)
    const dataHash = ethers.keccak256(rawBuffer);

    // Encrypt the data with AES-256-CBC
    const encrypted = CryptoJS.AES.encrypt(
      CryptoJS.lib.WordArray.create(rawBuffer as unknown as number[]),
      CryptoJS.enc.Hex.parse(encryptionKey),
      {
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7,
        iv: CryptoJS.lib.WordArray.random(16),
      }
    );

    // Prepend IV to ciphertext for later decryption
    const ivHex = encrypted.iv.toString(CryptoJS.enc.Hex);
    const ciphertextHex = encrypted.ciphertext.toString(CryptoJS.enc.Hex);
    const payload = Buffer.from(ivHex + ciphertextHex, "hex");

    console.log(
      `[StorageService] Encrypting ${rawBuffer.length} bytes (AES-256-CBC)`
    );

    // Upload encrypted payload to 0G Storage
    const uploadResult = await this.uploadData(payload);

    console.log(
      `[StorageService] Encrypted upload complete — rootHash=${uploadResult.rootHash}, dataHash=${dataHash}`
    );

    return {
      ...uploadResult,
      encryptionKey,
      dataHash,
      dataDescription: description,
    };
  }

  // ============================================================
  //               AGENT PACKAGE UPLOAD (Full Pipeline)
  // ============================================================

  /**
   * Upload a complete AI agent package:
   *   1. Encrypt and upload LoRA weights (if provided)
   *   2. Build metadata JSON with storage references
   *   3. Upload metadata JSON
   *
   * Returns everything needed to call GravitonINFT.mint() and
   * GravitonRegistry.registerAgent().
   */
  async uploadAgentPackage(agent: AgentPackage): Promise<{
    weightsUpload: EncryptedUploadResult | null;
    metadataUpload: UploadResult;
    mintParams: {
      dataDescription: string;
      dataHash: string;
      storageRoot: string;
      tokenURI: string;
    };
  }> {
    console.log(`[StorageService] Uploading agent package: "${agent.name}"`);

    // Step 1: Encrypt and upload LoRA weights
    let weightsUpload: EncryptedUploadResult | null = null;

    if (agent.loraWeightsPath || agent.loraWeightsBuffer) {
      const weightsData = agent.loraWeightsBuffer
        ? agent.loraWeightsBuffer
        : fs.readFileSync(agent.loraWeightsPath!);

      weightsUpload = await this.uploadEncrypted(
        weightsData,
        `${agent.name} — LoRA adapter weights (${agent.modelType})`
      );
    }

    // Step 2: Build metadata JSON
    const metadataJson = {
      name: agent.name,
      description: agent.description,
      modelType: agent.modelType,
      systemPrompt: agent.systemPrompt,
      weights: weightsUpload
        ? {
            storageHash: weightsUpload.rootHash,
            dataHash: weightsUpload.dataHash,
            encrypted: true,
            algorithm: "AES-256-CBC",
            size: weightsUpload.fileSize,
          }
        : null,
      ...agent.metadata,
      graviton: {
        version: "1.0.0",
        uploadedAt: new Date().toISOString(),
        network: this.config.network,
      },
    };

    // Step 3: Upload metadata JSON
    const metadataUpload = await this.uploadData(
      JSON.stringify(metadataJson, null, 2)
    );

    console.log(
      `[StorageService] Agent package uploaded — metadata rootHash=${metadataUpload.rootHash}`
    );

    return {
      weightsUpload,
      metadataUpload,
      mintParams: {
        dataDescription: weightsUpload
          ? weightsUpload.dataDescription
          : `${agent.name} — AI agent metadata`,
        dataHash: weightsUpload
          ? weightsUpload.dataHash
          : ethers.keccak256(
              Buffer.from(JSON.stringify(metadataJson))
            ),
        storageRoot: metadataUpload.rootHash,
        tokenURI: `0g://${metadataUpload.rootHash}`,
      },
    };
  }

  // ============================================================
  //                       DOWNLOAD
  // ============================================================

  /**
   * Download a file from 0G Storage by its root hash.
   * @param rootHash The 0x-prefixed root hash from a previous upload
   * @param outputPath Local path to save the downloaded file
   * @param withProof Enable Merkle proof verification during download
   */
  async downloadFile(
    rootHash: string,
    outputPath: string,
    withProof = true
  ): Promise<string> {
    console.log(`[StorageService] Downloading rootHash=${rootHash}`);

    // Ensure output directory exists
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const err = await this.indexer.download(rootHash, outputPath, withProof);
    if (err) {
      throw new Error(`StorageService: Download failed — ${err}`);
    }

    console.log(`[StorageService] Downloaded to ${outputPath}`);
    return outputPath;
  }

  // ============================================================
  //                      DECRYPTION
  // ============================================================

  /**
   * Download and decrypt a file that was uploaded via uploadEncrypted().
   * Only authorized INFT holders should have access to the encryptionKey.
   *
   * @param rootHash Storage root hash of the encrypted payload
   * @param encryptionKey The AES-256 key (hex string) from the original upload
   * @param outputPath Path to save the decrypted file
   */
  async downloadAndDecrypt(
    rootHash: string,
    encryptionKey: string,
    outputPath: string
  ): Promise<string> {
    // Download encrypted payload to a temp file
    const tempPath = outputPath + ".encrypted.tmp";
    await this.downloadFile(rootHash, tempPath, true);

    // Read encrypted payload
    const encryptedPayload = fs.readFileSync(tempPath);

    // Extract IV (first 16 bytes = 32 hex chars)
    const iv = CryptoJS.enc.Hex.parse(
      encryptedPayload.subarray(0, 16).toString("hex")
    );
    const ciphertext = CryptoJS.enc.Hex.parse(
      encryptedPayload.subarray(16).toString("hex")
    );

    // Decrypt
    const decrypted = CryptoJS.AES.decrypt(
      { ciphertext } as CryptoJS.lib.CipherParams,
      CryptoJS.enc.Hex.parse(encryptionKey),
      {
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7,
        iv,
      }
    );

    // Convert WordArray to Buffer and write to output
    const decryptedHex = decrypted.toString(CryptoJS.enc.Hex);
    const decryptedBuffer = Buffer.from(decryptedHex, "hex");

    fs.writeFileSync(outputPath, decryptedBuffer);

    // Clean up temp file
    fs.unlinkSync(tempPath);

    console.log(
      `[StorageService] Decrypted and saved to ${outputPath} (${decryptedBuffer.length} bytes)`
    );
    return outputPath;
  }

  // ============================================================
  //                      UTILITIES
  // ============================================================

  /**
   * Compute the Merkle root hash of a local file without uploading.
   * Useful for verifying file integrity against on-chain references.
   */
  async computeFileHash(filePath: string): Promise<string> {
    const file = await ZgFile.fromFilePath(filePath);
    const [tree, err] = await file.merkleTree();
    await file.close();
    if (err) {
      throw new Error(`StorageService: Hash computation failed — ${err}`);
    }
    const hash = tree!.rootHash();
    if (!hash) {
      throw new Error("StorageService: Hash computation returned null");
    }
    return hash;
  }

  /**
   * Get the current wallet address.
   */
  getWalletAddress(): string {
    return this.signer.address;
  }

  /**
   * Get the current network configuration.
   */
  getNetworkConfig(): NetworkConfig & { mode: string } {
    return { ...this.networkConfig, mode: this.config.mode };
  }
}

// ============================================================
//                    SINGLETON EXPORT
// ============================================================

/** Default StorageService instance (loads config from .env) */
let _defaultInstance: StorageService | null = null;

export function getStorageService(
  overrides?: Partial<StorageConfig>
): StorageService {
  if (!_defaultInstance || overrides) {
    _defaultInstance = new StorageService(overrides);
  }
  return _defaultInstance;
}

export default StorageService;
