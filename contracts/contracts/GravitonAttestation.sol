// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./GravitonINFT.sol";

/**
 * @title GravitonAttestation
 * @notice On-chain TEE attestation registry for AI agent inference results.
 *
 * Every inference session on the 0G Compute Network produces a TEE attestation
 * that proves the response was generated inside a Trusted Execution Environment
 * with the correct model weights — without exposing those weights.
 *
 * This contract stores attestation receipts on-chain, enabling:
 *   - Buyers to verify agent behavior before purchase
 *   - Marketplace ratings backed by cryptographic proof
 *   - Audit trail of all verified inference sessions
 *   - Dispute resolution with on-chain evidence
 *
 * Attestation lifecycle:
 *   1. User sends query via TestDriveChat → 0G Compute Network
 *   2. Provider runs inference inside TEE, returns signed response
 *   3. Broker SDK verifies TEE signature via processResponse()
 *   4. Backend calls submitAttestation() to anchor proof on-chain
 *   5. Frontend reads attestation to show "TEE Verified" badge
 *
 * @dev Works with the 0G Compute SDK's TEE verification flow.
 */
contract GravitonAttestation is AccessControl, ReentrancyGuard {
    // ============================================================
    //                          ROLES
    // ============================================================

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant ATTESTER_ROLE = keccak256("ATTESTER_ROLE");

    // ============================================================
    //                         ENUMS
    // ============================================================

    enum VerificationStatus {
        Unverified,     // Submitted but not yet verified
        Verified,       // TEE attestation confirmed valid
        Failed,         // Attestation verification failed
        Disputed        // Attestation under dispute
    }

    // ============================================================
    //                         STRUCTS
    // ============================================================

    /// @notice A single TEE attestation receipt for an inference session
    struct AttestationReceipt {
        uint256 tokenId;            // Agent INFT token ID
        address provider;           // 0G Compute provider address
        address requester;          // User who requested inference
        bytes32 requestHash;        // keccak256(request prompt)
        bytes32 responseHash;       // keccak256(response content)
        string chatId;              // 0G Compute chat completion ID
        string model;               // Model name used for inference
        uint256 timestamp;          // Block timestamp when submitted
        VerificationStatus status;  // Current verification status
        uint256 inputTokens;        // Input tokens consumed
        uint256 outputTokens;       // Output tokens generated
    }

    /// @notice Aggregate attestation statistics per agent
    struct AgentAttestationStats {
        uint256 totalAttestations;    // Total inference attestations
        uint256 verifiedCount;        // Successfully verified
        uint256 failedCount;          // Failed verifications
        uint256 disputedCount;        // Under dispute
        uint256 lastAttestationTime;  // Most recent attestation
        uint256 totalInputTokens;     // Lifetime input tokens
        uint256 totalOutputTokens;    // Lifetime output tokens
    }

    /// @notice Provider reputation data
    struct ProviderReputation {
        uint256 totalServiced;        // Total sessions serviced
        uint256 verifiedCount;        // Verified sessions
        uint256 failedCount;          // Failed sessions
        uint256 firstSeen;            // First attestation timestamp
        uint256 lastSeen;             // Last attestation timestamp
        bool isActive;                // Currently active
    }

    // ============================================================
    //                          STATE
    // ============================================================

    /// @notice Reference to the GravitonINFT contract
    GravitonINFT public immutable inft;

    /// @notice All attestation receipts (global auto-increment ID)
    mapping(uint256 => AttestationReceipt) private _receipts;
    uint256 public nextReceiptId;

    /// @notice Attestation IDs per agent (tokenId => receiptId[])
    mapping(uint256 => uint256[]) private _agentAttestations;

    /// @notice Attestation stats per agent
    mapping(uint256 => AgentAttestationStats) private _agentStats;

    /// @notice Attestation IDs per user (requester => receiptId[])
    mapping(address => uint256[]) private _userAttestations;

    /// @notice Provider reputation tracking
    mapping(address => ProviderReputation) private _providerReputation;

    /// @notice Total attestations across all agents
    uint256 public totalAttestations;

    /// @notice Total verified attestations
    uint256 public totalVerified;

    // ============================================================
    //                          EVENTS
    // ============================================================

    event AttestationSubmitted(
        uint256 indexed receiptId,
        uint256 indexed tokenId,
        address indexed provider,
        address requester,
        string chatId,
        VerificationStatus status
    );

    event AttestationVerified(
        uint256 indexed receiptId,
        uint256 indexed tokenId,
        VerificationStatus newStatus
    );

    event ProviderRegistered(
        address indexed provider,
        uint256 timestamp
    );

    // ============================================================
    //                        CONSTRUCTOR
    // ============================================================

    constructor(address _inft, address _admin) {
        require(_inft != address(0), "Attestation: zero INFT address");
        require(_admin != address(0), "Attestation: zero admin");

        inft = GravitonINFT(_inft);

        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(ADMIN_ROLE, _admin);
        _grantRole(ATTESTER_ROLE, _admin);
    }

    // ============================================================
    //                   ATTESTATION SUBMISSION
    // ============================================================

    /**
     * @notice Submit a TEE attestation receipt for an inference session.
     * @dev Called by the backend after the 0G Compute SDK verifies the response.
     *
     * @param tokenId Agent INFT token ID
     * @param provider 0G Compute provider address
     * @param requester User who requested inference
     * @param requestHash keccak256 of the request prompt
     * @param responseHash keccak256 of the response content
     * @param chatId 0G Compute chat completion ID
     * @param model Model name used
     * @param verified Whether the TEE attestation was verified by the SDK
     * @param inputTokens Input tokens consumed
     * @param outputTokens Output tokens generated
     */
    function submitAttestation(
        uint256 tokenId,
        address provider,
        address requester,
        bytes32 requestHash,
        bytes32 responseHash,
        string calldata chatId,
        string calldata model,
        bool verified,
        uint256 inputTokens,
        uint256 outputTokens
    ) external nonReentrant {
        require(
            hasRole(ATTESTER_ROLE, msg.sender),
            "Attestation: not attester"
        );

        uint256 receiptId = nextReceiptId++;

        VerificationStatus status = verified
            ? VerificationStatus.Verified
            : VerificationStatus.Unverified;

        _receipts[receiptId] = AttestationReceipt({
            tokenId: tokenId,
            provider: provider,
            requester: requester,
            requestHash: requestHash,
            responseHash: responseHash,
            chatId: chatId,
            model: model,
            timestamp: block.timestamp,
            status: status,
            inputTokens: inputTokens,
            outputTokens: outputTokens
        });

        // Update agent stats
        AgentAttestationStats storage agentStats = _agentStats[tokenId];
        agentStats.totalAttestations++;
        agentStats.lastAttestationTime = block.timestamp;
        agentStats.totalInputTokens += inputTokens;
        agentStats.totalOutputTokens += outputTokens;

        if (verified) {
            agentStats.verifiedCount++;
            totalVerified++;
        }

        // Update indices
        _agentAttestations[tokenId].push(receiptId);
        _userAttestations[requester].push(receiptId);

        // Update provider reputation
        ProviderReputation storage provRep = _providerReputation[provider];
        provRep.totalServiced++;
        provRep.lastSeen = block.timestamp;
        if (!provRep.isActive) {
            provRep.isActive = true;
            provRep.firstSeen = block.timestamp;
            emit ProviderRegistered(provider, block.timestamp);
        }
        if (verified) {
            provRep.verifiedCount++;
        }

        totalAttestations++;

        emit AttestationSubmitted(
            receiptId,
            tokenId,
            provider,
            requester,
            chatId,
            status
        );
    }

    /**
     * @notice Update the verification status of an attestation.
     * @dev Used for delayed verification or dispute resolution.
     */
    function updateVerificationStatus(
        uint256 receiptId,
        VerificationStatus newStatus
    ) external {
        require(
            hasRole(ATTESTER_ROLE, msg.sender) || hasRole(ADMIN_ROLE, msg.sender),
            "Attestation: not authorized"
        );
        require(receiptId < nextReceiptId, "Attestation: invalid receipt");

        AttestationReceipt storage receipt = _receipts[receiptId];
        VerificationStatus oldStatus = receipt.status;
        receipt.status = newStatus;

        // Update agent stats counters
        AgentAttestationStats storage agentStats = _agentStats[receipt.tokenId];

        // Decrement old status counter
        if (oldStatus == VerificationStatus.Verified) {
            agentStats.verifiedCount--;
            totalVerified--;
        } else if (oldStatus == VerificationStatus.Failed) {
            agentStats.failedCount--;
        } else if (oldStatus == VerificationStatus.Disputed) {
            agentStats.disputedCount--;
        }

        // Increment new status counter
        if (newStatus == VerificationStatus.Verified) {
            agentStats.verifiedCount++;
            totalVerified++;
        } else if (newStatus == VerificationStatus.Failed) {
            agentStats.failedCount++;
            _providerReputation[receipt.provider].failedCount++;
        } else if (newStatus == VerificationStatus.Disputed) {
            agentStats.disputedCount++;
        }

        emit AttestationVerified(receiptId, receipt.tokenId, newStatus);
    }

    // ============================================================
    //                       VIEW FUNCTIONS
    // ============================================================

    /**
     * @notice Get a specific attestation receipt.
     */
    function getReceipt(uint256 receiptId) external view returns (AttestationReceipt memory) {
        require(receiptId < nextReceiptId, "Attestation: invalid receipt");
        return _receipts[receiptId];
    }

    /**
     * @notice Get attestation stats for an agent.
     */
    function getAgentStats(uint256 tokenId) external view returns (AgentAttestationStats memory) {
        return _agentStats[tokenId];
    }

    /**
     * @notice Get attestation receipt IDs for an agent (paginated).
     */
    function getAgentAttestations(
        uint256 tokenId,
        uint256 offset,
        uint256 limit
    ) external view returns (uint256[] memory) {
        uint256[] storage ids = _agentAttestations[tokenId];
        uint256 total = ids.length;

        if (offset >= total) {
            return new uint256[](0);
        }

        uint256 end = offset + limit;
        if (end > total) end = total;

        uint256[] memory result = new uint256[](end - offset);
        for (uint256 i = offset; i < end; i++) {
            result[i - offset] = ids[i];
        }
        return result;
    }

    /**
     * @notice Get attestation receipt IDs for a user (paginated).
     */
    function getUserAttestations(
        address user,
        uint256 offset,
        uint256 limit
    ) external view returns (uint256[] memory) {
        uint256[] storage ids = _userAttestations[user];
        uint256 total = ids.length;

        if (offset >= total) {
            return new uint256[](0);
        }

        uint256 end = offset + limit;
        if (end > total) end = total;

        uint256[] memory result = new uint256[](end - offset);
        for (uint256 i = offset; i < end; i++) {
            result[i - offset] = ids[i];
        }
        return result;
    }

    /**
     * @notice Get the verification rate for an agent (basis points, 0-10000).
     */
    function getVerificationRate(uint256 tokenId) external view returns (uint256) {
        AgentAttestationStats storage s = _agentStats[tokenId];
        if (s.totalAttestations == 0) return 0;
        return (s.verifiedCount * 10000) / s.totalAttestations;
    }

    /**
     * @notice Get provider reputation.
     */
    function getProviderReputation(address provider) external view returns (ProviderReputation memory) {
        return _providerReputation[provider];
    }

    /**
     * @notice Check if an agent has any verified attestations.
     */
    function hasVerifiedAttestations(uint256 tokenId) external view returns (bool) {
        return _agentStats[tokenId].verifiedCount > 0;
    }

    // ============================================================
    //                    ADMIN FUNCTIONS
    // ============================================================

    /**
     * @notice Grant attester role to a backend service address.
     */
    function grantAttesterRole(address attester) external onlyRole(ADMIN_ROLE) {
        _grantRole(ATTESTER_ROLE, attester);
    }
}
