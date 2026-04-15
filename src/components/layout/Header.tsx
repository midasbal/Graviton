"use client";

import Link from "next/link";
import { useAccount, useConnect, useDisconnect, useBalance, useChainId, useSwitchChain } from "wagmi";
import { injected } from "wagmi/connectors";
import {
  Wallet,
  LogOut,
  Menu,
  X,
  LayoutDashboard,
  Store,
  Plus,
  Globe,
  Zap,
  Landmark,
  Layers,
  AlertTriangle,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { formatEther } from "viem";
import GravitonLogo from "@/components/ui/GravitonLogo";
import { ChevronDown } from "lucide-react";

const PRIMARY_LINKS = [
  { href: "/marketplace", label: "Marketplace", icon: Store },
  { href: "/create", label: "Create", icon: Plus },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
];

const TOOLS_LINKS = [
  { href: "/fine-tune", label: "Fine-Tune", icon: Zap },
  { href: "/multi-modal", label: "Multi-Modal", icon: Layers },
  { href: "/governance", label: "Governance", icon: Landmark },
];

const ALL_LINKS = [...PRIMARY_LINKS, ...TOOLS_LINKS];

export default function Header() {
  const { address, isConnected } = useAccount();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();
  const { data: balance } = useBalance({ address });
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showMainnetTooltip, setShowMainnetTooltip] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const toolsRef = useRef<HTMLDivElement>(null);

  // Close tools dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (toolsRef.current && !toolsRef.current.contains(e.target as Node)) {
        setToolsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const shortAddr = address
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : "";

  const isMainnet = chainId === 16661;

  return (
    <header className="sticky top-0 z-50 border-b border-border/60 glass">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 group shrink-0">
          <GravitonLogo size={34} className="transition-transform group-hover:scale-110 duration-300" />
          <span className="text-xl font-bold gradient-text hidden sm:inline tracking-tight">
            Graviton
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden lg:flex items-center gap-1 mx-8">
          {PRIMARY_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium text-muted hover:text-foreground hover:bg-card/80 transition-all duration-200"
            >
              <link.icon className="h-4 w-4" />
              {link.label}
            </Link>
          ))}

          {/* Tools dropdown */}
          <div ref={toolsRef} className="relative">
            <button
              onClick={() => setToolsOpen(!toolsOpen)}
              className="flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium text-muted hover:text-foreground hover:bg-card/80 transition-all duration-200"
            >
              <Zap className="h-4 w-4" />
              Tools
              <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${toolsOpen ? "rotate-180" : ""}`} />
            </button>
            {toolsOpen && (
              <div className="absolute left-0 top-full mt-1.5 w-48 rounded-xl border border-border/60 bg-card/95 backdrop-blur-xl shadow-xl shadow-black/30 py-1.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                {TOOLS_LINKS.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setToolsOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-muted hover:text-foreground hover:bg-card-hover/60 transition-colors"
                  >
                    <link.icon className="h-4 w-4" />
                    {link.label}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </nav>

        {/* Right side: Network + Wallet */}
        <div className="flex items-center gap-2.5">
          {/* Network switcher with mainnet warning */}
          {isConnected && (
            <div className="relative hidden sm:block">
              <button
                onClick={() => {
                  if (isMainnet) {
                    // If on mainnet, switch to testnet
                    switchChain({ chainId: 16602 });
                  } else {
                    // Show tooltip instead of switching to mainnet
                    setShowMainnetTooltip(true);
                    setTimeout(() => setShowMainnetTooltip(false), 3000);
                  }
                }}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all duration-200 ${
                  isMainnet
                    ? "border-error/40 bg-error/10 text-error hover:bg-error/20"
                    : "border-success/30 bg-success/10 text-success hover:bg-success/20"
                }`}
                title={isMainnet ? "Mainnet — click to switch to Testnet" : "0G Galileo Testnet"}
              >
                <div className={`h-2 w-2 rounded-full ${isMainnet ? "bg-error" : "bg-success"} animate-pulse`} />
                <Globe className="h-3 w-3" />
                {isMainnet ? "Mainnet" : "Galileo Testnet"}
              </button>

              {/* Mainnet unavailable tooltip */}
              {showMainnetTooltip && !isMainnet && (
                <div className="absolute top-full right-0 mt-2 w-64 rounded-xl border border-warning/30 bg-warning/10 p-3 text-xs text-warning shadow-lg backdrop-blur-xl z-50 animate-in fade-in slide-in-from-top-2">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold mb-1">Mainnet Coming Soon</p>
                      <p className="text-warning/80 leading-relaxed">
                        0G Mainnet is currently unavailable. Please continue using Galileo Testnet.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Wallet */}
          {isConnected ? (
            <div className="flex items-center gap-2">
              {balance && (
                <span className="hidden md:inline text-xs text-muted font-mono bg-card/60 rounded-lg px-2.5 py-1.5 border border-border/40">
                  {parseFloat(formatEther(balance.value)).toFixed(3)} A0GI
                </span>
              )}
              <button
                onClick={() => disconnect()}
                className="flex items-center gap-2 rounded-xl border border-border/60 bg-card/60 px-3 py-2 text-sm font-mono text-foreground hover:border-accent/40 hover:bg-card-hover transition-all duration-200"
              >
                <div className="h-2 w-2 rounded-full bg-success animate-pulse" />
                {shortAddr}
                <LogOut className="h-3.5 w-3.5 text-muted" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => connect({ connector: injected() })}
              className="flex items-center gap-2 rounded-xl btn-shimmer px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-accent/20 hover:shadow-accent/40 transition-shadow duration-300"
            >
              <Wallet className="h-4 w-4" />
              Connect Wallet
            </button>
          )}

          {/* Mobile menu toggle */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="lg:hidden rounded-xl p-2 text-muted hover:text-foreground hover:bg-card transition-colors"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile nav */}
      {mobileOpen && (
        <nav className="lg:hidden border-t border-border/60 bg-card/40 backdrop-blur-xl px-4 py-3 space-y-1">
          {ALL_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-muted hover:text-foreground hover:bg-card-hover transition-colors"
            >
              <link.icon className="h-4 w-4" />
              {link.label}
            </Link>
          ))}
          {/* Mobile network indicator */}
          {isConnected && (
            <div className="flex items-center gap-2 rounded-xl px-4 py-3 text-xs text-muted border-t border-border/30 mt-2 pt-3">
              <div className={`h-2 w-2 rounded-full ${isMainnet ? "bg-error" : "bg-success"}`} />
              <span>{isMainnet ? "0G Mainnet" : "0G Galileo Testnet"}</span>
              {isMainnet && (
                <button
                  onClick={() => switchChain({ chainId: 16602 })}
                  className="ml-auto text-accent-light text-xs underline"
                >
                  Switch to Testnet
                </button>
              )}
            </div>
          )}
        </nav>
      )}
    </header>
  );
}
