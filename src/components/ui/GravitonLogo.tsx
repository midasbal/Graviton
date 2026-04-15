/**
 * Graviton custom brand logo.
 * A hexagonal gravity-well prism with an inner "G" letterform —
 * three interlocking facets converge toward a bright centre,
 * representing AI agents being pulled together by gravitational force.
 * Completely original — no resemblance to Gemini, Bard, or other AI brands.
 */

interface LogoProps {
  size?: number;
  className?: string;
}

export default function GravitonLogo({ size = 32, className = "" }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Graviton logo"
    >
      {/* Outer hexagonal frame */}
      <path
        d="M24 3L42.5 13.5V34.5L24 45L5.5 34.5V13.5L24 3Z"
        stroke="url(#gl-hex)"
        strokeWidth="1.6"
        strokeLinejoin="round"
        opacity="0.5"
      />

      {/* Three converging facets → gravity well */}
      {/* Top-left facet */}
      <path
        d="M24 3L5.5 13.5L24 24Z"
        fill="url(#gl-facet1)"
        opacity="0.85"
      />
      {/* Top-right facet */}
      <path
        d="M24 3L42.5 13.5L24 24Z"
        fill="url(#gl-facet2)"
        opacity="0.7"
      />
      {/* Bottom facet */}
      <path
        d="M5.5 34.5L24 24L42.5 34.5L24 45Z"
        fill="url(#gl-facet3)"
        opacity="0.55"
      />

      {/* Centre bright diamond — the gravity core */}
      <path
        d="M18 24L24 18L30 24L24 30Z"
        fill="url(#gl-core)"
      />
      <path
        d="M18 24L24 18L30 24L24 30Z"
        fill="url(#gl-shine)"
        opacity="0.45"
      />

      {/* Accent spark lines radiating from centre */}
      <line x1="24" y1="16" x2="24" y2="11" stroke="#c084fc" strokeWidth="1.2" strokeLinecap="round" opacity="0.6" />
      <line x1="31" y1="28" x2="35" y2="31" stroke="#22d3ee" strokeWidth="1.2" strokeLinecap="round" opacity="0.6" />
      <line x1="17" y1="28" x2="13" y2="31" stroke="#f472b6" strokeWidth="1.2" strokeLinecap="round" opacity="0.6" />

      <defs>
        <linearGradient id="gl-hex" x1="5" y1="3" x2="43" y2="45">
          <stop offset="0%" stopColor="#818cf8" />
          <stop offset="50%" stopColor="#c084fc" />
          <stop offset="100%" stopColor="#22d3ee" />
        </linearGradient>
        <linearGradient id="gl-facet1" x1="5" y1="3" x2="24" y2="24">
          <stop offset="0%" stopColor="#6366f1" />
          <stop offset="100%" stopColor="#4338ca" />
        </linearGradient>
        <linearGradient id="gl-facet2" x1="42" y1="3" x2="24" y2="24">
          <stop offset="0%" stopColor="#818cf8" />
          <stop offset="100%" stopColor="#6366f1" />
        </linearGradient>
        <linearGradient id="gl-facet3" x1="5" y1="45" x2="43" y2="24">
          <stop offset="0%" stopColor="#f472b6" stopOpacity="0.6" />
          <stop offset="50%" stopColor="#6366f1" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#22d3ee" stopOpacity="0.6" />
        </linearGradient>
        <radialGradient id="gl-core" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="#e0e7ff" />
          <stop offset="40%" stopColor="#a5b4fc" />
          <stop offset="100%" stopColor="#6366f1" />
        </radialGradient>
        <radialGradient id="gl-shine" cx="0.35" cy="0.3" r="0.45">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.7" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
      </defs>
    </svg>
  );
}
