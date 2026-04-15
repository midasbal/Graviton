"use client";

import { useState, useEffect, useCallback } from "react";
import { useAccount } from "wagmi";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import Button from "@/components/ui/Button";
import { Input, TextArea, Select } from "@/components/ui/FormFields";
import {
  Cpu,
  Upload,
  Play,
  CheckCircle,
  XCircle,
  Loader2,
  ArrowRight,
  Database,
  Wallet,
  Zap,
  BarChart3,
  FileText,
  Settings,
  RefreshCw,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import type { FineTuneJob, FineTuneConfig } from "@/types";

// ============================================================
//  Constants
// ============================================================

const SUPPORTED_MODELS = [
  { value: "Qwen2.5-0.5B-Instruct", label: "Qwen 2.5 0.5B Instruct", size: "~100MB LoRA", price: "0.5 A0GI/M tokens" },
  { value: "Qwen2.5-7B-Instruct", label: "Qwen 2.5 7B Instruct", size: "~500MB LoRA", price: "2.0 A0GI/M tokens" },
  { value: "Qwen3-32B", label: "Qwen 3 32B", size: "~900MB LoRA", price: "5.0 A0GI/M tokens" },
];

const DEFAULT_CONFIG: FineTuneConfig = {
  neftune_noise_alpha: 5,
  num_train_epochs: 1,
  per_device_train_batch_size: 2,
  learning_rate: 0.0002,
  max_steps: 3,
};

const DATASET_TEMPLATES = {
  "instruction": `{"instruction": "Translate to French", "input": "Hello world", "output": "Bonjour le monde"}
{"instruction": "Translate to French", "input": "Good morning", "output": "Bonjour"}
{"instruction": "Summarize the text", "input": "Long article...", "output": "Brief summary"}`,
  "chat": `{"messages": [{"role": "user", "content": "What is 2+2?"}, {"role": "assistant", "content": "2+2 equals 4."}]}
{"messages": [{"role": "user", "content": "Hello"}, {"role": "assistant", "content": "Hi there! How can I help you?"}]}`,
  "text": `{"text": "The quick brown fox jumps over the lazy dog."}
{"text": "Machine learning is a subset of artificial intelligence."}`,
};

type TabId = "create" | "jobs" | "stats";

// ============================================================
//  Page Component
// ============================================================

export default function FineTunePage() {
  const { address, isConnected } = useAccount();
  const { addToast } = useAppStore();

  const [activeTab, setActiveTab] = useState<TabId>("create");

  // Create tab state
  const [tokenId, setTokenId] = useState("");
  const [baseModel, setBaseModel] = useState("Qwen2.5-0.5B-Instruct");
  const [datasetText, setDatasetText] = useState("");
  const [datasetFile, setDatasetFile] = useState<File | null>(null);
  const [config, setConfig] = useState<FineTuneConfig>(DEFAULT_CONFIG);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [estimatedFee, setEstimatedFee] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  // Jobs tab state
  const [jobs, setJobs] = useState<FineTuneJob[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [expandedJob, setExpandedJob] = useState<string | null>(null);
  const [pollingJob, setPollingJob] = useState<string | null>(null);

  // ----------------------------------------------------------
  //  Estimate Fee
  // ----------------------------------------------------------

  useEffect(() => {
    const lines = datasetText.trim().split("\n").filter(Boolean);
    if (lines.length === 0) {
      setEstimatedFee(null);
      return;
    }

    fetch("/api/fine-tune", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "estimate",
        baseModel,
        datasetSize: lines.length,
        epochs: config.num_train_epochs,
      }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.estimate) setEstimatedFee(data.estimate.estimatedFee);
      })
      .catch(() => {});
  }, [datasetText, baseModel, config.num_train_epochs]);

  // ----------------------------------------------------------
  //  Create Job
  // ----------------------------------------------------------

  const handleCreate = async () => {
    if (!tokenId.trim()) {
      addToast("Enter the INFT Token ID of your agent", "error");
      return;
    }

    const lines = datasetText.trim().split("\n").filter(Boolean);
    if (lines.length < 10) {
      addToast("Dataset needs at least 10 examples", "error");
      return;
    }

    // Validate JSONL
    try {
      lines.forEach((line, i) => {
        try { JSON.parse(line); } catch { throw new Error(`Line ${i + 1} is invalid JSON`); }
      });
    } catch (err: any) {
      addToast(err.message, "error");
      return;
    }

    setCreating(true);
    try {
      const res = await fetch("/api/fine-tune", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          tokenId: Number(tokenId),
          baseModel,
          dataset: datasetText,
          config,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      addToast(`Fine-tuning job created: ${data.job.jobId}`, "success");
      setJobs((prev) => [data.job, ...prev]);
      setActiveTab("jobs");
    } catch (err: any) {
      addToast(`Failed: ${err.message}`, "error");
    } finally {
      setCreating(false);
    }
  };

  // ----------------------------------------------------------
  //  Load Jobs
  // ----------------------------------------------------------

  const loadJobs = useCallback(async () => {
    setLoadingJobs(true);
    try {
      const res = await fetch("/api/fine-tune", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list" }),
      });
      const data = await res.json();
      if (data.jobs) setJobs(data.jobs);
    } catch {
      // silent
    } finally {
      setLoadingJobs(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "jobs") loadJobs();
  }, [activeTab, loadJobs]);

  // ----------------------------------------------------------
  //  Poll Job
  // ----------------------------------------------------------

  const pollJob = async (jobId: string) => {
    setPollingJob(jobId);
    try {
      const res = await fetch("/api/fine-tune", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "poll", jobId }),
      });
      const data = await res.json();
      if (data.job) {
        setJobs((prev) => prev.map((j) => (j.jobId === jobId ? data.job : j)));
      }
    } catch {
      // silent
    } finally {
      setPollingJob(null);
    }
  };

  // ----------------------------------------------------------
  //  Finalize Job
  // ----------------------------------------------------------

  const finalizeJob = async (jobId: string) => {
    try {
      const res = await fetch("/api/fine-tune", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "finalize", jobId }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      if (data.job) {
        setJobs((prev) => prev.map((j) => (j.jobId === jobId ? data.job : j)));
        addToast("Job finalized — LoRA adapter applied!", "success");
      }
    } catch (err: any) {
      addToast(`Finalize failed: ${err.message}`, "error");
    }
  };

  // ----------------------------------------------------------
  //  Handle JSONL file upload
  // ----------------------------------------------------------

  const handleFileUpload = async (file: File) => {
    setDatasetFile(file);
    const text = await file.text();
    setDatasetText(text);
    addToast(`Loaded ${file.name}`, "success");
  };

  // ----------------------------------------------------------
  //  Status badge
  // ----------------------------------------------------------

  const statusBadge = (status: string) => {
    const map: Record<string, { color: string; icon: React.ReactNode }> = {
      Created: { color: "bg-blue-500/20 text-blue-400", icon: <Loader2 className="h-3 w-3" /> },
      Submitted: { color: "bg-yellow-500/20 text-yellow-400", icon: <Loader2 className="h-3 w-3 animate-spin" /> },
      DatasetUploading: { color: "bg-yellow-500/20 text-yellow-400", icon: <Upload className="h-3 w-3" /> },
      DatasetUploaded: { color: "bg-blue-500/20 text-blue-400", icon: <Database className="h-3 w-3" /> },
      Training: { color: "bg-purple-500/20 text-purple-400", icon: <Cpu className="h-3 w-3 animate-pulse" /> },
      Trained: { color: "bg-emerald-500/20 text-emerald-400", icon: <CheckCircle className="h-3 w-3" /> },
      Delivering: { color: "bg-orange-500/20 text-orange-400", icon: <Loader2 className="h-3 w-3 animate-spin" /> },
      Delivered: { color: "bg-emerald-500/20 text-emerald-400", icon: <Database className="h-3 w-3" /> },
      Completed: { color: "bg-emerald-500/20 text-emerald-400", icon: <CheckCircle className="h-3 w-3" /> },
      Failed: { color: "bg-red-500/20 text-red-400", icon: <XCircle className="h-3 w-3" /> },
      Finalized: { color: "bg-cyan-500/20 text-cyan-400", icon: <Zap className="h-3 w-3" /> },
    };
    const info = map[status] ?? { color: "bg-gray-500/20 text-gray-400", icon: null };
    return (
      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${info.color}`}>
        {info.icon}
        {status}
      </span>
    );
  };

  // ----------------------------------------------------------
  //  Render: Not Connected
  // ----------------------------------------------------------

  if (!isConnected) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4">
            <Wallet className="h-16 w-16 text-muted mx-auto opacity-40" />
            <p className="text-lg font-medium text-foreground">Connect Your Wallet</p>
            <p className="text-sm text-muted max-w-md">
              Connect your wallet to fine-tune AI agents with 0G Compute Network.
            </p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // ----------------------------------------------------------
  //  Render
  // ----------------------------------------------------------

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1">
        <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
          {/* Page Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-pink-500">
                <Cpu className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-foreground">Fine-Tune Agent</h1>
                <p className="text-sm text-muted">
                  Customize AI models with your data on 0G Compute Network
                </p>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-border mb-6">
            {(
              [
                { id: "create" as TabId, label: "New Job", icon: <Play className="h-4 w-4" /> },
                { id: "jobs" as TabId, label: "My Jobs", icon: <BarChart3 className="h-4 w-4" /> },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? "border-accent text-accent"
                    : "border-transparent text-muted hover:text-foreground"
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          {/* ============================================== */}
          {/*  TAB: Create New Fine-Tuning Job               */}
          {/* ============================================== */}
          {activeTab === "create" && (
            <div className="space-y-6">
              {/* Step 1: Agent & Model */}
              <div className="rounded-xl border border-border bg-card p-6 space-y-4">
                <div className="flex items-center gap-2 mb-1">
                  <Cpu className="h-5 w-5 text-accent-light" />
                  <h2 className="text-lg font-semibold text-foreground">Agent & Model</h2>
                </div>

                <Input
                  label="INFT Token ID"
                  placeholder="e.g. 1"
                  value={tokenId}
                  onChange={(e) => setTokenId(e.target.value)}
                />

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Base Model</label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {SUPPORTED_MODELS.map((m) => (
                      <button
                        key={m.value}
                        onClick={() => setBaseModel(m.value)}
                        className={`rounded-lg border p-3 text-left transition-all ${
                          baseModel === m.value
                            ? "border-accent bg-accent/10 ring-1 ring-accent"
                            : "border-border bg-background hover:border-accent/30"
                        }`}
                      >
                        <p className="text-sm font-medium text-foreground">{m.label}</p>
                        <p className="text-xs text-muted mt-0.5">{m.size}</p>
                        <p className="text-xs text-accent-light mt-0.5">{m.price}</p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Step 2: Dataset */}
              <div className="rounded-xl border border-border bg-card p-6 space-y-4">
                <div className="flex items-center gap-2 mb-1">
                  <FileText className="h-5 w-5 text-accent-light" />
                  <h2 className="text-lg font-semibold text-foreground">Training Dataset</h2>
                </div>

                <p className="text-sm text-muted">
                  Provide your training data in JSONL format. Each line is one training example.
                  Minimum 10 examples required.
                </p>

                {/* Format templates */}
                <div>
                  <label className="block text-xs font-medium text-muted mb-1">Quick Template</label>
                  <div className="flex gap-2">
                    {(["instruction", "chat", "text"] as const).map((fmt) => (
                      <button
                        key={fmt}
                        onClick={() => setDatasetText(DATASET_TEMPLATES[fmt])}
                        className="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted hover:text-foreground hover:border-accent/30 transition-colors capitalize"
                      >
                        {fmt}
                      </button>
                    ))}
                  </div>
                </div>

                {/* File upload */}
                <label className="flex items-center gap-3 rounded-lg border border-dashed border-border bg-background px-4 py-3 cursor-pointer hover:border-accent/50 transition-colors">
                  <Upload className="h-5 w-5 text-muted" />
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {datasetFile ? datasetFile.name : "Upload .jsonl file"}
                    </p>
                    <p className="text-xs text-muted">Or paste your dataset below</p>
                  </div>
                  <input
                    type="file"
                    accept=".jsonl,.json"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleFileUpload(f);
                    }}
                  />
                </label>

                {/* Textarea for dataset */}
                <TextArea
                  label={`Dataset (JSONL) — ${datasetText.trim().split("\n").filter(Boolean).length} examples`}
                  placeholder='{"instruction": "...", "input": "...", "output": "..."}'
                  value={datasetText}
                  onChange={(e) => setDatasetText(e.target.value)}
                  rows={8}
                />

                {estimatedFee && (
                  <div className="flex items-center gap-2 rounded-lg border border-accent/20 bg-accent/5 px-4 py-2">
                    <Zap className="h-4 w-4 text-accent-light" />
                    <span className="text-sm text-foreground">
                      Estimated fee: <strong>{estimatedFee} A0GI</strong>
                    </span>
                  </div>
                )}
              </div>

              {/* Step 3: Training Config */}
              <div className="rounded-xl border border-border bg-card p-6 space-y-4">
                <button
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="flex items-center gap-2 w-full"
                >
                  <Settings className="h-5 w-5 text-accent-light" />
                  <h2 className="text-lg font-semibold text-foreground flex-1 text-left">Training Configuration</h2>
                  {showAdvanced ? (
                    <ChevronUp className="h-5 w-5 text-muted" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-muted" />
                  )}
                </button>

                {showAdvanced && (
                  <div className="space-y-4 pt-2">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-1">
                          Epochs
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={10}
                          value={config.num_train_epochs}
                          onChange={(e) =>
                            setConfig({ ...config, num_train_epochs: Number(e.target.value) })
                          }
                          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                        />
                        <p className="text-xs text-muted mt-1">1-3 recommended</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-1">
                          Batch Size
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={4}
                          value={config.per_device_train_batch_size}
                          onChange={(e) =>
                            setConfig({ ...config, per_device_train_batch_size: Number(e.target.value) })
                          }
                          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                        />
                        <p className="text-xs text-muted mt-1">Reduce to 1 if OOM</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-1">
                          Learning Rate
                        </label>
                        <input
                          type="number"
                          step={0.00001}
                          min={0.00001}
                          max={0.001}
                          value={config.learning_rate}
                          onChange={(e) =>
                            setConfig({ ...config, learning_rate: Number(e.target.value) })
                          }
                          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                        />
                        <p className="text-xs text-muted mt-1">0.0002 typical</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-1">
                          Max Steps
                        </label>
                        <input
                          type="number"
                          min={-1}
                          value={config.max_steps}
                          onChange={(e) =>
                            setConfig({ ...config, max_steps: Number(e.target.value) })
                          }
                          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                        />
                        <p className="text-xs text-muted mt-1">-1 = use epochs</p>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">
                        NEFTune Noise Alpha
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={10}
                        value={config.neftune_noise_alpha}
                        onChange={(e) =>
                          setConfig({ ...config, neftune_noise_alpha: Number(e.target.value) })
                        }
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                      />
                      <p className="text-xs text-muted mt-1">0 = disabled, 5 = recommended</p>
                    </div>
                  </div>
                )}

                {!showAdvanced && (
                  <p className="text-xs text-muted">
                    Using default config: {config.num_train_epochs} epoch(s), LR {config.learning_rate}, batch {config.per_device_train_batch_size}.
                    Click to customize.
                  </p>
                )}
              </div>

              {/* Submit */}
              <div className="flex justify-end">
                <Button
                  onClick={handleCreate}
                  loading={creating}
                  icon={<Play className="h-4 w-4" />}
                  className="px-8"
                >
                  Start Fine-Tuning
                </Button>
              </div>

              {/* Info Card */}
              <div className="rounded-xl border border-border bg-card/50 p-5 space-y-3">
                <h3 className="text-sm font-semibold text-foreground">How Fine-Tuning Works on 0G</h3>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  {[
                    { step: "1", title: "Upload Dataset", desc: "JSONL data → 0G Storage (encrypted)" },
                    { step: "2", title: "Submit Job", desc: "On-chain job + 0G Compute provider" },
                    { step: "3", title: "LoRA Training", desc: "TEE-secured training on GPU nodes" },
                    { step: "4", title: "Finalize", desc: "LoRA adapter → INFT IntelligentData" },
                  ].map((s) => (
                    <div key={s.step} className="flex gap-3">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/20 text-xs font-bold text-accent">
                        {s.step}
                      </div>
                      <div>
                        <p className="text-xs font-medium text-foreground">{s.title}</p>
                        <p className="text-xs text-muted">{s.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ============================================== */}
          {/*  TAB: My Jobs                                  */}
          {/* ============================================== */}
          {activeTab === "jobs" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted">{jobs.length} job(s)</p>
                <Button
                  variant="ghost"
                  onClick={loadJobs}
                  loading={loadingJobs}
                  icon={<RefreshCw className="h-4 w-4" />}
                >
                  Refresh
                </Button>
              </div>

              {jobs.length === 0 && (
                <div className="rounded-xl border border-border bg-card p-12 text-center">
                  <Cpu className="h-12 w-12 text-muted mx-auto mb-3 opacity-40" />
                  <p className="text-foreground font-medium mb-1">No fine-tuning jobs yet</p>
                  <p className="text-sm text-muted mb-4">
                    Create your first fine-tuning job to customize an AI agent.
                  </p>
                  <Button onClick={() => setActiveTab("create")} icon={<ArrowRight className="h-4 w-4" />}>
                    Create Job
                  </Button>
                </div>
              )}

              {jobs.map((job) => (
                <div
                  key={job.jobId}
                  className="rounded-xl border border-border bg-card overflow-hidden"
                >
                  {/* Job Header */}
                  <button
                    onClick={() => setExpandedJob(expandedJob === job.jobId ? null : job.jobId)}
                    className="w-full flex items-center gap-4 px-5 py-4 hover:bg-background/50 transition-colors"
                  >
                    <div className="flex-1 text-left">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-foreground">
                          Agent #{job.tokenId}
                        </span>
                        {statusBadge(job.status)}
                        <span className="text-xs text-muted">
                          {job.baseModel}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted">
                        <span>{job.datasetSize} examples</span>
                        <span>•</span>
                        <span>~{job.tokenCount} tokens</span>
                        <span>•</span>
                        <span>{job.estimatedFee} A0GI</span>
                        <span>•</span>
                        <span>{new Date(job.createdAt).toLocaleString()}</span>
                      </div>
                    </div>

                    {/* Progress */}
                    <div className="w-32 flex items-center gap-2">
                      <div className="flex-1 h-2 rounded-full bg-border overflow-hidden">
                        <div
                          className="h-full rounded-full bg-accent transition-all duration-500"
                          style={{ width: `${job.progress}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted w-8 text-right">{job.progress}%</span>
                    </div>

                    {expandedJob === job.jobId ? (
                      <ChevronUp className="h-5 w-5 text-muted" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-muted" />
                    )}
                  </button>

                  {/* Expanded Details */}
                  {expandedJob === job.jobId && (
                    <div className="border-t border-border px-5 py-4 space-y-4">
                      {/* Actions */}
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          onClick={() => pollJob(job.jobId)}
                          loading={pollingJob === job.jobId}
                          icon={<RefreshCw className="h-3.5 w-3.5" />}
                        >
                          Poll Progress
                        </Button>

                        {job.status === "Completed" && (
                          <Button
                            onClick={() => finalizeJob(job.jobId)}
                            icon={<CheckCircle className="h-3.5 w-3.5" />}
                          >
                            Finalize & Apply
                          </Button>
                        )}
                      </div>

                      {/* Info grid */}
                      <div className="grid grid-cols-2 gap-3">
                        <InfoRow label="Job ID" value={job.jobId} />
                        <InfoRow label="On-Chain ID" value={`#${job.onChainJobId}`} />
                        <InfoRow label="Provider" value={truncAddr(job.provider)} />
                        <InfoRow label="Config" value={`${job.config.num_train_epochs} epochs, LR ${job.config.learning_rate}`} />
                        {job.datasetHash && <InfoRow label="Dataset Hash" value={truncHash(job.datasetHash)} />}
                        {job.resultHash && <InfoRow label="Result Hash" value={truncHash(job.resultHash)} />}
                      </div>

                      {/* Logs */}
                      {job.logs.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-muted mb-1">Logs</p>
                          <div className="rounded-lg bg-background border border-border p-3 max-h-40 overflow-y-auto">
                            {job.logs.map((log, i) => (
                              <p key={i} className="text-xs font-mono text-muted leading-5">
                                {log}
                              </p>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}

// ============================================================
//  Helpers
// ============================================================

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-background border border-border/50 px-3 py-2">
      <p className="text-xs text-muted">{label}</p>
      <p className="text-xs font-mono text-foreground truncate">{value}</p>
    </div>
  );
}

function truncAddr(addr: string) {
  return addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : "—";
}

function truncHash(hash: string) {
  return hash ? `${hash.slice(0, 10)}...${hash.slice(-6)}` : "—";
}
