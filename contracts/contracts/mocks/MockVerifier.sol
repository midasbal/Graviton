// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {TransferValidityProof, TransferValidityProofOutput, IERC7857DataVerifier} from "../interfaces/IERC7857DataVerifier.sol";

/**
 * @title MockVerifier
 * @notice A mock oracle/verifier for testnet and local development.
 * @dev Always returns valid proofs so that transfers and clones work without a live TEE.
 *      MUST be replaced with a real Verifier (TEE or ZKP) before mainnet production use.
 */
contract MockVerifier is IERC7857DataVerifier {
    /**
     * @notice Auto-approves all transfer validity proofs.
     * @param proofs Array of transfer validity proofs to verify
     * @return outputs Processed proof outputs with extracted data
     */
    function verifyTransferValidity(
        TransferValidityProof[] calldata proofs
    ) external pure override returns (TransferValidityProofOutput[] memory outputs) {
        outputs = new TransferValidityProofOutput[](proofs.length);

        for (uint256 i = 0; i < proofs.length; i++) {
            outputs[i] = TransferValidityProofOutput({
                dataHash: proofs[i].ownershipProof.dataHash,
                sealedKey: proofs[i].ownershipProof.sealedKey,
                targetPubkey: proofs[i].ownershipProof.targetPubkey,
                wantedKey: proofs[i].accessProof.targetPubkey,
                accessAssistant: address(0),
                accessProofNonce: proofs[i].accessProof.nonce,
                ownershipProofNonce: proofs[i].ownershipProof.nonce
            });
        }
    }
}
