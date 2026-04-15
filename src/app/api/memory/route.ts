/**
 * Graviton — Memory API Route
 *
 * Backend API for agent memory CRUD operations.
 * Bridges the frontend TestDriveChat with the MemoryService + 0G Storage.
 *
 * Endpoints (all POST with JSON body):
 *   action: "start"      — Start/resume a memory session
 *   action: "add"        — Add a conversation entry
 *   action: "commit"     — Commit memory to 0G Storage + on-chain
 *   action: "load"       — Load memory context from 0G Storage
 *   action: "state"      — Get on-chain memory state
 *   action: "initialize" — Initialize memory for an agent on-chain
 */

import { NextRequest, NextResponse } from "next/server";

// In-memory session store (server-side)
// In production this would be Redis or similar
interface SessionEntry {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  verified?: boolean;
}

interface SessionData {
  agentId: string;
  sessionId: string;
  entries: SessionEntry[];
  interactionCount: number;
  createdAt: number;
  summary?: string;
  preferences?: Record<string, string>;
}

const sessions = new Map<string, SessionData>();

function sessionKey(agentId: string, sessionId: string): string {
  return `${agentId}:${sessionId}`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, agentId, sessionId } = body;

    if (!action) {
      return NextResponse.json({ error: "Missing action" }, { status: 400 });
    }

    switch (action) {
      case "start":
        return handleStart(agentId, sessionId);

      case "add":
        return handleAdd(agentId, sessionId, body.entry);

      case "commit":
        return handleCommit(agentId, sessionId, body.snapshotType);

      case "load":
        return handleLoad(agentId, body.encryptionKey);

      case "state":
        return handleState(agentId);

      case "initialize":
        return handleInitialize(agentId);

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error: any) {
    console.error("[Memory API] Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal error" },
      { status: 500 }
    );
  }
}

// ============================================================
//                        HANDLERS
// ============================================================

/**
 * Start or resume a memory session.
 */
function handleStart(agentId: string, sessionId: string) {
  if (!agentId || !sessionId) {
    return NextResponse.json(
      { error: "Missing agentId or sessionId" },
      { status: 400 }
    );
  }

  const key = sessionKey(agentId, sessionId);

  if (sessions.has(key)) {
    const session = sessions.get(key)!;
    return NextResponse.json({
      status: "resumed",
      entries: session.entries.length,
      interactionCount: session.interactionCount,
    });
  }

  const session: SessionData = {
    agentId,
    sessionId,
    entries: [],
    interactionCount: 0,
    createdAt: Date.now(),
    preferences: {},
  };

  sessions.set(key, session);

  return NextResponse.json({
    status: "started",
    entries: 0,
    interactionCount: 0,
  });
}

/**
 * Add a conversation entry to the session.
 */
function handleAdd(
  agentId: string,
  sessionId: string,
  entry: SessionEntry
) {
  if (!agentId || !sessionId || !entry) {
    return NextResponse.json(
      { error: "Missing agentId, sessionId, or entry" },
      { status: 400 }
    );
  }

  const key = sessionKey(agentId, sessionId);
  let session = sessions.get(key);

  if (!session) {
    session = {
      agentId,
      sessionId,
      entries: [],
      interactionCount: 0,
      createdAt: Date.now(),
      preferences: {},
    };
    sessions.set(key, session);
  }

  session.entries.push({
    role: entry.role,
    content: entry.content,
    timestamp: entry.timestamp || Date.now(),
    verified: entry.verified,
  });

  if (entry.role === "user") {
    session.interactionCount++;
  }

  return NextResponse.json({
    status: "added",
    totalEntries: session.entries.length,
    interactionCount: session.interactionCount,
  });
}

/**
 * Commit session memory to 0G Storage and anchor on-chain.
 *
 * For the hackathon demo, this returns a simulated commit result
 * because 0G Storage uploads require the full SDK running server-side
 * with a funded wallet. The architecture is real — the simulation
 * shows judges what happens in production.
 */
function handleCommit(
  agentId: string,
  sessionId: string,
  snapshotType?: string
) {
  if (!agentId || !sessionId) {
    return NextResponse.json(
      { error: "Missing agentId or sessionId" },
      { status: 400 }
    );
  }

  const key = sessionKey(agentId, sessionId);
  const session = sessions.get(key);

  if (!session || session.entries.length === 0) {
    return NextResponse.json(
      { error: "No session data to commit" },
      { status: 400 }
    );
  }

  // Generate content hash from the session data
  const memoryJson = JSON.stringify(session);
  const encoder = new TextEncoder();
  const data = encoder.encode(memoryJson);

  // Simple hash for demo (in production: ethers.keccak256)
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    hash = ((hash << 5) - hash + data[i]) | 0;
  }
  const contentHash = `0x${Math.abs(hash).toString(16).padStart(64, "0")}`;

  // Simulated 0G Storage root
  const storageRoot = `0x${Date.now().toString(16).padStart(64, "0")}`;

  // Simulated encryption key
  const encryptionKey = Buffer.from(
    `graviton-memory-${agentId}-${sessionId}-${Date.now()}`
  ).toString("base64").slice(0, 44);

  const result = {
    status: "committed",
    storageRoot,
    contentHash,
    snapshotType: snapshotType || "conversation",
    interactionCount: session.interactionCount,
    totalEntries: session.entries.length,
    encryptionKey,
    // In production, txHash comes from the on-chain commit
    txHash: `0x${Date.now().toString(16)}${"0".repeat(48)}`.slice(0, 66),
    note: "Memory committed to 0G Storage (demo mode). In production, this uploads encrypted memory to 0G Storage and anchors the Merkle root on-chain via GravitonMemory contract.",
  };

  return NextResponse.json(result);
}

/**
 * Load memory context from 0G Storage.
 * In demo mode, returns the cached session data.
 */
function handleLoad(agentId: string, encryptionKey?: string) {
  if (!agentId) {
    return NextResponse.json(
      { error: "Missing agentId" },
      { status: 400 }
    );
  }

  // Find the most recent session for this agent
  let latestSession: SessionData | null = null;
  for (const [key, session] of sessions) {
    if (session.agentId === agentId) {
      if (!latestSession || session.createdAt > latestSession.createdAt) {
        latestSession = session;
      }
    }
  }

  if (!latestSession) {
    return NextResponse.json({
      summary: "",
      recentEntries: [],
      preferences: {},
      totalInteractions: 0,
      memorySnapshots: 0,
    });
  }

  // Build memory context
  const recentEntries = latestSession.entries.slice(-10);

  // Simple summary
  const userMsgCount = latestSession.entries.filter(e => e.role === "user").length;
  const summary = latestSession.entries.length > 0
    ? `Previous session: ${userMsgCount} user messages, ${latestSession.entries.length} total entries.`
    : "";

  return NextResponse.json({
    summary,
    recentEntries,
    preferences: latestSession.preferences || {},
    totalInteractions: latestSession.interactionCount,
    memorySnapshots: 1,
  });
}

/**
 * Get on-chain memory state.
 * In demo mode, returns simulated state from session data.
 */
function handleState(agentId: string) {
  if (!agentId) {
    return NextResponse.json(
      { error: "Missing agentId" },
      { status: 400 }
    );
  }

  // Aggregate from all sessions for this agent
  let totalInteractions = 0;
  let totalSnapshots = 0;
  let lastUpdated = 0;
  let isActive = false;

  for (const [_, session] of sessions) {
    if (session.agentId === agentId) {
      totalInteractions += session.interactionCount;
      totalSnapshots++;
      isActive = true;
      if (session.createdAt > lastUpdated) {
        lastUpdated = session.createdAt;
      }
    }
  }

  return NextResponse.json({
    totalInteractions,
    totalSnapshots,
    lastUpdated,
    isActive,
    latestStorageRoot: isActive
      ? `0x${lastUpdated.toString(16).padStart(64, "0")}`
      : "",
  });
}

/**
 * Initialize memory for an agent.
 * In demo mode, just marks the agent as having memory enabled.
 */
function handleInitialize(agentId: string) {
  if (!agentId) {
    return NextResponse.json(
      { error: "Missing agentId" },
      { status: 400 }
    );
  }

  return NextResponse.json({
    status: "initialized",
    agentId,
    txHash: `0x${Date.now().toString(16)}${"0".repeat(48)}`.slice(0, 66),
    note: "Memory initialized on GravitonMemory contract (demo mode).",
  });
}
