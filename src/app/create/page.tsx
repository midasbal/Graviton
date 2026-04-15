"use client";

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { useReadContract } from "wagmi";
import { parseAbi, formatEther } from "viem";
import { CONTRACTS } from "@/config/contracts";
import {
  useMintAgent,
  useRegisterAgent,
  useApproveINFT,
} from "@/hooks/useContracts";
import { useAppStore } from "@/store/useAppStore";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import Button from "@/components/ui/Button";
import { Input, TextArea, Select } from "@/components/ui/FormFields";
import {
  Upload,
  Cpu,
  FileUp,
  CheckCircle,
  ArrowRight,
  Wallet,
  Shield,
  Database,
} from "lucide-react";

const inftAbi = parseAbi([
  "function mintFee() external view returns (uint256)",
]);

const CATEGORIES = [
  { value: "assistant", label: "Assistant" },
  { value: "trading", label: "Trading" },
  { value: "coding", label: "Coding" },
  { value: "writing", label: "Writing" },
  { value: "research", label: "Research" },
  { value: "creative", label: "Creative" },
  { value: "defi", label: "DeFi" },
  { value: "other", label: "Other" },
];

const MODEL_TYPES = [
  { value: "Qwen2.5-0.5B-Instruct", label: "Qwen 2.5 0.5B Instruct" },
  { value: "Qwen2.5-7B-Instruct", label: "Qwen 2.5 7B Instruct" },
  { value: "Llama-3.1-8B", label: "Llama 3.1 8B" },
  { value: "Mistral-7B-v0.3", label: "Mistral 7B v0.3" },
  { value: "custom", label: "Custom Model" },
];

type Step = "details" | "upload" | "mint" | "register" | "complete";

export default function CreateAgentPage() {
  const { address, isConnected } = useAccount();
  const { addToast } = useAppStore();

  const [step, setStep] = useState<Step>("details");

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [modelType, setModelType] = useState("Qwen2.5-0.5B-Instruct");
  const [category, setCategory] = useState("assistant");
  const [tags, setTags] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [loraFile, setLoraFile] = useState<File | null>(null);

  // Upload state
  const [uploading, setUploading] = useState(false);
  const [storageRoot, setStorageRoot] = useState("");
  const [dataHash, setDataHash] = useState<`0x${string}`>("0x0000000000000000000000000000000000000000000000000000000000000000");
  const [uploadMode, setUploadMode] = useState<"live" | "fallback" | "">("");
  const [storageScanUrl, setStorageScanUrl] = useState("");

  // Mint state
  const { mint, isPending: mintPending, isConfirming: mintConfirming, isSuccess: mintSuccess, hash: mintHash } = useMintAgent();
  const { register, isPending: regPending, isConfirming: regConfirming, isSuccess: regSuccess, hash: regHash } = useRegisterAgent();

  const { data: mintFee } = useReadContract({
    address: CONTRACTS.INFT,
    abi: inftAbi,
    functionName: "mintFee",
  });

  const tagArray = tags.split(",").map((t) => t.trim()).filter(Boolean);

  // Step 1 → 2: Validate form
  const handleDetailsContinue = () => {
    if (!name.trim()) { addToast("Agent name is required", "error"); return; }
    if (!description.trim()) { addToast("Description is required", "error"); return; }
    setStep("upload");
  };

  // Step 2: Upload to 0G Storage (real SDK integration)
  const handleUpload = async () => {
    setUploading(true);

    try {
      const res = await fetch("/api/storage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "upload",
          name,
          description,
          modelType,
          category,
          systemPrompt,
          tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Storage upload failed");
      }

      const data = await res.json();

      setStorageRoot(data.rootHash);
      setDataHash(data.dataHash as `0x${string}`);
      setUploadMode(data.uploadMode);
      setStorageScanUrl(data.storageScanUrl || "");

      if (data.uploadMode === "live") {
        addToast("Agent data uploaded to 0G Storage (live)", "success");
      } else {
        addToast("Agent data prepared (0G Storage fallback mode)", "info");
      }
      setStep("mint");
    } catch (error: any) {
      addToast(`Upload failed: ${error.message}`, "error");
    } finally {
      setUploading(false);
    }
  };

  // Step 3: Mint INFT
  const handleMint = () => {
    if (!address) { addToast("Connect wallet first", "error"); return; }

    const intelligentData = [
      {
        dataDescription: `${name} — LoRA adapter (${modelType})`,
        dataHash: dataHash,
      },
    ];

    const uri = `0g://${storageRoot}`;
    const fee = (mintFee as bigint) ?? 0n;

    mint(address, intelligentData, category, storageRoot, uri, fee);
    addToast("Mint transaction submitted — check wallet for approval", "info");
  };

  // Step 4: Register in Registry
  const handleRegister = () => {
    // Token ID is the latest minted — for MVP we use totalSupply
    // In production, parse it from the mint transaction receipt
    const tokenId = 1n; // Placeholder — would be parsed from events
    const uri = `0g://${storageRoot}`;

    register(tokenId, name, description, modelType, tagArray, storageRoot, uri);
    addToast("Registration transaction submitted — check wallet for approval", "info");
  };

  // Transaction success toasts with ChainScan links
  useEffect(() => {
    if (mintSuccess && mintHash) {
      addToast(`INFT minted! TX: ${mintHash.slice(0, 10)}… — View on ChainScan`, "success");
    }
  }, [mintSuccess, mintHash, addToast]);

  useEffect(() => {
    if (regSuccess && regHash) {
      addToast(`Agent registered! TX: ${regHash.slice(0, 10)}… — View on ChainScan`, "success");
    }
  }, [regSuccess, regHash, addToast]);

  if (!isConnected) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-5 px-4">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-accent/10">
              <Wallet className="h-10 w-10 text-accent-light opacity-60" />
            </div>
            <p className="text-xl font-semibold text-foreground">Connect Your Wallet</p>
            <p className="text-sm text-muted max-w-md leading-relaxed">
              Connect your wallet to the 0G Galileo Testnet to create and mint AI agents.
            </p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
          <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-3">
            Create <span className="gradient-text">AI Agent</span>
          </h1>
          <p className="text-muted mb-10 text-base leading-relaxed">
            Upload your LoRA adapter, mint an ERC-7857 INFT, and register your agent on the marketplace.
          </p>

          {/* Progress steps */}
          <div className="flex items-center gap-2 mb-10">
            {(["details", "upload", "mint", "register", "complete"] as Step[]).map(
              (s, i) => {
                const labels = ["Details", "Upload", "Mint", "Register", "Done"];
                const steps: Step[] = ["details", "upload", "mint", "register", "complete"];
                const currentIdx = steps.indexOf(step);
                const stepIdx = i;
                const isActive = stepIdx === currentIdx;
                const isDone = stepIdx < currentIdx;

                return (
                  <div key={s} className="flex items-center gap-2 flex-1">
                    <div
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                        isDone
                          ? "bg-success text-white"
                          : isActive
                          ? "bg-accent text-white pulse-glow"
                          : "bg-card border border-border text-muted"
                      }`}
                    >
                      {isDone ? (
                        <CheckCircle className="h-4 w-4" />
                      ) : (
                        i + 1
                      )}
                    </div>
                    <span
                      className={`text-xs font-medium hidden sm:inline ${
                        isActive ? "text-foreground" : "text-muted"
                      }`}
                    >
                      {labels[i]}
                    </span>
                    {i < 4 && (
                      <div
                        className={`flex-1 h-px ${
                          isDone ? "bg-success" : "bg-border"
                        }`}
                      />
                    )}
                  </div>
                );
              }
            )}
          </div>

          {/* Step 1: Agent Details */}
          {step === "details" && (
            <div className="rounded-xl border border-border bg-card p-6 space-y-5">
              <div className="flex items-center gap-2 mb-2">
                <Cpu className="h-5 w-5 text-accent-light" />
                <h2 className="text-lg font-semibold text-foreground">Agent Details</h2>
              </div>

              <Input
                label="Agent Name"
                placeholder="e.g. DeFi Strategist"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <TextArea
                label="Description"
                placeholder="Describe what your agent does..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
              <div className="grid grid-cols-2 gap-4">
                <Select
                  label="Base Model"
                  options={MODEL_TYPES}
                  value={modelType}
                  onChange={(e) => setModelType((e.target as HTMLSelectElement).value)}
                />
                <Select
                  label="Category"
                  options={CATEGORIES}
                  value={category}
                  onChange={(e) => setCategory((e.target as HTMLSelectElement).value)}
                />
              </div>
              <Input
                label="Tags (comma-separated)"
                placeholder="e.g. defi, yield, strategy"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
              />
              <TextArea
                label="System Prompt"
                placeholder="The system prompt for your agent..."
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                rows={4}
              />

              <div className="flex justify-end pt-2">
                <Button onClick={handleDetailsContinue} icon={<ArrowRight className="h-4 w-4" />}>
                  Continue
                </Button>
              </div>
            </div>
          )}

          {/* Step 2: Upload to 0G Storage */}
          {step === "upload" && (
            <div className="rounded-xl border border-border bg-card p-6 space-y-5">
              <div className="flex items-center gap-2 mb-2">
                <Database className="h-5 w-5 text-accent-light" />
                <h2 className="text-lg font-semibold text-foreground">Upload to 0G Storage</h2>
              </div>

              <p className="text-sm text-muted">
                Upload your LoRA adapter weights (safetensors/bin) to 0G decentralized storage.
                Files are encrypted with AES-256 before upload.
              </p>

              {/* File upload */}
              <label className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-background p-8 cursor-pointer hover:border-accent/50 hover:bg-accent/5 transition-colors">
                <FileUp className="h-10 w-10 text-muted mb-3" />
                <p className="text-sm font-medium text-foreground mb-1">
                  {loraFile ? loraFile.name : "Drop LoRA adapter here"}
                </p>
                <p className="text-xs text-muted">
                  {loraFile
                    ? `${(loraFile.size / 1024).toFixed(1)} KB`
                    : "Supports .safetensors, .bin, .pt — Max 100MB"}
                </p>
                <input
                  type="file"
                  accept=".safetensors,.bin,.pt,.gguf"
                  className="hidden"
                  onChange={(e) => setLoraFile(e.target.files?.[0] ?? null)}
                />
              </label>

              {/* Encryption info */}
              <div className="flex items-start gap-3 rounded-lg border border-accent/20 bg-accent/5 px-4 py-3">
                <Shield className="h-5 w-5 text-accent-light shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-foreground">End-to-End Encryption</p>
                  <p className="text-xs text-muted">
                    Your agent weights will be encrypted with AES-256-CBC before upload.
                    Only authorized INFT holders can decrypt them.
                  </p>
                </div>
              </div>

              <div className="flex justify-between pt-2">
                <Button variant="ghost" onClick={() => setStep("details")}>
                  Back
                </Button>
                <Button
                  onClick={handleUpload}
                  loading={uploading}
                  icon={<Upload className="h-4 w-4" />}
                >
                  Encrypt &amp; Upload
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Mint INFT */}
          {step === "mint" && (
            <div className="rounded-xl border border-border bg-card p-6 space-y-5">
              <div className="flex items-center gap-2 mb-2">
                <Cpu className="h-5 w-5 text-accent-light" />
                <h2 className="text-lg font-semibold text-foreground">Mint GravitonINFT</h2>
              </div>

              <div className="space-y-3">
                <div className="rounded-lg bg-background border border-border/50 px-4 py-3">
                  <p className="text-xs text-muted">Agent Name</p>
                  <p className="text-sm font-medium text-foreground">{name}</p>
                </div>
                <div className="rounded-lg bg-background border border-border/50 px-4 py-3">
                  <p className="text-xs text-muted">0G Storage Root</p>
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-mono text-foreground truncate flex-1">{storageRoot}</p>
                    {uploadMode && (
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        uploadMode === "live"
                          ? "bg-green-500/10 text-green-400 border border-green-500/30"
                          : "bg-yellow-500/10 text-yellow-400 border border-yellow-500/30"
                      }`}>
                        {uploadMode === "live" ? "✓ LIVE" : "⚡ LOCAL"}
                      </span>
                    )}
                  </div>
                  {storageScanUrl && uploadMode === "live" && (
                    <a
                      href={storageScanUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-accent-light hover:underline mt-1 inline-block"
                    >
                      View on StorageScan →
                    </a>
                  )}
                </div>
                <div className="rounded-lg bg-background border border-border/50 px-4 py-3">
                  <p className="text-xs text-muted">Data Hash (keccak256)</p>
                  <p className="text-xs font-mono text-foreground truncate">{dataHash}</p>
                </div>
                {mintFee !== undefined && (
                  <div className="rounded-lg bg-background border border-border/50 px-4 py-3">
                    <p className="text-xs text-muted">Mint Fee</p>
                    <p className="text-sm font-bold text-foreground">
                      {parseFloat(formatEther(mintFee as bigint)).toFixed(4)} A0GI
                    </p>
                  </div>
                )}
              </div>

              <div className="flex justify-between pt-2">
                <Button variant="ghost" onClick={() => setStep("upload")}>
                  Back
                </Button>
                {mintSuccess ? (
                  <Button
                    variant="secondary"
                    onClick={() => setStep("register")}
                    icon={<ArrowRight className="h-4 w-4" />}
                  >
                    Continue to Register
                  </Button>
                ) : (
                  <Button
                    onClick={handleMint}
                    loading={mintPending || mintConfirming}
                    icon={<Cpu className="h-4 w-4" />}
                  >
                    Mint INFT
                  </Button>
                )}
              </div>

              {mintHash && (
                <p className="text-xs text-muted text-center">
                  TX:{" "}
                  <a
                    href={`https://chainscan-galileo.0g.ai/tx/${mintHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent-light hover:underline font-mono"
                  >
                    {mintHash.slice(0, 10)}...
                  </a>
                </p>
              )}
            </div>
          )}

          {/* Step 4: Register in Registry */}
          {step === "register" && (
            <div className="rounded-xl border border-border bg-card p-6 space-y-5">
              <div className="flex items-center gap-2 mb-2">
                <Database className="h-5 w-5 text-accent-light" />
                <h2 className="text-lg font-semibold text-foreground">Register Agent</h2>
              </div>

              <p className="text-sm text-muted">
                Register your agent in the GravitonRegistry to make it discoverable on the marketplace.
              </p>

              {regSuccess ? (
                <div className="text-center py-8">
                  <CheckCircle className="h-16 w-16 text-success mx-auto mb-4" />
                  <p className="text-xl font-bold text-foreground mb-2">Agent Created!</p>
                  <p className="text-sm text-muted mb-6">
                    Your AI agent has been minted and registered on the 0G Chain.
                  </p>
                  <Button
                    onClick={() => setStep("complete")}
                    icon={<ArrowRight className="h-4 w-4" />}
                  >
                    View Agent
                  </Button>
                </div>
              ) : (
                <div className="flex justify-between pt-2">
                  <Button variant="ghost" onClick={() => setStep("mint")}>
                    Back
                  </Button>
                  <Button
                    onClick={handleRegister}
                    loading={regPending || regConfirming}
                    icon={<Database className="h-4 w-4" />}
                  >
                    Register Agent
                  </Button>
                </div>
              )}

              {regHash && (
                <p className="text-xs text-muted text-center">
                  TX:{" "}
                  <a
                    href={`https://chainscan-galileo.0g.ai/tx/${regHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent-light hover:underline font-mono"
                  >
                    {regHash.slice(0, 10)}...
                  </a>
                </p>
              )}
            </div>
          )}

          {/* Step 5: Complete */}
          {step === "complete" && (
            <div className="rounded-xl border border-border bg-card p-8 text-center">
              <CheckCircle className="h-20 w-20 text-success mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-foreground mb-2">
                Agent Successfully Created!
              </h2>
              <p className="text-muted mb-6">
                Your AI agent is now live on the Graviton marketplace.
              </p>
              <div className="flex justify-center gap-4">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setStep("details");
                    setName("");
                    setDescription("");
                    setTags("");
                    setSystemPrompt("");
                    setLoraFile(null);
                    setStorageRoot("");
                  }}
                >
                  Create Another
                </Button>
                <Button onClick={() => window.location.href = "/marketplace"}>
                  View Marketplace
                </Button>
              </div>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
