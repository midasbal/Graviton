<p align="center">
  <img src="public/favicon.svg" alt="Graviton Logo" width="100" height="100" />
</p>

<h1 align="center">Graviton — Decentralized AI Agent Marketplace</h1>

<p align="center">
  <strong>Mint, trade, rent, and test-drive AI agents as ERC-7857 Intelligent NFTs on 0G Chain.</strong>
</p>

<p align="center">
  <a href="https://chainscan-galileo.0g.ai">
    <img src="https://img.shields.io/badge/0G_Galileo-Testnet-6366f1?style=for-the-badge" alt="0G Galileo" />
  </a>
  <img src="https://img.shields.io/badge/Solidity-0.8.24-363636?style=for-the-badge&logo=solidity" alt="Solidity" />
  <img src="https://img.shields.io/badge/Next.js-16-000000?style=for-the-badge&logo=next.js" alt="Next.js" />
  <img src="https://img.shields.io/badge/Tests-76%20passing-22c55e?style=for-the-badge" alt="Tests" />
  <img src="https://img.shields.io/badge/Track-Agentic%20Economy-f472b6?style=for-the-badge" alt="Track 3" />
</p>

---

> 🚧 **Checkpoint Notice:** This project is currently in active development. This is a submission for the HackQuest Checkpoint phase and the project will be fully completed for the final deadline.

---

## Table of Contents

- [Project Overview](#project-overview)
- [Key Features](#key-features)
- [System Architecture](#system-architecture)
- [0G Module Integration](#0g-module-integration)
- [Smart Contracts](#smart-contracts)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Deployed Contracts (Galileo Testnet)](#deployed-contracts-galileo-testnet)
- [Reviewer Notes](#reviewer-notes)
- [Project Structure](#project-structure)
- [Testing](#testing)
- [Roadmap](#roadmap)
- [License](#license)

---

## Project Overview

**Graviton** is a fully on-chain marketplace for AI agents, built end-to-end on the **0G ecosystem** (Chain, Storage, and Compute). It introduces a new primitive — the **Intelligent NFT (INFT)** — defined by the [ERC-7857](https://eips.ethereum.org/EIPS/eip-7857) standard, which encapsulates AI model weights, metadata, and capabilities within a single transferable token.

The platform enables creators to **mint** AI agents, **list** them for sale or rent, and allows consumers to **test-drive** agents via TEE-sealed inference before purchasing — all without ever exposing the underlying model weights.

**Track:** Agentic Economy (Track 3)

### The Problem

Today's AI marketplace landscape is fragmented and centralized:

- Model creators have no on-chain ownership proof for their work.
- Buyers cannot verify model quality before purchasing.
- Revenue flows are opaque, with platforms extracting disproportionate fees.
- Model weights are exposed on download, eliminating creator leverage.

### The Solution

Graviton solves these problems through a composable on-chain architecture:

| Problem | Graviton Solution |
|---------|-------------------|
| No ownership proof | ERC-7857 INFTs with on-chain provenance |
| No pre-purchase verification | TEE-sealed test-drive (try before you buy) |
| Opaque revenue | Revenue-sharing DAO with transparent on-chain distribution |
| Exposed model weights | Encrypted storage via 0G Storage; decryption only after purchase |
| No quality signal | On-chain ratings, usage analytics, and attestation records |

---

## Key Features

### 🧬 ERC-7857 Intelligent NFTs (INFTs)
- AI agents as transferable tokens with encrypted model weights
- On-chain metadata: name, description, tags, model URI, system prompt
- Built-in data-binding and verified data management

### 🏪 Marketplace (Buy / Rent / Test-Drive)
- Fixed-price sales and time-limited rental agreements
- "Sealed Inference" test-drive — interact with agents without accessing weights
- On-chain star ratings (1–5) and usage analytics

### 🧠 Agent Memory
- Persistent, per-agent key-value memory stored on 0G Chain
- Operators can store and query agent memory entries
- Enables stateful agent behavior across sessions

### 🛡️ TEE Attestation
- Trusted Execution Environment verification for inference responses
- On-chain attestation records with quote hashes and PCR measurements
- Verifiable proof that agent outputs are authentic and untampered

### 🔧 Fine-Tuning Pipeline
- Submit on-chain fine-tuning jobs with dataset URIs and hyperparameters
- Job lifecycle management: Pending → Running → Completed / Failed
- Operators publish tuned model URIs on completion

### 🗳️ Revenue-Sharing DAO
- Stake INFTs to earn governance weight
- Create and vote on governance proposals
- Automatic creator revenue tracking on every sale/rental
- On-chain claim-based reward distribution

### 🎭 Multi-Modal Agents
- Register agents with multiple modality capabilities (Text, Image, Audio, Video, Code)
- Pipeline stage management for complex multi-modal workflows
- Per-modality usage tracking and analytics

### ⚡ Cross-Contract Hooks
- Marketplace automatically updates Registry analytics on buy/rent
- Marketplace automatically accrues DAO creator rewards on transactions
- Zero additional transactions required from users

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        GRAVITON FRONTEND                           │
│              Next.js 16 · React 19 · wagmi · viem                  │
├────────────┬────────────┬──────────┬────────────┬──────────────────┤
│ Marketplace│  Dashboard │  Create  │ Fine-Tune  │   Governance     │
│  /agent/id │  /dashboard│  /create │ /fine-tune │   /governance    │
│ /multi-modal│           │          │            │                  │
└──────┬─────┴─────┬──────┴────┬─────┴──────┬─────┴────────┬─────────┘
       │           │           │            │              │
       ▼           ▼           ▼            ▼              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       API LAYER (Next.js Route Handlers)           │
│  /api/storage  /api/test-drive  /api/memory  /api/fine-tune        │
│  /api/attestation  /api/dao  /api/events  /api/hooks               │
│  /api/multimodal                                                   │
└──────┬──────────────────────┬──────────────────────┬───────────────┘
       │                      │                      │
       ▼                      ▼                      ▼
┌──────────────┐  ┌───────────────────┐  ┌───────────────────────────┐
│  0G Storage  │  │   0G Compute      │  │     0G Chain (Galileo)    │
│              │  │                   │  │                           │
│ • Encrypted  │  │ • Broker SDK      │  │ ┌───────────────────────┐ │
│   model      │  │ • OpenAI-compat   │  │ │   GravitonINFT        │ │
│   weight     │  │   inference       │  │ │   (ERC-7857)          │ │
│   storage    │  │ • TEE-sealed      │  │ ├───────────────────────┤ │
│ • Agent      │  │   test-drive      │  │ │   GravitonMarketplace │ │
│   memory     │  │ • Auth headers    │  │ │   (Buy/Rent/Rate)     │ │
│   backups    │  │ • Micropayments   │  │ ├───────────────────────┤ │
│ • Fine-tune  │  │                   │  │ │   GravitonRegistry    │ │
│   datasets   │  │                   │  │ │   (Metadata/Analytics)│ │
│              │  │                   │  │ ├───────────────────────┤ │
└──────────────┘  └───────────────────┘  │ │   GravitonMemory      │ │
                                         │ │   (Key-Value Store)   │ │
                                         │ ├───────────────────────┤ │
                                         │ │   GravitonAttestation │ │
                                         │ │   (TEE Verification)  │ │
                                         │ ├───────────────────────┤ │
                                         │ │   GravitonFineTuning  │ │
                                         │ │   (Job Management)    │ │
                                         │ ├───────────────────────┤ │
                                         │ │   GravitonDAO         │ │
                                         │ │   (Governance/Revenue)│ │
                                         │ ├───────────────────────┤ │
                                         │ │   GravitonMultiModal  │ │
                                         │ │   (Multi-Modality)    │ │
                                         │ └───────────────────────┘ │
                                         │                           │
                                         │   MockVerifier            │
                                         │   (ERC-7857 Data Verify)  │
                                         └───────────────────────────┘
```

### Data Flow: Agent Lifecycle

```
Creator                         Buyer                         DAO
  │                               │                            │
  ├─ 1. Mint INFT ───────────────►│                            │
  │    (encrypted weights → 0G    │                            │
  │     Storage, metadata → chain)│                            │
  │                               │                            │
  ├─ 2. Register Agent ──────────►│                            │
  │    (system prompt, tags,      │                            │
  │     model URI on-chain)       │                            │
  │                               │                            │
  ├─ 3. List for Sale/Rent ──────►│                            │
  │    (price, rental duration)   │                            │
  │                               │                            │
  │                               ├─ 4. Test-Drive ───────────►│
  │                               │    (TEE-sealed inference,  │
  │                               │     no weight exposure)    │
  │                               │                            │
  │                               ├─ 5. Buy / Rent ──────────►│
  │                               │    (payment on-chain,      │
  │                               │     hooks update analytics │
  │                               │     + accrue DAO rewards)  │
  │                               │                            │
  │◄──────────────────────────────┤                            │
  │  6. Revenue Accrued           │                            │
  │     (claim via DAO)           │                  ┌─────────┤
  │                               │                  │ 7. DAO  │
  │                               │                  │ Propose │
  │                               │                  │ Vote    │
  │                               │                  │ Execute │
  │                               │                  └─────────┤
  │◄──────────────────────────────┼──────────────────┤         │
  │  8. Claim Rewards             │  8. Distribute   │         │
  │                               │     Revenue      │         │
```

---

## 0G Module Integration

Graviton is built to leverage every layer of the 0G stack:

### 🔗 0G Chain

**Role:** Settlement layer, state, and governance.

All nine smart contracts are deployed on the **0G Galileo Testnet** (Chain ID: `16602`). The chain provides:

- **ERC-7857 token standard** for Intelligent NFTs with data-binding
- **Marketplace settlement** — atomic buy/rent transactions with native token payments
- **On-chain analytics** — usage counts, ratings, rental tracking via the Registry
- **Governance** — proposal creation, voting, and execution via the DAO contract
- **Cross-contract hooks** — the Marketplace auto-updates Registry analytics and DAO revenue on every transaction, requiring zero additional user transactions

### 💾 0G Storage

**Role:** Decentralized, encrypted model weight storage and data persistence.

Integration via `@0gfoundation/0g-ts-sdk`:

- **Encrypted model weights** — Agent creators upload encrypted model weights to 0G Storage at mint time. The storage root hash is recorded on-chain as the INFT's model URI. Only token holders can decrypt.
- **Agent memory backups** — The Memory contract's key-value entries can be backed up to 0G Storage for persistence beyond on-chain state.
- **Fine-tuning datasets** — Training data for fine-tuning jobs is stored on 0G Storage with verifiable root hashes.
- **File retrieval** — The storage API provides download and location lookup for any stored file by root hash.

**Key service:** `lib/storageService.ts` — wraps the 0G Storage SDK with `ZgFile`, `Indexer`, and `getFlowContract` for upload/download.

### ⚡ 0G Compute

**Role:** Decentralized AI inference for the test-drive feature.

Integration via `@0glabs/0g-serving-broker`:

- **Broker initialization** — Creates a `ZGComputeNetworkBroker` connected to the user's wallet for authenticated inference requests.
- **Sealed inference** — The test-drive feature routes prompts through 0G Compute providers using OpenAI-compatible API calls, with per-request authentication headers and micropayment settlement.
- **TEE verification** — Every inference response includes a `chatId` that can be verified against the provider's Trusted Execution Environment to prove the output was generated by the claimed model.
- **Provider discovery** — Automatic service metadata resolution (endpoint, model) for available compute providers.

**Key service:** `lib/computeService.ts` — manages sessions, broker lifecycle, and TEE response verification.

---

## Smart Contracts

| # | Contract | Description | Key Functions |
|---|----------|-------------|---------------|
| 1 | **MockVerifier** | ERC-7857 data verifier (testnet) | `verifyData()` |
| 2 | **GravitonINFT** | ERC-7857 Intelligent NFT token | `mint()`, `transferWithData()`, `updateData()` |
| 3 | **GravitonMarketplace** | Buy, rent, rate, and list agents | `listForSale()`, `buyAgent()`, `rentAgent()`, `rateAgent()` |
| 4 | **GravitonRegistry** | Agent metadata and analytics | `registerAgent()`, `recordInference()`, `recordRental()` |
| 5 | **GravitonMemory** | On-chain key-value memory store | `storeMemory()`, `getMemory()`, `getMemoryKeys()` |
| 6 | **GravitonAttestation** | TEE attestation records | `recordAttestation()`, `getAttestations()`, `hasVerifiedAttestation()` |
| 7 | **GravitonFineTuning** | Fine-tuning job management | `submitJob()`, `startJob()`, `completeJob()`, `failJob()` |
| 8 | **GravitonDAO** | Governance and revenue sharing | `stakeINFT()`, `createProposal()`, `vote()`, `executeProposal()`, `claimCreatorRewards()` |
| 9 | **GravitonMultiModal** | Multi-modality management | `createProfile()`, `addModality()`, `addPipelineStage()` |

All contracts use **Solidity 0.8.24**, OpenZeppelin libraries, `evmVersion: cancun`, and `viaIR: true`.

**Cross-Contract Hooks (E4):** The Marketplace contract has an optional hook system. When wired (via `setHooks()`), every `buyAgent()` and `rentAgent()` call automatically:
1. Calls `Registry.recordInference()` / `Registry.recordRental()` to update analytics
2. Calls `DAO.updateCreatorRewards()` to accrue creator revenue

This means users get analytics + revenue tracking for free — zero extra transactions.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 16.2.3 (App Router), React 19, TypeScript 5, Tailwind CSS v4 |
| **Wallet** | wagmi v3, viem v2, @tanstack/react-query |
| **State** | zustand |
| **Smart Contracts** | Solidity 0.8.24, Hardhat 2, OpenZeppelin |
| **0G Storage** | @0gfoundation/0g-ts-sdk v1.2.1 |
| **0G Compute** | @0glabs/0g-serving-broker v0.6.2 |
| **AI Inference** | OpenAI SDK (routed through 0G Compute providers) |
| **Encryption** | crypto-js (AES-256 for model weight encryption) |
| **Icons** | lucide-react |
| **Testing** | Hardhat + Chai + ethers.js (76 tests) |

---

## Getting Started

### Prerequisites

- **Node.js** ≥ 18
- **npm** or **yarn**
- **MetaMask** or any EVM-compatible wallet

### 1. Clone the Repository

```bash
git clone https://github.com/midasbal/Graviton.git
cd Graviton
```

### 2. Install Dependencies

```bash
# Frontend dependencies
npm install

# Smart contract dependencies
cd contracts
npm install
cd ..
```

### 3. Configure Environment

```bash
cp .env.example .env.local
```

Edit `.env.local` with your settings. The deployed testnet contracts are pre-configured:

```env
# 0G Galileo Testnet (pre-deployed)
NEXT_PUBLIC_DEFAULT_CHAIN=testnet
NEXT_PUBLIC_TESTNET_INFT_ADDRESS=0xC7f8298571726b7F79093E6343e16c00a04df5F8
NEXT_PUBLIC_TESTNET_MARKETPLACE_ADDRESS=0x91D1e023A9FAdeC831abE5d52247eC78998d471F
NEXT_PUBLIC_TESTNET_REGISTRY_ADDRESS=0xA6D1c437CBDe470A7C317aA61E9DC6E54c114d60
NEXT_PUBLIC_TESTNET_MEMORY_ADDRESS=0x4c29bD1fC7e9Ac68F629e1BcaE11a7CD16F0a3Ca
NEXT_PUBLIC_TESTNET_ATTESTATION_ADDRESS=0x876bcf409a673Bb5D610163e41FBcB38937f9824
NEXT_PUBLIC_TESTNET_FINETUNING_ADDRESS=0x25e00De35C3d9C6A35B2F430B815EA816571d3A1
NEXT_PUBLIC_TESTNET_DAO_ADDRESS=0xFc24dD77E47974A0747e89fe81D9a13C254238C1
NEXT_PUBLIC_TESTNET_MULTIMODAL_ADDRESS=0x45588B3385dA81eA873467569a9Ad21254CB273F
```

### 4. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 5. Connect Wallet

1. Open MetaMask and add the **0G Galileo Testnet**:
   - **Network Name:** 0G Galileo Testnet
   - **RPC URL:** `https://evmrpc-testnet.0g.ai`
   - **Chain ID:** `16602`
   - **Currency Symbol:** A0GI
   - **Explorer:** `https://chainscan-galileo.0g.ai`
2. Get testnet tokens from the [0G Faucet](https://faucet.0g.ai).
3. Click "Connect Wallet" on the Graviton UI.

### 6. Run Smart Contract Tests

```bash
cd contracts
npx hardhat test
```

Expected output: **76 passing** tests across 10 test suites.

---

## Deployed Contracts (Galileo Testnet)

All contracts are deployed and verified on [0G ChainScan](https://chainscan-galileo.0g.ai).

| Contract | Address | ChainScan |
|----------|---------|-----------|
| **MockVerifier** | `0xDCf38Df3664576878fE9dE80C6FDA0c3e17ceEDc` | [View](https://chainscan-galileo.0g.ai/address/0xDCf38Df3664576878fE9dE80C6FDA0c3e17ceEDc) |
| **GravitonINFT** | `0xC7f8298571726b7F79093E6343e16c00a04df5F8` | [View](https://chainscan-galileo.0g.ai/address/0xC7f8298571726b7F79093E6343e16c00a04df5F8) |
| **GravitonMarketplace** | `0x91D1e023A9FAdeC831abE5d52247eC78998d471F` | [View](https://chainscan-galileo.0g.ai/address/0x91D1e023A9FAdeC831abE5d52247eC78998d471F) |
| **GravitonRegistry** | `0xA6D1c437CBDe470A7C317aA61E9DC6E54c114d60` | [View](https://chainscan-galileo.0g.ai/address/0xA6D1c437CBDe470A7C317aA61E9DC6E54c114d60) |
| **GravitonMemory** | `0x4c29bD1fC7e9Ac68F629e1BcaE11a7CD16F0a3Ca` | [View](https://chainscan-galileo.0g.ai/address/0x4c29bD1fC7e9Ac68F629e1BcaE11a7CD16F0a3Ca) |
| **GravitonAttestation** | `0x876bcf409a673Bb5D610163e41FBcB38937f9824` | [View](https://chainscan-galileo.0g.ai/address/0x876bcf409a673Bb5D610163e41FBcB38937f9824) |
| **GravitonFineTuning** | `0x25e00De35C3d9C6A35B2F430B815EA816571d3A1` | [View](https://chainscan-galileo.0g.ai/address/0x25e00De35C3d9C6A35B2F430B815EA816571d3A1) |
| **GravitonDAO** | `0xFc24dD77E47974A0747e89fe81D9a13C254238C1` | [View](https://chainscan-galileo.0g.ai/address/0xFc24dD77E47974A0747e89fe81D9a13C254238C1) |
| **GravitonMultiModal** | `0x45588B3385dA81eA873467569a9Ad21254CB273F` | [View](https://chainscan-galileo.0g.ai/address/0x45588B3385dA81eA873467569a9Ad21254CB273F) |

**Network:** 0G Galileo Testnet · Chain ID `16602` · RPC `https://evmrpc-testnet.0g.ai`

---

## Reviewer Notes

### Quick Start for Judges

1. **No private key needed** — the frontend is fully read/write via MetaMask.
2. **Get testnet A0GI** — visit the [0G Faucet](https://faucet.0g.ai) and request tokens for the Galileo Testnet.
3. **Contracts are pre-deployed** — all 9 contracts are live and verified on ChainScan (links above). No deployment steps required.
4. **Demo data** — the project includes a seed script (`contracts/scripts/demo.js`) that populates the marketplace with sample agents for review.

### Key Pages to Explore

| Page | URL | What to Test |
|------|-----|-------------|
| **Homepage** | `/` | Overview, CTA buttons, design |
| **Marketplace** | `/marketplace` | Browse agents, search by tags |
| **Create Agent** | `/create` | Mint INFT + register agent metadata |
| **Agent Detail** | `/agent/[id]` | Buy, rent, test-drive, rate, view analytics |
| **Dashboard** | `/dashboard` | View owned agents, stats |
| **Fine-Tune** | `/fine-tune` | Submit fine-tuning jobs |
| **Multi-Modal** | `/multi-modal` | Manage modalities and pipeline stages |
| **Governance** | `/governance` | Stake, propose, vote, claim rewards |

### Running the Demo Seed Script

```bash
cd contracts
npx hardhat run scripts/demo.js --network testnet
```

This creates sample agents on-chain so the marketplace has content for review.

---

## Project Structure

```
graviton/
├── contracts/                    # Smart contracts (Hardhat project)
│   ├── contracts/
│   │   ├── GravitonINFT.sol           # ERC-7857 Intelligent NFT
│   │   ├── GravitonMarketplace.sol    # Buy / Rent / Rate / Hooks
│   │   ├── GravitonRegistry.sol       # Metadata & Analytics
│   │   ├── GravitonMemory.sol         # On-chain Key-Value Store
│   │   ├── GravitonAttestation.sol    # TEE Attestation Records
│   │   ├── GravitonFineTuning.sol     # Fine-Tuning Job Pipeline
│   │   ├── GravitonDAO.sol            # Governance & Revenue Sharing
│   │   ├── GravitonMultiModal.sol     # Multi-Modality Management
│   │   ├── interfaces/               # IERC7857, IERC7857DataVerifier
│   │   └── mocks/MockVerifier.sol     # Testnet data verifier
│   ├── scripts/
│   │   ├── deploy.js                  # Full deployment script
│   │   ├── verify.js                  # ChainScan verification
│   │   ├── postdeploy.js             # Cross-contract wiring
│   │   └── demo.js                    # Demo data seeder
│   └── test/
│       └── Graviton.test.js           # 76 tests across 10 suites
│
├── src/                          # Next.js frontend
│   ├── app/
│   │   ├── page.tsx                   # Landing page
│   │   ├── layout.tsx                 # Root layout + checkpoint banner
│   │   ├── marketplace/page.tsx       # Agent marketplace grid
│   │   ├── create/page.tsx            # Mint & register agents
│   │   ├── dashboard/page.tsx         # Owner dashboard
│   │   ├── agent/[id]/page.tsx        # Agent detail (buy/rent/test-drive)
│   │   ├── fine-tune/page.tsx         # Fine-tuning interface
│   │   ├── multi-modal/page.tsx       # Multi-modal management
│   │   ├── governance/page.tsx        # DAO governance
│   │   └── api/                       # 9 API route handlers
│   │       ├── storage/route.ts       #   0G Storage integration
│   │       ├── test-drive/route.ts    #   0G Compute sealed inference
│   │       ├── memory/route.ts        #   Agent memory operations
│   │       ├── attestation/route.ts   #   TEE attestation
│   │       ├── fine-tune/route.ts     #   Fine-tuning jobs
│   │       ├── dao/route.ts           #   DAO operations
│   │       ├── events/route.ts        #   Event indexing
│   │       ├── hooks/route.ts         #   Cross-contract hook wiring
│   │       └── multimodal/route.ts    #   Multi-modal operations
│   ├── components/
│   │   ├── layout/                    # Header, Footer, ToastContainer
│   │   ├── marketplace/               # AgentGrid, AgentCard
│   │   ├── agent/                     # Agent detail components
│   │   ├── activity/                  # Activity feed
│   │   └── ui/                        # Button, Badge, FormFields,
│   │                                  #   GravitonLogo, Skeleton, StarRating
│   ├── hooks/useContracts.ts          # 30+ wagmi contract hooks
│   ├── config/contracts.ts            # Contract addresses (testnet/mainnet)
│   ├── store/useAppStore.ts           # Zustand global state
│   ├── providers/Web3Provider.tsx     # wagmi + QueryClient provider
│   ├── types/index.ts                 # TypeScript type definitions
│   └── lib/eventIndexer.ts            # On-chain event indexer
│
├── lib/                          # Backend services
│   ├── storageService.ts              # 0G Storage SDK wrapper
│   ├── computeService.ts             # 0G Compute broker + inference
│   ├── memoryService.ts              # Agent memory management
│   ├── attestationService.ts         # TEE attestation service
│   └── fineTuningService.ts          # Fine-tuning job orchestration
│
├── public/                       # Static assets
│   └── favicon.svg                    # Graviton hexagonal prism logo
│
├── package.json                  # Frontend dependencies
├── tsconfig.json                 # TypeScript configuration
├── next.config.ts                # Next.js configuration
└── postcss.config.mjs            # PostCSS configuration
```

---

## Testing

### Test Suites (76 Tests)

```
  GravitonINFT                              ✔ 15 tests
  GravitonMarketplace                       ✔ 14 tests
  GravitonRegistry                          ✔  8 tests
  GravitonMemory                            ✔  8 tests
  GravitonAttestation                       ✔  8 tests
  GravitonFineTuning                        ✔  9 tests
  GravitonDAO                               ✔  7 tests
  GravitonMultiModal                        ✔  9 tests
  Integration: Cross-Contract Flows         ✔  4 tests
  E4: Cross-Contract Hooks                  ✔  7 tests
  ─────────────────────────────────────────────────────
  Total                                        76 passing
```

### Run Tests

```bash
cd contracts
npx hardhat test
```

### What the Tests Cover

- **Token lifecycle:** minting, transfers, data updates, ERC-7857 compliance
- **Marketplace operations:** listing, buying, renting, rating, delisting, price validation
- **Registry:** agent registration, metadata queries, analytics tracking
- **Memory:** store, retrieve, list keys, access control
- **Attestation:** record, query, verification status
- **Fine-tuning:** job submission, state transitions, access control
- **DAO:** staking, proposals, voting, execution, revenue distribution, reward claims
- **Multi-Modal:** profile creation, modality management, pipeline stages, usage tracking
- **Integration:** full cross-contract lifecycle flows
- **Hooks:** automatic analytics and revenue accrual on buy/rent

---

## Roadmap

### Checkpoint Phase (Current) ✅

- [x] 9 smart contracts deployed and verified on Galileo Testnet
- [x] Full marketplace UI with 7 pages
- [x] 0G Storage integration for encrypted model weights
- [x] 0G Compute integration for sealed inference test-drive
- [x] TEE attestation and verification
- [x] Revenue-sharing DAO with governance
- [x] Fine-tuning pipeline
- [x] Multi-modal agent support
- [x] Cross-contract hooks for zero-friction analytics
- [x] 76 passing tests
- [x] Loading skeletons, error states, and transaction hash links

### Final Phase (Upcoming)

- [ ] Production mainnet deployment
- [ ] Enhanced TEE integration with real attestation verification
- [ ] Agent-to-agent composition and orchestration
- [ ] Advanced search and filtering (by modality, rating, price range)
- [ ] Creator analytics dashboard with revenue charts
- [ ] Mobile-responsive optimizations
- [ ] Comprehensive E2E testing with Playwright
- [ ] Performance optimizations and caching layer

---

## License

This project is built for the **0G APAC Hackathon** (HackQuest). All rights reserved.

---

<p align="center">
  Built with 💜 on <strong>0G — The Modular AI Chain</strong>
</p>
