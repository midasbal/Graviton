import GravitonLogo from "@/components/ui/GravitonLogo";
import { ExternalLink } from "lucide-react";

const LINKS = [
  { href: "https://chainscan-galileo.0g.ai", label: "Block Explorer" },
  { href: "https://faucet.0g.ai", label: "Faucet" },
  { href: "https://docs.0g.ai", label: "0G Docs" },
  { href: "https://0g.ai", label: "0G.ai" },
];

export default function Footer() {
  return (
    <footer className="border-t border-border/40 bg-card/20">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-between">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <GravitonLogo size={28} />
            <div>
              <p className="text-sm font-semibold gradient-text">Graviton</p>
              <p className="text-xs text-muted">
                AI Agent Marketplace on{" "}
                <a
                  href="https://0g.ai"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent-light hover:underline"
                >
                  0G Chain
                </a>
              </p>
            </div>
          </div>

          {/* Links */}
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-muted">
            {LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
              >
                {link.label}
                <ExternalLink className="h-3 w-3 opacity-50" />
              </a>
            ))}
          </div>
        </div>

        {/* Bottom */}
        <div className="mt-6 pt-6 border-t border-border/30 flex flex-col items-center gap-2 sm:flex-row sm:justify-between text-xs text-muted/60">
          <span>Built for 0G APAC Hackathon</span>
          <span>ERC-7857 · TEE Inference · 0G Storage · Revenue-Sharing DAO</span>
        </div>
      </div>
    </footer>
  );
}
