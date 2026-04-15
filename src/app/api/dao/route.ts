/**
 * DAO API Route
 *
 * POST /api/dao
 * Actions:
 *   - pools:           Get current pool balances
 *   - stats:           Get DAO global stats
 *   - proposals:       List proposals (paginated)
 *   - proposal:        Get single proposal by ID
 *   - creator-rewards: Get creator reward info
 *   - stake-info:      Get stake info for a token
 */

import { NextRequest, NextResponse } from "next/server";

// In-memory cache for proposals (MVP — production would read from chain events)
const proposalCache: Map<number, {
  id: number;
  proposer: string;
  title: string;
  description: string;
  recipient: string;
  amount: string;
  votesFor: number;
  votesAgainst: number;
  createdAt: number;
  deadline: number;
  status: number;
}> = new Map();

function ok(data: Record<string, unknown>) {
  return NextResponse.json(data, { status: 200 });
}

function err(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      // ─── Pool Balances ────────────────────────────────────
      case "pools": {
        // These are read from the contract on the frontend via hooks.
        // This endpoint provides a cached/fallback view.
        return ok({
          pools: {
            creators: "0",
            stakers: "0",
            treasury: "0",
            totalDistributed: "0",
          },
          note: "Use on-chain hooks for real-time data",
        });
      }

      // ─── DAO Stats ────────────────────────────────────────
      case "stats": {
        return ok({
          stats: {
            totalStaked: 0,
            totalRevenueDistributed: "0",
            totalStakerRewardsPaid: "0",
            totalCreatorRewardsPaid: "0",
            totalProposals: proposalCache.size,
            treasuryBalance: "0",
          },
          note: "Use on-chain hooks for real-time data",
        });
      }

      // ─── List Proposals ───────────────────────────────────
      case "proposals": {
        const { offset = 0, limit = 20 } = body;
        const all = Array.from(proposalCache.values())
          .sort((a, b) => b.createdAt - a.createdAt)
          .slice(offset, offset + limit);

        return ok({ proposals: all, total: proposalCache.size });
      }

      // ─── Single Proposal ─────────────────────────────────
      case "proposal": {
        const { proposalId } = body;
        if (proposalId === undefined) return err("Missing proposalId");
        const p = proposalCache.get(proposalId);
        if (!p) return ok({ proposal: null, note: "Read from chain" });
        return ok({ proposal: p });
      }

      // ─── Cache Proposal (called after on-chain create) ───
      case "cache-proposal": {
        const { proposal } = body;
        if (!proposal || proposal.id === undefined) return err("Invalid proposal");
        proposalCache.set(proposal.id, proposal);
        return ok({ cached: true, id: proposal.id });
      }

      // ─── Creator Rewards ─────────────────────────────────
      case "creator-rewards": {
        const { creator } = body;
        if (!creator) return err("Missing creator address");
        return ok({
          rewards: {
            totalEarned: "0",
            pendingRewards: "0",
            agentCount: 0,
            totalVolume: "0",
            lastUpdatedAt: 0,
          },
          note: "Use on-chain hooks for real-time data",
        });
      }

      // ─── Stake Info ───────────────────────────────────────
      case "stake-info": {
        const { tokenId } = body;
        if (tokenId === undefined) return err("Missing tokenId");
        return ok({
          stake: {
            owner: "0x0000000000000000000000000000000000000000",
            tokenId,
            stakedAt: 0,
            lastClaimedAt: 0,
            isActive: false,
          },
          note: "Use on-chain hooks for real-time data",
        });
      }

      default:
        return err(`Unknown action: ${action}`);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
