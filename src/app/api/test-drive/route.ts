import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/test-drive
 *
 * Proxies chat messages to the 0G Compute Network for sealed inference.
 * In production, this would use the computeService with a real provider.
 * For the hackathon MVP, it returns a simulated response demonstrating the flow.
 */
export async function POST(req: NextRequest) {
  try {
    const { tokenId, message, history } = await req.json();

    if (!message || !tokenId) {
      return NextResponse.json(
        { error: "Missing tokenId or message" },
        { status: 400 }
      );
    }

    // In production: use computeService.runInference() with a real 0G Compute provider.
    // The sealed inference flow:
    //   1. Select a compute provider from the 0G network
    //   2. Send the request through TEE-protected channels
    //   3. Receive response + TEE attestation proof
    //   4. Verify the proof via broker.inference.processResponse()
    //
    // For the MVP demo, we simulate this flow:

    const simulatedResponse = generateDemoResponse(message, tokenId);

    return NextResponse.json({
      response: simulatedResponse,
      verified: true,
      provider: "0G-Compute-TEE-Demo",
      model: "graviton-demo-agent",
      tokenId,
    });
  } catch (error: any) {
    console.error("[test-drive] Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

function generateDemoResponse(message: string, tokenId: string): string {
  const lower = message.toLowerCase();

  if (lower.includes("hello") || lower.includes("hi")) {
    return `Hello! I'm Graviton Agent #${tokenId}, running on the 0G Compute Network with TEE verification. How can I help you today?`;
  }

  if (lower.includes("0g") || lower.includes("zero gravity")) {
    return `0G (Zero Gravity) is a modular AI chain that provides decentralized storage, compute, and data availability infrastructure. The Graviton marketplace uses:\n\n• **0G Storage** — Encrypted LoRA adapter weights stored on-chain with Merkle proofs\n• **0G Compute** — TEE-sealed inference for privacy-preserving AI execution\n• **ERC-7857 INFT** — Intelligent NFTs that wrap AI agent weights with verifiable ownership`;
  }

  if (lower.includes("blockchain") || lower.includes("web3")) {
    return `Blockchain technology enables decentralized, trustless computation. In the context of AI agents like me:\n\n1. **Ownership** is enforced via ERC-7857 INFTs on 0G Chain\n2. **Privacy** is maintained through AES-256 encryption + TEE sealed inference\n3. **Marketplace** enables buying, selling, and renting AI agents with on-chain escrow\n4. **Verification** ensures inference results haven't been tampered with`;
  }

  if (lower.includes("graviton") || lower.includes("marketplace")) {
    return `Graviton is a decentralized AI agent marketplace built on the 0G ecosystem. Key features:\n\n• **Mint** AI agents as ERC-7857 INFTs with encrypted LoRA weights\n• **Trade** agents on the marketplace with royalty support\n• **Rent** agents for temporary inference access\n• **Test-Drive** agents in TEE-sealed sessions before purchasing\n• **Rate & Review** agents with on-chain ratings`;
  }

  return `That's an interesting question about "${message.slice(0, 50)}...". As a Graviton demo agent, I'm showcasing the 0G Compute Network's sealed inference capabilities. In production, this response would come from the actual LoRA-adapted model running inside a Trusted Execution Environment (TEE), with cryptographic proof of correct execution.`;
}
