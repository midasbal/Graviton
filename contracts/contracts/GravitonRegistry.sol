// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "./GravitonINFT.sol";

/**
 * @title GravitonRegistry
 * @notice On-chain registry for AI agent metadata, ratings, versioning, and analytics.
 *
 * Features:
 *   - Register agents with extended metadata (model type, tags, 0G Storage hash)
 *   - Star-based rating system (1-5) with anti-spam cooldown
 *   - Usage tracking and analytics counters
 *   - Version history tracking
 *   - Category-based and creator-based agent indexing
 *
 * @dev Deployed on 0G Chain. Reads ownership from GravitonINFT.
 */
contract GravitonRegistry is AccessControl {
    // ============================================================
    //                          ROLES
    // ============================================================

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    // ============================================================
    //                         STRUCTS
    // ============================================================

    struct AgentMeta {
        string name;                // Human-readable agent name
        string description;         // Short description
        string modelType;           // e.g. "Qwen2.5-0.5B-Instruct", "custom"
        string[] tags;              // Searchable tags
        string storageHash;         // 0G Storage root hash for model weights / data
        string metadataURI;         // Off-chain extended metadata JSON
        uint256 registeredAt;
        uint256 updatedAt;
        uint256 version;            // Increments on each update
    }

    struct RatingData {
        uint256 totalScore;         // Sum of all ratings (1-5 each)
        uint256 ratingCount;        // Number of ratings
    }

    struct UsageStats {
        uint256 inferenceCount;     // Number of inference calls served
        uint256 rentalCount;        // Number of times rented
        uint256 cloneCount;         // Number of times cloned
    }

    // ============================================================
    //                          STATE
    // ============================================================

    /// @notice Reference to the GravitonINFT contract
    GravitonINFT public immutable inft;

    /// @notice Extended metadata for each token
    mapping(uint256 => AgentMeta) private _metas;

    /// @notice Rating data per token
    mapping(uint256 => RatingData) public ratings;

    /// @notice Usage statistics per token
    mapping(uint256 => UsageStats) public stats;

    /// @notice Tracks the last rating time for each (user, tokenId) pair
    mapping(address => mapping(uint256 => uint256)) public lastRatedAt;

    /// @notice Rating cooldown period (prevents spam)
    uint256 public ratingCooldown = 1 hours;

    /// @notice Token IDs indexed by category
    mapping(string => uint256[]) private _categoryIndex;

    /// @notice Token IDs indexed by creator address
    mapping(address => uint256[]) private _creatorIndex;

    /// @notice Total number of registered agents
    uint256 public totalRegistered;

    // ============================================================
    //                          EVENTS
    // ============================================================

    event AgentRegistered(
        uint256 indexed tokenId,
        string name,
        string modelType,
        address indexed creator
    );
    event AgentMetaUpdated(uint256 indexed tokenId, uint256 version);
    event AgentRated(uint256 indexed tokenId, address indexed rater, uint8 score);
    event InferenceRecorded(uint256 indexed tokenId, uint256 totalInferences);
    event RentalRecorded(uint256 indexed tokenId, uint256 totalRentals);
    event CloneRecorded(uint256 indexed tokenId, uint256 totalClones);
    event RatingCooldownUpdated(uint256 oldCooldown, uint256 newCooldown);

    // ============================================================
    //                        CONSTRUCTOR
    // ============================================================

    /**
     * @param _inft Address of the GravitonINFT contract
     * @param _admin Admin address
     */
    constructor(address _inft, address _admin) {
        require(_inft != address(0), "Registry: zero INFT address");
        require(_admin != address(0), "Registry: zero admin");

        inft = GravitonINFT(_inft);

        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(ADMIN_ROLE, _admin);
    }

    // ============================================================
    //                       REGISTRATION
    // ============================================================

    /**
     * @notice Register an agent in the registry.
     * @dev Only the token owner or creator can register.
     */
    function registerAgent(
        uint256 tokenId,
        string calldata name,
        string calldata description,
        string calldata modelType,
        string[] calldata tags,
        string calldata storageHash,
        string calldata metadataURI
    ) external {
        require(
            inft.ownerOf(tokenId) == msg.sender || inft.creatorOf(tokenId) == msg.sender,
            "Registry: not owner or creator"
        );
        require(bytes(name).length > 0, "Registry: empty name");
        require(_metas[tokenId].registeredAt == 0, "Registry: already registered");

        _metas[tokenId] = AgentMeta({
            name: name,
            description: description,
            modelType: modelType,
            tags: tags,
            storageHash: storageHash,
            metadataURI: metadataURI,
            registeredAt: block.timestamp,
            updatedAt: block.timestamp,
            version: 1
        });

        // Update indices
        string memory category = inft.categoryOf(tokenId);
        _categoryIndex[category].push(tokenId);

        address creator = inft.creatorOf(tokenId);
        _creatorIndex[creator].push(tokenId);

        totalRegistered++;

        emit AgentRegistered(tokenId, name, modelType, creator);
    }

    /**
     * @notice Update agent metadata. Increments version.
     */
    function updateAgentMeta(
        uint256 tokenId,
        string calldata name,
        string calldata description,
        string calldata modelType,
        string[] calldata tags,
        string calldata storageHash,
        string calldata metadataURI
    ) external {
        require(
            inft.ownerOf(tokenId) == msg.sender || inft.creatorOf(tokenId) == msg.sender,
            "Registry: not owner or creator"
        );
        AgentMeta storage meta = _metas[tokenId];
        require(meta.registeredAt > 0, "Registry: not registered");

        meta.name = name;
        meta.description = description;
        meta.modelType = modelType;
        meta.tags = tags;
        meta.storageHash = storageHash;
        meta.metadataURI = metadataURI;
        meta.updatedAt = block.timestamp;
        meta.version++;

        emit AgentMetaUpdated(tokenId, meta.version);
    }

    // ============================================================
    //                         RATINGS
    // ============================================================

    /**
     * @notice Rate an agent (1-5 stars).
     * @dev Anti-spam: one rating per user per agent per cooldown period.
     */
    function rateAgent(uint256 tokenId, uint8 score) external {
        require(score >= 1 && score <= 5, "Registry: score must be 1-5");
        require(_metas[tokenId].registeredAt > 0, "Registry: not registered");
        require(
            block.timestamp >= lastRatedAt[msg.sender][tokenId] + ratingCooldown,
            "Registry: rating cooldown active"
        );

        ratings[tokenId].totalScore += score;
        ratings[tokenId].ratingCount++;
        lastRatedAt[msg.sender][tokenId] = block.timestamp;

        emit AgentRated(tokenId, msg.sender, score);
    }

    // ============================================================
    //                      USAGE TRACKING
    // ============================================================

    /**
     * @notice Record an inference call. Callable by owner, marketplace, or admin.
     */
    function recordInference(uint256 tokenId) external {
        require(
            inft.ownerOf(tokenId) == msg.sender || hasRole(ADMIN_ROLE, msg.sender),
            "Registry: unauthorized"
        );
        stats[tokenId].inferenceCount++;
        emit InferenceRecorded(tokenId, stats[tokenId].inferenceCount);
    }

    /**
     * @notice Record a rental. Callable by admin or marketplace.
     */
    function recordRental(uint256 tokenId) external onlyRole(ADMIN_ROLE) {
        stats[tokenId].rentalCount++;
        emit RentalRecorded(tokenId, stats[tokenId].rentalCount);
    }

    /**
     * @notice Record a clone event.
     */
    function recordClone(uint256 tokenId) external onlyRole(ADMIN_ROLE) {
        stats[tokenId].cloneCount++;
        emit CloneRecorded(tokenId, stats[tokenId].cloneCount);
    }

    // ============================================================
    //                       VIEW HELPERS
    // ============================================================

    /**
     * @notice Get full metadata for an agent.
     */
    function getAgentMeta(uint256 tokenId) external view returns (AgentMeta memory) {
        require(_metas[tokenId].registeredAt > 0, "Registry: not registered");
        return _metas[tokenId];
    }

    /**
     * @notice Get the average rating (multiplied by 100 for precision, e.g. 450 = 4.50).
     */
    function getAverageRating(uint256 tokenId) external view returns (uint256) {
        RatingData storage r = ratings[tokenId];
        if (r.ratingCount == 0) return 0;
        return (r.totalScore * 100) / r.ratingCount;
    }

    /**
     * @notice Get usage stats for an agent.
     */
    function getUsageStats(uint256 tokenId) external view returns (UsageStats memory) {
        return stats[tokenId];
    }

    /**
     * @notice Get all token IDs in a given category.
     */
    function getAgentsByCategory(string calldata category) external view returns (uint256[] memory) {
        return _categoryIndex[category];
    }

    /**
     * @notice Get all token IDs created by a given address.
     */
    function getAgentsByCreator(address creator) external view returns (uint256[] memory) {
        return _creatorIndex[creator];
    }

    /**
     * @notice Check if a token is registered.
     */
    function isRegistered(uint256 tokenId) external view returns (bool) {
        return _metas[tokenId].registeredAt > 0;
    }

    // ============================================================
    //                    ADMIN FUNCTIONS
    // ============================================================

    /**
     * @notice Update the rating cooldown period.
     */
    function setRatingCooldown(uint256 _cooldown) external onlyRole(ADMIN_ROLE) {
        uint256 old = ratingCooldown;
        ratingCooldown = _cooldown;
        emit RatingCooldownUpdated(old, _cooldown);
    }
}
