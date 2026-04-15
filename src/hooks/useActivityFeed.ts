"use client";

import { useState, useEffect, useCallback, useRef } from "react";

/**
 * Client-side activity event shape (serialized from server)
 */
export interface ActivityEvent {
  id: string;
  type: string;
  contract: string;
  blockNumber: string;
  transactionHash: string;
  logIndex: number;
  timestamp?: number;
  tokenId?: string;
  actor?: string;
  summary: string;
  details: Record<string, string>;
  explorerUrl: string;
}

interface UseActivityFeedOptions {
  tokenId?: string;
  actor?: string;
  types?: string[];
  limit?: number;
  blocks?: number;
  pollInterval?: number; // ms, 0 = no polling
  enabled?: boolean;
}

interface UseActivityFeedResult {
  events: ActivityEvent[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
  lastUpdated: Date | null;
}

/**
 * React hook for consuming the /api/events endpoint with optional polling.
 */
export function useActivityFeed(opts: UseActivityFeedOptions = {}): UseActivityFeedResult {
  const {
    tokenId,
    actor,
    types,
    limit = 30,
    blocks = 10000,
    pollInterval = 0,
    enabled = true,
  } = opts;

  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchEvents = useCallback(async () => {
    if (!enabled) return;

    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (tokenId) params.set("tokenId", tokenId);
      if (actor) params.set("actor", actor);
      if (types && types.length > 0) params.set("types", types.join(","));
      params.set("limit", String(limit));
      params.set("blocks", String(blocks));

      const res = await fetch(`/api/events?${params.toString()}`);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json();
      setEvents(data.events ?? []);
      setLastUpdated(new Date());
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to fetch events";
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [tokenId, actor, types, limit, blocks, enabled]);

  // Initial fetch
  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // Polling
  useEffect(() => {
    if (pollInterval > 0 && enabled) {
      intervalRef.current = setInterval(fetchEvents, pollInterval);
      return () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
      };
    }
  }, [pollInterval, enabled, fetchEvents]);

  return {
    events,
    isLoading,
    error,
    refetch: fetchEvents,
    lastUpdated,
  };
}
