"use client";

import { useReadContract, useReadContracts } from "wagmi";
import { parseAbi } from "viem";
import { CONTRACTS } from "@/config/contracts";
import { useAppStore } from "@/store/useAppStore";
import AgentCard from "./AgentCard";
import { Loader2, PackageOpen } from "lucide-react";
import { AgentGridSkeleton, ErrorState } from "@/components/ui/Skeleton";

// Parsed ABIs for proper viem typing in useReadContracts
const registryAbi = parseAbi([
  "function isRegistered(uint256 tokenId) external view returns (bool)",
  "function getAverageRating(uint256 tokenId) external view returns (uint256)",
  "function ratings(uint256 tokenId) external view returns (uint256 totalScore, uint256 ratingCount)",
  "function getUsageStats(uint256 tokenId) external view returns (uint256 inferenceCount, uint256 rentalCount, uint256 cloneCount)",
  "function getAgentMeta(uint256 tokenId) external view returns (string name, string description, string modelType, string[] tags, string storageHash, string metadataURI, uint256 registeredAt, uint256 updatedAt, uint256 version)",
  "function totalRegistered() external view returns (uint256)",
]);

const inftAbi = parseAbi([
  "function totalSupply() external view returns (uint256)",
  "function categoryOf(uint256 tokenId) external view returns (string)",
]);

const marketplaceAbi = parseAbi([
  "function getListing(uint256 tokenId) external view returns (address seller, uint256 price, string category, bool isActive, uint256 listedAt)",
]);

interface ParsedAgent {
  tokenId: bigint;
  name: string;
  description: string;
  modelType: string;
  category: string;
  tags: string[];
  averageRating: number;
  ratingCount: bigint;
  inferenceCount: bigint;
  listingPrice: bigint | null;
  isActive: boolean;
}

export default function AgentGrid() {
  const { categoryFilter, ratingFilter, searchQuery } = useAppStore();

  const { data: totalSupply, isLoading: supplyLoading } = useReadContract({
    address: CONTRACTS.INFT,
    abi: inftAbi,
    functionName: "totalSupply",
  });

  const supply = totalSupply ? Number(totalSupply) : 0;
  const tokenIds = Array.from({ length: supply }, (_, i) => BigInt(i + 1));

  // Batch fetch per token: isRegistered, avgRating, ratings, usageStats, category, listing
  const batchContracts = tokenIds.flatMap((id) => [
    { address: CONTRACTS.REGISTRY, abi: registryAbi, functionName: "isRegistered" as const, args: [id] },
    { address: CONTRACTS.REGISTRY, abi: registryAbi, functionName: "getAverageRating" as const, args: [id] },
    { address: CONTRACTS.REGISTRY, abi: registryAbi, functionName: "ratings" as const, args: [id] },
    { address: CONTRACTS.REGISTRY, abi: registryAbi, functionName: "getUsageStats" as const, args: [id] },
    { address: CONTRACTS.INFT, abi: inftAbi, functionName: "categoryOf" as const, args: [id] },
    { address: CONTRACTS.MARKETPLACE, abi: marketplaceAbi, functionName: "getListing" as const, args: [id] },
  ]);

  const { data: batchData, isLoading: batchLoading } = useReadContracts({
    contracts: batchContracts,
    query: { enabled: supply > 0 },
  });

  const metaContracts = tokenIds.map((id) => ({
    address: CONTRACTS.REGISTRY,
    abi: registryAbi,
    functionName: "getAgentMeta" as const,
    args: [id],
  }));

  const { data: metaData, isLoading: metaLoading } = useReadContracts({
    contracts: metaContracts,
    query: { enabled: supply > 0 },
  });

  const isLoading = supplyLoading || batchLoading || metaLoading;

  if (isLoading) {
    return <AgentGridSkeleton count={6} />;
  }

  if (supply === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-28 text-muted">
        <PackageOpen className="h-14 w-14 mb-5 opacity-30" />
        <p className="text-lg font-medium mb-2 text-foreground">No agents yet</p>
        <p className="text-sm">Be the first to mint an AI agent on Graviton.</p>
      </div>
    );
  }

  // Parse batch data into typed agent objects
  const FIELDS = 6;
  const agents: ParsedAgent[] = [];

  for (let idx = 0; idx < tokenIds.length; idx++) {
    const base = idx * FIELDS;
    const isRegistered = batchData?.[base]?.result as boolean | undefined;
    if (!isRegistered) continue;

    const meta = metaData?.[idx]?.result as
      | readonly [string, string, string, readonly string[], string, string, bigint, bigint, bigint]
      | undefined;
    if (!meta) continue;

    const avgRating100 = batchData?.[base + 1]?.result as bigint | undefined;
    const ratingsRaw = batchData?.[base + 2]?.result as readonly [bigint, bigint] | undefined;
    const statsRaw = batchData?.[base + 3]?.result as readonly [bigint, bigint, bigint] | undefined;
    const category = batchData?.[base + 4]?.result as string | undefined;
    const listingRaw = batchData?.[base + 5]?.result as readonly [string, bigint, string, boolean, bigint] | undefined;

    const averageRating = avgRating100 ? Number(avgRating100) / 100 : 0;
    const ratingCount = ratingsRaw ? ratingsRaw[1] : 0n;
    const inferenceCount = statsRaw ? statsRaw[0] : 0n;
    const listingActive = listingRaw ? listingRaw[3] : false;
    const listingPrice = listingActive ? listingRaw![1] : null;

    agents.push({
      tokenId: tokenIds[idx],
      name: meta[0] as string,
      description: meta[1] as string,
      modelType: meta[2] as string,
      category: (category as string) || "other",
      tags: (meta[3] as string[]) || [],
      averageRating,
      ratingCount,
      inferenceCount,
      listingPrice,
      isActive: listingActive,
    });
  }

  // Apply filters
  const filtered = agents.filter((agent) => {
    if (categoryFilter !== "all" && agent.category !== categoryFilter) return false;
    if (ratingFilter > 0 && agent.averageRating < ratingFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const match =
        agent.name.toLowerCase().includes(q) ||
        agent.description.toLowerCase().includes(q) ||
        agent.tags.some((t) => t.toLowerCase().includes(q));
      if (!match) return false;
    }
    return true;
  });

  if (filtered.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-28 text-muted">
        <PackageOpen className="h-14 w-14 mb-5 opacity-30" />
        <p className="text-lg font-medium mb-2 text-foreground">No matching agents</p>
        <p className="text-sm">Try adjusting your filters.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {filtered.map((agent) => (
        <AgentCard key={agent.tokenId.toString()} {...agent} />
      ))}
    </div>
  );
}
