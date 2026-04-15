"use client";

import Link from "next/link";
import { Activity, Tag, Sparkles } from "lucide-react";
import StarRating from "@/components/ui/StarRating";
import Badge from "@/components/ui/Badge";
import GravitonLogo from "@/components/ui/GravitonLogo";
import { formatEther } from "viem";

interface AgentCardProps {
  tokenId: bigint;
  name: string;
  description: string;
  modelType: string;
  category: string;
  tags: string[];
  averageRating: number;
  ratingCount: bigint;
  inferenceCount: bigint;
  listingPrice: bigint | null; // null = not for sale
  isActive: boolean;
}

export default function AgentCard({
  tokenId,
  name,
  description,
  modelType,
  category,
  tags,
  averageRating,
  ratingCount,
  inferenceCount,
  listingPrice,
  isActive,
}: AgentCardProps) {
  return (
    <Link href={`/agent/${tokenId.toString()}`}>
      <div className="group relative rounded-2xl border border-border/60 bg-card/40 p-6 transition-all duration-300 hover:border-accent/30 hover:bg-card-hover/60 hover:shadow-xl hover:shadow-accent-glow card-glow">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent/10 group-hover:bg-accent/20 transition-colors">
            <GravitonLogo size={28} />
          </div>
          <div className="flex flex-col items-end gap-1">
            {listingPrice !== null && isActive ? (
              <span className="text-lg font-bold text-foreground">
                {parseFloat(formatEther(listingPrice)).toFixed(2)}{" "}
                <span className="text-xs text-muted font-normal">A0GI</span>
              </span>
            ) : (
              <Badge variant="default">Not Listed</Badge>
            )}
          </div>
        </div>

        {/* Name & description */}
        <h3 className="text-base font-semibold text-foreground mb-1.5 line-clamp-1 group-hover:text-accent-light transition-colors">
          {name}
        </h3>
        <p className="text-sm text-muted line-clamp-2 mb-4 min-h-[2.5rem] leading-relaxed">
          {description}
        </p>

        {/* Tags */}
        <div className="flex flex-wrap gap-1.5 mb-5">
          <Badge variant="accent">{category}</Badge>
          {tags.slice(0, 3).map((tag) => (
            <Badge key={tag}>{tag}</Badge>
          ))}
          {tags.length > 3 && (
            <Badge>+{tags.length - 3}</Badge>
          )}
        </div>

        {/* Footer stats */}
        <div className="flex items-center justify-between pt-4 border-t border-border/40">
          <div className="flex items-center gap-1">
            <StarRating rating={averageRating} size="sm" />
            <span className="text-xs text-muted ml-1">
              ({ratingCount.toString()})
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted">
            <span className="flex items-center gap-1">
              <Activity className="h-3 w-3" />
              {inferenceCount.toString()}
            </span>
            <span className="flex items-center gap-1">
              <Tag className="h-3 w-3" />
              {modelType}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
