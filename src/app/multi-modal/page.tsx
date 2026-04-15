"use client";

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import Button from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/FormFields";
import {
  Layers,
  MessageSquare,
  ImageIcon,
  Music,
  Video,
  Code,
  Plus,
  CheckCircle,
  XCircle,
  Loader2,
  ArrowRight,
  Wallet,
  BarChart3,
  Workflow,
  Shield,
  Trash2,
} from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import {
  useHasModalProfile,
  useSupportedModalities,
  useModalityUsageStats,
  useModalProfile,
  useTotalMultiModalAgents,
  useCreateModalProfile,
  useAddModality,
  useRemoveModality,
  useAddPipelineStage,
  useBalanceOf,
} from "@/hooks/useContracts";
import { CONTRACTS } from "@/config/contracts";
import { Modality, MODALITY_LABELS, MODALITY_ICONS } from "@/types";

// ============================================================
//  Constants
// ============================================================

const MODALITY_DETAILS = [
  {
    id: Modality.Text,
    label: "Text",
    icon: MessageSquare,
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/30",
    capabilities: ["chat", "completion", "summarization", "translation", "Q&A"],
  },
  {
    id: Modality.Image,
    label: "Image",
    icon: ImageIcon,
    color: "text-purple-400",
    bg: "bg-purple-500/10",
    border: "border-purple-500/30",
    capabilities: ["generation", "editing", "analysis", "vision", "style-transfer"],
  },
  {
    id: Modality.Audio,
    label: "Audio",
    icon: Music,
    color: "text-green-400",
    bg: "bg-green-500/10",
    border: "border-green-500/30",
    capabilities: ["text-to-speech", "speech-to-text", "music-generation", "voice-clone"],
  },
  {
    id: Modality.Video,
    label: "Video",
    icon: Video,
    color: "text-red-400",
    bg: "bg-red-500/10",
    border: "border-red-500/30",
    capabilities: ["generation", "editing", "analysis", "animation", "lip-sync"],
  },
  {
    id: Modality.Code,
    label: "Code",
    icon: Code,
    color: "text-yellow-400",
    bg: "bg-yellow-500/10",
    border: "border-yellow-500/30",
    capabilities: ["generation", "review", "debugging", "refactoring", "documentation"],
  },
];

type TabId = "manage" | "pipelines" | "stats";

// ============================================================
//  Page
// ============================================================

export default function MultiModalPage() {
  const { address, isConnected } = useAccount();
  const addToast = useAppStore((s) => s.addToast);
  const [tab, setTab] = useState<TabId>("manage");
  const [tokenId, setTokenId] = useState("");
  const tokenBigInt = tokenId ? BigInt(tokenId) : undefined;

  // On-chain reads
  const { data: hasProfile, refetch: refetchProfile } = useHasModalProfile(tokenBigInt);
  const { data: modalities, refetch: refetchModalities } = useSupportedModalities(tokenBigInt);
  const { data: usageStats } = useModalityUsageStats(tokenBigInt);
  const { data: profile } = useModalProfile(tokenBigInt);
  const { data: totalMM } = useTotalMultiModalAgents();
  const { data: userBalance } = useBalanceOf(address);

  const supported = modalities as readonly boolean[] | undefined;
  const usage = usageStats as readonly bigint[] | undefined;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden border-b border-border bg-gradient-to-b from-purple-500/5 to-transparent">
          <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-500/20">
                <Layers className="h-6 w-6 text-purple-400" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-foreground">Multi-Modal Agents</h1>
                <p className="text-muted text-sm">Configure text, image, audio, video & code capabilities</p>
              </div>
            </div>

            {/* Quick stats */}
            <div className="mt-6 grid grid-cols-2 md:grid-cols-3 gap-3">
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-xs text-muted">Multi-Modal Agents</p>
                <p className="text-lg font-bold text-foreground">{totalMM ? Number(totalMM) : 0}</p>
              </div>
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-xs text-muted">Your INFTs</p>
                <p className="text-lg font-bold text-foreground">{userBalance ? Number(userBalance) : 0}</p>
              </div>
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-xs text-muted">Modality Types</p>
                <p className="text-lg font-bold text-foreground">5</p>
              </div>
            </div>
          </div>
        </section>

        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          {/* Token ID selector */}
          <div className="mt-6 flex items-end gap-3">
            <div className="w-48">
              <Input
                label="Agent Token ID"
                value={tokenId}
                onChange={(e) => setTokenId(e.target.value)}
                type="number"
                min="0"
                placeholder="e.g. 0"
              />
            </div>
            {tokenId && (
              <p className="text-sm text-muted mb-1">
                {hasProfile ? (
                  <span className="text-green-400"><CheckCircle className="h-3.5 w-3.5 inline mr-1" />Profile active</span>
                ) : (
                  <span className="text-yellow-400">No multi-modal profile</span>
                )}
              </p>
            )}
          </div>

          {/* Tabs */}
          <div className="flex gap-1 border-b border-border mt-6 overflow-x-auto">
            {[
              { id: "manage" as TabId, label: "Modalities", icon: Layers },
              { id: "pipelines" as TabId, label: "Pipelines", icon: Workflow },
              { id: "stats" as TabId, label: "Usage Stats", icon: BarChart3 },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  tab === t.id
                    ? "border-purple-400 text-purple-400"
                    : "border-transparent text-muted hover:text-foreground"
                }`}
              >
                <t.icon className="h-4 w-4" />
                {t.label}
              </button>
            ))}
          </div>

          <div className="py-8">
            {!isConnected ? (
              <div className="rounded-xl border border-border bg-card p-12 text-center">
                <Wallet className="h-12 w-12 text-muted mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">Connect Wallet</h3>
                <p className="text-muted">Connect to manage multi-modal agent capabilities.</p>
              </div>
            ) : !tokenId ? (
              <div className="rounded-xl border border-border bg-card p-12 text-center">
                <Layers className="h-12 w-12 text-muted mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">Select an Agent</h3>
                <p className="text-muted">Enter a Token ID above to manage its multi-modal capabilities.</p>
              </div>
            ) : (
              <>
                {tab === "manage" && (
                  <ManageTab
                    tokenId={tokenBigInt!}
                    hasProfile={Boolean(hasProfile)}
                    supported={supported}
                    addToast={addToast}
                    refetchProfile={refetchProfile}
                    refetchModalities={refetchModalities}
                  />
                )}
                {tab === "pipelines" && (
                  <PipelinesTab
                    tokenId={tokenBigInt!}
                    hasProfile={Boolean(hasProfile)}
                    supported={supported}
                    profile={profile}
                    addToast={addToast}
                  />
                )}
                {tab === "stats" && (
                  <StatsTab
                    tokenId={tokenBigInt!}
                    supported={supported}
                    usage={usage}
                  />
                )}
              </>
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

// ============================================================
//  Manage Tab — Create profile + Add/Remove modalities
// ============================================================

type AddToast = (message: string, type?: "success" | "error" | "info") => void;

function ManageTab({
  tokenId,
  hasProfile,
  supported,
  addToast,
  refetchProfile,
  refetchModalities,
}: {
  tokenId: bigint;
  hasProfile: boolean;
  supported: readonly boolean[] | undefined;
  addToast: AddToast;
  refetchProfile: () => void;
  refetchModalities: () => void;
}) {
  const { create, isPending: createPending, isConfirming: createConfirming, isSuccess: createSuccess } = useCreateModalProfile();
  const { addModality, isPending: addPending, isConfirming: addConfirming, isSuccess: addSuccess } = useAddModality();
  const { remove, isPending: removePending, isConfirming: removeConfirming, isSuccess: removeSuccess } = useRemoveModality();

  const [selectedModality, setSelectedModality] = useState<number | null>(null);
  const [selectedCaps, setSelectedCaps] = useState<string[]>([]);
  const [modelRef, setModelRef] = useState("");

  useEffect(() => {
    if (createSuccess) {
      addToast("Multi-modal profile created!", "success");
      refetchProfile();
    }
  }, [createSuccess, addToast, refetchProfile]);

  useEffect(() => {
    if (addSuccess) {
      addToast("Modality added!", "success");
      refetchModalities();
      setSelectedModality(null);
      setSelectedCaps([]);
      setModelRef("");
    }
  }, [addSuccess, addToast, refetchModalities]);

  useEffect(() => {
    if (removeSuccess) {
      addToast("Modality removed.", "info");
      refetchModalities();
    }
  }, [removeSuccess, addToast, refetchModalities]);

  // Create profile if not active
  if (!hasProfile) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center">
        <Layers className="h-12 w-12 text-purple-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-foreground mb-2">Create Multi-Modal Profile</h3>
        <p className="text-muted mb-6">
          Enable multi-modal capabilities for this agent. This creates an on-chain profile
          that tracks which modalities (text, image, audio, video, code) your agent supports.
        </p>
        <Button
          onClick={() => create(tokenId)}
          disabled={createPending || createConfirming}
        >
          {createPending || createConfirming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          {createPending ? "Signing…" : createConfirming ? "Confirming…" : "Create Profile"}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-foreground">Agent Modalities</h2>
      <p className="text-sm text-muted">
        Enable modalities to define what types of input/output your agent can handle.
        Each modality can have separate model weights stored on 0G Storage.
      </p>

      {/* Modality cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {MODALITY_DETAILS.map((mod) => {
          const isEnabled = supported ? supported[mod.id] : false;
          const Icon = mod.icon;

          return (
            <div
              key={mod.id}
              className={`rounded-xl border p-5 transition-colors ${
                isEnabled
                  ? `${mod.border} ${mod.bg}`
                  : "border-border bg-card hover:border-border-hover"
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${mod.bg}`}>
                    <Icon className={`h-5 w-5 ${mod.color}`} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">{mod.label}</h3>
                    <p className="text-xs text-muted">{mod.capabilities.length} capabilities</p>
                  </div>
                </div>
                {isEnabled ? (
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">
                    Active
                  </span>
                ) : (
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-500/20 text-gray-400">
                    Inactive
                  </span>
                )}
              </div>

              {/* Capability chips */}
              <div className="flex flex-wrap gap-1 mb-3">
                {mod.capabilities.map((cap) => (
                  <span
                    key={cap}
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      isEnabled ? `${mod.bg} ${mod.color}` : "bg-border text-muted"
                    }`}
                  >
                    {cap}
                  </span>
                ))}
              </div>

              {/* Actions */}
              {isEnabled ? (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => remove(tokenId, mod.id)}
                  disabled={removePending || removeConfirming}
                >
                  <Trash2 className="h-3.5 w-3.5" /> Remove
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={() => {
                    setSelectedModality(mod.id);
                    setSelectedCaps(mod.capabilities.slice(0, 3));
                    setModelRef("");
                  }}
                >
                  <Plus className="h-3.5 w-3.5" /> Enable
                </Button>
              )}
            </div>
          );
        })}
      </div>

      {/* Add modality form */}
      {selectedModality !== null && (
        <div className="rounded-xl border border-purple-500/30 bg-card p-6 space-y-4">
          <h3 className="text-lg font-semibold text-foreground">
            Enable {MODALITY_LABELS[selectedModality]}
          </h3>

          <div>
            <label className="text-sm font-medium text-foreground block mb-2">Capabilities</label>
            <div className="flex flex-wrap gap-2">
              {MODALITY_DETAILS[selectedModality].capabilities.map((cap) => {
                const isSelected = selectedCaps.includes(cap);
                return (
                  <button
                    key={cap}
                    onClick={() =>
                      setSelectedCaps(
                        isSelected
                          ? selectedCaps.filter((c) => c !== cap)
                          : [...selectedCaps, cap]
                      )
                    }
                    className={`text-sm px-3 py-1 rounded-full border transition-colors ${
                      isSelected
                        ? "border-purple-400 bg-purple-500/20 text-purple-400"
                        : "border-border bg-card text-muted hover:border-border-hover"
                    }`}
                  >
                    {isSelected && <CheckCircle className="h-3 w-3 inline mr-1" />}
                    {cap}
                  </button>
                );
              })}
            </div>
          </div>

          <Input
            label="Model Reference"
            value={modelRef}
            onChange={(e) => setModelRef(e.target.value)}
            placeholder="e.g. stable-diffusion-xl, whisper-large-v3"
          />

          <div className="flex gap-3">
            <Button
              onClick={() => {
                if (selectedCaps.length === 0) {
                  addToast("Select at least one capability.", "error");
                  return;
                }
                const ref = modelRef || `${MODALITY_LABELS[selectedModality].toLowerCase()}-default`;
                const zeroHash = ("0x" + "0".repeat(64)) as `0x${string}`;
                addModality(tokenId, selectedModality, selectedCaps, ref, "", zeroHash);
              }}
              disabled={addPending || addConfirming}
            >
              {addPending || addConfirming ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              {addPending ? "Signing…" : addConfirming ? "Confirming…" : "Add Modality"}
            </Button>
            <Button variant="secondary" onClick={() => setSelectedModality(null)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
//  Pipelines Tab
// ============================================================

function PipelinesTab({
  tokenId,
  hasProfile,
  supported,
  profile,
  addToast,
}: {
  tokenId: bigint;
  hasProfile: boolean;
  supported: readonly boolean[] | undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  profile: any;
  addToast: AddToast;
}) {
  const { addStage, isPending, isConfirming, isSuccess } = useAddPipelineStage();
  const [inputMod, setInputMod] = useState("0");
  const [outputMod, setOutputMod] = useState("1");
  const [processorName, setProcessorName] = useState("");

  type ModalProfileTuple = readonly [bigint, bigint, bigint, bigint, bigint, bigint, boolean];
  const stageCount = profile ? Number((profile as ModalProfileTuple)[2] ?? 0) : 0;

  useEffect(() => {
    if (isSuccess) {
      addToast("Pipeline stage added!", "success");
      setProcessorName("");
    }
  }, [isSuccess, addToast]);

  if (!hasProfile) {
    return (
      <div className="rounded-xl border border-border bg-card p-12 text-center">
        <Workflow className="h-12 w-12 text-muted mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-foreground mb-2">No Profile</h3>
        <p className="text-muted">Create a multi-modal profile first on the Modalities tab.</p>
      </div>
    );
  }

  const enabledModalities = MODALITY_DETAILS.filter((m) => supported?.[m.id]);

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-foreground">Multi-Modal Pipelines</h2>
      <p className="text-sm text-muted">
        Define processing pipelines that chain modalities together. For example, a
        Text → Image → Video pipeline could generate animated content from text prompts.
      </p>

      {/* Existing stages count */}
      <div className="rounded-xl border border-border bg-card p-4">
        <p className="text-sm text-muted">
          <Workflow className="h-4 w-4 inline mr-1" />
          {stageCount} pipeline stage{stageCount !== 1 ? "s" : ""} configured
        </p>
      </div>

      {/* Example pipelines */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {[
          { name: "Content Creator", flow: "Text → Image → Video", desc: "Generate visual content from prompts" },
          { name: "Voice Assistant", flow: "Audio → Text → Audio", desc: "Speech-to-text + response + TTS" },
          { name: "Code Reviewer", flow: "Code → Text → Code", desc: "Analyze code, explain, then fix" },
        ].map((example) => (
          <div key={example.name} className="rounded-xl border border-border bg-card/50 p-4">
            <h4 className="text-sm font-semibold text-foreground">{example.name}</h4>
            <p className="text-xs text-purple-400 font-mono mt-1">{example.flow}</p>
            <p className="text-xs text-muted mt-1">{example.desc}</p>
          </div>
        ))}
      </div>

      {/* Add stage form */}
      {enabledModalities.length >= 2 ? (
        <div className="rounded-xl border border-purple-500/30 bg-card p-6 space-y-4">
          <h3 className="text-lg font-semibold text-foreground">Add Pipeline Stage</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Select
              label="Input Modality"
              value={inputMod}
              onChange={(e) => setInputMod(e.target.value)}
              options={enabledModalities.map((m) => ({ value: String(m.id), label: `${MODALITY_ICONS[m.id]} ${m.label}` }))}
            />
            <Select
              label="Output Modality"
              value={outputMod}
              onChange={(e) => setOutputMod(e.target.value)}
              options={enabledModalities.map((m) => ({ value: String(m.id), label: `${MODALITY_ICONS[m.id]} ${m.label}` }))}
            />
            <Input
              label="Processor Name"
              value={processorName}
              onChange={(e) => setProcessorName(e.target.value)}
              placeholder="e.g. text-to-image"
            />
          </div>
          <Button
            onClick={() => {
              const name = processorName || `${MODALITY_LABELS[Number(inputMod)]}-to-${MODALITY_LABELS[Number(outputMod)]}`;
              addStage(tokenId, Number(inputMod), Number(outputMod), name);
            }}
            disabled={isPending || isConfirming}
          >
            {isPending || isConfirming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {isPending ? "Signing…" : isConfirming ? "Confirming…" : "Add Stage"}
          </Button>
        </div>
      ) : (
        <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-4">
          <p className="text-sm text-yellow-400">
            <Shield className="h-4 w-4 inline mr-1" />
            Enable at least 2 modalities to create pipeline stages.
          </p>
        </div>
      )}
    </div>
  );
}

// ============================================================
//  Stats Tab
// ============================================================

function StatsTab({
  tokenId,
  supported,
  usage,
}: {
  tokenId: bigint;
  supported: readonly boolean[] | undefined;
  usage: readonly bigint[] | undefined;
}) {
  const totalUsage = usage ? usage.reduce((a, b) => a + Number(b), 0) : 0;

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-foreground">Usage Statistics</h2>
      <p className="text-sm text-muted">
        Per-modality usage analytics for Agent #{Number(tokenId)}.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
        {MODALITY_DETAILS.map((mod) => {
          const isEnabled = supported ? supported[mod.id] : false;
          const count = usage ? Number(usage[mod.id]) : 0;
          const pct = totalUsage > 0 ? Math.round((count / totalUsage) * 100) : 0;
          const Icon = mod.icon;

          return (
            <div
              key={mod.id}
              className={`rounded-xl border p-4 ${
                isEnabled ? `${mod.border} ${mod.bg}` : "border-border bg-card"
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <Icon className={`h-4 w-4 ${isEnabled ? mod.color : "text-muted"}`} />
                <span className={`text-sm font-medium ${isEnabled ? "text-foreground" : "text-muted"}`}>
                  {mod.label}
                </span>
              </div>
              <p className={`text-2xl font-bold ${isEnabled ? "text-foreground" : "text-muted"}`}>
                {count}
              </p>
              <p className="text-xs text-muted">{isEnabled ? `${pct}% of total` : "Not enabled"}</p>
              {/* Usage bar */}
              {isEnabled && totalUsage > 0 && (
                <div className="mt-2 h-1.5 w-full bg-border rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      mod.color.replace("text-", "bg-").replace("-400", "-500")
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Summary */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h3 className="text-lg font-semibold text-foreground mb-3">Summary</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-muted">Total Inferences</p>
            <p className="text-lg font-bold text-foreground">{totalUsage}</p>
          </div>
          <div>
            <p className="text-xs text-muted">Active Modalities</p>
            <p className="text-lg font-bold text-foreground">
              {supported ? supported.filter(Boolean).length : 0} / 5
            </p>
          </div>
          <div>
            <p className="text-xs text-muted">Most Used</p>
            <p className="text-lg font-bold text-foreground">
              {totalUsage > 0 && usage
                ? MODALITY_LABELS[usage.indexOf(usage.reduce((a, b) => (a > b ? a : b), 0n))]
                : "—"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
