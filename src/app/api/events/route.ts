import { NextRequest, NextResponse } from "next/server";
import { fetchActivityEvents, getActivitySummary, type IndexerOptions, type EventType } from "@/lib/eventIndexer";

/**
 * GET /api/events?tokenId=1&actor=0x…&types=AgentMinted,AgentSold&limit=50&blocks=10000
 *
 * Returns a paginated, filtered activity feed from all Graviton contracts.
 *
 * Query params:
 *   - tokenId: Filter by agent token ID
 *   - actor: Filter by actor address
 *   - types: Comma-separated event type names
 *   - limit: Max events to return (default 50, max 200)
 *   - blocks: How many blocks back to scan (default 5000, max 50000)
 *
 * POST /api/events { action: "summary" }
 *   - Returns count-by-type summary of recent events
 */

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const opts: IndexerOptions = {};

    // tokenId filter
    const tokenIdParam = searchParams.get("tokenId");
    if (tokenIdParam) {
      opts.tokenId = BigInt(tokenIdParam);
    }

    // actor filter
    const actorParam = searchParams.get("actor");
    if (actorParam) {
      opts.actor = actorParam;
    }

    // event type filter
    const typesParam = searchParams.get("types");
    if (typesParam) {
      opts.eventTypes = typesParam.split(",").filter(Boolean) as EventType[];
    }

    // limit
    const limitParam = searchParams.get("limit");
    opts.limit = Math.min(Number(limitParam) || 50, 200);

    // block range
    const blocksParam = searchParams.get("blocks");
    if (blocksParam) {
      const blocksBack = Math.min(Number(blocksParam) || 5000, 50000);
      // fromBlock will be calculated relative to latest in the indexer
      // We pass it as a hint via a special approach:
      // The indexer defaults to 5000 blocks back; we override by computing here
      const { createPublicClient, http } = await import("viem");
      const client = createPublicClient({
        transport: http(process.env.NEXT_PUBLIC_RPC_URL || "https://evmrpc-testnet.0g.ai"),
      });
      const latest = await client.getBlockNumber();
      opts.fromBlock = latest > BigInt(blocksBack) ? latest - BigInt(blocksBack) : 0n;
    }

    const events = await fetchActivityEvents(opts);

    // Serialize BigInt fields for JSON
    const serialized = events.map((e) => ({
      ...e,
      blockNumber: e.blockNumber.toString(),
    }));

    return NextResponse.json({
      events: serialized,
      count: serialized.length,
      meta: {
        tokenId: tokenIdParam || null,
        actor: actorParam || null,
        types: typesParam || null,
        limit: opts.limit,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[events] GET error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { action, fromBlock } = await req.json();

    if (action === "summary") {
      const summary = await getActivitySummary(
        fromBlock ? BigInt(fromBlock) : undefined,
      );
      return NextResponse.json({ summary });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[events] POST error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
