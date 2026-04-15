// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IERC7857DataVerifier
 * @notice Interface for verifying ERC-7857 transfer validity proofs.
 * @dev Mirrors the 0G reference: 0gfoundation/0g-agent-nft
 */

/// @notice Oracle type used to generate the proof
enum OracleType {
    TEE,
    ZKP
}

/// @notice Access proof signed by the receiver (or their delegate)
struct AccessProof {
    bytes32 dataHash;
    bytes targetPubkey;
    bytes nonce;
    bytes proof;
}

/// @notice Ownership proof signed by the TEE/ZKP oracle
struct OwnershipProof {
    OracleType oracleType;
    bytes32 dataHash;
    bytes sealedKey;
    bytes targetPubkey;
    bytes nonce;
    bytes proof;
}

/// @notice Combined proof for a single data slot transfer
struct TransferValidityProof {
    AccessProof accessProof;
    OwnershipProof ownershipProof;
}

/// @notice Output after proof verification
struct TransferValidityProofOutput {
    bytes32 dataHash;
    bytes sealedKey;
    bytes targetPubkey;
    bytes wantedKey;
    address accessAssistant;
    bytes accessProofNonce;
    bytes ownershipProofNonce;
}

interface IERC7857DataVerifier {
    /**
     * @notice Verify data transfer validity proofs.
     * @param proofs Array of transfer validity proofs
     * @return Array of processed proof outputs
     */
    function verifyTransferValidity(
        TransferValidityProof[] calldata proofs
    ) external returns (TransferValidityProofOutput[] memory);
}
