// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "./GravitonINFT.sol";

/**
 * @title GravitonMultiModal
 * @notice On-chain registry for multi-modal AI agent capabilities.
 *
 * Tracks which modalities each AI agent supports:
 *   - Text (chat, completion, summarization)
 *   - Image (generation, editing, analysis, vision)
 *   - Audio (TTS, STT, music generation)
 *   - Video (generation, editing, analysis)
 *   - Code (generation, review, debugging)
 *
 * Each modality can have multiple sub-capabilities and an associated
 * 0G Storage root for modality-specific model weights (e.g. LoRA adapters
 * for image generation vs. text chat).
 *
 * Features:
 *   - Register/update modality support per agent
 *   - Per-modality model weight storage references (0G Storage)
 *   - Capability search and filtering
 *   - Usage analytics per modality
 *   - Pipeline composition (chain modalities together)
 *
 * @dev Deployed on 0G Chain. Reads ownership from GravitonINFT.
 */
contract GravitonMultiModal is AccessControl {
    // ============================================================
    //                          ROLES
    // ============================================================

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    // ============================================================
    //                         ENUMS
    // ============================================================

    enum Modality {
        Text,    // 0
        Image,   // 1
        Audio,   // 2
        Video,   // 3
        Code     // 4
    }

    // ============================================================
    //                         STRUCTS
    // ============================================================

    /// @notice Configuration for a single modality on an agent
    struct ModalityConfig {
        Modality modality;              // Which modality
        bool enabled;                   // Currently active
        string[] capabilities;          // Sub-capabilities, e.g. ["generation", "analysis"]
        string modelReference;          // Model identifier for this modality
        string storageRoot;             // 0G Storage root for modality-specific weights
        bytes32 weightsHash;            // Hash of the modality-specific weights
        uint256 addedAt;                // When this modality was first added
        uint256 updatedAt;              // Last update timestamp
    }

    /// @notice A pipeline stage for composing multi-modal workflows
    struct PipelineStage {
        Modality inputModality;         // Expected input type
        Modality outputModality;        // Produced output type
        string processorName;           // Name of the processing step
        uint256 orderIndex;             // Position in the pipeline
    }

    /// @notice Agent's multi-modal profile
    struct AgentModalProfile {
        uint256 tokenId;
        uint256 modalityCount;          // Number of enabled modalities
        uint256 pipelineStageCount;     // Number of pipeline stages defined
        uint256 totalUsage;             // Total multi-modal inference count
        uint256 registeredAt;
        uint256 updatedAt;
        bool isActive;
    }

    // ============================================================
    //                          STATE
    // ============================================================

    /// @notice Reference to the GravitonINFT contract
    GravitonINFT public immutable inft;

    /// @notice Agent modal profiles
    mapping(uint256 => AgentModalProfile) public profiles;

    /// @notice Modality configs: tokenId => modality => config
    mapping(uint256 => mapping(Modality => ModalityConfig)) public modalityConfigs;

    /// @notice Pipeline stages: tokenId => index => stage
    mapping(uint256 => mapping(uint256 => PipelineStage)) public pipelineStages;

    /// @notice Per-modality usage counters: tokenId => modality => count
    mapping(uint256 => mapping(Modality => uint256)) public modalityUsage;

    /// @notice Index: modality => list of tokenIds supporting it
    mapping(Modality => uint256[]) private _modalityIndex;

    /// @notice Total agents with multi-modal profiles
    uint256 public totalMultiModalAgents;

    /// @notice Total modality registrations across all agents
    uint256 public totalModalityRegistrations;

    // ============================================================
    //                          EVENTS
    // ============================================================

    event ModalProfileCreated(uint256 indexed tokenId, address indexed owner);

    event ModalityAdded(
        uint256 indexed tokenId,
        Modality indexed modality,
        string modelReference,
        string[] capabilities
    );

    event ModalityUpdated(
        uint256 indexed tokenId,
        Modality indexed modality,
        string modelReference
    );

    event ModalityRemoved(uint256 indexed tokenId, Modality indexed modality);

    event PipelineStageAdded(
        uint256 indexed tokenId,
        uint256 stageIndex,
        Modality inputModality,
        Modality outputModality,
        string processorName
    );

    event ModalityUsageRecorded(
        uint256 indexed tokenId,
        Modality indexed modality,
        uint256 newCount
    );

    // ============================================================
    //                        CONSTRUCTOR
    // ============================================================

    constructor(address _inft, address _admin) {
        require(_inft != address(0), "MultiModal: zero INFT address");
        require(_admin != address(0), "MultiModal: zero admin");

        inft = GravitonINFT(_inft);

        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(ADMIN_ROLE, _admin);
        _grantRole(OPERATOR_ROLE, _admin);
    }

    // ============================================================
    //                     PROFILE MANAGEMENT
    // ============================================================

    /**
     * @notice Create a multi-modal profile for an agent.
     * @dev Only the INFT owner can create a profile.
     * @param tokenId The agent's INFT token ID
     */
    function createProfile(uint256 tokenId) external {
        require(inft.ownerOf(tokenId) == msg.sender, "MultiModal: not owner");
        require(!profiles[tokenId].isActive, "MultiModal: already active");

        profiles[tokenId] = AgentModalProfile({
            tokenId: tokenId,
            modalityCount: 0,
            pipelineStageCount: 0,
            totalUsage: 0,
            registeredAt: block.timestamp,
            updatedAt: block.timestamp,
            isActive: true
        });

        totalMultiModalAgents++;
        emit ModalProfileCreated(tokenId, msg.sender);
    }

    // ============================================================
    //                   MODALITY MANAGEMENT
    // ============================================================

    /**
     * @notice Add a modality capability to an agent.
     * @param tokenId Agent token ID
     * @param modality The modality type (Text, Image, Audio, Video, Code)
     * @param capabilities Sub-capability strings (e.g. ["generation", "editing"])
     * @param modelReference Model identifier for this modality
     * @param storageRoot 0G Storage root for modality-specific weights
     * @param weightsHash Hash of the weights file
     */
    function addModality(
        uint256 tokenId,
        Modality modality,
        string[] calldata capabilities,
        string calldata modelReference,
        string calldata storageRoot,
        bytes32 weightsHash
    ) external {
        require(inft.ownerOf(tokenId) == msg.sender, "MultiModal: not owner");
        require(profiles[tokenId].isActive, "MultiModal: no profile");
        require(!modalityConfigs[tokenId][modality].enabled, "MultiModal: already enabled");
        require(capabilities.length > 0, "MultiModal: no capabilities");

        modalityConfigs[tokenId][modality] = ModalityConfig({
            modality: modality,
            enabled: true,
            capabilities: capabilities,
            modelReference: modelReference,
            storageRoot: storageRoot,
            weightsHash: weightsHash,
            addedAt: block.timestamp,
            updatedAt: block.timestamp
        });

        profiles[tokenId].modalityCount++;
        profiles[tokenId].updatedAt = block.timestamp;
        totalModalityRegistrations++;

        _modalityIndex[modality].push(tokenId);

        emit ModalityAdded(tokenId, modality, modelReference, capabilities);
    }

    /**
     * @notice Update an existing modality's configuration.
     * @param tokenId Agent token ID
     * @param modality Which modality to update
     * @param capabilities New sub-capabilities
     * @param modelReference New model reference
     * @param storageRoot New 0G Storage root
     * @param weightsHash New weights hash
     */
    function updateModality(
        uint256 tokenId,
        Modality modality,
        string[] calldata capabilities,
        string calldata modelReference,
        string calldata storageRoot,
        bytes32 weightsHash
    ) external {
        require(inft.ownerOf(tokenId) == msg.sender, "MultiModal: not owner");
        require(modalityConfigs[tokenId][modality].enabled, "MultiModal: not enabled");

        ModalityConfig storage config = modalityConfigs[tokenId][modality];
        config.capabilities = capabilities;
        config.modelReference = modelReference;
        config.storageRoot = storageRoot;
        config.weightsHash = weightsHash;
        config.updatedAt = block.timestamp;

        profiles[tokenId].updatedAt = block.timestamp;

        emit ModalityUpdated(tokenId, modality, modelReference);
    }

    /**
     * @notice Remove a modality from an agent.
     * @param tokenId Agent token ID
     * @param modality Which modality to remove
     */
    function removeModality(uint256 tokenId, Modality modality) external {
        require(inft.ownerOf(tokenId) == msg.sender, "MultiModal: not owner");
        require(modalityConfigs[tokenId][modality].enabled, "MultiModal: not enabled");

        modalityConfigs[tokenId][modality].enabled = false;
        profiles[tokenId].modalityCount--;
        profiles[tokenId].updatedAt = block.timestamp;

        emit ModalityRemoved(tokenId, modality);
    }

    // ============================================================
    //                   PIPELINE MANAGEMENT
    // ============================================================

    /**
     * @notice Add a pipeline stage for multi-modal composition.
     * @dev A pipeline defines how different modalities chain together.
     *      Example: Text → Image → Video pipeline for animated content.
     * @param tokenId Agent token ID
     * @param inputModality Input type for this stage
     * @param outputModality Output type for this stage
     * @param processorName Name of the processing step
     */
    function addPipelineStage(
        uint256 tokenId,
        Modality inputModality,
        Modality outputModality,
        string calldata processorName
    ) external {
        require(inft.ownerOf(tokenId) == msg.sender, "MultiModal: not owner");
        require(profiles[tokenId].isActive, "MultiModal: no profile");
        require(
            modalityConfigs[tokenId][inputModality].enabled &&
            modalityConfigs[tokenId][outputModality].enabled,
            "MultiModal: modality not enabled"
        );

        uint256 stageIndex = profiles[tokenId].pipelineStageCount;

        pipelineStages[tokenId][stageIndex] = PipelineStage({
            inputModality: inputModality,
            outputModality: outputModality,
            processorName: processorName,
            orderIndex: stageIndex
        });

        profiles[tokenId].pipelineStageCount++;
        profiles[tokenId].updatedAt = block.timestamp;

        emit PipelineStageAdded(tokenId, stageIndex, inputModality, outputModality, processorName);
    }

    // ============================================================
    //                     USAGE TRACKING
    // ============================================================

    /**
     * @notice Record usage of a specific modality.
     * @dev Called by operator/backend after inference.
     * @param tokenId Agent token ID
     * @param modality Which modality was used
     */
    function recordModalityUsage(
        uint256 tokenId,
        Modality modality
    ) external onlyRole(OPERATOR_ROLE) {
        require(profiles[tokenId].isActive, "MultiModal: no profile");
        require(modalityConfigs[tokenId][modality].enabled, "MultiModal: not enabled");

        modalityUsage[tokenId][modality]++;
        profiles[tokenId].totalUsage++;

        emit ModalityUsageRecorded(tokenId, modality, modalityUsage[tokenId][modality]);
    }

    // ============================================================
    //                     VIEW FUNCTIONS
    // ============================================================

    /**
     * @notice Get an agent's multi-modal profile.
     */
    function getProfile(uint256 tokenId) external view returns (AgentModalProfile memory) {
        return profiles[tokenId];
    }

    /**
     * @notice Get a specific modality config for an agent.
     */
    function getModalityConfig(
        uint256 tokenId,
        Modality modality
    ) external view returns (ModalityConfig memory) {
        return modalityConfigs[tokenId][modality];
    }

    /**
     * @notice Get a pipeline stage for an agent.
     */
    function getPipelineStage(
        uint256 tokenId,
        uint256 stageIndex
    ) external view returns (PipelineStage memory) {
        return pipelineStages[tokenId][stageIndex];
    }

    /**
     * @notice Check if an agent supports a specific modality.
     */
    function supportsModality(
        uint256 tokenId,
        Modality modality
    ) external view returns (bool) {
        return modalityConfigs[tokenId][modality].enabled;
    }

    /**
     * @notice Get all agents supporting a given modality.
     */
    function getAgentsByModality(Modality modality) external view returns (uint256[] memory) {
        return _modalityIndex[modality];
    }

    /**
     * @notice Get supported modalities for an agent as a boolean array.
     * @return supported Array of 5 bools [text, image, audio, video, code]
     */
    function getSupportedModalities(uint256 tokenId) external view returns (bool[5] memory supported) {
        supported[0] = modalityConfigs[tokenId][Modality.Text].enabled;
        supported[1] = modalityConfigs[tokenId][Modality.Image].enabled;
        supported[2] = modalityConfigs[tokenId][Modality.Audio].enabled;
        supported[3] = modalityConfigs[tokenId][Modality.Video].enabled;
        supported[4] = modalityConfigs[tokenId][Modality.Code].enabled;
    }

    /**
     * @notice Get usage stats per modality for an agent.
     * @return usage Array of 5 uints [text, image, audio, video, code]
     */
    function getModalityUsageStats(uint256 tokenId) external view returns (uint256[5] memory usage) {
        usage[0] = modalityUsage[tokenId][Modality.Text];
        usage[1] = modalityUsage[tokenId][Modality.Image];
        usage[2] = modalityUsage[tokenId][Modality.Audio];
        usage[3] = modalityUsage[tokenId][Modality.Video];
        usage[4] = modalityUsage[tokenId][Modality.Code];
    }

    /**
     * @notice Check if an agent has a multi-modal profile.
     */
    function hasProfile(uint256 tokenId) external view returns (bool) {
        return profiles[tokenId].isActive;
    }

    // ============================================================
    //                    ADMIN FUNCTIONS
    // ============================================================

    function grantOperatorRole(address operator) external onlyRole(ADMIN_ROLE) {
        _grantRole(OPERATOR_ROLE, operator);
    }
}
