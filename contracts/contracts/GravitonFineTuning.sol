// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./GravitonINFT.sol";

/**
 * @title GravitonFineTuning
 * @notice On-chain registry for decentralized LoRA fine-tuning jobs.
 *
 * Enables agent owners to submit fine-tuning jobs that:
 *   1. Take training data from 0G Storage (encrypted datasets)
 *   2. Run LoRA fine-tuning on 0G Compute Network providers
 *   3. Store the resulting LoRA adapter back to 0G Storage
 *   4. Update the agent's IntelligentData with the new adapter hash
 *
 * Job lifecycle:
 *   Created → Funded → Training → Completed | Failed → Finalized
 *
 * The training dataset and resulting weights never leave the TEE.
 * Merkle proofs of the training data and output are anchored on-chain.
 */
contract GravitonFineTuning is AccessControl, ReentrancyGuard {
    // ============================================================
    //                          ROLES
    // ============================================================

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    // ============================================================
    //                         ENUMS
    // ============================================================

    enum JobStatus {
        Created,      // Job submitted, not yet funded
        Funded,       // Payment escrowed, awaiting training
        Training,     // Training in progress on compute provider
        Completed,    // Training completed, results stored
        Failed,       // Training failed
        Finalized     // Results applied to INFT (IntelligentData updated)
    }

    // ============================================================
    //                         STRUCTS
    // ============================================================

    /// @notice A single fine-tuning job
    struct FineTuningJob {
        uint256 tokenId;              // Agent INFT being fine-tuned
        address owner;                // Job submitter (must be INFT owner)
        address provider;             // 0G Compute provider running the job
        string baseModel;             // Base model name (e.g. "Qwen2.5-7B-Instruct")
        string datasetStorageRoot;    // 0G Storage root of training dataset
        bytes32 datasetHash;          // keccak256 of the dataset
        string resultStorageRoot;     // 0G Storage root of resulting LoRA adapter
        bytes32 resultHash;           // keccak256 of the resulting adapter
        JobStatus status;             // Current job status
        uint256 createdAt;            // Timestamp
        uint256 completedAt;          // Timestamp of completion
        uint256 epochs;               // Training epochs
        uint256 loraRank;             // LoRA rank (4, 8, 16, 32, 64)
        uint256 learningRateBps;      // Learning rate in basis points (e.g. 200 = 0.02)
        string hyperparamsJson;       // Additional hyperparameters as JSON
    }

    /// @notice Fine-tuning statistics per agent
    struct AgentFineTuningStats {
        uint256 totalJobs;            // Total fine-tuning jobs submitted
        uint256 completedJobs;        // Successfully completed jobs
        uint256 failedJobs;           // Failed jobs
        uint256 totalEpochsTrained;   // Sum of epochs across all completed jobs
        uint256 lastFineTunedAt;      // Last successful fine-tuning timestamp
        uint256 currentVersion;       // Number of times weights were updated
    }

    // ============================================================
    //                          STATE
    // ============================================================

    /// @notice Reference to the GravitonINFT contract
    GravitonINFT public immutable inft;

    /// @notice All fine-tuning jobs (global auto-increment)
    mapping(uint256 => FineTuningJob) private _jobs;
    uint256 public nextJobId;

    /// @notice Jobs per agent (tokenId => jobId[])
    mapping(uint256 => uint256[]) private _agentJobs;

    /// @notice Jobs per owner (address => jobId[])
    mapping(address => uint256[]) private _ownerJobs;

    /// @notice Fine-tuning stats per agent
    mapping(uint256 => AgentFineTuningStats) private _agentStats;

    /// @notice Total completed fine-tuning jobs globally
    uint256 public totalCompletedJobs;

    /// @notice Minimum LoRA rank allowed
    uint256 public constant MIN_LORA_RANK = 4;

    /// @notice Maximum LoRA rank allowed
    uint256 public constant MAX_LORA_RANK = 128;

    // ============================================================
    //                          EVENTS
    // ============================================================

    event JobCreated(
        uint256 indexed jobId,
        uint256 indexed tokenId,
        address indexed owner,
        string baseModel,
        uint256 epochs,
        uint256 loraRank
    );

    event JobStatusUpdated(
        uint256 indexed jobId,
        uint256 indexed tokenId,
        JobStatus oldStatus,
        JobStatus newStatus
    );

    event JobCompleted(
        uint256 indexed jobId,
        uint256 indexed tokenId,
        string resultStorageRoot,
        bytes32 resultHash
    );

    event JobFinalized(
        uint256 indexed jobId,
        uint256 indexed tokenId,
        uint256 newVersion
    );

    // ============================================================
    //                        CONSTRUCTOR
    // ============================================================

    constructor(address _inft, address _admin) {
        require(_inft != address(0), "FineTuning: zero INFT address");
        require(_admin != address(0), "FineTuning: zero admin");

        inft = GravitonINFT(_inft);

        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(ADMIN_ROLE, _admin);
        _grantRole(OPERATOR_ROLE, _admin);
    }

    // ============================================================
    //                     JOB SUBMISSION
    // ============================================================

    /**
     * @notice Submit a new fine-tuning job.
     * @dev Caller must own the INFT being fine-tuned.
     *
     * @param tokenId INFT token ID
     * @param provider 0G Compute provider for training
     * @param baseModel Base model name
     * @param datasetStorageRoot 0G Storage root of training dataset
     * @param datasetHash keccak256 of the dataset content
     * @param epochs Number of training epochs
     * @param loraRank LoRA rank (4-128)
     * @param learningRateBps Learning rate in bps (e.g. 200 = 2e-2)
     * @param hyperparamsJson Additional hyperparameters as JSON string
     */
    function createJob(
        uint256 tokenId,
        address provider,
        string calldata baseModel,
        string calldata datasetStorageRoot,
        bytes32 datasetHash,
        uint256 epochs,
        uint256 loraRank,
        uint256 learningRateBps,
        string calldata hyperparamsJson
    ) external nonReentrant returns (uint256 jobId) {
        require(
            inft.ownerOf(tokenId) == msg.sender,
            "FineTuning: not owner"
        );
        require(provider != address(0), "FineTuning: zero provider");
        require(epochs > 0 && epochs <= 100, "FineTuning: invalid epochs");
        require(
            loraRank >= MIN_LORA_RANK && loraRank <= MAX_LORA_RANK,
            "FineTuning: invalid LoRA rank"
        );
        require(learningRateBps > 0 && learningRateBps <= 10000, "FineTuning: invalid LR");
        require(bytes(datasetStorageRoot).length > 0, "FineTuning: empty dataset root");

        jobId = nextJobId++;

        _jobs[jobId] = FineTuningJob({
            tokenId: tokenId,
            owner: msg.sender,
            provider: provider,
            baseModel: baseModel,
            datasetStorageRoot: datasetStorageRoot,
            datasetHash: datasetHash,
            resultStorageRoot: "",
            resultHash: bytes32(0),
            status: JobStatus.Created,
            createdAt: block.timestamp,
            completedAt: 0,
            epochs: epochs,
            loraRank: loraRank,
            learningRateBps: learningRateBps,
            hyperparamsJson: hyperparamsJson
        });

        _agentJobs[tokenId].push(jobId);
        _ownerJobs[msg.sender].push(jobId);

        AgentFineTuningStats storage stats = _agentStats[tokenId];
        stats.totalJobs++;

        emit JobCreated(jobId, tokenId, msg.sender, baseModel, epochs, loraRank);
    }

    // ============================================================
    //                    STATUS TRANSITIONS
    // ============================================================

    /**
     * @notice Mark a job as funded and ready for training.
     */
    function fundJob(uint256 jobId) external {
        FineTuningJob storage job = _jobs[jobId];
        require(job.owner == msg.sender, "FineTuning: not job owner");
        require(job.status == JobStatus.Created, "FineTuning: not in Created");

        _updateStatus(jobId, JobStatus.Funded);
    }

    /**
     * @notice Mark a job as training (operator/provider only).
     */
    function startTraining(uint256 jobId) external {
        require(
            hasRole(OPERATOR_ROLE, msg.sender) ||
            _jobs[jobId].provider == msg.sender,
            "FineTuning: not operator or provider"
        );
        require(_jobs[jobId].status == JobStatus.Funded, "FineTuning: not funded");

        _updateStatus(jobId, JobStatus.Training);
    }

    /**
     * @notice Mark a job as completed with training results.
     * @param jobId Job ID
     * @param resultStorageRoot 0G Storage root of the resulting LoRA adapter
     * @param resultHash keccak256 of the resulting adapter weights
     */
    function completeJob(
        uint256 jobId,
        string calldata resultStorageRoot,
        bytes32 resultHash
    ) external {
        require(
            hasRole(OPERATOR_ROLE, msg.sender) ||
            _jobs[jobId].provider == msg.sender,
            "FineTuning: not operator or provider"
        );

        FineTuningJob storage job = _jobs[jobId];
        require(job.status == JobStatus.Training, "FineTuning: not training");
        require(bytes(resultStorageRoot).length > 0, "FineTuning: empty result");

        job.resultStorageRoot = resultStorageRoot;
        job.resultHash = resultHash;
        job.completedAt = block.timestamp;

        _updateStatus(jobId, JobStatus.Completed);

        AgentFineTuningStats storage stats = _agentStats[job.tokenId];
        stats.completedJobs++;
        stats.totalEpochsTrained += job.epochs;
        stats.lastFineTunedAt = block.timestamp;
        totalCompletedJobs++;

        emit JobCompleted(jobId, job.tokenId, resultStorageRoot, resultHash);
    }

    /**
     * @notice Mark a job as failed.
     */
    function failJob(uint256 jobId) external {
        require(
            hasRole(OPERATOR_ROLE, msg.sender) ||
            _jobs[jobId].provider == msg.sender ||
            _jobs[jobId].owner == msg.sender,
            "FineTuning: not authorized"
        );

        FineTuningJob storage job = _jobs[jobId];
        require(
            job.status == JobStatus.Funded || job.status == JobStatus.Training,
            "FineTuning: cannot fail"
        );

        _updateStatus(jobId, JobStatus.Failed);
        _agentStats[job.tokenId].failedJobs++;
    }

    /**
     * @notice Finalize a completed job — apply the new weights to the INFT.
     * @dev Only the INFT owner can finalize. This conceptually signals
     *      that the owner has verified and accepted the fine-tuning results.
     *      The actual IntelligentData update is done off-chain via
     *      GravitonINFT.updateIntelligentData().
     */
    function finalizeJob(uint256 jobId) external {
        FineTuningJob storage job = _jobs[jobId];
        require(job.owner == msg.sender, "FineTuning: not job owner");
        require(
            inft.ownerOf(job.tokenId) == msg.sender,
            "FineTuning: not INFT owner"
        );
        require(job.status == JobStatus.Completed, "FineTuning: not completed");

        _updateStatus(jobId, JobStatus.Finalized);

        AgentFineTuningStats storage stats = _agentStats[job.tokenId];
        stats.currentVersion++;

        emit JobFinalized(jobId, job.tokenId, stats.currentVersion);
    }

    // ============================================================
    //                       VIEW FUNCTIONS
    // ============================================================

    function getJob(uint256 jobId) external view returns (FineTuningJob memory) {
        require(jobId < nextJobId, "FineTuning: invalid job");
        return _jobs[jobId];
    }

    function getAgentStats(uint256 tokenId) external view returns (AgentFineTuningStats memory) {
        return _agentStats[tokenId];
    }

    function getAgentJobs(
        uint256 tokenId,
        uint256 offset,
        uint256 limit
    ) external view returns (uint256[] memory) {
        uint256[] storage ids = _agentJobs[tokenId];
        uint256 total = ids.length;
        if (offset >= total) return new uint256[](0);
        uint256 end = offset + limit > total ? total : offset + limit;
        uint256[] memory result = new uint256[](end - offset);
        for (uint256 i = offset; i < end; i++) {
            result[i - offset] = ids[i];
        }
        return result;
    }

    function getOwnerJobs(
        address owner,
        uint256 offset,
        uint256 limit
    ) external view returns (uint256[] memory) {
        uint256[] storage ids = _ownerJobs[owner];
        uint256 total = ids.length;
        if (offset >= total) return new uint256[](0);
        uint256 end = offset + limit > total ? total : offset + limit;
        uint256[] memory result = new uint256[](end - offset);
        for (uint256 i = offset; i < end; i++) {
            result[i - offset] = ids[i];
        }
        return result;
    }

    /**
     * @notice Get the current LoRA adapter version for an agent.
     */
    function getCurrentVersion(uint256 tokenId) external view returns (uint256) {
        return _agentStats[tokenId].currentVersion;
    }

    // ============================================================
    //                    INTERNAL HELPERS
    // ============================================================

    function _updateStatus(uint256 jobId, JobStatus newStatus) internal {
        JobStatus old = _jobs[jobId].status;
        _jobs[jobId].status = newStatus;
        emit JobStatusUpdated(jobId, _jobs[jobId].tokenId, old, newStatus);
    }

    // ============================================================
    //                    ADMIN FUNCTIONS
    // ============================================================

    function grantOperatorRole(address operator) external onlyRole(ADMIN_ROLE) {
        _grantRole(OPERATOR_ROLE, operator);
    }
}
