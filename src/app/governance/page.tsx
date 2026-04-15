"use client";

import { useState, useEffect, useCallback } from "react";
import { useAccount } from "wagmi";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import Button from "@/components/ui/Button";
import { Input, TextArea } from "@/components/ui/FormFields";
import {
  Landmark,
  Coins,
  Users,
  Wallet,
  TrendingUp,
  Vote,
  Plus,
  CheckCircle,
  XCircle,
  Loader2,
  ArrowRight,
  Lock,
  Unlock,
  Gift,
  BarChart3,
  Clock,
  Shield,
  PiggyBank,
  CircleDollarSign,
} from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import {
  usePoolBalances,
  useDAOStats,
  useTotalStaked,
  useStakerTokenCount,
  useCreatorRewards,
  useNextProposalId,
  useDAOProposal,
  useHasVoted,
  useBalanceOf,
  useStakeINFT,
  useUnstakeINFT,
  useClaimStakerRewards,
  useClaimCreatorRewards,
  useCreateProposal,
  useVoteOnProposal,
  useExecuteProposal,
  useDistributeRevenue,
  useApproveINFT,
  formatEther,
  parseEther,
} from "@/hooks/useContracts";
import { CONTRACTS } from "@/config/contracts";
import { ProposalStatus } from "@/types";

// ============================================================
//  Types
// ============================================================

type AddToast = (message: string, type?: "success" | "error" | "info") => void;
type TabId = "overview" | "staking" | "proposals" | "rewards";

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: "overview", label: "Overview", icon: BarChart3 },
  { id: "staking", label: "Staking", icon: Lock },
  { id: "proposals", label: "Proposals", icon: Vote },
  { id: "rewards", label: "Rewards", icon: Gift },
];

const STATUS_LABELS: Record<number, string> = {
  0: "Active",
  1: "Passed",
  2: "Rejected",
  3: "Executed",
  4: "Cancelled",
};

const STATUS_COLORS: Record<number, string> = {
  0: "bg-blue-500/20 text-blue-400",
  1: "bg-green-500/20 text-green-400",
  2: "bg-red-500/20 text-red-400",
  3: "bg-purple-500/20 text-purple-400",
  4: "bg-gray-500/20 text-gray-400",
};

// ============================================================
//  Page
// ============================================================

export default function GovernancePage() {
  const { address, isConnected } = useAccount();
  const addToast = useAppStore((s) => s.addToast);
  const [tab, setTab] = useState<TabId>("overview");

  // ── On-chain reads ──
  const { data: poolData, refetch: refetchPools } = usePoolBalances();
  const { data: daoStatsData, refetch: refetchStats } = useDAOStats();
  const { data: totalStakedData } = useTotalStaked();
  const { data: stakerCount } = useStakerTokenCount(address);
  const { data: creatorRewardsData, refetch: refetchCreatorRewards } = useCreatorRewards(address);
  const { data: nextPropId } = useNextProposalId();
  const { data: userBalance } = useBalanceOf(address);

  // Format helpers
  const poolArr = poolData as readonly bigint[] | undefined;
  const pools = poolArr
    ? {
        creators: formatEther(poolArr[0]),
        stakers: formatEther(poolArr[1]),
        treasury: formatEther(poolArr[2]),
        total: formatEther(poolArr[3]),
      }
    : { creators: "0", stakers: "0", treasury: "0", total: "0" };

  const statsArr = daoStatsData as readonly bigint[] | undefined;
  const stats = statsArr
    ? {
        totalStaked: Number(statsArr[0]),
        totalRevenue: formatEther(statsArr[1]),
        stakerPaid: formatEther(statsArr[2]),
        creatorPaid: formatEther(statsArr[3]),
        totalProposals: Number(statsArr[4]),
        treasuryBalance: formatEther(statsArr[5]),
      }
    : { totalStaked: 0, totalRevenue: "0", stakerPaid: "0", creatorPaid: "0", totalProposals: 0, treasuryBalance: "0" };

  const myStakedCount = stakerCount ? Number(stakerCount) : 0;
  const myINFTBalance = userBalance ? Number(userBalance) : 0;

  const creatorInfo = creatorRewardsData
    ? {
        totalEarned: formatEther((creatorRewardsData as readonly bigint[])[0]),
        pending: formatEther((creatorRewardsData as readonly bigint[])[1]),
        agentCount: Number((creatorRewardsData as readonly bigint[])[2]),
        totalVolume: formatEther((creatorRewardsData as readonly bigint[])[3]),
      }
    : { totalEarned: "0", pending: "0", agentCount: 0, totalVolume: "0" };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden border-b border-border/40 hero-gradient">
          <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/15">
                <Landmark className="h-7 w-7 text-accent-light" />
              </div>
              <div>
                <h1 className="text-3xl sm:text-4xl font-bold text-foreground">
                  <span className="gradient-text">Governance</span>
                </h1>
                <p className="text-muted text-sm">Revenue-sharing DAO — stake, vote, earn</p>
              </div>
            </div>

            {/* Quick stats bar */}
            <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
              <QuickStat icon={PiggyBank} label="Treasury" value={`${parseFloat(pools.treasury).toFixed(4)} A0GI`} />
              <QuickStat icon={Users} label="Total Staked" value={`${stats.totalStaked} INFTs`} />
              <QuickStat icon={TrendingUp} label="Total Revenue" value={`${parseFloat(stats.totalRevenue).toFixed(4)} A0GI`} />
              <QuickStat icon={Vote} label="Proposals" value={`${stats.totalProposals}`} />
            </div>
          </div>
        </section>

        {/* Tabs */}
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex gap-1 border-b border-border/40 mt-8 overflow-x-auto">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  tab === t.id
                    ? "border-accent text-accent-light"
                    : "border-transparent text-muted hover:text-foreground"
                }`}
              >
                <t.icon className="h-4 w-4" />
                {t.label}
              </button>
            ))}
          </div>

          <div className="py-8">
            {tab === "overview" && <OverviewTab pools={pools} stats={stats} refetchPools={refetchPools} refetchStats={refetchStats} addToast={addToast} />}
            {tab === "staking" && <StakingTab myStakedCount={myStakedCount} myINFTBalance={myINFTBalance} address={address} isConnected={isConnected} addToast={addToast} />}
            {tab === "proposals" && <ProposalsTab totalProposals={stats.totalProposals} myStakedCount={myStakedCount} address={address} isConnected={isConnected} addToast={addToast} />}
            {tab === "rewards" && <RewardsTab creatorInfo={creatorInfo} address={address} isConnected={isConnected} addToast={addToast} refetchCreatorRewards={refetchCreatorRewards} />}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

// ============================================================
//  Quick Stat Card
// ============================================================

function QuickStat({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 mb-1">
        <Icon className="h-4 w-4 text-accent-light" />
        <span className="text-xs text-muted">{label}</span>
      </div>
      <p className="text-lg font-bold text-foreground">{value}</p>
    </div>
  );
}

// ============================================================
//  Overview Tab
// ============================================================

function OverviewTab({
  pools,
  stats,
  refetchPools,
  refetchStats,
  addToast,
}: {
  pools: { creators: string; stakers: string; treasury: string; total: string };
  stats: { totalStaked: number; totalRevenue: string; stakerPaid: string; creatorPaid: string; totalProposals: number; treasuryBalance: string };
  refetchPools: () => void;
  refetchStats: () => void;
  addToast: AddToast;
}) {
  const { distribute, hash: distributeHash, isPending, isConfirming, isSuccess } = useDistributeRevenue();
  const [amount, setAmount] = useState("0.01");

  useEffect(() => {
    if (isSuccess) {
      const txMsg = distributeHash ? ` TX: ${distributeHash.slice(0, 10)}…` : "";
      addToast(`Revenue distributed to pools!${txMsg}`, "success");
      refetchPools();
      refetchStats();
    }
  }, [isSuccess, addToast, refetchPools, refetchStats]);

  return (
    <div className="space-y-8">
      {/* Pool Cards */}
      <div>
        <h2 className="text-xl font-bold text-foreground mb-4">Revenue Pools</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <PoolCard
            title="Creator Pool"
            percentage="40%"
            balance={pools.creators}
            icon={CircleDollarSign}
            color="text-green-400"
            bg="bg-green-500/10"
            description="Rewards for AI agent creators based on sales volume"
          />
          <PoolCard
            title="Staker Pool"
            percentage="40%"
            balance={pools.stakers}
            icon={Lock}
            color="text-blue-400"
            bg="bg-blue-500/10"
            description="Distributed to INFT stakers, time-weighted over 30 days"
          />
          <PoolCard
            title="Treasury"
            percentage="20%"
            balance={pools.treasury}
            icon={PiggyBank}
            color="text-purple-400"
            bg="bg-purple-500/10"
            description="Community treasury for ecosystem grants & growth"
          />
        </div>
      </div>

      {/* Revenue Distribution */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h3 className="text-lg font-semibold text-foreground mb-2">Distribute Revenue</h3>
        <p className="text-sm text-muted mb-4">
          Send A0GI to the DAO. It will be split 40/40/20 across Creator, Staker, and Treasury pools.
        </p>
        <div className="flex items-end gap-3">
          <div className="flex-1 max-w-xs">
            <Input
              label="Amount (A0GI)"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              type="number"
              step="0.001"
              min="0.001"
            />
          </div>
          <Button
            onClick={() => distribute(amount)}
            disabled={isPending || isConfirming || !amount || parseFloat(amount) <= 0}
            className="mb-1"
          >
            {isPending || isConfirming ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Coins className="h-4 w-4" />
            )}
            {isPending ? "Signing…" : isConfirming ? "Confirming…" : "Distribute"}
          </Button>
        </div>
      </div>

      {/* Global Stats */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">DAO Statistics</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <StatRow label="Total Revenue Distributed" value={`${parseFloat(stats.totalRevenue).toFixed(4)} A0GI`} />
          <StatRow label="Staker Rewards Paid" value={`${parseFloat(stats.stakerPaid).toFixed(4)} A0GI`} />
          <StatRow label="Creator Rewards Paid" value={`${parseFloat(stats.creatorPaid).toFixed(4)} A0GI`} />
          <StatRow label="Total INFTs Staked" value={`${stats.totalStaked}`} />
          <StatRow label="Governance Proposals" value={`${stats.totalProposals}`} />
          <StatRow label="Treasury Balance" value={`${parseFloat(stats.treasuryBalance).toFixed(4)} A0GI`} />
        </div>
      </div>
    </div>
  );
}

function PoolCard({
  title,
  percentage,
  balance,
  icon: Icon,
  color,
  bg,
  description,
}: {
  title: string;
  percentage: string;
  balance: string;
  icon: React.ElementType;
  color: string;
  bg: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-6 hover:border-border-hover transition-colors">
      <div className="flex items-center justify-between mb-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${bg}`}>
          <Icon className={`h-5 w-5 ${color}`} />
        </div>
        <span className={`text-sm font-bold ${color}`}>{percentage}</span>
      </div>
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      <p className="text-2xl font-bold text-foreground mt-1">{parseFloat(balance).toFixed(4)} <span className="text-sm text-muted">A0GI</span></p>
      <p className="text-xs text-muted mt-2">{description}</p>
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted">{label}</p>
      <p className="text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

// ============================================================
//  Staking Tab
// ============================================================

function StakingTab({
  myStakedCount,
  myINFTBalance,
  address,
  isConnected,
  addToast,
}: {
  myStakedCount: number;
  myINFTBalance: number;
  address: `0x${string}` | undefined;
  isConnected: boolean;
  addToast: AddToast;
}) {
  const [tokenIdInput, setTokenIdInput] = useState("");
  const [unstakeIdInput, setUnstakeIdInput] = useState("");

  const { approve, isPending: approvePending, isSuccess: approveSuccess } = useApproveINFT();
  const { stakeToken, hash: stakeHash, isPending: stakePending, isConfirming: stakeConfirming, isSuccess: stakeSuccess } = useStakeINFT();
  const { unstakeToken, hash: unstakeHash, isPending: unstakePending, isConfirming: unstakeConfirming, isSuccess: unstakeSuccess } = useUnstakeINFT();

  useEffect(() => {
    if (approveSuccess) {
      addToast("INFT approved for DAO! Now click Stake.", "success");
    }
  }, [approveSuccess, addToast]);

  useEffect(() => {
    if (stakeSuccess) {
      const txMsg = stakeHash ? ` TX: ${stakeHash.slice(0, 10)}…` : "";
      addToast(`INFT staked successfully!${txMsg}`, "success");
      setTokenIdInput("");
    }
  }, [stakeSuccess, addToast]);

  useEffect(() => {
    if (unstakeSuccess) {
      const txMsg = unstakeHash ? ` TX: ${unstakeHash.slice(0, 10)}…` : "";
      addToast(`INFT unstaked + rewards claimed!${txMsg}`, "success");
      setUnstakeIdInput("");
    }
  }, [unstakeSuccess, addToast]);

  if (!isConnected) {
    return (
      <div className="rounded-xl border border-border bg-card p-12 text-center">
        <Wallet className="h-12 w-12 text-muted mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-foreground mb-2">Connect Wallet</h3>
        <p className="text-muted">Connect your wallet to stake INFTs and earn rewards.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-1">
            <Shield className="h-4 w-4 text-blue-400" />
            <span className="text-xs text-muted">Your Staked INFTs</span>
          </div>
          <p className="text-2xl font-bold text-foreground">{myStakedCount}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-1">
            <Wallet className="h-4 w-4 text-green-400" />
            <span className="text-xs text-muted">Available to Stake</span>
          </div>
          <p className="text-2xl font-bold text-foreground">{myINFTBalance}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-1">
            <Vote className="h-4 w-4 text-purple-400" />
            <span className="text-xs text-muted">Voting Power</span>
          </div>
          <p className="text-2xl font-bold text-foreground">{myStakedCount} vote{myStakedCount !== 1 ? "s" : ""}</p>
        </div>
      </div>

      {/* Stake */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h3 className="text-lg font-semibold text-foreground mb-2">
          <Lock className="h-5 w-5 inline mr-2 text-blue-400" />
          Stake INFT
        </h3>
        <p className="text-sm text-muted mb-4">
          Stake your AI Agent INFT to earn a share of the Staker Pool. Rewards vest linearly over 30 days.
          You must first approve the DAO contract, then stake.
        </p>
        <div className="flex items-end gap-3 flex-wrap">
          <div className="w-40">
            <Input
              label="Token ID"
              value={tokenIdInput}
              onChange={(e) => setTokenIdInput(e.target.value)}
              type="number"
              min="0"
              placeholder="e.g. 0"
            />
          </div>
          <Button
            variant="secondary"
            onClick={() => {
              if (!tokenIdInput) return;
              approve(BigInt(tokenIdInput), CONTRACTS.DAO);
            }}
            disabled={approvePending || !tokenIdInput}
            className="mb-1"
          >
            {approvePending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
            Approve
          </Button>
          <Button
            onClick={() => {
              if (!tokenIdInput) return;
              stakeToken(BigInt(tokenIdInput));
            }}
            disabled={stakePending || stakeConfirming || !tokenIdInput}
            className="mb-1"
          >
            {stakePending || stakeConfirming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
            {stakePending ? "Signing…" : stakeConfirming ? "Confirming…" : "Stake"}
          </Button>
        </div>
      </div>

      {/* Unstake */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h3 className="text-lg font-semibold text-foreground mb-2">
          <Unlock className="h-5 w-5 inline mr-2 text-green-400" />
          Unstake INFT
        </h3>
        <p className="text-sm text-muted mb-4">
          Unstake your INFT and automatically claim all pending staker rewards.
        </p>
        <div className="flex items-end gap-3">
          <div className="w-40">
            <Input
              label="Token ID"
              value={unstakeIdInput}
              onChange={(e) => setUnstakeIdInput(e.target.value)}
              type="number"
              min="0"
              placeholder="e.g. 0"
            />
          </div>
          <Button
            variant="secondary"
            onClick={() => {
              if (!unstakeIdInput) return;
              unstakeToken(BigInt(unstakeIdInput));
            }}
            disabled={unstakePending || unstakeConfirming || !unstakeIdInput}
            className="mb-1"
          >
            {unstakePending || unstakeConfirming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unlock className="h-4 w-4" />}
            {unstakePending ? "Signing…" : unstakeConfirming ? "Confirming…" : "Unstake + Claim"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
//  Proposals Tab
// ============================================================

function ProposalsTab({
  totalProposals,
  myStakedCount,
  address,
  isConnected,
  addToast,
}: {
  totalProposals: number;
  myStakedCount: number;
  address: `0x${string}` | undefined;
  isConnected: boolean;
  addToast: AddToast;
}) {
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("0");

  const { propose, hash: proposeHash, isPending: proposePending, isConfirming: proposeConfirming, isSuccess: proposeSuccess } = useCreateProposal();

  useEffect(() => {
    if (proposeSuccess) {
      const txMsg = proposeHash ? ` TX: ${proposeHash.slice(0, 10)}…` : "";
      addToast(`Proposal created on-chain!${txMsg}`, "success");
      setShowCreate(false);
      setTitle("");
      setDescription("");
      setRecipient("");
      setAmount("0");
    }
  }, [proposeSuccess, addToast]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">Governance Proposals</h2>
          <p className="text-sm text-muted">{totalProposals} proposal{totalProposals !== 1 ? "s" : ""} total</p>
        </div>
        {isConnected && myStakedCount > 0 && (
          <Button onClick={() => setShowCreate(!showCreate)}>
            <Plus className="h-4 w-4" />
            New Proposal
          </Button>
        )}
      </div>

      {/* Eligibility notice */}
      {isConnected && myStakedCount === 0 && (
        <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-4">
          <p className="text-sm text-yellow-400">
            <Shield className="h-4 w-4 inline mr-1" />
            You must stake at least 1 INFT to create proposals and vote.
          </p>
        </div>
      )}

      {/* Create Proposal Form */}
      {showCreate && (
        <div className="rounded-xl border border-accent/30 bg-card p-6 space-y-4">
          <h3 className="text-lg font-semibold text-foreground">Create Proposal</h3>
          <Input
            label="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Fund AI Safety Research"
          />
          <TextArea
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the proposal in detail…"
            rows={4}
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Recipient Address (0x…)"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder="0x… (or 0x0 for signaling)"
            />
            <Input
              label="Amount (A0GI, 0 for signaling)"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              type="number"
              step="0.001"
              min="0"
            />
          </div>
          <div className="flex gap-3">
            <Button
              onClick={() => {
                if (!title || !description) {
                  addToast("Title and description are required.", "error");
                  return;
                }
                const rec = (recipient || "0x0000000000000000000000000000000000000000") as `0x${string}`;
                const amt = parseFloat(amount) > 0 ? parseEther(amount) : 0n;
                propose(title, description, rec, amt);
              }}
              disabled={proposePending || proposeConfirming || !title}
            >
              {proposePending || proposeConfirming ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              {proposePending ? "Signing…" : proposeConfirming ? "Confirming…" : "Submit Proposal"}
            </Button>
            <Button variant="secondary" onClick={() => setShowCreate(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {/* Proposal List */}
      {totalProposals === 0 ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center">
          <Vote className="h-12 w-12 text-muted mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">No Proposals Yet</h3>
          <p className="text-muted">Stake an INFT and create the first governance proposal.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {Array.from({ length: totalProposals }, (_, i) => (
            <ProposalCard key={i} proposalId={BigInt(i)} address={address} myStakedCount={myStakedCount} addToast={addToast} />
          ))}
        </div>
      )}
    </div>
  );
}

function ProposalCard({
  proposalId,
  address,
  myStakedCount,
  addToast,
}: {
  proposalId: bigint;
  address: `0x${string}` | undefined;
  myStakedCount: number;
  addToast: AddToast;
}) {
  const { data: propData } = useDAOProposal(proposalId);
  const { data: voted } = useHasVoted(proposalId, address);
  const { castVote, hash: voteHash, isPending: votePending, isConfirming: voteConfirming, isSuccess: voteSuccess } = useVoteOnProposal();
  const { execute, hash: execHash, isPending: execPending, isConfirming: execConfirming, isSuccess: execSuccess } = useExecuteProposal();

  useEffect(() => {
    if (voteSuccess) {
      const txMsg = voteHash ? ` TX: ${voteHash.slice(0, 10)}…` : "";
      addToast(`Vote cast!${txMsg}`, "success");
    }
  }, [voteSuccess, voteHash, addToast]);

  useEffect(() => {
    if (execSuccess) {
      const txMsg = execHash ? ` TX: ${execHash.slice(0, 10)}…` : "";
      addToast(`Proposal executed!${txMsg}`, "success");
    }
  }, [execSuccess, execHash, addToast]);

  if (!propData) {
    return (
      <div className="rounded-xl border border-border bg-card p-4 animate-pulse">
        <div className="h-5 w-48 bg-border rounded" />
      </div>
    );
  }

  // Proposal tuple: [id, proposer, title, desc, recipient, amount, votesFor, votesAgainst, createdAt, deadline, status]
  type ProposalTuple = readonly [bigint, string, string, string, string, bigint, bigint, bigint, bigint, bigint, number];
  const raw = propData as ProposalTuple;
  const pId = Number(raw[0] ?? 0);
  const proposer = String(raw[1] ?? "0x");
  const title = String(raw[2] ?? "");
  const desc = String(raw[3] ?? "");
  const recipient = String(raw[4] ?? "0x");
  const amount = BigInt(raw[5] ?? 0n);
  const votesFor = Number(raw[6] ?? 0);
  const votesAgainst = Number(raw[7] ?? 0);
  const createdAt = Number(raw[8] ?? 0);
  const deadline = Number(raw[9] ?? 0);
  const status = Number(raw[10] ?? 0);

  const now = Math.floor(Date.now() / 1000);
  const isExpired = now >= deadline;
  const isActive = status === 0;
  const totalVotes = votesFor + votesAgainst;
  const forPct = totalVotes > 0 ? Math.round((votesFor / totalVotes) * 100) : 0;

  return (
    <div className="rounded-xl border border-border bg-card p-5 hover:border-border-hover transition-colors">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-muted">#{Number(proposalId)}</span>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[status] || "bg-gray-500/20 text-gray-400"}`}>
            {STATUS_LABELS[status] || "Unknown"}
          </span>
        </div>
        <div className="text-xs text-muted flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {isExpired ? "Ended" : `${Math.ceil((deadline - now) / 3600)}h left`}
        </div>
      </div>

      <h4 className="text-base font-semibold text-foreground mb-1">{title}</h4>
      <p className="text-sm text-muted mb-3 line-clamp-2">{desc}</p>

      {/* Amount */}
      {amount > 0n && (
        <p className="text-xs text-muted mb-2">
          Requesting: <span className="text-foreground font-semibold">{formatEther(amount)} A0GI</span> → {recipient.slice(0, 10)}…
        </p>
      )}

      {/* Vote bar */}
      <div className="mb-3">
        <div className="flex justify-between text-xs text-muted mb-1">
          <span>For: {votesFor}</span>
          <span>Against: {votesAgainst}</span>
        </div>
        <div className="h-2 w-full bg-border rounded-full overflow-hidden flex">
          {totalVotes > 0 && (
            <>
              <div className="bg-green-500 h-full transition-all" style={{ width: `${forPct}%` }} />
              <div className="bg-red-500 h-full transition-all" style={{ width: `${100 - forPct}%` }} />
            </>
          )}
        </div>
      </div>

      {/* Actions */}
      {isActive && myStakedCount > 0 && !Boolean(voted) && (
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={() => castVote(proposalId, true)}
            disabled={votePending || voteConfirming}
          >
            <CheckCircle className="h-3.5 w-3.5" /> For
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => castVote(proposalId, false)}
            disabled={votePending || voteConfirming}
          >
            <XCircle className="h-3.5 w-3.5" /> Against
          </Button>
        </div>
      )}

      {isActive && Boolean(voted) && (
        <p className="text-xs text-green-400">
          <CheckCircle className="h-3 w-3 inline mr-1" /> You voted
        </p>
      )}

      {isActive && isExpired && (
        <Button
          size="sm"
          variant="secondary"
          onClick={() => execute(proposalId)}
          disabled={execPending || execConfirming}
        >
          {execPending || execConfirming ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowRight className="h-3.5 w-3.5" />}
          Execute
        </Button>
      )}
    </div>
  );
}

// ============================================================
//  Rewards Tab
// ============================================================

function RewardsTab({
  creatorInfo,
  address,
  isConnected,
  addToast,
  refetchCreatorRewards,
}: {
  creatorInfo: { totalEarned: string; pending: string; agentCount: number; totalVolume: string };
  address: `0x${string}` | undefined;
  isConnected: boolean;
  addToast: AddToast;
  refetchCreatorRewards: () => void;
}) {
  const { claim, hash: claimHash, isPending, isConfirming, isSuccess } = useClaimCreatorRewards();

  useEffect(() => {
    if (isSuccess) {
      const txMsg = claimHash ? ` TX: ${claimHash.slice(0, 10)}…` : "";
      addToast(`Creator rewards claimed!${txMsg}`, "success");
      refetchCreatorRewards();
    }
  }, [isSuccess, addToast, refetchCreatorRewards]);

  if (!isConnected) {
    return (
      <div className="rounded-xl border border-border bg-card p-12 text-center">
        <Wallet className="h-12 w-12 text-muted mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-foreground mb-2">Connect Wallet</h3>
        <p className="text-muted">Connect to view your creator rewards.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-foreground">Creator Rewards</h2>
      <p className="text-sm text-muted">
        Earn rewards when your AI agents generate sales and rental volume on the marketplace.
        The Creator Pool (40% of all DAO revenue) is distributed proportionally.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-xs text-muted mb-1">Pending Rewards</p>
          <p className="text-2xl font-bold text-green-400">{parseFloat(creatorInfo.pending).toFixed(4)} <span className="text-sm text-muted">A0GI</span></p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-xs text-muted mb-1">Total Earned</p>
          <p className="text-2xl font-bold text-foreground">{parseFloat(creatorInfo.totalEarned).toFixed(4)} <span className="text-sm text-muted">A0GI</span></p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-xs text-muted mb-1">Your Agents</p>
          <p className="text-2xl font-bold text-foreground">{creatorInfo.agentCount}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-xs text-muted mb-1">Total Volume</p>
          <p className="text-2xl font-bold text-foreground">{parseFloat(creatorInfo.totalVolume).toFixed(4)} <span className="text-sm text-muted">A0GI</span></p>
        </div>
      </div>

      <Button
        onClick={() => claim()}
        disabled={isPending || isConfirming || parseFloat(creatorInfo.pending) === 0}
      >
        {isPending || isConfirming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gift className="h-4 w-4" />}
        {isPending ? "Signing…" : isConfirming ? "Confirming…" : "Claim Creator Rewards"}
      </Button>

      {/* How it works */}
      <div className="rounded-xl border border-border bg-card/50 p-6">
        <h3 className="text-lg font-semibold text-foreground mb-3">How Creator Rewards Work</h3>
        <div className="space-y-3">
          <Step num={1} text="Your AI agent is sold or rented on the marketplace." />
          <Step num={2} text="Platform fees flow to the DAO and are split into 3 pools." />
          <Step num={3} text="40% goes to the Creator Pool, allocated by sales volume." />
          <Step num={4} text="Claim your pending rewards anytime — no lockup period." />
        </div>
      </div>
    </div>
  );
}

function Step({ num, text }: { num: number; text: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-accent/20 text-xs font-bold text-accent-light flex-shrink-0">
        {num}
      </div>
      <p className="text-sm text-muted">{text}</p>
    </div>
  );
}
