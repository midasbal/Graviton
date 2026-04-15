"use client";

import { useReadContract, useReadContracts, useWriteContract, useWaitForTransactionReceipt, useChainId } from "wagmi";
import { parseEther, formatEther } from "viem";
import { CONTRACTS, getContractsForChain } from "@/config/contracts";
import { INFT_ABI, MARKETPLACE_ABI, REGISTRY_ABI, MEMORY_ABI, ATTESTATION_ABI, FINE_TUNING_ABI, DAO_ABI, MULTIMODAL_ABI } from "@/config/abis";
import type { AgentMeta, Listing, RentalTerms, UsageStats } from "@/types";

// ============================================================
//               CHAIN-AWARE CONTRACT RESOLVER
// ============================================================

/** Returns the correct contract addresses for the currently connected chain */
export function useChainContracts() {
  const chainId = useChainId();
  return getContractsForChain(chainId);
}

// ============================================================
//                   REGISTRY READ HOOKS
// ============================================================

export function useTotalRegistered() {
  return useReadContract({
    address: CONTRACTS.REGISTRY,
    abi: REGISTRY_ABI,
    functionName: "totalRegistered",
  });
}

export function useAgentMeta(tokenId: bigint | undefined) {
  return useReadContract({
    address: CONTRACTS.REGISTRY,
    abi: REGISTRY_ABI,
    functionName: "getAgentMeta",
    args: tokenId !== undefined ? [tokenId] : undefined,
    query: { enabled: tokenId !== undefined },
  });
}

export function useIsRegistered(tokenId: bigint | undefined) {
  return useReadContract({
    address: CONTRACTS.REGISTRY,
    abi: REGISTRY_ABI,
    functionName: "isRegistered",
    args: tokenId !== undefined ? [tokenId] : undefined,
    query: { enabled: tokenId !== undefined },
  });
}

export function useAverageRating(tokenId: bigint | undefined) {
  return useReadContract({
    address: CONTRACTS.REGISTRY,
    abi: REGISTRY_ABI,
    functionName: "getAverageRating",
    args: tokenId !== undefined ? [tokenId] : undefined,
    query: { enabled: tokenId !== undefined },
  });
}

export function useRatings(tokenId: bigint | undefined) {
  return useReadContract({
    address: CONTRACTS.REGISTRY,
    abi: REGISTRY_ABI,
    functionName: "ratings",
    args: tokenId !== undefined ? [tokenId] : undefined,
    query: { enabled: tokenId !== undefined },
  });
}

export function useUsageStats(tokenId: bigint | undefined) {
  return useReadContract({
    address: CONTRACTS.REGISTRY,
    abi: REGISTRY_ABI,
    functionName: "getUsageStats",
    args: tokenId !== undefined ? [tokenId] : undefined,
    query: { enabled: tokenId !== undefined },
  });
}

export function useAgentsByCategory(category: string) {
  return useReadContract({
    address: CONTRACTS.REGISTRY,
    abi: REGISTRY_ABI,
    functionName: "getAgentsByCategory",
    args: [category],
    query: { enabled: category.length > 0 && category !== "all" },
  });
}

export function useAgentsByCreator(creator: `0x${string}` | undefined) {
  return useReadContract({
    address: CONTRACTS.REGISTRY,
    abi: REGISTRY_ABI,
    functionName: "getAgentsByCreator",
    args: creator ? [creator] : undefined,
    query: { enabled: !!creator },
  });
}

// ============================================================
//                     INFT READ HOOKS
// ============================================================

export function useTotalSupply() {
  return useReadContract({
    address: CONTRACTS.INFT,
    abi: INFT_ABI,
    functionName: "totalSupply",
  });
}

export function useMintFee() {
  return useReadContract({
    address: CONTRACTS.INFT,
    abi: INFT_ABI,
    functionName: "mintFee",
  });
}

export function useOwnerOf(tokenId: bigint | undefined) {
  return useReadContract({
    address: CONTRACTS.INFT,
    abi: INFT_ABI,
    functionName: "ownerOf",
    args: tokenId !== undefined ? [tokenId] : undefined,
    query: { enabled: tokenId !== undefined },
  });
}

export function useBalanceOf(address: `0x${string}` | undefined) {
  return useReadContract({
    address: CONTRACTS.INFT,
    abi: INFT_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });
}

export function useTokenOfOwnerByIndex(
  owner: `0x${string}` | undefined,
  index: bigint
) {
  return useReadContract({
    address: CONTRACTS.INFT,
    abi: INFT_ABI,
    functionName: "tokenOfOwnerByIndex",
    args: owner ? [owner, index] : undefined,
    query: { enabled: !!owner },
  });
}

export function useCreatorOf(tokenId: bigint | undefined) {
  return useReadContract({
    address: CONTRACTS.INFT,
    abi: INFT_ABI,
    functionName: "creatorOf",
    args: tokenId !== undefined ? [tokenId] : undefined,
    query: { enabled: tokenId !== undefined },
  });
}

export function useCategoryOf(tokenId: bigint | undefined) {
  return useReadContract({
    address: CONTRACTS.INFT,
    abi: INFT_ABI,
    functionName: "categoryOf",
    args: tokenId !== undefined ? [tokenId] : undefined,
    query: { enabled: tokenId !== undefined },
  });
}

export function useStorageRootOf(tokenId: bigint | undefined) {
  return useReadContract({
    address: CONTRACTS.INFT,
    abi: INFT_ABI,
    functionName: "storageRootOf",
    args: tokenId !== undefined ? [tokenId] : undefined,
    query: { enabled: tokenId !== undefined },
  });
}

// ============================================================
//                  MARKETPLACE READ HOOKS
// ============================================================

export function useListing(tokenId: bigint | undefined) {
  return useReadContract({
    address: CONTRACTS.MARKETPLACE,
    abi: MARKETPLACE_ABI,
    functionName: "getListing",
    args: tokenId !== undefined ? [tokenId] : undefined,
    query: { enabled: tokenId !== undefined },
  });
}

export function useRental(tokenId: bigint | undefined) {
  return useReadContract({
    address: CONTRACTS.MARKETPLACE,
    abi: MARKETPLACE_ABI,
    functionName: "getRental",
    args: tokenId !== undefined ? [tokenId] : undefined,
    query: { enabled: tokenId !== undefined },
  });
}

export function useMarketplaceStats() {
  return useReadContracts({
    contracts: [
      {
        address: CONTRACTS.MARKETPLACE,
        abi: MARKETPLACE_ABI,
        functionName: "totalSales",
      },
      {
        address: CONTRACTS.MARKETPLACE,
        abi: MARKETPLACE_ABI,
        functionName: "totalVolume",
      },
      {
        address: CONTRACTS.MARKETPLACE,
        abi: MARKETPLACE_ABI,
        functionName: "platformFeeBps",
      },
    ],
  });
}

// ============================================================
//              CROSS-CONTRACT HOOKS (E4)
// ============================================================

/** Read which Registry and DAO the Marketplace is wired to */
export function useMarketplaceHooks() {
  return useReadContracts({
    contracts: [
      {
        address: CONTRACTS.MARKETPLACE,
        abi: MARKETPLACE_ABI,
        functionName: "registry",
      },
      {
        address: CONTRACTS.MARKETPLACE,
        abi: MARKETPLACE_ABI,
        functionName: "dao",
      },
    ],
  });
}

/** Admin-only: wire Marketplace → Registry + DAO */
export function useSetHooks() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const setHooks = (registryAddr: `0x${string}`, daoAddr: `0x${string}`) => {
    writeContract({
      address: CONTRACTS.MARKETPLACE,
      abi: MARKETPLACE_ABI,
      functionName: "setHooks",
      args: [registryAddr, daoAddr],
    });
  };

  return { setHooks, hash, isPending, isConfirming, isSuccess, error };
}

// ============================================================
//                      WRITE HOOKS
// ============================================================

export function useMintAgent() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const mint = (
    to: `0x${string}`,
    intelligentData: { dataDescription: string; dataHash: `0x${string}` }[],
    category: string,
    storageRoot: string,
    uri: string,
    fee: bigint
  ) => {
    writeContract({
      address: CONTRACTS.INFT,
      abi: INFT_ABI,
      functionName: "mint",
      args: [to, intelligentData, category, storageRoot, uri],
      value: fee,
    });
  };

  return { mint, hash, isPending, isConfirming, isSuccess, error };
}

export function useListAgent() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const list = (tokenId: bigint, priceInEth: string) => {
    writeContract({
      address: CONTRACTS.MARKETPLACE,
      abi: MARKETPLACE_ABI,
      functionName: "listAgent",
      args: [tokenId, parseEther(priceInEth)],
    });
  };

  return { list, hash, isPending, isConfirming, isSuccess, error };
}

export function useBuyAgent() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const buy = (tokenId: bigint, price: bigint) => {
    writeContract({
      address: CONTRACTS.MARKETPLACE,
      abi: MARKETPLACE_ABI,
      functionName: "buyAgent",
      args: [tokenId],
      value: price,
    });
  };

  return { buy, hash, isPending, isConfirming, isSuccess, error };
}

export function useRentAgent() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const rent = (tokenId: bigint, days: bigint, totalPrice: bigint) => {
    writeContract({
      address: CONTRACTS.MARKETPLACE,
      abi: MARKETPLACE_ABI,
      functionName: "rentAgent",
      args: [tokenId, days],
      value: totalPrice,
    });
  };

  return { rent, hash, isPending, isConfirming, isSuccess, error };
}

export function useRateAgent() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const rate = (tokenId: bigint, score: number) => {
    writeContract({
      address: CONTRACTS.REGISTRY,
      abi: REGISTRY_ABI,
      functionName: "rateAgent",
      args: [tokenId, score],
    });
  };

  return { rate, hash, isPending, isConfirming, isSuccess, error };
}

export function useRegisterAgent() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const register = (
    tokenId: bigint,
    name: string,
    description: string,
    modelType: string,
    tags: string[],
    storageHash: string,
    metadataURI: string
  ) => {
    writeContract({
      address: CONTRACTS.REGISTRY,
      abi: REGISTRY_ABI,
      functionName: "registerAgent",
      args: [tokenId, name, description, modelType, tags, storageHash, metadataURI],
    });
  };

  return { register, hash, isPending, isConfirming, isSuccess, error };
}

export function useApproveINFT() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const approve = (tokenId: bigint, spender: `0x${string}`) => {
    writeContract({
      address: CONTRACTS.INFT,
      abi: INFT_ABI,
      functionName: "approve",
      args: [spender, tokenId],
    });
  };

  return { approve, hash, isPending, isConfirming, isSuccess, error };
}

// ============================================================
//                   MEMORY READ HOOKS
// ============================================================

export function useMemoryState(tokenId: bigint | undefined) {
  return useReadContract({
    address: CONTRACTS.MEMORY,
    abi: MEMORY_ABI,
    functionName: "getMemoryState",
    args: tokenId !== undefined ? [tokenId] : undefined,
    query: { enabled: tokenId !== undefined },
  });
}

export function useIsMemoryActive(tokenId: bigint | undefined) {
  return useReadContract({
    address: CONTRACTS.MEMORY,
    abi: MEMORY_ABI,
    functionName: "isMemoryActive",
    args: tokenId !== undefined ? [tokenId] : undefined,
    query: { enabled: tokenId !== undefined },
  });
}

export function useLatestSnapshot(tokenId: bigint | undefined) {
  return useReadContract({
    address: CONTRACTS.MEMORY,
    abi: MEMORY_ABI,
    functionName: "getLatestSnapshot",
    args: tokenId !== undefined ? [tokenId] : undefined,
    query: { enabled: tokenId !== undefined },
  });
}

export function useTotalInteractions(tokenId: bigint | undefined) {
  return useReadContract({
    address: CONTRACTS.MEMORY,
    abi: MEMORY_ABI,
    functionName: "getTotalInteractions",
    args: tokenId !== undefined ? [tokenId] : undefined,
    query: { enabled: tokenId !== undefined },
  });
}

// ============================================================
//                 ATTESTATION READ HOOKS
// ============================================================

export function useAgentAttestationStats(tokenId: bigint | undefined) {
  return useReadContract({
    address: CONTRACTS.ATTESTATION,
    abi: ATTESTATION_ABI,
    functionName: "getAgentStats",
    args: tokenId !== undefined ? [tokenId] : undefined,
    query: { enabled: tokenId !== undefined },
  });
}

export function useVerificationRate(tokenId: bigint | undefined) {
  return useReadContract({
    address: CONTRACTS.ATTESTATION,
    abi: ATTESTATION_ABI,
    functionName: "getVerificationRate",
    args: tokenId !== undefined ? [tokenId] : undefined,
    query: { enabled: tokenId !== undefined },
  });
}

export function useHasVerifiedAttestations(tokenId: bigint | undefined) {
  return useReadContract({
    address: CONTRACTS.ATTESTATION,
    abi: ATTESTATION_ABI,
    functionName: "hasVerifiedAttestations",
    args: tokenId !== undefined ? [tokenId] : undefined,
    query: { enabled: tokenId !== undefined },
  });
}

export function useProviderReputation(provider: `0x${string}` | undefined) {
  return useReadContract({
    address: CONTRACTS.ATTESTATION,
    abi: ATTESTATION_ABI,
    functionName: "getProviderReputation",
    args: provider ? [provider] : undefined,
    query: { enabled: !!provider },
  });
}

// ============================================================
//                 FINE-TUNING READ HOOKS
// ============================================================

export function useFineTuningStats(tokenId: bigint | undefined) {
  return useReadContract({
    address: CONTRACTS.FINE_TUNING,
    abi: FINE_TUNING_ABI,
    functionName: "getAgentStats",
    args: tokenId !== undefined ? [tokenId] : undefined,
    query: { enabled: tokenId !== undefined },
  });
}

export function useCurrentVersion(tokenId: bigint | undefined) {
  return useReadContract({
    address: CONTRACTS.FINE_TUNING,
    abi: FINE_TUNING_ABI,
    functionName: "getCurrentVersion",
    args: tokenId !== undefined ? [tokenId] : undefined,
    query: { enabled: tokenId !== undefined },
  });
}

export function useTotalCompletedFineTuning() {
  return useReadContract({
    address: CONTRACTS.FINE_TUNING,
    abi: FINE_TUNING_ABI,
    functionName: "totalCompletedJobs",
  });
}

export function useNextFineTuningJobId() {
  return useReadContract({
    address: CONTRACTS.FINE_TUNING,
    abi: FINE_TUNING_ABI,
    functionName: "nextJobId",
  });
}

// ============================================================
//                    DAO READ HOOKS
// ============================================================

export function usePoolBalances() {
  return useReadContract({
    address: CONTRACTS.DAO,
    abi: DAO_ABI,
    functionName: "getPoolBalances",
  });
}

export function useDAOStats() {
  return useReadContract({
    address: CONTRACTS.DAO,
    abi: DAO_ABI,
    functionName: "getDAOStats",
  });
}

export function useTotalStaked() {
  return useReadContract({
    address: CONTRACTS.DAO,
    abi: DAO_ABI,
    functionName: "totalStaked",
  });
}

export function useStakerTokenCount(address: `0x${string}` | undefined) {
  return useReadContract({
    address: CONTRACTS.DAO,
    abi: DAO_ABI,
    functionName: "stakerTokenCount",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });
}

export function useStakeInfo(tokenId: bigint | undefined) {
  return useReadContract({
    address: CONTRACTS.DAO,
    abi: DAO_ABI,
    functionName: "getStakeInfo",
    args: tokenId !== undefined ? [tokenId] : undefined,
    query: { enabled: tokenId !== undefined },
  });
}

export function usePendingStakerReward(tokenId: bigint | undefined) {
  return useReadContract({
    address: CONTRACTS.DAO,
    abi: DAO_ABI,
    functionName: "pendingStakerReward",
    args: tokenId !== undefined ? [tokenId] : undefined,
    query: { enabled: tokenId !== undefined },
  });
}

export function useDAOProposal(proposalId: bigint | undefined) {
  return useReadContract({
    address: CONTRACTS.DAO,
    abi: DAO_ABI,
    functionName: "getProposal",
    args: proposalId !== undefined ? [proposalId] : undefined,
    query: { enabled: proposalId !== undefined },
  });
}

export function useCreatorRewards(creator: `0x${string}` | undefined) {
  return useReadContract({
    address: CONTRACTS.DAO,
    abi: DAO_ABI,
    functionName: "getCreatorRewards",
    args: creator ? [creator] : undefined,
    query: { enabled: !!creator },
  });
}

export function useNextProposalId() {
  return useReadContract({
    address: CONTRACTS.DAO,
    abi: DAO_ABI,
    functionName: "nextProposalId",
  });
}

export function useHasVoted(proposalId: bigint | undefined, voter: `0x${string}` | undefined) {
  return useReadContract({
    address: CONTRACTS.DAO,
    abi: DAO_ABI,
    functionName: "hasVoted",
    args: proposalId !== undefined && voter ? [proposalId, voter] : undefined,
    query: { enabled: proposalId !== undefined && !!voter },
  });
}

// ============================================================
//                    DAO WRITE HOOKS
// ============================================================

export function useStakeINFT() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const stakeToken = (tokenId: bigint) => {
    writeContract({
      address: CONTRACTS.DAO,
      abi: DAO_ABI,
      functionName: "stake",
      args: [tokenId],
    });
  };

  return { stakeToken, hash, isPending, isConfirming, isSuccess, error };
}

export function useUnstakeINFT() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const unstakeToken = (tokenId: bigint) => {
    writeContract({
      address: CONTRACTS.DAO,
      abi: DAO_ABI,
      functionName: "unstake",
      args: [tokenId],
    });
  };

  return { unstakeToken, hash, isPending, isConfirming, isSuccess, error };
}

export function useClaimStakerRewards() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const claimRewards = (tokenId: bigint) => {
    writeContract({
      address: CONTRACTS.DAO,
      abi: DAO_ABI,
      functionName: "claimStakerRewards",
      args: [tokenId],
    });
  };

  return { claimRewards, hash, isPending, isConfirming, isSuccess, error };
}

export function useClaimCreatorRewards() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const claim = () => {
    writeContract({
      address: CONTRACTS.DAO,
      abi: DAO_ABI,
      functionName: "claimCreatorRewards",
    });
  };

  return { claim, hash, isPending, isConfirming, isSuccess, error };
}

export function useCreateProposal() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const propose = (
    title: string,
    description: string,
    recipient: `0x${string}`,
    amount: bigint
  ) => {
    writeContract({
      address: CONTRACTS.DAO,
      abi: DAO_ABI,
      functionName: "createProposal",
      args: [title, description, recipient, amount],
    });
  };

  return { propose, hash, isPending, isConfirming, isSuccess, error };
}

export function useVoteOnProposal() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const castVote = (proposalId: bigint, support: boolean) => {
    writeContract({
      address: CONTRACTS.DAO,
      abi: DAO_ABI,
      functionName: "vote",
      args: [proposalId, support],
    });
  };

  return { castVote, hash, isPending, isConfirming, isSuccess, error };
}

export function useExecuteProposal() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const execute = (proposalId: bigint) => {
    writeContract({
      address: CONTRACTS.DAO,
      abi: DAO_ABI,
      functionName: "executeProposal",
      args: [proposalId],
    });
  };

  return { execute, hash, isPending, isConfirming, isSuccess, error };
}

export function useDistributeRevenue() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const distribute = (amountInEth: string) => {
    writeContract({
      address: CONTRACTS.DAO,
      abi: DAO_ABI,
      functionName: "distributeRevenue",
      value: parseEther(amountInEth),
    });
  };

  return { distribute, hash, isPending, isConfirming, isSuccess, error };
}

// ============================================================
//                 MULTI-MODAL READ HOOKS
// ============================================================

export function useModalProfile(tokenId: bigint | undefined) {
  return useReadContract({
    address: CONTRACTS.MULTIMODAL,
    abi: MULTIMODAL_ABI,
    functionName: "getProfile",
    args: tokenId !== undefined ? [tokenId] : undefined,
    query: { enabled: tokenId !== undefined },
  });
}

export function useHasModalProfile(tokenId: bigint | undefined) {
  return useReadContract({
    address: CONTRACTS.MULTIMODAL,
    abi: MULTIMODAL_ABI,
    functionName: "hasProfile",
    args: tokenId !== undefined ? [tokenId] : undefined,
    query: { enabled: tokenId !== undefined },
  });
}

export function useSupportedModalities(tokenId: bigint | undefined) {
  return useReadContract({
    address: CONTRACTS.MULTIMODAL,
    abi: MULTIMODAL_ABI,
    functionName: "getSupportedModalities",
    args: tokenId !== undefined ? [tokenId] : undefined,
    query: { enabled: tokenId !== undefined },
  });
}

export function useModalityUsageStats(tokenId: bigint | undefined) {
  return useReadContract({
    address: CONTRACTS.MULTIMODAL,
    abi: MULTIMODAL_ABI,
    functionName: "getModalityUsageStats",
    args: tokenId !== undefined ? [tokenId] : undefined,
    query: { enabled: tokenId !== undefined },
  });
}

export function useModalityConfig(tokenId: bigint | undefined, modality: number | undefined) {
  return useReadContract({
    address: CONTRACTS.MULTIMODAL,
    abi: MULTIMODAL_ABI,
    functionName: "getModalityConfig",
    args: tokenId !== undefined && modality !== undefined ? [tokenId, modality] : undefined,
    query: { enabled: tokenId !== undefined && modality !== undefined },
  });
}

export function useTotalMultiModalAgents() {
  return useReadContract({
    address: CONTRACTS.MULTIMODAL,
    abi: MULTIMODAL_ABI,
    functionName: "totalMultiModalAgents",
  });
}

export function useAgentsByModality(modality: number | undefined) {
  return useReadContract({
    address: CONTRACTS.MULTIMODAL,
    abi: MULTIMODAL_ABI,
    functionName: "getAgentsByModality",
    args: modality !== undefined ? [modality] : undefined,
    query: { enabled: modality !== undefined },
  });
}

// ============================================================
//                MULTI-MODAL WRITE HOOKS
// ============================================================

export function useCreateModalProfile() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const create = (tokenId: bigint) => {
    writeContract({
      address: CONTRACTS.MULTIMODAL,
      abi: MULTIMODAL_ABI,
      functionName: "createProfile",
      args: [tokenId],
    });
  };

  return { create, hash, isPending, isConfirming, isSuccess, error };
}

export function useAddModality() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const addModality = (
    tokenId: bigint,
    modality: number,
    capabilities: string[],
    modelReference: string,
    storageRoot: string,
    weightsHash: `0x${string}`
  ) => {
    writeContract({
      address: CONTRACTS.MULTIMODAL,
      abi: MULTIMODAL_ABI,
      functionName: "addModality",
      args: [tokenId, modality, capabilities, modelReference, storageRoot, weightsHash],
    });
  };

  return { addModality, hash, isPending, isConfirming, isSuccess, error };
}

export function useRemoveModality() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const remove = (tokenId: bigint, modality: number) => {
    writeContract({
      address: CONTRACTS.MULTIMODAL,
      abi: MULTIMODAL_ABI,
      functionName: "removeModality",
      args: [tokenId, modality],
    });
  };

  return { remove, hash, isPending, isConfirming, isSuccess, error };
}

export function useAddPipelineStage() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const addStage = (
    tokenId: bigint,
    inputModality: number,
    outputModality: number,
    processorName: string
  ) => {
    writeContract({
      address: CONTRACTS.MULTIMODAL,
      abi: MULTIMODAL_ABI,
      functionName: "addPipelineStage",
      args: [tokenId, inputModality, outputModality, processorName],
    });
  };

  return { addStage, hash, isPending, isConfirming, isSuccess, error };
}

export { parseEther, formatEther };
