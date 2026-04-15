/**
 * Fine-Tuning API Route
 *
 * POST /api/fine-tune
 * Actions:
 *   - create:    Create a new fine-tuning job
 *   - status:    Get job status & progress
 *   - poll:      Poll and advance progress
 *   - finalize:  Finalize a completed job
 *   - list:      List all jobs (optionally by tokenId)
 *   - stats:     Get agent fine-tuning stats
 *   - providers: Get available providers
 *   - estimate:  Estimate fine-tuning cost
 */

import { NextRequest, NextResponse } from "next/server";
import {
  getFineTuningService,
  DEFAULT_CONFIG,
  type FineTuneConfig,
  type DatasetEntry,
} from "../../../../lib/fineTuningService";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;
    const svc = getFineTuningService();

    switch (action) {
      // ----------------------------------------------------------
      //  Create a new fine-tuning job
      // ----------------------------------------------------------
      case "create": {
        const { tokenId, baseModel, dataset, config, providerAddress } = body;

        if (!tokenId || !baseModel || !dataset) {
          return NextResponse.json(
            { error: "Missing required fields: tokenId, baseModel, dataset" },
            { status: 400 }
          );
        }

        const entries: DatasetEntry[] = Array.isArray(dataset)
          ? dataset
          : parseJSONL(dataset);

        const mergedConfig: FineTuneConfig = {
          ...DEFAULT_CONFIG,
          ...(config ?? {}),
        };

        const provider =
          providerAddress ?? "0x940b4a101CaBa9be04b16A7363cafa29C1660B0d";

        const job = await svc.createJob({
          tokenId: Number(tokenId),
          baseModel,
          dataset: entries,
          config: mergedConfig,
          providerAddress: provider,
        });

        return NextResponse.json({
          status: "ok",
          job: sanitizeJob(job),
        });
      }

      // ----------------------------------------------------------
      //  Get job status
      // ----------------------------------------------------------
      case "status": {
        const { jobId } = body;
        if (!jobId) {
          return NextResponse.json({ error: "Missing jobId" }, { status: 400 });
        }

        const job = svc.getJob(jobId);
        if (!job) {
          return NextResponse.json({ error: "Job not found" }, { status: 404 });
        }

        return NextResponse.json({ status: "ok", job: sanitizeJob(job) });
      }

      // ----------------------------------------------------------
      //  Poll progress (simulated for MVP)
      // ----------------------------------------------------------
      case "poll": {
        const { jobId } = body;
        if (!jobId) {
          return NextResponse.json({ error: "Missing jobId" }, { status: 400 });
        }

        const job = await svc.pollProgress(jobId);
        return NextResponse.json({ status: "ok", job: sanitizeJob(job) });
      }

      // ----------------------------------------------------------
      //  Finalize a completed job
      // ----------------------------------------------------------
      case "finalize": {
        const { jobId } = body;
        if (!jobId) {
          return NextResponse.json({ error: "Missing jobId" }, { status: 400 });
        }

        const job = await svc.finalizeJob(jobId);
        return NextResponse.json({ status: "ok", job: sanitizeJob(job) });
      }

      // ----------------------------------------------------------
      //  List jobs
      // ----------------------------------------------------------
      case "list": {
        const { tokenId: tid } = body;
        const jobs = tid
          ? svc.getJobsForToken(Number(tid))
          : svc.getAllJobs();

        return NextResponse.json({
          status: "ok",
          jobs: jobs.map(sanitizeJob),
        });
      }

      // ----------------------------------------------------------
      //  Agent fine-tuning stats (on-chain)
      // ----------------------------------------------------------
      case "stats": {
        const { tokenId: statTokenId } = body;
        if (!statTokenId) {
          return NextResponse.json({ error: "Missing tokenId" }, { status: 400 });
        }

        const stats = await svc.getAgentStats(Number(statTokenId));
        return NextResponse.json({ status: "ok", stats });
      }

      // ----------------------------------------------------------
      //  Available providers
      // ----------------------------------------------------------
      case "providers": {
        const providers = svc.getProviders();
        return NextResponse.json({ status: "ok", providers });
      }

      // ----------------------------------------------------------
      //  Estimate cost
      // ----------------------------------------------------------
      case "estimate": {
        const { baseModel: estModel, datasetSize, epochs } = body;
        if (!estModel || !datasetSize) {
          return NextResponse.json(
            { error: "Missing baseModel or datasetSize" },
            { status: 400 }
          );
        }

        // Rough estimate: ~200 tokens per example average
        const tokenCount = Number(datasetSize) * 200;
        const fee = svc.estimateFee(estModel, tokenCount, epochs ?? 1);

        return NextResponse.json({
          status: "ok",
          estimate: {
            model: estModel,
            datasetSize: Number(datasetSize),
            tokenCount,
            epochs: epochs ?? 1,
            estimatedFee: fee.toFixed(4),
            currency: "A0GI",
          },
        });
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (err: any) {
    console.error("[fine-tune API]", err);
    return NextResponse.json(
      { error: err.message ?? "Internal error" },
      { status: 500 }
    );
  }
}

// ============================================================
//  Helpers
// ============================================================

/** Parse a JSONL string into DatasetEntry[] */
function parseJSONL(content: string): DatasetEntry[] {
  return content
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line));
}

/** Strip internal fields for the API response */
function sanitizeJob(job: any) {
  return {
    jobId: job.jobId,
    tokenId: job.tokenId,
    baseModel: job.baseModel,
    status: job.status,
    progress: job.progress,
    provider: job.provider,
    datasetHash: job.datasetHash,
    datasetStorageRoot: job.datasetStorageRoot,
    resultStorageRoot: job.resultStorageRoot,
    resultHash: job.resultHash,
    onChainJobId: job.onChainJobId,
    config: job.config,
    datasetSize: job.datasetSize,
    tokenCount: job.tokenCount,
    estimatedFee: job.estimatedFee,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    error: job.error,
    logs: job.logs,
  };
}
