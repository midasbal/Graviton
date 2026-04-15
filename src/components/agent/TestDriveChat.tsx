"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Shield, ShieldCheck, Loader2, X, Brain, Save, Database, CheckCircle2 } from "lucide-react";
import Button from "@/components/ui/Button";
import type { ChatMessage, MemoryContext, AttestationSubmitResult } from "@/types";

interface TestDriveChatProps {
  agentName: string;
  tokenId: string;
  onClose: () => void;
}

export default function TestDriveChat({
  agentName,
  tokenId,
  onClose,
}: TestDriveChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "system",
      content: `Connected to ${agentName} (Token #${tokenId}). This is a sealed inference session powered by 0G Compute Network with TEE verification. Persistent memory is enabled — conversations are stored on 0G Storage and anchored on-chain.`,
      timestamp: Date.now(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId] = useState(() => `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Memory state
  const [memoryContext, setMemoryContext] = useState<MemoryContext | null>(null);
  const [memoryActive, setMemoryActive] = useState(false);
  const [isSavingMemory, setIsSavingMemory] = useState(false);
  const [memorySaved, setMemorySaved] = useState(false);
  const [interactionCount, setInteractionCount] = useState(0);

  // Attestation state
  const [attestationCount, setAttestationCount] = useState(0);
  const [verifiedCount, setVerifiedCount] = useState(0);

  // Initialize session and load memory
  useEffect(() => {
    const initSession = async () => {
      try {
        // Start memory session
        await fetch("/api/memory", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "start",
            agentId: tokenId,
            sessionId,
          }),
        });

        // Load existing memory context
        const memRes = await fetch("/api/memory", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "load",
            agentId: tokenId,
          }),
        });

        const memData: MemoryContext = await memRes.json();
        if (memData.totalInteractions > 0 || memData.summary) {
          setMemoryContext(memData);
          setMemoryActive(true);
          setMessages((prev) => [
            ...prev,
            {
              role: "system",
              content: `🧠 Memory loaded: ${memData.totalInteractions} past interactions, ${memData.memorySnapshots} snapshots on 0G Storage.${memData.summary ? ` Summary: ${memData.summary}` : ""}`,
              timestamp: Date.now(),
            },
          ]);
        } else {
          setMemoryActive(true);
        }
      } catch (err) {
        console.warn("Memory init failed:", err);
        setMemoryActive(true); // Still enable for new memory
      }
    };

    initSession();
  }, [tokenId, sessionId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  // Add entry to memory backend
  const trackEntry = useCallback(async (entry: ChatMessage) => {
    try {
      await fetch("/api/memory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add",
          agentId: tokenId,
          sessionId,
          entry: {
            role: entry.role,
            content: entry.content,
            timestamp: entry.timestamp,
            verified: entry.verified,
          },
        }),
      });
    } catch {
      // Non-blocking
    }
  }, [tokenId, sessionId]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      role: "user",
      content: input.trim(),
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);
    setInteractionCount((c) => c + 1);

    // Track in memory
    trackEntry(userMessage);

    try {
      // Call the test-drive API route
      const res = await fetch("/api/test-drive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tokenId,
          message: userMessage.content,
          history: messages
            .filter((m) => m.role !== "system")
            .map((m) => ({ role: m.role, content: m.content })),
          memoryContext: memoryContext?.summary || "",
        }),
      });

      const data = await res.json();

      const assistantMessage: ChatMessage = {
        role: "assistant",
        content: data.response || "No response received.",
        timestamp: Date.now(),
        verified: data.verified ?? false,
      };

      setMessages((prev) => [...prev, assistantMessage]);
      trackEntry(assistantMessage);

      // Submit TEE attestation
      try {
        const attRes = await fetch("/api/attestation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "submit",
            tokenId,
            provider: data.provider || "0G-Compute-TEE-Demo",
            requester: "0x0000000000000000000000000000000000000000",
            requestContent: userMessage.content,
            responseContent: data.response,
            chatId: data.chatId || `chat-${Date.now()}`,
            model: data.model || "graviton-demo-agent",
            verified: data.verified ?? true,
            inputTokens: userMessage.content.length,
            outputTokens: (data.response || "").length,
          }),
        });
        const attData: AttestationSubmitResult = await attRes.json();
        setAttestationCount((c) => c + 1);
        if (attData.verified) setVerifiedCount((c) => c + 1);
      } catch {
        // Attestation is non-blocking
      }
    } catch {
      const errorMsg: ChatMessage = {
        role: "assistant",
        content:
          "Connection error. The 0G Compute Network may be unavailable. Please try again.",
        timestamp: Date.now(),
        verified: false,
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  // Save memory to 0G Storage
  const handleSaveMemory = async () => {
    if (interactionCount === 0) return;
    setIsSavingMemory(true);

    try {
      const res = await fetch("/api/memory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "commit",
          agentId: tokenId,
          sessionId,
          snapshotType: "conversation",
        }),
      });

      const data = await res.json();

      if (data.status === "committed") {
        setMemorySaved(true);
        setMessages((prev) => [
          ...prev,
          {
            role: "system",
            content: `🧠 Memory saved to 0G Storage! ${data.totalEntries} entries committed. Storage root: ${data.storageRoot.slice(0, 18)}... | On-chain TX: ${data.txHash.slice(0, 18)}...`,
            timestamp: Date.now(),
          },
        ]);

        // Reset after 3 seconds
        setTimeout(() => setMemorySaved(false), 3000);
      }
    } catch (err) {
      console.error("Memory save failed:", err);
    } finally {
      setIsSavingMemory(false);
    }
  };

  return (
    <div className="flex flex-col rounded-2xl border border-border/60 bg-card/40 overflow-hidden h-[500px]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/40 px-5 py-3.5">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-success animate-pulse" />
          <span className="text-sm font-semibold text-foreground">
            Test Drive — {agentName}
          </span>
          <span className="flex items-center gap-1 rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 text-[10px] font-medium text-accent-light">
            <Shield className="h-3 w-3" />
            TEE Sealed
          </span>
          {/* Memory indicator */}
          {memoryActive && (
            <span className="flex items-center gap-1 rounded-full border border-purple-500/30 bg-purple-500/10 px-2 py-0.5 text-[10px] font-medium text-purple-400">
              <Brain className="h-3 w-3" />
              Memory
              {interactionCount > 0 && (
                <span className="ml-0.5 text-purple-300">({interactionCount})</span>
              )}
            </span>
          )}
          {/* Attestation indicator */}
          {attestationCount > 0 && (
            <span className="flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
              <CheckCircle2 className="h-3 w-3" />
              {verifiedCount}/{attestationCount} Attested
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {/* Save Memory Button */}
          {memoryActive && interactionCount > 0 && (
            <button
              onClick={handleSaveMemory}
              disabled={isSavingMemory}
              className={`flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-medium transition-colors ${
                memorySaved
                  ? "bg-success/20 text-success border border-success/30"
                  : "bg-purple-500/10 text-purple-400 border border-purple-500/30 hover:bg-purple-500/20"
              }`}
              title="Save conversation memory to 0G Storage"
            >
              {isSavingMemory ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : memorySaved ? (
                <Database className="h-3 w-3" />
              ) : (
                <Save className="h-3 w-3" />
              )}
              {memorySaved ? "Saved" : "Save Memory"}
            </button>
          )}
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-muted hover:text-foreground hover:bg-background transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] rounded-xl px-4 py-2.5 text-sm ${
                msg.role === "user"
                  ? "bg-accent text-white rounded-br-sm"
                  : msg.role === "system"
                  ? "bg-accent/10 text-accent-light border border-accent/20 rounded-bl-sm"
                  : "bg-background border border-border text-foreground rounded-bl-sm"
              }`}
            >
              <p className="whitespace-pre-wrap">{msg.content}</p>
              {msg.role === "assistant" && (
                <div className="mt-2 flex items-center gap-1 text-[10px] text-muted">
                  {msg.verified ? (
                    <>
                      <ShieldCheck className="h-3 w-3 text-success" />
                      <span className="text-success">TEE Verified</span>
                    </>
                  ) : (
                    <>
                      <Shield className="h-3 w-3" />
                      <span>Unverified</span>
                    </>
                  )}
                  <span className="ml-2">
                    {new Date(msg.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 rounded-xl bg-background border border-border px-4 py-3 text-sm text-muted">
              <Loader2 className="h-4 w-4 animate-spin" />
              Generating response...
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-border/40 p-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Send a message..."
            className="flex-1 rounded-xl border border-border/60 bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted/60 focus:border-accent/50 focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all duration-200"
            disabled={isLoading}
          />
          <Button
            type="submit"
            size="md"
            disabled={!input.trim() || isLoading}
            icon={<Send className="h-4 w-4" />}
          >
            Send
          </Button>
        </form>
      </div>
    </div>
  );
}
