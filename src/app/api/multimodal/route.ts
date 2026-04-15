/**
 * Multi-Modal API Route
 *
 * POST /api/multimodal
 * Actions:
 *   - profile:      Get agent's multi-modal profile
 *   - modalities:   Get supported modalities for an agent
 *   - usage:        Get per-modality usage stats
 *   - config:       Get config for a specific modality
 *   - agents:       Get agents supporting a given modality
 *   - stats:        Global multi-modal stats
 */

import { NextRequest, NextResponse } from "next/server";

function ok(data: Record<string, unknown>) {
  return NextResponse.json(data, { status: 200 });
}

function err(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}

const MODALITY_NAMES = ["Text", "Image", "Audio", "Video", "Code"];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case "profile": {
        const { tokenId } = body;
        if (tokenId === undefined) return err("Missing tokenId");
        return ok({
          profile: {
            tokenId,
            modalityCount: 0,
            pipelineStageCount: 0,
            totalUsage: 0,
            registeredAt: 0,
            updatedAt: 0,
            isActive: false,
          },
          note: "Use on-chain hooks for real-time data",
        });
      }

      case "modalities": {
        const { tokenId } = body;
        if (tokenId === undefined) return err("Missing tokenId");
        return ok({
          modalities: [false, false, false, false, false],
          labels: MODALITY_NAMES,
          note: "Use on-chain hooks for real-time data",
        });
      }

      case "usage": {
        const { tokenId } = body;
        if (tokenId === undefined) return err("Missing tokenId");
        return ok({
          usage: [0, 0, 0, 0, 0],
          labels: MODALITY_NAMES,
        });
      }

      case "config": {
        const { tokenId, modality } = body;
        if (tokenId === undefined || modality === undefined) return err("Missing tokenId or modality");
        return ok({
          config: {
            modality,
            enabled: false,
            capabilities: [],
            modelReference: "",
            storageRoot: "",
            weightsHash: "0x" + "0".repeat(64),
            addedAt: 0,
            updatedAt: 0,
          },
          note: "Use on-chain hooks for real-time data",
        });
      }

      case "agents": {
        const { modality } = body;
        if (modality === undefined) return err("Missing modality");
        return ok({
          modality,
          label: MODALITY_NAMES[modality] || "Unknown",
          agentIds: [],
          note: "Use on-chain hooks for real-time data",
        });
      }

      case "stats": {
        return ok({
          totalMultiModalAgents: 0,
          totalModalityRegistrations: 0,
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
