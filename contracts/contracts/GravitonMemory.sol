// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./GravitonINFT.sol";

/**
 * @title GravitonMemory
 * @notice On-chain anchor for decentralized agent memory stored on 0G Storage.
 *
 * Each AI agent (INFT) can have persistent, evolving memory. Conversation
 * summaries, learned preferences, and contextual data are stored encrypted
 * on 0G Storage. This contract stores the on-chain proof anchors:
 *   - Memory snapshot root hashes (0G Storage Merkle roots)
 *   - Interaction counters
 *   - Memory evolution history
 *
 * This makes Graviton agents truly intelligent: their memory persists across
 * sessions and is verifiable on-chain via 0G Storage proofs.
 *
 * @dev Deployed on 0G Chain alongside GravitonINFT.
 */
contract GravitonMemory is AccessControl, ReentrancyGuard {
    // ============================================================
    //                          ROLES
    // ============================================================

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    // ============================================================
    //                         STRUCTS
    // ============================================================

    /// @notice A single memory snapshot anchored to 0G Storage
    struct MemorySnapshot {
        string storageRoot;         // 0G Storage Merkle root hash
        bytes32 contentHash;        // keccak256 of the memory content (for integrity)
        uint256 interactionCount;   // Number of interactions in this snapshot
        uint256 timestamp;          // When this snapshot was committed
        string snapshotType;        // "conversation", "preference", "context", "summary"
    }

    /// @notice Aggregate memory state for an agent
    struct AgentMemoryState {
        uint256 totalInteractions;  // Lifetime interaction count
        uint256 totalSnapshots;     // Number of memory snapshots stored
        uint256 lastUpdated;        // Timestamp of last memory update
        string latestStorageRoot;   // Most recent 0G Storage root hash
        bool isActive;              // Whether memory tracking is enabled
    }

    // ============================================================
    //                          STATE
    // ============================================================

    /// @notice Reference to the GravitonINFT contract
    GravitonINFT public immutable inft;

    /// @notice Memory state per agent token ID
    mapping(uint256 => AgentMemoryState) private _memoryStates;

    /// @notice Memory snapshot history per agent (tokenId => snapshotIndex => snapshot)
    mapping(uint256 => mapping(uint256 => MemorySnapshot)) private _snapshots;

    /// @notice Maximum snapshots retained per agent (older ones can be pruned)
    uint256 public maxSnapshotsPerAgent = 100;

    /// @notice Total memory operations across all agents
    uint256 public totalMemoryOps;

    // ============================================================
    //                          EVENTS
    // ============================================================

    event MemoryInitialized(
        uint256 indexed tokenId,
        address indexed owner,
        uint256 timestamp
    );

    event MemorySnapshotCommitted(
        uint256 indexed tokenId,
        uint256 indexed snapshotIndex,
        string storageRoot,
        bytes32 contentHash,
        uint256 interactionCount,
        string snapshotType
    );

    event MemoryUpdated(
        uint256 indexed tokenId,
        uint256 totalInteractions,
        uint256 totalSnapshots,
        string latestStorageRoot
    );

    event InteractionRecorded(
        uint256 indexed tokenId,
        uint256 totalInteractions
    );

    // ============================================================
    //                        CONSTRUCTOR
    // ============================================================

    /**
     * @param _inft Address of the GravitonINFT contract
     * @param _admin Admin address
     */
    constructor(address _inft, address _admin) {
        require(_inft != address(0), "Memory: zero INFT address");
        require(_admin != address(0), "Memory: zero admin");

        inft = GravitonINFT(_inft);

        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(ADMIN_ROLE, _admin);
        _grantRole(OPERATOR_ROLE, _admin);
    }

    // ============================================================
    //                    MEMORY INITIALIZATION
    // ============================================================

    /**
     * @notice Initialize memory tracking for an agent.
     * @dev Only the token owner can initialize memory.
     */
    function initializeMemory(uint256 tokenId) external {
        require(
            inft.ownerOf(tokenId) == msg.sender,
            "Memory: not owner"
        );
        require(
            !_memoryStates[tokenId].isActive,
            "Memory: already initialized"
        );

        _memoryStates[tokenId] = AgentMemoryState({
            totalInteractions: 0,
            totalSnapshots: 0,
            lastUpdated: block.timestamp,
            latestStorageRoot: "",
            isActive: true
        });

        emit MemoryInitialized(tokenId, msg.sender, block.timestamp);
    }

    // ============================================================
    //                   MEMORY OPERATIONS
    // ============================================================

    /**
     * @notice Commit a memory snapshot to on-chain storage anchor.
     * @dev Stores the 0G Storage root hash and metadata on-chain.
     *      The actual memory content lives on 0G Storage.
     *
     * @param tokenId The agent token ID
     * @param storageRoot 0G Storage Merkle root hash of the memory data
     * @param contentHash keccak256 hash of the raw memory content
     * @param interactionCount Number of interactions in this snapshot
     * @param snapshotType Type of memory ("conversation", "preference", "context", "summary")
     */
    function commitMemorySnapshot(
        uint256 tokenId,
        string calldata storageRoot,
        bytes32 contentHash,
        uint256 interactionCount,
        string calldata snapshotType
    ) external nonReentrant {
        require(
            inft.ownerOf(tokenId) == msg.sender ||
            hasRole(OPERATOR_ROLE, msg.sender),
            "Memory: not owner or operator"
        );

        AgentMemoryState storage state = _memoryStates[tokenId];

        // Auto-initialize if not already
        if (!state.isActive) {
            state.isActive = true;
            state.lastUpdated = block.timestamp;
            emit MemoryInitialized(tokenId, msg.sender, block.timestamp);
        }

        uint256 snapshotIndex = state.totalSnapshots;
        require(snapshotIndex < maxSnapshotsPerAgent, "Memory: max snapshots reached");

        // Store snapshot
        _snapshots[tokenId][snapshotIndex] = MemorySnapshot({
            storageRoot: storageRoot,
            contentHash: contentHash,
            interactionCount: interactionCount,
            timestamp: block.timestamp,
            snapshotType: snapshotType
        });

        // Update state
        state.totalSnapshots++;
        state.totalInteractions += interactionCount;
        state.lastUpdated = block.timestamp;
        state.latestStorageRoot = storageRoot;
        totalMemoryOps++;

        emit MemorySnapshotCommitted(
            tokenId,
            snapshotIndex,
            storageRoot,
            contentHash,
            interactionCount,
            snapshotType
        );

        emit MemoryUpdated(
            tokenId,
            state.totalInteractions,
            state.totalSnapshots,
            storageRoot
        );
    }

    /**
     * @notice Record a single interaction (lightweight, no snapshot).
     * @dev Used for tracking interaction count without committing a full snapshot.
     */
    function recordInteraction(uint256 tokenId) external {
        require(
            inft.ownerOf(tokenId) == msg.sender ||
            hasRole(OPERATOR_ROLE, msg.sender),
            "Memory: not owner or operator"
        );

        AgentMemoryState storage state = _memoryStates[tokenId];
        require(state.isActive, "Memory: not initialized");

        state.totalInteractions++;
        state.lastUpdated = block.timestamp;
        totalMemoryOps++;

        emit InteractionRecorded(tokenId, state.totalInteractions);
    }

    // ============================================================
    //                       VIEW FUNCTIONS
    // ============================================================

    /**
     * @notice Get the full memory state for an agent.
     */
    function getMemoryState(uint256 tokenId) external view returns (AgentMemoryState memory) {
        return _memoryStates[tokenId];
    }

    /**
     * @notice Get a specific memory snapshot by index.
     */
    function getSnapshot(
        uint256 tokenId,
        uint256 snapshotIndex
    ) external view returns (MemorySnapshot memory) {
        require(
            snapshotIndex < _memoryStates[tokenId].totalSnapshots,
            "Memory: snapshot out of range"
        );
        return _snapshots[tokenId][snapshotIndex];
    }

    /**
     * @notice Get the latest memory snapshot for an agent.
     */
    function getLatestSnapshot(uint256 tokenId) external view returns (MemorySnapshot memory) {
        AgentMemoryState storage state = _memoryStates[tokenId];
        require(state.totalSnapshots > 0, "Memory: no snapshots");
        return _snapshots[tokenId][state.totalSnapshots - 1];
    }

    /**
     * @notice Get memory snapshot history (paginated).
     * @param tokenId The agent token ID
     * @param offset Starting index
     * @param limit Maximum number of snapshots to return
     */
    function getSnapshotHistory(
        uint256 tokenId,
        uint256 offset,
        uint256 limit
    ) external view returns (MemorySnapshot[] memory) {
        AgentMemoryState storage state = _memoryStates[tokenId];
        uint256 total = state.totalSnapshots;

        if (offset >= total) {
            return new MemorySnapshot[](0);
        }

        uint256 end = offset + limit;
        if (end > total) {
            end = total;
        }

        MemorySnapshot[] memory result = new MemorySnapshot[](end - offset);
        for (uint256 i = offset; i < end; i++) {
            result[i - offset] = _snapshots[tokenId][i];
        }

        return result;
    }

    /**
     * @notice Check if memory is active for an agent.
     */
    function isMemoryActive(uint256 tokenId) external view returns (bool) {
        return _memoryStates[tokenId].isActive;
    }

    /**
     * @notice Get total interactions for an agent.
     */
    function getTotalInteractions(uint256 tokenId) external view returns (uint256) {
        return _memoryStates[tokenId].totalInteractions;
    }

    // ============================================================
    //                    ADMIN FUNCTIONS
    // ============================================================

    /**
     * @notice Update the maximum snapshots per agent.
     */
    function setMaxSnapshots(uint256 _max) external onlyRole(ADMIN_ROLE) {
        require(_max > 0, "Memory: zero max");
        maxSnapshotsPerAgent = _max;
    }

    /**
     * @notice Grant operator role (allows backend to commit snapshots).
     */
    function grantOperatorRole(address operator) external onlyRole(ADMIN_ROLE) {
        _grantRole(OPERATOR_ROLE, operator);
    }
}
