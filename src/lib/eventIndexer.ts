/**
 * Graviton Event Indexer (E5)
 *
 * Server-side utility that queries on-chain events from all Graviton contracts
 * using viem's getLogs. Returns a unified, chronologically-sorted activity feed.
 *
 * Supported event types:
 *   - AgentMinted, Transfer (INFT)
 *   - AgentListed, AgentSold, AgentRented (Marketplace)
 *   - AgentRegistered, AgentRated (Registry)
 *   - MemorySnapshotCommitted (Memory)
 *   - AttestationSubmitted (Attestation)
 *   - JobCreated, JobCompleted (FineTuning)
 *   - RevenueDistributed, INFTStaked, ProposalCreated (DAO)
 *   - ModalityAdded (MultiModal)
 */

import {
  createPublicClient,
  http,
  parseAbiItem,
  type Log,
  type AbiEvent,
  formatEther,
} from "viem";

// ── Config ──

const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || "https://evmrpc-testnet.0g.ai";
const EXPLORER_URL = "https://chainscan-galileo.0g.ai";

const CONTRACTS = {
  INFT: (process.env.GRAVITON_INFT_ADDRESS || "0xC7f8298571726b7F79093E6343e16c00a04df5F8") as `0x${string}`,
  MARKETPLACE: (process.env.GRAVITON_MARKETPLACE_ADDRESS || "0x91D1e023A9FAdeC831abE5d52247eC78998d471F") as `0x${string}`,
  REGISTRY: (process.env.GRAVITON_REGISTRY_ADDRESS || "0xA6D1c437CBDe470A7C317aA61E9DC6E54c114d60") as `0x${string}`,
  MEMORY: (process.env.GRAVITON_MEMORY_ADDRESS || "0x4c29bD1fC7e9Ac68F629e1BcaE11a7CD16F0a3Ca") as `0x${string}`,
  ATTESTATION: (process.env.GRAVITON_ATTESTATION_ADDRESS || "0x876bcf409a673Bb5D610163e41FBcB38937f9824") as `0x${string}`,
  FINE_TUNING: (process.env.GRAVITON_FINETUNING_ADDRESS || "0x25e00De35C3d9C6A35B2F430B815EA816571d3A1") as `0x${string}`,
  DAO: (process.env.GRAVITON_DAO_ADDRESS || "0xFc24dD77E47974A0747e89fe81D9a13C254238C1") as `0x${string}`,
  MULTIMODAL: (process.env.GRAVITON_MULTIMODAL_ADDRESS || "0x45588B3385dA81eA873467569a9Ad21254CB273F") as `0x${string}`,
};

// ── ABI Items ──

const EVENT_DEFS = {
  // INFT
  AgentMinted: parseAbiItem("event AgentMinted(uint256 indexed tokenId, address indexed creator, string category, string storageRoot)"),
  Transfer: parseAbiItem("event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)"),

  // Marketplace
  AgentListed: parseAbiItem("event AgentListed(uint256 indexed tokenId, address indexed seller, uint256 price, string category)"),
  AgentSold: parseAbiItem("event AgentSold(uint256 indexed tokenId, address indexed seller, address indexed buyer, uint256 price, uint256 royaltyAmount, uint256 platformFee)"),
  AgentRented: parseAbiItem("event AgentRented(uint256 indexed tokenId, address indexed owner, address indexed renter, uint256 pricePerDay, uint256 duration)"),
  HooksConfigured: parseAbiItem("event HooksConfigured(address indexed registry, address indexed dao)"),

  // Registry
  AgentRegistered: parseAbiItem("event AgentRegistered(uint256 indexed tokenId, string name, string modelType, address indexed creator)"),
  AgentRated: parseAbiItem("event AgentRated(uint256 indexed tokenId, address indexed rater, uint8 score)"),

  // Memory
  MemorySnapshotCommitted: parseAbiItem("event MemorySnapshotCommitted(uint256 indexed tokenId, string storageRoot, bytes32 contentHash, uint256 interactionCount, string snapshotType)"),

  // Attestation
  AttestationSubmitted: parseAbiItem("event AttestationSubmitted(uint256 indexed receiptId, uint256 indexed tokenId, address indexed provider, address requester, string chatId, uint8 status)"),

  // FineTuning
  JobCreated: parseAbiItem("event JobCreated(uint256 indexed jobId, uint256 indexed tokenId, address indexed owner, string baseModel, uint256 epochs, uint256 loraRank)"),
  JobCompleted: parseAbiItem("event JobCompleted(uint256 indexed jobId, uint256 indexed tokenId, string resultStorageRoot, bytes32 resultHash)"),

  // DAO
  RevenueDistributed: parseAbiItem("event RevenueDistributed(uint256 total, uint256 toCreators, uint256 toStakers, uint256 toTreasury)"),
  INFTStaked: parseAbiItem("event INFTStaked(uint256 indexed tokenId, address indexed owner)"),
  INFTUnstaked: parseAbiItem("event INFTUnstaked(uint256 indexed tokenId, address indexed owner, uint256 rewardsEarned)"),
  ProposalCreated: parseAbiItem("event ProposalCreated(uint256 indexed proposalId, address indexed proposer, string title, uint256 amount)"),
  ProposalExecuted: parseAbiItem("event ProposalExecuted(uint256 indexed proposalId, address indexed recipient, uint256 amount)"),

  // MultiModal
  ModalityAdded: parseAbiItem("event ModalityAdded(uint256 indexed tokenId, uint8 indexed modality, string modelReference, string[] capabilities)"),
} as const;

// ── Types ──

export type EventType = keyof typeof EVENT_DEFS;

export interface ActivityEvent {
  id: string;                   // unique: txHash-logIndex
  type: EventType;
  contract: string;             // contract name (INFT, Marketplace, etc.)
  blockNumber: bigint;
  transactionHash: string;
  logIndex: number;
  timestamp?: number;           // unix seconds (best-effort)
  tokenId?: string;
  actor?: string;               // primary actor address
  summary: string;              // human-readable summary
  details: Record<string, string>;
  explorerUrl: string;
}

export interface IndexerOptions {
  fromBlock?: bigint;
  toBlock?: bigint;
  tokenId?: bigint;
  actor?: string;
  eventTypes?: EventType[];
  limit?: number;
}

// ── Indexer ──

function getClient() {
  return createPublicClient({
    transport: http(RPC_URL),
  });
}

const MODALITY_NAMES = ["Text", "Image", "Audio", "Video", "Code"];

function shortenAddr(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

/**
 * Parse a raw log into an ActivityEvent
 */
function parseEvent(
  log: Log,
  type: EventType,
  contractName: string,
  args: Record<string, unknown>,
): ActivityEvent {
  const txHash = log.transactionHash ?? "0x";
  const base: ActivityEvent = {
    id: `${txHash}-${log.logIndex}`,
    type,
    contract: contractName,
    blockNumber: log.blockNumber ?? 0n,
    transactionHash: txHash,
    logIndex: log.logIndex ?? 0,
    summary: "",
    details: {},
    explorerUrl: `${EXPLORER_URL}/tx/${txHash}`,
  };

  switch (type) {
    case "AgentMinted": {
      const tokenId = String(args.tokenId);
      const creator = args.creator as string;
      base.tokenId = tokenId;
      base.actor = creator;
      base.summary = `Agent #${tokenId} minted by ${shortenAddr(creator)}`;
      base.details = { category: args.category as string, storageRoot: args.storageRoot as string };
      break;
    }
    case "Transfer": {
      const from = args.from as string;
      const to = args.to as string;
      const tokenId = String(args.tokenId);
      base.tokenId = tokenId;
      base.actor = to;
      if (from === "0x0000000000000000000000000000000000000000") {
        base.summary = `Agent #${tokenId} minted to ${shortenAddr(to)}`;
      } else {
        base.summary = `Agent #${tokenId} transferred ${shortenAddr(from)} → ${shortenAddr(to)}`;
      }
      base.details = { from, to };
      break;
    }
    case "AgentListed": {
      const tokenId = String(args.tokenId);
      const seller = args.seller as string;
      const price = formatEther(args.price as bigint);
      base.tokenId = tokenId;
      base.actor = seller;
      base.summary = `Agent #${tokenId} listed for ${price} A0GI`;
      base.details = { seller, price, category: args.category as string };
      break;
    }
    case "AgentSold": {
      const tokenId = String(args.tokenId);
      const buyer = args.buyer as string;
      const price = formatEther(args.price as bigint);
      base.tokenId = tokenId;
      base.actor = buyer;
      base.summary = `Agent #${tokenId} sold for ${price} A0GI`;
      base.details = {
        seller: args.seller as string,
        buyer,
        price,
        royalty: formatEther(args.royaltyAmount as bigint),
        platformFee: formatEther(args.platformFee as bigint),
      };
      break;
    }
    case "AgentRented": {
      const tokenId = String(args.tokenId);
      const renter = args.renter as string;
      const days = String(args.duration);
      base.tokenId = tokenId;
      base.actor = renter;
      base.summary = `Agent #${tokenId} rented for ${days} day(s)`;
      base.details = { owner: args.owner as string, renter, pricePerDay: formatEther(args.pricePerDay as bigint), duration: days };
      break;
    }
    case "HooksConfigured": {
      base.summary = `Cross-contract hooks configured`;
      base.details = { registry: args.registry as string, dao: args.dao as string };
      break;
    }
    case "AgentRegistered": {
      const tokenId = String(args.tokenId);
      const name = args.name as string;
      base.tokenId = tokenId;
      base.actor = args.creator as string;
      base.summary = `"${name}" registered (Agent #${tokenId})`;
      base.details = { name, modelType: args.modelType as string };
      break;
    }
    case "AgentRated": {
      const tokenId = String(args.tokenId);
      base.tokenId = tokenId;
      base.actor = args.rater as string;
      base.summary = `Agent #${tokenId} rated ${args.score}/5 ⭐`;
      base.details = { rater: args.rater as string, score: String(args.score) };
      break;
    }
    case "MemorySnapshotCommitted": {
      const tokenId = String(args.tokenId);
      base.tokenId = tokenId;
      base.summary = `Memory snapshot committed for Agent #${tokenId}`;
      base.details = { snapshotType: args.snapshotType as string, interactions: String(args.interactionCount) };
      break;
    }
    case "AttestationSubmitted": {
      const tokenId = String(args.tokenId);
      base.tokenId = tokenId;
      base.actor = args.provider as string;
      base.summary = `TEE attestation for Agent #${tokenId}`;
      base.details = { provider: args.provider as string, chatId: args.chatId as string };
      break;
    }
    case "JobCreated": {
      const tokenId = String(args.tokenId);
      base.tokenId = tokenId;
      base.actor = args.owner as string;
      base.summary = `Fine-tuning job started for Agent #${tokenId}`;
      base.details = { baseModel: args.baseModel as string, epochs: String(args.epochs), loraRank: String(args.loraRank) };
      break;
    }
    case "JobCompleted": {
      const tokenId = String(args.tokenId);
      base.tokenId = tokenId;
      base.summary = `Fine-tuning completed for Agent #${tokenId}`;
      base.details = { jobId: String(args.jobId) };
      break;
    }
    case "RevenueDistributed": {
      const total = formatEther(args.total as bigint);
      base.summary = `${total} A0GI revenue distributed to DAO pools`;
      base.details = {
        total,
        toCreators: formatEther(args.toCreators as bigint),
        toStakers: formatEther(args.toStakers as bigint),
        toTreasury: formatEther(args.toTreasury as bigint),
      };
      break;
    }
    case "INFTStaked": {
      const tokenId = String(args.tokenId);
      base.tokenId = tokenId;
      base.actor = args.owner as string;
      base.summary = `Agent #${tokenId} staked in DAO`;
      base.details = { owner: args.owner as string };
      break;
    }
    case "INFTUnstaked": {
      const tokenId = String(args.tokenId);
      base.tokenId = tokenId;
      base.actor = args.owner as string;
      base.summary = `Agent #${tokenId} unstaked from DAO`;
      base.details = { rewards: formatEther(args.rewardsEarned as bigint) };
      break;
    }
    case "ProposalCreated": {
      base.actor = args.proposer as string;
      base.summary = `DAO proposal "${args.title}" created`;
      base.details = { proposalId: String(args.proposalId), amount: formatEther(args.amount as bigint) };
      break;
    }
    case "ProposalExecuted": {
      base.summary = `DAO proposal #${args.proposalId} executed`;
      base.details = { recipient: args.recipient as string, amount: formatEther(args.amount as bigint) };
      break;
    }
    case "ModalityAdded": {
      const tokenId = String(args.tokenId);
      const modIdx = Number(args.modality);
      const modName = MODALITY_NAMES[modIdx] || `Modality(${modIdx})`;
      base.tokenId = tokenId;
      base.summary = `${modName} modality added to Agent #${tokenId}`;
      base.details = { modality: modName, modelReference: args.modelReference as string };
      break;
    }
  }

  return base;
}

// Map event types to their contract addresses
const EVENT_CONTRACT_MAP: Record<EventType, { address: `0x${string}`; name: string }> = {
  AgentMinted: { address: CONTRACTS.INFT, name: "INFT" },
  Transfer: { address: CONTRACTS.INFT, name: "INFT" },
  AgentListed: { address: CONTRACTS.MARKETPLACE, name: "Marketplace" },
  AgentSold: { address: CONTRACTS.MARKETPLACE, name: "Marketplace" },
  AgentRented: { address: CONTRACTS.MARKETPLACE, name: "Marketplace" },
  HooksConfigured: { address: CONTRACTS.MARKETPLACE, name: "Marketplace" },
  AgentRegistered: { address: CONTRACTS.REGISTRY, name: "Registry" },
  AgentRated: { address: CONTRACTS.REGISTRY, name: "Registry" },
  MemorySnapshotCommitted: { address: CONTRACTS.MEMORY, name: "Memory" },
  AttestationSubmitted: { address: CONTRACTS.ATTESTATION, name: "Attestation" },
  JobCreated: { address: CONTRACTS.FINE_TUNING, name: "FineTuning" },
  JobCompleted: { address: CONTRACTS.FINE_TUNING, name: "FineTuning" },
  RevenueDistributed: { address: CONTRACTS.DAO, name: "DAO" },
  INFTStaked: { address: CONTRACTS.DAO, name: "DAO" },
  INFTUnstaked: { address: CONTRACTS.DAO, name: "DAO" },
  ProposalCreated: { address: CONTRACTS.DAO, name: "DAO" },
  ProposalExecuted: { address: CONTRACTS.DAO, name: "DAO" },
  ModalityAdded: { address: CONTRACTS.MULTIMODAL, name: "MultiModal" },
};

/**
 * Fetch events from all Graviton contracts within a block range.
 */
export async function fetchActivityEvents(
  opts: IndexerOptions = {},
): Promise<ActivityEvent[]> {
  const client = getClient();

  const latestBlock = await client.getBlockNumber();
  // Default: last 5000 blocks (~4 hours on 0G testnet)
  const fromBlock = opts.fromBlock ?? (latestBlock > 5000n ? latestBlock - 5000n : 0n);
  const toBlock = opts.toBlock ?? latestBlock;

  // Determine which event types to fetch
  const eventTypes: EventType[] = opts.eventTypes ?? (Object.keys(EVENT_DEFS) as EventType[]);

  // Build getLogs queries
  const queries = eventTypes.map((type) => {
    const { address, name } = EVENT_CONTRACT_MAP[type];
    const event = EVENT_DEFS[type];
    return { type, address, name, event };
  });

  // Execute all queries in parallel
  const results = await Promise.allSettled(
    queries.map(async (q) => {
      const logs = await client.getLogs({
        address: q.address,
        event: q.event as AbiEvent,
        fromBlock,
        toBlock,
      });
      return logs.map((log) =>
        parseEvent(log, q.type, q.name, (log as Log & { args: Record<string, unknown> }).args ?? {}),
      );
    }),
  );

  // Flatten and collect
  let events: ActivityEvent[] = [];
  for (const result of results) {
    if (result.status === "fulfilled") {
      events.push(...result.value);
    }
  }

  // Filter by tokenId if requested
  if (opts.tokenId !== undefined) {
    const tid = String(opts.tokenId);
    events = events.filter((e) => e.tokenId === tid);
  }

  // Filter by actor if requested
  if (opts.actor) {
    const actor = opts.actor.toLowerCase();
    events = events.filter(
      (e) => e.actor?.toLowerCase() === actor,
    );
  }

  // Sort by block number desc, then logIndex desc (newest first)
  events.sort((a, b) => {
    if (a.blockNumber !== b.blockNumber) {
      return Number(b.blockNumber - a.blockNumber);
    }
    return b.logIndex - a.logIndex;
  });

  // Apply limit
  if (opts.limit && opts.limit > 0) {
    events = events.slice(0, opts.limit);
  }

  // Best-effort: try to add timestamps for the first N events
  const uniqueBlocks = [...new Set(events.slice(0, 50).map((e) => e.blockNumber))];
  const blockTimestamps = new Map<bigint, number>();

  const blockResults = await Promise.allSettled(
    uniqueBlocks.map(async (bn) => {
      const block = await client.getBlock({ blockNumber: bn });
      return { blockNumber: bn, timestamp: Number(block.timestamp) };
    }),
  );
  for (const r of blockResults) {
    if (r.status === "fulfilled") {
      blockTimestamps.set(r.value.blockNumber, r.value.timestamp);
    }
  }
  for (const event of events) {
    const ts = blockTimestamps.get(event.blockNumber);
    if (ts) event.timestamp = ts;
  }

  return events;
}

/**
 * Get a summary of recent activity counts by type.
 */
export async function getActivitySummary(
  fromBlock?: bigint,
): Promise<Record<string, number>> {
  const events = await fetchActivityEvents({ fromBlock, limit: 500 });
  const summary: Record<string, number> = {};
  for (const e of events) {
    summary[e.type] = (summary[e.type] || 0) + 1;
  }
  return summary;
}
