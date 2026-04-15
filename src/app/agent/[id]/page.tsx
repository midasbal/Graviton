"use client";

import { use, useState, useEffect, useCallback } from "react";
import { useAccount } from "wagmi";
import { useReadContract } from "wagmi";
import { parseAbi, formatEther } from "viem";
import { CONTRACTS } from "@/config/contracts";
import {
  useBuyAgent,
  useRentAgent,
  useRateAgent,
  useSupportedModalities,
  useHasModalProfile,
} from "@/hooks/useContracts";
import { useAppStore } from "@/store/useAppStore";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import StarRating from "@/components/ui/StarRating";
import TestDriveChat from "@/components/agent/TestDriveChat";
import ActivityFeed from "@/components/activity/ActivityFeed";
import {
  Cpu,
  Shield,
  Database,
  Activity,
  Copy,
  ExternalLink,
  ShoppingCart,
  Clock,
  MessageSquare,
  ArrowLeft,
  User,
  Hash,
  ImageIcon,
  Music,
  Video,
  Code,
  Layers,
} from "lucide-react";
import Link from "next/link";
import { MODALITY_LABELS, MODALITY_ICONS } from "@/types";
import { AgentDetailSkeleton } from "@/components/ui/Skeleton";

const registryAbi = parseAbi([
  "function getAgentMeta(uint256 tokenId) external view returns (string name, string description, string modelType, string[] tags, string storageHash, string metadataURI, uint256 registeredAt, uint256 updatedAt, uint256 version)",
  "function getAverageRating(uint256 tokenId) external view returns (uint256)",
  "function ratings(uint256 tokenId) external view returns (uint256 totalScore, uint256 ratingCount)",
  "function getUsageStats(uint256 tokenId) external view returns (uint256 inferenceCount, uint256 rentalCount, uint256 cloneCount)",
  "function isRegistered(uint256 tokenId) external view returns (bool)",
]);

const inftAbi = parseAbi([
  "function ownerOf(uint256 tokenId) external view returns (address)",
  "function creatorOf(uint256 tokenId) external view returns (address)",
  "function categoryOf(uint256 tokenId) external view returns (string)",
  "function storageRootOf(uint256 tokenId) external view returns (string)",
]);

const marketplaceAbi = parseAbi([
  "function getListing(uint256 tokenId) external view returns (address seller, uint256 price, string category, bool isActive, uint256 listedAt)",
  "function getRental(uint256 tokenId) external view returns (address renter, uint256 pricePerDay, uint256 startTime, uint256 endTime, bool isActive)",
]);

// ── Contract return tuple types ──────────────────────────────
type AgentMetaTuple = readonly [string, string, string, readonly string[], string, string, bigint, bigint, bigint];
type RatingsTuple = readonly [bigint, bigint];
type StatsTuple = readonly [bigint, bigint, bigint];
type ListingTuple = readonly [string, bigint, string, boolean, bigint];
type RentalTuple = readonly [string, bigint, bigint, bigint, boolean];

interface StorageFileInfo {
  locations: number;
  size?: number;
  nodes?: string[];
}

// ============================================================
//  StorageProofSection — Live verification against 0G Storage
// ============================================================

function StorageProofSection({
  storageRoot,
  storageHash,
  copyToClipboard,
}: {
  storageRoot: string;
  storageHash: string;
  copyToClipboard: (text: string) => void;
}) {
  const [verifyStatus, setVerifyStatus] = useState<"idle" | "checking" | "verified" | "unverified">("idle");
  const [fileInfo, setFileInfo] = useState<StorageFileInfo | null>(null);
  const storageScanUrl = `https://storagescan-galileo.0g.ai/tx/${storageRoot}`;

  const verify = useCallback(async () => {
    if (!storageRoot || storageRoot === "—") return;
    setVerifyStatus("checking");
    try {
      const res = await fetch("/api/storage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "verify", rootHash: storageRoot }),
      });
      const data = await res.json();
      setVerifyStatus(data.exists ? "verified" : "unverified");
      setFileInfo(data.fileInfo);
    } catch {
      setVerifyStatus("unverified");
    }
  }, [storageRoot]);

  useEffect(() => {
    if (storageRoot && storageRoot !== "—") {
      verify();
    }
  }, [storageRoot, verify]);

  return (
    <div className="rounded-2xl border border-border/60 bg-card/40 p-7 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Database className="h-5 w-5 text-accent-light" />
          0G Storage Proof
        </h2>
        {verifyStatus === "checking" && (
          <span className="inline-flex items-center gap-1.5 text-xs text-muted animate-pulse">
            <span className="h-2 w-2 rounded-full bg-yellow-400 animate-ping" />
            Verifying...
          </span>
        )}
        {verifyStatus === "verified" && (
          <span className="inline-flex items-center gap-1.5 text-xs text-green-400 font-semibold">
            <span className="h-2 w-2 rounded-full bg-green-400" />
            Verified on 0G Storage
          </span>
        )}
        {verifyStatus === "unverified" && (
          <span className="inline-flex items-center gap-1.5 text-xs text-yellow-400">
            <span className="h-2 w-2 rounded-full bg-yellow-400" />
            Not yet indexed
          </span>
        )}
      </div>

      {/* Storage Root */}
      <div className="flex items-center justify-between rounded-lg bg-background border border-border/50 px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted mb-0.5">Merkle Root Hash</p>
          <p className="text-xs font-mono text-foreground truncate">
            {storageRoot || "—"}
          </p>
        </div>
        {storageRoot && (
          <div className="flex items-center gap-1 shrink-0 ml-3">
            <button
              onClick={() => copyToClipboard(storageRoot)}
              className="rounded p-1.5 text-muted hover:text-foreground hover:bg-card transition-colors"
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
            <a
              href={storageScanUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded p-1.5 text-muted hover:text-accent-light hover:bg-card transition-colors"
              title="View on StorageScan"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        )}
      </div>

      {/* Data Hash */}
      <div className="flex items-center justify-between rounded-lg bg-background border border-border/50 px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted mb-0.5">Data Hash (keccak256)</p>
          <p className="text-xs font-mono text-foreground truncate">
            {storageHash || "—"}
          </p>
        </div>
        {storageHash && (
          <button
            onClick={() => copyToClipboard(storageHash)}
            className="shrink-0 ml-3 rounded p-1.5 text-muted hover:text-foreground hover:bg-card transition-colors"
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Verification info */}
      {fileInfo && verifyStatus === "verified" && (
        <div className="rounded-lg bg-green-500/5 border border-green-500/20 px-4 py-3">
          <div className="flex items-center gap-2 text-xs text-green-400">
            <Shield className="h-3.5 w-3.5" />
            <span>
              Data verified on {fileInfo.locations} storage node{fileInfo.locations > 1 ? "s" : ""}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AgentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const tokenId = BigInt(id);
  const { address } = useAccount();
  const { addToast } = useAppStore();
  const [showChat, setShowChat] = useState(false);
  const [rentDays, setRentDays] = useState(1);

  // Fetch all data
  const { data: meta, isLoading: metaLoading } = useReadContract({ address: CONTRACTS.REGISTRY, abi: registryAbi, functionName: "getAgentMeta", args: [tokenId] });
  const { data: avgRating } = useReadContract({ address: CONTRACTS.REGISTRY, abi: registryAbi, functionName: "getAverageRating", args: [tokenId] });
  const { data: ratings } = useReadContract({ address: CONTRACTS.REGISTRY, abi: registryAbi, functionName: "ratings", args: [tokenId] });
  const { data: stats } = useReadContract({ address: CONTRACTS.REGISTRY, abi: registryAbi, functionName: "getUsageStats", args: [tokenId] });
  const { data: isRegistered, isLoading: regLoading } = useReadContract({ address: CONTRACTS.REGISTRY, abi: registryAbi, functionName: "isRegistered", args: [tokenId] });
  const { data: owner } = useReadContract({ address: CONTRACTS.INFT, abi: inftAbi, functionName: "ownerOf", args: [tokenId] });
  const { data: creator } = useReadContract({ address: CONTRACTS.INFT, abi: inftAbi, functionName: "creatorOf", args: [tokenId] });
  const { data: category } = useReadContract({ address: CONTRACTS.INFT, abi: inftAbi, functionName: "categoryOf", args: [tokenId] });
  const { data: storageRoot } = useReadContract({ address: CONTRACTS.INFT, abi: inftAbi, functionName: "storageRootOf", args: [tokenId] });
  const { data: listing } = useReadContract({ address: CONTRACTS.MARKETPLACE, abi: marketplaceAbi, functionName: "getListing", args: [tokenId] });
  const { data: rental } = useReadContract({ address: CONTRACTS.MARKETPLACE, abi: marketplaceAbi, functionName: "getRental", args: [tokenId] });

  // Write hooks
  const { buy, hash: buyHash, isPending: buyPending, isConfirming: buyConfirming, isSuccess: buySuccess } = useBuyAgent();
  const { rent, hash: rentHash, isPending: rentPending, isConfirming: rentConfirming, isSuccess: rentSuccess } = useRentAgent();
  const { rate, hash: rateHash, isPending: ratePending } = useRateAgent();

  // Multi-modal
  const { data: hasModalProfile } = useHasModalProfile(tokenId);
  const { data: supportedModalities } = useSupportedModalities(tokenId);
  const modalitiesArr = supportedModalities as readonly boolean[] | undefined;

  // Loading state with skeleton
  if (regLoading || metaLoading) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="flex-1">
          <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
            <AgentDetailSkeleton />
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (!isRegistered) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center text-muted px-4">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-accent/10 mb-5">
              <Cpu className="h-10 w-10 text-accent-light opacity-40" />
            </div>
            <p className="text-lg font-medium text-foreground">Agent #{id} not found</p>
            <Link href="/marketplace" className="text-accent-light hover:underline text-sm mt-3 inline-block">
              Back to Marketplace
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const name = (meta as AgentMetaTuple)?.[0] ?? "Unknown Agent";
  const description = (meta as AgentMetaTuple)?.[1] ?? "";
  const modelType = (meta as AgentMetaTuple)?.[2] ?? "";
  const tags = ((meta as AgentMetaTuple)?.[3] as string[]) ?? [];
  const storageHash = (meta as AgentMetaTuple)?.[4] ?? "";
  const registeredAt = (meta as AgentMetaTuple)?.[6] ? Number((meta as AgentMetaTuple)![6]) : 0;
  const version = (meta as AgentMetaTuple)?.[8] ? Number((meta as AgentMetaTuple)![8]) : 1;

  const rating = avgRating ? Number(avgRating) / 100 : 0;
  const ratingCount = ratings ? Number((ratings as RatingsTuple)[1]) : 0;
  const inferenceCount = stats ? Number((stats as StatsTuple)[0]) : 0;
  const rentalCount = stats ? Number((stats as StatsTuple)[1]) : 0;

  const listingActive = listing ? (listing as ListingTuple)[3] : false;
  const listingPrice = listing ? (listing as ListingTuple)[1] : 0n;
  const rentalActive = rental ? (rental as RentalTuple)[4] : false;
  const rentalPricePerDay = rental ? (rental as RentalTuple)[1] : 0n;

  const isOwner = address && owner && (address as string).toLowerCase() === (owner as string).toLowerCase();
  const shortAddr = (addr: string) => addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : "—";
  const explorerUrl = "https://chainscan-galileo.0g.ai";

  const handleBuy = () => {
    if (!listingActive) return;
    buy(tokenId, listingPrice as bigint);
    addToast("Purchase transaction submitted — check wallet", "info");
  };

  const handleRent = () => {
    const total = (rentalPricePerDay as bigint) * BigInt(rentDays);
    rent(tokenId, BigInt(rentDays), total);
    addToast("Rental transaction submitted — check wallet", "info");
  };

  const handleRate = (score: number) => {
    rate(tokenId, score);
    addToast(`Rating ${score} stars — check wallet`, "info");
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    addToast("Copied to clipboard", "success");
  };

  // Transaction success toasts with ChainScan links
  useEffect(() => {
    if (buySuccess && buyHash) {
      addToast(`Agent purchased! TX: ${buyHash.slice(0, 10)}… — View on ChainScan`, "success");
    }
  }, [buySuccess, buyHash, addToast]);

  useEffect(() => {
    if (rentSuccess && rentHash) {
      addToast(`Agent rented! TX: ${rentHash.slice(0, 10)}… — View on ChainScan`, "success");
    }
  }, [rentSuccess, rentHash, addToast]);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
          {/* Breadcrumb */}
          <Link
            href="/marketplace"
            className="inline-flex items-center gap-2 text-sm text-muted hover:text-foreground transition-colors mb-8"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Marketplace
          </Link>

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
            {/* Left column — main info */}
            <div className="lg:col-span-2 space-y-8">
              {/* Agent header */}
              <div className="rounded-2xl border border-border/60 bg-card/40 p-7">
                <div className="flex items-start gap-4">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-accent/10">
                    <Cpu className="h-8 w-8 text-accent-light" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1.5">
                      <h1 className="text-2xl font-bold text-foreground">{name}</h1>
                      <Badge variant="accent">{category as string}</Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted mb-3">
                      <span className="flex items-center gap-1">
                        <Hash className="h-3.5 w-3.5" />
                        Token #{id}
                      </span>
                      <span>v{version}</span>
                      {registeredAt > 0 && (
                        <span>
                          Registered {new Date(registeredAt * 1000).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted leading-relaxed">{description}</p>
                  </div>
                </div>

                {/* Tags */}
                <div className="flex flex-wrap gap-1.5 mt-4">
                  {tags.map((tag) => (
                    <Badge key={tag}>{tag}</Badge>
                  ))}
                </div>

                {/* Multi-Modal Badges */}
                {Boolean(hasModalProfile) && modalitiesArr && modalitiesArr.some(Boolean) && (
                  <div className="flex items-center gap-2 mt-3">
                    <Layers className="h-3.5 w-3.5 text-purple-400" />
                    <span className="text-xs text-muted mr-1">Modalities:</span>
                    {modalitiesArr.map((enabled, i) =>
                      enabled ? (
                        <span
                          key={i}
                          className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-400"
                          title={MODALITY_LABELS[i]}
                        >
                          {MODALITY_ICONS[i]} {MODALITY_LABELS[i]}
                        </span>
                      ) : null
                    )}
                  </div>
                )}

                {/* Rating */}
                <div className="flex items-center gap-4 mt-4 pt-4 border-t border-border/60">
                  <div className="flex items-center gap-2">
                    <StarRating rating={rating} size="md" />
                    <span className="text-sm text-muted">
                      {rating.toFixed(1)} ({ratingCount} ratings)
                    </span>
                  </div>
                  {address && !isOwner && (
                    <div className="flex items-center gap-1 text-xs text-muted">
                      <span>Rate:</span>
                      <StarRating
                        rating={0}
                        size="sm"
                        interactive
                        onRate={handleRate}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: "Inferences", value: inferenceCount, icon: Activity },
                  { label: "Rentals", value: rentalCount, icon: Clock },
                  { label: "Model", value: modelType, icon: Cpu },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-2xl border border-border/60 bg-card/40 p-5 text-center"
                  >
                    <stat.icon className="h-5 w-5 text-accent-light mx-auto mb-2" />
                    <p className="text-lg font-bold text-foreground">
                      {typeof stat.value === "number" ? stat.value.toLocaleString() : stat.value}
                    </p>
                    <p className="text-xs text-muted">{stat.label}</p>
                  </div>
                ))}
              </div>

              {/* Storage info */}
              <StorageProofSection storageRoot={storageRoot as string} storageHash={storageHash} copyToClipboard={copyToClipboard} />

              {/* Test-Drive Chat */}
              <div>
                {showChat ? (
                  <TestDriveChat
                    agentName={name}
                    tokenId={id}
                    onClose={() => setShowChat(false)}
                  />
                ) : (
                  <button
                    onClick={() => setShowChat(true)}
                    className="w-full rounded-2xl border border-dashed border-accent/40 bg-accent/5 p-10 text-center hover:bg-accent/10 hover:border-accent/60 transition-all duration-300 group"
                  >
                    <MessageSquare className="h-8 w-8 text-accent-light mx-auto mb-3 group-hover:scale-110 transition-transform" />
                    <p className="text-base font-semibold text-foreground mb-1">
                      Test-Drive this Agent
                    </p>
                    <p className="text-sm text-muted">
                      Chat with the agent in a TEE-sealed session before purchasing
                    </p>
                  </button>
                )}
              </div>
            </div>

            {/* Right column — actions sidebar */}
            <div className="space-y-5">
              {/* Price & Buy */}
              {listingActive && (
                <div className="rounded-2xl border border-border/60 bg-card/40 p-7">
                  <p className="text-sm text-muted mb-1">Listed Price</p>
                  <p className="text-3xl font-bold text-foreground mb-1">
                    {parseFloat(formatEther(listingPrice as bigint)).toFixed(3)}
                    <span className="text-base text-muted ml-1">A0GI</span>
                  </p>
                  {!isOwner && (
                    <Button
                      className="w-full mt-4"
                      size="lg"
                      loading={buyPending || buyConfirming}
                      icon={<ShoppingCart className="h-5 w-5" />}
                      onClick={handleBuy}
                    >
                      {buySuccess ? "Purchased!" : "Buy Agent"}
                    </Button>
                  )}
                  {buyHash && (
                    <p className="text-xs text-muted text-center mt-2">
                      TX:{" "}
                      <a
                        href={`${explorerUrl}/tx/${buyHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-accent-light hover:underline font-mono"
                      >
                        {buyHash.slice(0, 10)}…
                      </a>
                    </p>
                  )}
                </div>
              )}

              {/* Rent */}
              {rentalPricePerDay > 0n && !rentalActive && !isOwner && (
                <div className="rounded-2xl border border-border/60 bg-card/40 p-7">
                  <p className="text-sm text-muted mb-1">Rental Price</p>
                  <p className="text-xl font-bold text-foreground mb-3">
                    {parseFloat(formatEther(rentalPricePerDay as bigint)).toFixed(3)}
                    <span className="text-sm text-muted ml-1">A0GI / day</span>
                  </p>
                  <div className="flex items-center gap-2 mb-3">
                    <label className="text-sm text-muted">Days:</label>
                    <input
                      type="number"
                      min={1}
                      max={365}
                      value={rentDays}
                      onChange={(e) => setRentDays(Math.max(1, Number(e.target.value)))}
                      className="w-20 rounded-xl border border-border/60 bg-background px-2 py-1.5 text-sm text-foreground text-center focus:border-accent/50 focus:outline-none"
                    />
                    <span className="text-sm text-muted">
                      Total:{" "}
                      {parseFloat(
                        formatEther(
                          (rentalPricePerDay as bigint) * BigInt(rentDays)
                        )
                      ).toFixed(3)}{" "}
                      A0GI
                    </span>
                  </div>
                  <Button
                    variant="secondary"
                    className="w-full"
                    loading={rentPending || rentConfirming}
                    icon={<Clock className="h-4 w-4" />}
                    onClick={handleRent}
                  >
                    Rent Agent
                  </Button>
                  {rentHash && (
                    <p className="text-xs text-muted text-center mt-2">
                      TX:{" "}
                      <a
                        href={`${explorerUrl}/tx/${rentHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-accent-light hover:underline font-mono"
                      >
                        {rentHash.slice(0, 10)}…
                      </a>
                    </p>
                  )}
                </div>
              )}

              {/* Owner / Creator info */}
              <div className="rounded-2xl border border-border/60 bg-card/40 p-7 space-y-3.5">
                <h3 className="text-sm font-semibold text-foreground">Details</h3>
                {[
                  { label: "Owner", value: owner as string },
                  { label: "Creator", value: creator as string },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between">
                    <span className="text-xs text-muted">{item.label}</span>
                    <a
                      href={`${explorerUrl}/address/${item.value}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs font-mono text-accent-light hover:underline"
                    >
                      <User className="h-3 w-3" />
                      {shortAddr(item.value || "")}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                ))}
              </div>

              {/* TEE Verification */}
              <div className="rounded-2xl border border-accent/20 bg-accent/5 p-7">
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="h-5 w-5 text-accent-light" />
                  <h3 className="text-sm font-semibold text-foreground">
                    TEE Protected
                  </h3>
                </div>
                <p className="text-xs text-muted leading-relaxed">
                  This agent&apos;s weights are encrypted with AES-256 and stored on
                  0G&apos;s decentralized storage. Inference runs inside a Trusted
                  Execution Environment ensuring privacy and verifiability.
                </p>
              </div>
            </div>
          </div>

          {/* Agent Activity Feed (E5) */}
          <div className="mt-10">
            <ActivityFeed
              tokenId={tokenId.toString()}
              title={`Agent #${tokenId} Activity`}
              limit={20}
              blocks={20000}
              pollInterval={30000}
              maxHeight="320px"
            />
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
