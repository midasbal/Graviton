import Link from "next/link";
import {
  Shield,
  Database,
  ArrowRight,
  Zap,
  Lock,
  Store,
  Activity,
  Hexagon,
} from "lucide-react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import GravitonLogo from "@/components/ui/GravitonLogo";

const FEATURES = [
  {
    icon: Shield,
    title: "ERC-7857 INFT",
    description:
      "AI agents wrapped in Intelligent NFTs with verifiable data integrity, oracle-backed transfers, and on-chain royalties.",
    color: "text-cyan",
    bg: "bg-cyan/10",
    borderColor: "group-hover:border-cyan/30",
  },
  {
    icon: Lock,
    title: "Encrypted Weights",
    description:
      "LoRA adapters encrypted with AES-256 and stored on 0G decentralized storage. Only authorized holders can decrypt.",
    color: "text-pink",
    bg: "bg-pink/10",
    borderColor: "group-hover:border-pink/30",
  },
  {
    icon: Zap,
    title: "TEE Sealed Inference",
    description:
      "Test-drive agents in Trusted Execution Environments via 0G Compute Network. Responses are cryptographically verified.",
    color: "text-lime",
    bg: "bg-lime/10",
    borderColor: "group-hover:border-lime/30",
  },
  {
    icon: Store,
    title: "Decentralized Marketplace",
    description:
      "Buy, sell, and rent AI agents with on-chain escrow, automatic royalties, and transparent platform fees.",
    color: "text-accent-light",
    bg: "bg-accent/10",
    borderColor: "group-hover:border-accent/30",
  },
  {
    icon: Database,
    title: "0G Storage Integration",
    description:
      "Permanent, verifiable storage with Merkle proofs. Every agent's data is referenced on-chain via root hashes.",
    color: "text-warning",
    bg: "bg-warning/10",
    borderColor: "group-hover:border-warning/30",
  },
  {
    icon: Activity,
    title: "On-Chain Analytics",
    description:
      "Track inference counts, ratings, and usage statistics. All metrics recorded transparently on 0G Chain.",
    color: "text-success",
    bg: "bg-success/10",
    borderColor: "group-hover:border-success/30",
  },
];

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden hero-gradient">
          <div className="absolute inset-0 bg-grid opacity-[0.04]" />
          <div className="relative mx-auto max-w-5xl px-4 py-28 sm:px-6 sm:py-36 text-center">
            {/* Floating logo */}
            <div className="flex justify-center mb-8">
              <div className="animate-float">
                <GravitonLogo size={72} />
              </div>
            </div>

            <div className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-4 py-2 text-xs font-medium text-accent-light mb-8 backdrop-blur-sm">
              <Hexagon className="h-3.5 w-3.5" />
              Built on 0G — The Modular AI Chain
            </div>

            <h1 className="text-5xl font-extrabold tracking-tight text-foreground sm:text-6xl lg:text-7xl mb-8 leading-[1.1]">
              The AI Agent{" "}
              <span className="gradient-text">Marketplace</span>
            </h1>

            <p className="text-lg sm:text-xl text-muted max-w-2xl mx-auto mb-12 leading-relaxed">
              Mint, trade, rent, and test-drive intelligent NFTs powered by
              encrypted LoRA adapters, TEE-sealed inference, and
              0G decentralized infrastructure.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/marketplace"
                className="inline-flex items-center gap-2 rounded-2xl btn-shimmer px-8 py-4 text-base font-semibold text-white shadow-xl shadow-accent/25 hover:shadow-accent/40 transition-shadow duration-300"
              >
                Explore Marketplace
                <ArrowRight className="h-5 w-5" />
              </Link>
              <Link
                href="/create"
                className="inline-flex items-center gap-2 rounded-2xl border border-border bg-card/60 backdrop-blur-sm px-8 py-4 text-base font-semibold text-foreground hover:bg-card-hover hover:border-accent/30 transition-all duration-300"
              >
                Create Agent
              </Link>
            </div>

            {/* Trust badges */}
            <div className="mt-14 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted/70">
              <span className="flex items-center gap-1.5"><Shield className="h-3.5 w-3.5 text-cyan/60" /> TEE Verified</span>
              <span className="flex items-center gap-1.5"><Lock className="h-3.5 w-3.5 text-pink/60" /> AES-256 Encrypted</span>
              <span className="flex items-center gap-1.5"><Database className="h-3.5 w-3.5 text-warning/60" /> 0G Storage</span>
              <span className="flex items-center gap-1.5"><Activity className="h-3.5 w-3.5 text-success/60" /> On-Chain</span>
            </div>
          </div>
        </section>

        {/* Features grid */}
        <section className="border-t border-border/40 bg-card/10">
          <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
                AI Agents as First-Class{" "}
                <span className="gradient-text">On-Chain Assets</span>
              </h2>
              <p className="text-muted max-w-lg mx-auto text-base leading-relaxed">
                Graviton combines ERC-7857, 0G Storage, and 0G Compute to create
                a trustless marketplace for AI agent ownership.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((feature) => (
                <div
                  key={feature.title}
                  className={`group rounded-2xl border border-border/60 bg-card/40 p-7 hover:bg-card-hover/60 transition-all duration-300 card-glow ${feature.borderColor}`}
                >
                  <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${feature.bg} transition-colors mb-5`}>
                    <feature.icon className={`h-6 w-6 ${feature.color}`} />
                  </div>
                  <h3 className="text-base font-semibold text-foreground mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-muted leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="border-t border-border/40">
          <div className="mx-auto max-w-4xl px-4 py-24 sm:px-6">
            <div className="text-center mb-14">
              <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
                How It <span className="gradient-text">Works</span>
              </h2>
            </div>

            <div className="space-y-5">
              {[
                {
                  step: "01",
                  title: "Create & Encrypt",
                  desc: "Train a LoRA adapter, define a system prompt, and encrypt your agent's weights with AES-256.",
                  color: "text-cyan",
                  bg: "bg-cyan/10",
                },
                {
                  step: "02",
                  title: "Upload to 0G Storage",
                  desc: "Encrypted weights are uploaded to 0G's decentralized storage. A Merkle root hash is recorded on-chain.",
                  color: "text-pink",
                  bg: "bg-pink/10",
                },
                {
                  step: "03",
                  title: "Mint as ERC-7857 INFT",
                  desc: "Your AI agent becomes an Intelligent NFT with verifiable data, royalties, and transferable ownership.",
                  color: "text-accent-light",
                  bg: "bg-accent/10",
                },
                {
                  step: "04",
                  title: "Trade & Test-Drive",
                  desc: "List on the marketplace, let buyers test-drive via TEE-sealed inference, and earn royalties on resales.",
                  color: "text-lime",
                  bg: "bg-lime/10",
                },
              ].map((item) => (
                <div
                  key={item.step}
                  className="flex items-start gap-5 rounded-2xl border border-border/60 bg-card/40 p-7 hover:border-accent/20 hover:bg-card-hover/40 transition-all duration-300"
                >
                  <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${item.bg} ${item.color} font-bold text-lg`}>
                    {item.step}
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-foreground mb-1.5">
                      {item.title}
                    </h3>
                    <p className="text-sm text-muted leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="border-t border-border/40 hero-gradient">
          <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/15 mb-6">
              <Hexagon className="h-8 w-8 text-accent-light" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-4">
              Ready to Build on <span className="gradient-text">Graviton</span>?
            </h2>
            <p className="text-muted mb-10 text-base leading-relaxed max-w-lg mx-auto">
              Connect to the 0G Galileo Testnet, get some tokens from the faucet,
              and create your first AI agent.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/create"
                className="inline-flex items-center gap-2 rounded-2xl btn-shimmer px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-accent/25"
              >
                <Zap className="h-4 w-4" />
                Create Agent
              </Link>
              <a
                href="https://faucet.0g.ai"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-2xl border border-border bg-card/60 px-6 py-3.5 text-sm font-semibold text-foreground hover:bg-card-hover transition-colors"
              >
                Get Testnet Tokens
                <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
