/**
 * Graviton — Attestation API Route
 *
 * Backend API for TEE attestation operations.
 * Bridges the frontend with attestation verification + on-chain anchoring.
 *
 * Endpoints (all POST with JSON body):
 *   action: "submit"     — Submit attestation after an inference session
 *   action: "stats"      — Get attestation stats for an agent
 *   action: "receipt"     — Get a specific attestation receipt
 *   action: "verify"      — Check verification rate for an agent
 *   action: "provider"    — Get provider reputation
 *   action: "history"     — Get recent attestation IDs for an agent
 */

import { NextRequest, NextResponse } from "next/server";

// In-memory attestation store for demo mode
interface DemoReceipt {
  receiptId: number;
  tokenId: string;
  provider: string;
  requester: string;
  requestHash: string;
  responseHash: string;
  chatId: string;
  model: string;
  timestamp: number;
  status: number; // 0=Unverified, 1=Verified, 2=Failed
  inputTokens: number;
  outputTokens: number;
}

const receipts: DemoReceipt[] = [];
let nextReceiptId = 0;

// Aggregate stats per agent
const agentStats: Map<string, {
  totalAttestations: number;
  verifiedCount: number;
  failedCount: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  lastAttestationTime: number;
}> = new Map();

// Provider reputation
const providerRep: Map<string, {
  totalServiced: number;
  verifiedCount: number;
  failedCount: number;
  firstSeen: number;
  lastSeen: number;
}> = new Map();

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    if (!action) {
      return NextResponse.json({ error: "Missing action" }, { status: 400 });
    }

    switch (action) {
      case "submit":
        return handleSubmit(body);
      case "stats":
        return handleStats(body.tokenId);
      case "receipt":
        return handleReceipt(body.receiptId);
      case "verify":
        return handleVerify(body.tokenId);
      case "provider":
        return handleProvider(body.provider);
      case "history":
        return handleHistory(body.tokenId, body.offset, body.limit);
      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error: any) {
    console.error("[Attestation API] Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal error" },
      { status: 500 }
    );
  }
}

// ============================================================
//                        HANDLERS
// ============================================================

function handleSubmit(body: any) {
  const {
    tokenId,
    provider,
    requester,
    requestContent,
    responseContent,
    chatId,
    model,
    verified,
    inputTokens,
    outputTokens,
  } = body;

  if (!tokenId || !chatId) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Hash content
  const requestHash = simpleHash(requestContent || "");
  const responseHash = simpleHash(responseContent || "");

  const receiptId = nextReceiptId++;

  const receipt: DemoReceipt = {
    receiptId,
    tokenId: String(tokenId),
    provider: provider || "0G-Compute-TEE-Demo",
    requester: requester || "0x0000000000000000000000000000000000000000",
    requestHash,
    responseHash,
    chatId,
    model: model || "graviton-demo-agent",
    timestamp: Date.now(),
    status: verified ? 1 : 0,
    inputTokens: inputTokens || 0,
    outputTokens: outputTokens || 0,
  };

  receipts.push(receipt);

  // Update agent stats
  const statsKey = String(tokenId);
  if (!agentStats.has(statsKey)) {
    agentStats.set(statsKey, {
      totalAttestations: 0,
      verifiedCount: 0,
      failedCount: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      lastAttestationTime: 0,
    });
  }
  const stats = agentStats.get(statsKey)!;
  stats.totalAttestations++;
  stats.lastAttestationTime = receipt.timestamp;
  stats.totalInputTokens += receipt.inputTokens;
  stats.totalOutputTokens += receipt.outputTokens;
  if (verified) stats.verifiedCount++;

  // Update provider reputation
  const provKey = receipt.provider;
  if (!providerRep.has(provKey)) {
    providerRep.set(provKey, {
      totalServiced: 0,
      verifiedCount: 0,
      failedCount: 0,
      firstSeen: receipt.timestamp,
      lastSeen: receipt.timestamp,
    });
  }
  const prov = providerRep.get(provKey)!;
  prov.totalServiced++;
  prov.lastSeen = receipt.timestamp;
  if (verified) prov.verifiedCount++;

  return NextResponse.json({
    receiptId,
    txHash: `0x${Date.now().toString(16)}${"0".repeat(48)}`.slice(0, 66),
    verified: !!verified,
    requestHash,
    responseHash,
    status: verified ? "Verified" : "Unverified",
    note: "TEE attestation anchored on-chain via GravitonAttestation (demo mode).",
  });
}

function handleStats(tokenId: string) {
  if (!tokenId) {
    return NextResponse.json({ error: "Missing tokenId" }, { status: 400 });
  }

  const stats = agentStats.get(String(tokenId));

  if (!stats) {
    return NextResponse.json({
      totalAttestations: 0,
      verifiedCount: 0,
      failedCount: 0,
      disputedCount: 0,
      lastAttestationTime: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      verificationRate: 0,
    });
  }

  const rate = stats.totalAttestations > 0
    ? Math.round((stats.verifiedCount / stats.totalAttestations) * 10000)
    : 0;

  return NextResponse.json({
    ...stats,
    disputedCount: 0,
    verificationRate: rate,
  });
}

function handleReceipt(receiptId: number) {
  if (receiptId === undefined || receiptId === null) {
    return NextResponse.json({ error: "Missing receiptId" }, { status: 400 });
  }

  const receipt = receipts.find((r) => r.receiptId === receiptId);
  if (!receipt) {
    return NextResponse.json({ error: "Receipt not found" }, { status: 404 });
  }

  const statusLabels = ["Unverified", "Verified", "Failed", "Disputed"];

  return NextResponse.json({
    ...receipt,
    statusLabel: statusLabels[receipt.status] || "Unknown",
  });
}

function handleVerify(tokenId: string) {
  if (!tokenId) {
    return NextResponse.json({ error: "Missing tokenId" }, { status: 400 });
  }

  const stats = agentStats.get(String(tokenId));
  const hasVerified = stats ? stats.verifiedCount > 0 : false;
  const rate = stats && stats.totalAttestations > 0
    ? Math.round((stats.verifiedCount / stats.totalAttestations) * 10000)
    : 0;

  return NextResponse.json({
    hasVerifiedAttestations: hasVerified,
    verificationRate: rate,
    verificationRatePercent: (rate / 100).toFixed(1),
    totalAttestations: stats?.totalAttestations || 0,
    verifiedCount: stats?.verifiedCount || 0,
  });
}

function handleProvider(provider: string) {
  if (!provider) {
    return NextResponse.json({ error: "Missing provider" }, { status: 400 });
  }

  const rep = providerRep.get(provider);
  if (!rep) {
    return NextResponse.json({
      totalServiced: 0,
      verifiedCount: 0,
      failedCount: 0,
      firstSeen: 0,
      lastSeen: 0,
      isActive: false,
      reliabilityRate: 0,
    });
  }

  const rate = rep.totalServiced > 0
    ? Math.round((rep.verifiedCount / rep.totalServiced) * 10000)
    : 0;

  return NextResponse.json({
    ...rep,
    isActive: true,
    reliabilityRate: rate,
    reliabilityRatePercent: (rate / 100).toFixed(1),
  });
}

function handleHistory(tokenId: string, offset = 0, limit = 20) {
  if (!tokenId) {
    return NextResponse.json({ error: "Missing tokenId" }, { status: 400 });
  }

  const agentReceipts = receipts.filter((r) => r.tokenId === String(tokenId));
  const sliced = agentReceipts.slice(offset, offset + limit);

  return NextResponse.json({
    receipts: sliced,
    total: agentReceipts.length,
    offset,
    limit,
  });
}

// Simple hash for demo purposes
function simpleHash(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) - hash + input.charCodeAt(i)) | 0;
  }
  return `0x${Math.abs(hash).toString(16).padStart(64, "0")}`;
}
