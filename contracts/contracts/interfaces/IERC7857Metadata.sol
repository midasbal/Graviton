// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IERC7857Metadata
 * @notice Metadata structures for ERC-7857 intelligent NFTs.
 */

/// @notice Represents a single piece of intelligent data attached to an INFT
struct IntelligentData {
    string dataDescription; // Human-readable description (e.g. "LoRA weights", "system prompt")
    bytes32 dataHash;       // Keccak256 hash of the encrypted data blob
}
