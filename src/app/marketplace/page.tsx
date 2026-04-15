"use client";

import { useReadContract } from "wagmi";
import { parseAbi, formatEther } from "viem";
import { CONTRACTS } from "@/config/contracts";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import MarketplaceFilters from "@/components/marketplace/MarketplaceFilters";
import AgentGrid from "@/components/marketplace/AgentGrid";
import { ActivityTicker } from "@/components/activity/ActivityFeed";
import { Store, TrendingUp, ShoppingBag, Coins } from "lucide-react";

const registryAbi = parseAbi([
  "function totalRegistered() external view returns (uint256)",
]);

const marketplaceAbi = parseAbi([
  "function totalSales() external view returns (uint256)",
  "function totalVolume() external view returns (uint256)",
]);

export default function MarketplacePage() {
  const { data: totalRegistered } = useReadContract({
    address: CONTRACTS.REGISTRY,
    abi: registryAbi,
    functionName: "totalRegistered",
  });

  const { data: totalSales } = useReadContract({
    address: CONTRACTS.MARKETPLACE,
    abi: marketplaceAbi,
    functionName: "totalSales",
  });

  const { data: totalVolume } = useReadContract({
    address: CONTRACTS.MARKETPLACE,
    abi: marketplaceAbi,
    functionName: "totalVolume",
  });

  const stats = [
    {
      label: "Total Agents",
      value: totalRegistered ? Number(totalRegistered).toLocaleString() : "—",
      icon: Store,
    },
    {
      label: "Total Sales",
      value: totalSales ? Number(totalSales).toLocaleString() : "—",
      icon: ShoppingBag,
    },
    {
      label: "Volume Traded",
      value: totalVolume
        ? `${parseFloat(formatEther(totalVolume)).toFixed(2)} A0GI`
        : "—",
      icon: Coins,
    },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
          {/* Page header */}
          <div className="mb-10">
            <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-3">
              AI Agent <span className="gradient-text">Marketplace</span>
            </h1>
            <p className="text-muted max-w-2xl text-base leading-relaxed">
              Discover, test-drive, and acquire AI agents secured by ERC-7857 INFTs
              on the 0G network. Every agent&apos;s weights are encrypted and verifiable.
            </p>
          </div>

          {/* Stats bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="flex items-center gap-4 rounded-2xl border border-border/60 bg-card/40 px-5 py-4"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10">
                  <stat.icon className="h-5 w-5 text-accent-light" />
                </div>
                <div>
                  <p className="text-lg font-bold text-foreground">{stat.value}</p>
                  <p className="text-xs text-muted">{stat.label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Live activity ticker (E5) */}
          <div className="mb-8">
            <ActivityTicker limit={5} pollInterval={20000} />
          </div>

          {/* Filters */}
          <div className="mb-8">
            <MarketplaceFilters />
          </div>

          {/* Agent Grid */}
          <AgentGrid />
        </div>
      </main>
      <Footer />
    </div>
  );
}
