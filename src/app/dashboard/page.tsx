"use client";

import { useAccount } from "wagmi";
import { useReadContract, useReadContracts } from "wagmi";
import { parseAbi, formatEther } from "viem";
import { CONTRACTS } from "@/config/contracts";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import AgentCard from "@/components/marketplace/AgentCard";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import {
  Wallet,
  Cpu,
  ShoppingBag,
  Clock,
  Plus,
  Loader2,
  PackageOpen,
} from "lucide-react";
import Link from "next/link";
import ActivityFeed from "@/components/activity/ActivityFeed";
import { DashboardStatsSkeleton, AgentGridSkeleton } from "@/components/ui/Skeleton";

const inftAbi = parseAbi([
  "function balanceOf(address owner) external view returns (uint256)",
  "function tokenOfOwnerByIndex(address owner, uint256 index) external view returns (uint256)",
  "function categoryOf(uint256 tokenId) external view returns (string)",
]);

const registryAbi = parseAbi([
  "function getAgentMeta(uint256 tokenId) external view returns (string name, string description, string modelType, string[] tags, string storageHash, string metadataURI, uint256 registeredAt, uint256 updatedAt, uint256 version)",
  "function isRegistered(uint256 tokenId) external view returns (bool)",
  "function getAverageRating(uint256 tokenId) external view returns (uint256)",
  "function ratings(uint256 tokenId) external view returns (uint256 totalScore, uint256 ratingCount)",
  "function getUsageStats(uint256 tokenId) external view returns (uint256 inferenceCount, uint256 rentalCount, uint256 cloneCount)",
  "function getAgentsByCreator(address creator) external view returns (uint256[])",
]);

const marketplaceAbi = parseAbi([
  "function getListing(uint256 tokenId) external view returns (address seller, uint256 price, string category, bool isActive, uint256 listedAt)",
]);

export default function DashboardPage() {
  const { address, isConnected } = useAccount();

  // Get balance of owned tokens
  const { data: balance, isLoading: balLoading } = useReadContract({
    address: CONTRACTS.INFT,
    abi: inftAbi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const ownedCount = balance ? Number(balance) : 0;

  // Fetch token IDs owned
  const tokenIndexContracts = Array.from({ length: ownedCount }, (_, i) => ({
    address: CONTRACTS.INFT,
    abi: inftAbi,
    functionName: "tokenOfOwnerByIndex" as const,
    args: [address!, BigInt(i)],
  }));

  const { data: tokenIdsData, isLoading: idsLoading } = useReadContracts({
    contracts: tokenIndexContracts,
    query: { enabled: ownedCount > 0 && !!address },
  });

  const tokenIds = (tokenIdsData ?? [])
    .map((r) => r.result as bigint | undefined)
    .filter((id): id is bigint => id !== undefined);

  // Fetch metadata + stats for each owned token
  const detailContracts = tokenIds.flatMap((id) => [
    { address: CONTRACTS.REGISTRY, abi: registryAbi, functionName: "isRegistered" as const, args: [id] },
    { address: CONTRACTS.REGISTRY, abi: registryAbi, functionName: "getAgentMeta" as const, args: [id] },
    { address: CONTRACTS.REGISTRY, abi: registryAbi, functionName: "getAverageRating" as const, args: [id] },
    { address: CONTRACTS.REGISTRY, abi: registryAbi, functionName: "ratings" as const, args: [id] },
    { address: CONTRACTS.REGISTRY, abi: registryAbi, functionName: "getUsageStats" as const, args: [id] },
    { address: CONTRACTS.INFT, abi: inftAbi, functionName: "categoryOf" as const, args: [id] },
    { address: CONTRACTS.MARKETPLACE, abi: marketplaceAbi, functionName: "getListing" as const, args: [id] },
  ]);

  const { data: detailData, isLoading: detailLoading } = useReadContracts({
    contracts: detailContracts,
    query: { enabled: tokenIds.length > 0 },
  });

  // Also fetch agents created by this user (may differ from owned)
  const { data: createdIds } = useReadContract({
    address: CONTRACTS.REGISTRY,
    abi: registryAbi,
    functionName: "getAgentsByCreator",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const isLoading = balLoading || idsLoading || detailLoading;

  if (!isConnected) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-5 px-4">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-accent/10">
              <Wallet className="h-10 w-10 text-accent-light opacity-60" />
            </div>
            <p className="text-xl font-semibold text-foreground">
              Connect Your Wallet
            </p>
            <p className="text-sm text-muted max-w-md leading-relaxed">
              Connect to the 0G Galileo Testnet to view your agents and activity.
            </p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // Parse detail data
  const FIELDS = 7;
  interface OwnedAgent {
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
    isRegistered: boolean;
  }

  const ownedAgents: OwnedAgent[] = [];

  for (let idx = 0; idx < tokenIds.length; idx++) {
    const base = idx * FIELDS;
    const isReg = detailData?.[base]?.result as boolean | undefined;
    const meta = detailData?.[base + 1]?.result as
      | readonly [string, string, string, readonly string[], string, string, bigint, bigint, bigint]
      | undefined;
    const avgR = detailData?.[base + 2]?.result as bigint | undefined;
    const ratings = detailData?.[base + 3]?.result as readonly [bigint, bigint] | undefined;
    const stats = detailData?.[base + 4]?.result as readonly [bigint, bigint, bigint] | undefined;
    const cat = detailData?.[base + 5]?.result as string | undefined;
    const listing = detailData?.[base + 6]?.result as readonly [string, bigint, string, boolean, bigint] | undefined;

    ownedAgents.push({
      tokenId: tokenIds[idx],
      name: meta?.[0] ?? `Agent #${tokenIds[idx]}`,
      description: meta?.[1] ?? "Unregistered agent",
      modelType: meta?.[2] ?? "Unknown",
      category: cat ?? "other",
      tags: meta?.[3] ? [...meta[3]] : [],
      averageRating: avgR ? Number(avgR) / 100 : 0,
      ratingCount: ratings ? ratings[1] : 0n,
      inferenceCount: stats ? stats[0] : 0n,
      listingPrice: listing && listing[3] ? listing[1] : null,
      isActive: listing ? listing[3] : false,
      isRegistered: !!isReg,
    });
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-10">
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-2">
                <span className="gradient-text">Dashboard</span>
              </h1>
              <p className="text-muted">
                Manage your AI agents, listings, and rentals.
              </p>
            </div>
            <Link href="/create">
              <Button icon={<Plus className="h-4 w-4" />}>Create Agent</Button>
            </Link>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 mb-10">
            {[
              { label: "Owned Agents", value: ownedCount, icon: Cpu },
              {
                label: "Created Agents",
                value: createdIds ? (createdIds as bigint[]).length : 0,
                icon: ShoppingBag,
              },
              {
                label: "Listed",
                value: ownedAgents.filter((a) => a.isActive).length,
                icon: Clock,
              },
              {
                label: "Total Inferences",
                value: ownedAgents
                  .reduce((sum, a) => sum + Number(a.inferenceCount), 0)
                  .toLocaleString(),
                icon: Cpu,
              },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-2xl border border-border/60 bg-card/40 p-5"
              >
                <stat.icon className="h-5 w-5 text-accent-light mb-3" />
                <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                <p className="text-xs text-muted mt-1">{stat.label}</p>
              </div>
            ))}
          </div>

          {/* Loading */}
          {isLoading && (
            <>
              <DashboardStatsSkeleton />
              <AgentGridSkeleton count={3} />
            </>
          )}

          {/* No agents */}
          {!isLoading && ownedAgents.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-muted">
              <PackageOpen className="h-14 w-14 mb-5 opacity-30" />
              <p className="text-lg font-medium mb-2 text-foreground">No agents yet</p>
              <p className="text-sm mb-8">
                Create your first AI agent to get started.
              </p>
              <Link href="/create">
                <Button icon={<Plus className="h-4 w-4" />}>
                  Create Agent
                </Button>
              </Link>
            </div>
          )}

          {/* Owned agents grid */}
          {!isLoading && ownedAgents.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-foreground mb-5">
                Your Agents
              </h2>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {ownedAgents.map((agent) => (
                  <div key={agent.tokenId.toString()} className="relative">
                    {!agent.isRegistered && (
                      <div className="absolute top-3 right-3 z-10">
                        <Badge variant="warning">Unregistered</Badge>
                      </div>
                    )}
                    <AgentCard {...agent} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Activity Feed (E5) */}
          {isConnected && (
            <div className="mt-10">
              <ActivityFeed
                actor={address}
                title="Your Activity"
                limit={15}
                pollInterval={30000}
                maxHeight="360px"
              />
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
