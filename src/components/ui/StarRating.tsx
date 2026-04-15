import { Star } from "lucide-react";

interface StarRatingProps {
  rating: number; // 0-5
  size?: "sm" | "md";
  interactive?: boolean;
  onRate?: (score: number) => void;
}

export default function StarRating({
  rating,
  size = "sm",
  interactive = false,
  onRate,
}: StarRatingProps) {
  const iconSize = size === "sm" ? "h-3.5 w-3.5" : "h-5 w-5";

  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= Math.round(rating);
        return (
          <button
            key={star}
            disabled={!interactive}
            onClick={() => interactive && onRate?.(star)}
            className={`${interactive ? "cursor-pointer hover:scale-110" : "cursor-default"} transition-transform`}
          >
            <Star
              className={`${iconSize} ${
                filled
                  ? "fill-warning text-warning"
                  : "fill-none text-muted/40"
              }`}
            />
          </button>
        );
      })}
    </div>
  );
}
