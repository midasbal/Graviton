"use client";

import { useActivityFeed, type ActivityEvent } from "@/hooks/useActivityFeed";
import {
  Activity,
  Cpu,
  ShoppingCart,
  ShoppingBag,
  Clock,
  Star,
  Database,
  Shield,
  Layers,
  Coins,
  Lock,
  Unlock,
  FileText,
  Zap,
  ImageIcon,
  ExternalLink,
  RefreshCw,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { type ReactNode } from "react";

// ── Icon + color mapping by event type ──

const EVENT_CONFIG: Record<
  string,
  { icon: ReactNode; color: string; bgColor: string }
> = {
  AgentMinted:               { icon: <Cpu className="h-3.5 w-3.5" />,          color: "text-green-400",  bgColor: "bg-green-500/15" },
  Transfer:                  { icon: <ShoppingBag className="h-3.5 w-3.5" />,  color: "text-blue-400",   bgColor: "bg-blue-500/15" },
  AgentListed:               { icon: <ShoppingCart className="h-3.5 w-3.5" />,  color: "text-amber-400",  bgColor: "bg-amber-500/15" },
  AgentSold:                 { icon: <Coins className="h-3.5 w-3.5" />,        color: "text-emerald-400",bgColor: "bg-emerald-500/15" },
  AgentRented:               { icon: <Clock className="h-3.5 w-3.5" />,        color: "text-cyan-400",   bgColor: "bg-cyan-500/15" },
  HooksConfigured:           { icon: <Zap className="h-3.5 w-3.5" />,          color: "text-violet-400", bgColor: "bg-violet-500/15" },
  AgentRegistered:           { icon: <FileText className="h-3.5 w-3.5" />,     color: "text-indigo-400", bgColor: "bg-indigo-500/15" },
  AgentRated:                { icon: <Star className="h-3.5 w-3.5" />,         color: "text-yellow-400", bgColor: "bg-yellow-500/15" },
  MemorySnapshotCommitted:   { icon: <Database className="h-3.5 w-3.5" />,     color: "text-purple-400", bgColor: "bg-purple-500/15" },
  AttestationSubmitted:      { icon: <Shield className="h-3.5 w-3.5" />,       color: "text-teal-400",   bgColor: "bg-teal-500/15" },
  JobCreated:                { icon: <Layers className="h-3.5 w-3.5" />,       color: "text-orange-400", bgColor: "bg-orange-500/15" },
  JobCompleted:              { icon: <Layers className="h-3.5 w-3.5" />,       color: "text-green-400",  bgColor: "bg-green-500/15" },
  RevenueDistributed:        { icon: <Coins className="h-3.5 w-3.5" />,        color: "text-pink-400",   bgColor: "bg-pink-500/15" },
  INFTStaked:                { icon: <Lock className="h-3.5 w-3.5" />,         color: "text-sky-400",    bgColor: "bg-sky-500/15" },
  INFTUnstaked:              { icon: <Unlock className="h-3.5 w-3.5" />,       color: "text-rose-400",   bgColor: "bg-rose-500/15" },
  ProposalCreated:           { icon: <FileText className="h-3.5 w-3.5" />,     color: "text-fuchsia-400",bgColor: "bg-fuchsia-500/15" },
  ProposalExecuted:          { icon: <Zap className="h-3.5 w-3.5" />,          color: "text-lime-400",   bgColor: "bg-lime-500/15" },
  ModalityAdded:             { icon: <ImageIcon className="h-3.5 w-3.5" />,    color: "text-violet-400", bgColor: "bg-violet-500/15" },
};

const DEFAULT_CONFIG = { icon: <Activity className="h-3.5 w-3.5" />, color: "text-muted", bgColor: "bg-card" };

function formatTime(timestamp?: number): string {
  if (!timestamp) return "";
  const now = Math.floor(Date.now() / 1000);
  const diff = now - timestamp;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// ── Single event row ──

function EventRow({ event }: { event: ActivityEvent }) {
  const config = EVENT_CONFIG[event.type] || DEFAULT_CONFIG;

  return (
    <div className="flex items-start gap-3 py-2.5 px-3 rounded-lg hover:bg-card/80 transition-colors group">
      {/* Icon */}
      <div
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${config.bgColor} ${config.color} mt-0.5`}
      >
        {config.icon}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <p className="text-sm text-foreground leading-snug line-clamp-1">
          {event.summary}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[11px] text-muted">
            {formatTime(event.timestamp)}
          </span>
          <span className="text-[11px] text-muted/50">•</span>
          <span className="text-[11px] text-muted">{event.contract}</span>
        </div>
      </div>

      {/* Explorer link */}
      <a
        href={event.explorerUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="shrink-0 mt-1 opacity-0 group-hover:opacity-100 transition-opacity rounded p-1 text-muted hover:text-accent-light"
        title="View on ChainScan"
      >
        <ExternalLink className="h-3.5 w-3.5" />
      </a>
    </div>
  );
}

// ── Main component ──

interface ActivityFeedProps {
  tokenId?: string;
  actor?: string;
  types?: string[];
  limit?: number;
  blocks?: number;
  pollInterval?: number;
  title?: string;
  compact?: boolean;
  maxHeight?: string;
}

export default function ActivityFeed({
  tokenId,
  actor,
  types,
  limit = 20,
  blocks = 10000,
  pollInterval = 30000, // 30s default
  title = "Activity Feed",
  compact = false,
  maxHeight = "400px",
}: ActivityFeedProps) {
  const { events, isLoading, error, refetch, lastUpdated } = useActivityFeed({
    tokenId,
    actor,
    types,
    limit,
    blocks,
    pollInterval,
  });

  return (
    <div className="rounded-2xl border border-border/60 bg-card/40 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border/40">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-accent-light" />
          <h3 className={`font-semibold text-foreground ${compact ? "text-sm" : "text-base"}`}>
            {title}
          </h3>
          {events.length > 0 && (
            <span className="inline-flex items-center justify-center rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-medium text-accent-light">
              {events.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {lastUpdated && (
            <span className="text-[11px] text-muted">
              {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={refetch}
            disabled={isLoading}
            className="rounded p-1.5 text-muted hover:text-foreground hover:bg-background transition-colors disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Body */}
      <div
        className="overflow-y-auto divide-y divide-border/30"
        style={{ maxHeight }}
      >
        {/* Loading */}
        {isLoading && events.length === 0 && (
          <div className="flex items-center justify-center py-8 text-muted">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            <span className="text-sm">Scanning on-chain events...</span>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 px-4 py-3 text-red-400 text-sm">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* No events */}
        {!isLoading && !error && events.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-muted">
            <Activity className="h-8 w-8 mb-2 opacity-30" />
            <p className="text-sm">No activity found</p>
            <p className="text-xs mt-1">Events will appear here as they happen on-chain</p>
          </div>
        )}

        {/* Events */}
        {events.map((event) => (
          <EventRow key={event.id} event={event} />
        ))}
      </div>
    </div>
  );
}

// ── Compact ticker variant ──

export function ActivityTicker({
  limit = 5,
  pollInterval = 20000,
}: {
  limit?: number;
  pollInterval?: number;
}) {
  const { events, isLoading } = useActivityFeed({ limit, pollInterval });

  if (isLoading && events.length === 0) {
    return null;
  }

  if (events.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-4 overflow-x-auto py-2 px-4 bg-card/50 border border-border/50 rounded-lg">
      <span className="flex items-center gap-1.5 text-xs text-accent-light font-semibold shrink-0">
        <Activity className="h-3 w-3" />
        LIVE
      </span>
      {events.slice(0, limit).map((event) => {
        const config = EVENT_CONFIG[event.type] || DEFAULT_CONFIG;
        return (
          <a
            key={event.id}
            href={event.explorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-muted hover:text-foreground shrink-0 transition-colors"
          >
            <span className={config.color}>{config.icon}</span>
            <span className="max-w-[200px] truncate">{event.summary}</span>
            {event.timestamp && (
              <span className="text-muted/50 text-[10px]">
                {formatTime(event.timestamp)}
              </span>
            )}
          </a>
        );
      })}
    </div>
  );
}
