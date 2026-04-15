// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./GravitonINFT.sol";

/**
 * @title GravitonDAO
 * @notice Revenue-sharing DAO for the Graviton AI Agent Marketplace.
 *
 * Distributes marketplace platform fees and contributions to three pools:
 *   1. Creator Pool  (40%) — Rewards agent creators based on agent performance
 *   2. Staker Pool   (40%) — Rewards GRVT INFT holders who stake
 *   3. Treasury Pool (20%) — Community treasury for ecosystem growth
 *
 * Key features:
 *   - Stake INFTs to earn revenue share
 *   - Propose and vote on treasury spending (1 INFT = 1 vote)
 *   - Creator rewards proportional to agent sales/rental volume
 *   - Time-weighted staking for fair distribution
 *   - On-chain governance with proposal lifecycle
 *
 * Revenue flow:
 *   Marketplace accumulatedFees → DAO.distributeRevenue() → 3 pools
 */
contract GravitonDAO is AccessControl, ReentrancyGuard {
    // ============================================================
    //                          ROLES
    // ============================================================

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    // ============================================================
    //                         ENUMS
    // ============================================================

    enum ProposalStatus {
        Active,       // Voting open
        Passed,       // Quorum reached, majority approved
        Rejected,     // Quorum reached, majority rejected
        Executed,     // Passed and funds disbursed
        Cancelled     // Cancelled by proposer or admin
    }

    // ============================================================
    //                         STRUCTS
    // ============================================================

    /// @notice A staked INFT position
    struct StakeInfo {
        address owner;           // Staker address
        uint256 tokenId;         // INFT token ID
        uint256 stakedAt;        // Timestamp of staking
        uint256 lastClaimedAt;   // Last reward claim timestamp
        bool isActive;           // Currently staked
    }

    /// @notice Creator reward tracking
    struct CreatorRewards {
        uint256 totalEarned;        // Total rewards earned all time
        uint256 pendingRewards;     // Unclaimed rewards
        uint256 agentCount;         // Number of agents by this creator
        uint256 totalVolume;        // Total sales+rental volume
        uint256 lastUpdatedAt;      // Last reward update timestamp
    }

    /// @notice A governance proposal
    struct Proposal {
        uint256 id;
        address proposer;
        string title;
        string description;
        address payable recipient;     // Recipient of treasury funds
        uint256 amount;                // Amount requested from treasury
        uint256 votesFor;
        uint256 votesAgainst;
        uint256 createdAt;
        uint256 deadline;              // Voting deadline
        ProposalStatus status;
    }

    // ============================================================
    //                          STATE
    // ============================================================

    /// @notice Reference to the GravitonINFT contract
    GravitonINFT public immutable inft;

    // ── Revenue Pools ──

    /// @notice Creator pool balance
    uint256 public creatorPool;

    /// @notice Staker pool balance
    uint256 public stakerPool;

    /// @notice Treasury pool balance
    uint256 public treasuryPool;

    /// @notice Total revenue ever distributed
    uint256 public totalRevenueDistributed;

    // ── Revenue Split (basis points, total = 10000) ──

    uint256 public creatorShareBps;   // Default 4000 (40%)
    uint256 public stakerShareBps;    // Default 4000 (40%)
    uint256 public treasuryShareBps;  // Default 2000 (20%)

    // ── Staking ──

    /// @notice Staked INFTs
    mapping(uint256 => StakeInfo) public stakes;

    /// @notice Number of active stakes per address
    mapping(address => uint256) public stakerTokenCount;

    /// @notice Total INFTs currently staked
    uint256 public totalStaked;

    /// @notice Total staker rewards distributed
    uint256 public totalStakerRewardsPaid;

    // ── Creator Rewards ──

    /// @notice Creator reward tracking
    mapping(address => CreatorRewards) public creatorRewards;

    /// @notice Total creator rewards distributed
    uint256 public totalCreatorRewardsPaid;

    // ── Governance ──

    /// @notice All proposals
    mapping(uint256 => Proposal) public proposals;

    /// @notice Who voted on what
    mapping(uint256 => mapping(address => bool)) public hasVoted;

    /// @notice Next proposal ID
    uint256 public nextProposalId;

    /// @notice Voting period in seconds (default 3 days)
    uint256 public votingPeriod;

    /// @notice Quorum — minimum votes needed (default 1 for testnet)
    uint256 public quorumVotes;

    /// @notice Minimum stake duration before voting (1 hour)
    uint256 public constant MIN_STAKE_FOR_VOTE = 1 hours;

    // ============================================================
    //                          EVENTS
    // ============================================================

    event RevenueDistributed(
        uint256 total,
        uint256 toCreators,
        uint256 toStakers,
        uint256 toTreasury
    );

    event INFTStaked(uint256 indexed tokenId, address indexed owner);
    event INFTUnstaked(uint256 indexed tokenId, address indexed owner, uint256 rewardsEarned);

    event StakerRewardsClaimed(address indexed staker, uint256 amount);
    event CreatorRewardsClaimed(address indexed creator, uint256 amount);
    event CreatorRewardsUpdated(address indexed creator, uint256 newRewards, uint256 volume);

    event ProposalCreated(
        uint256 indexed proposalId,
        address indexed proposer,
        string title,
        uint256 amount
    );
    event Voted(uint256 indexed proposalId, address indexed voter, bool support);
    event ProposalExecuted(uint256 indexed proposalId, address indexed recipient, uint256 amount);
    event ProposalCancelled(uint256 indexed proposalId);

    event RevenueSplitUpdated(uint256 creatorBps, uint256 stakerBps, uint256 treasuryBps);

    // ============================================================
    //                        CONSTRUCTOR
    // ============================================================

    constructor(address _inft, address _admin) {
        require(_inft != address(0), "DAO: zero INFT address");
        require(_admin != address(0), "DAO: zero admin");

        inft = GravitonINFT(_inft);

        // Default revenue split: 40/40/20
        creatorShareBps = 4000;
        stakerShareBps = 4000;
        treasuryShareBps = 2000;

        // Governance defaults
        votingPeriod = 3 days;
        quorumVotes = 1; // Low for testnet

        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(ADMIN_ROLE, _admin);
        _grantRole(OPERATOR_ROLE, _admin);
    }

    // ============================================================
    //                   REVENUE DISTRIBUTION
    // ============================================================

    /**
     * @notice Receive and distribute revenue into the three pools.
     * @dev Called with msg.value containing the revenue to distribute.
     *      Can be called by anyone (marketplace, admin, external).
     */
    function distributeRevenue() external payable nonReentrant {
        require(msg.value > 0, "DAO: zero revenue");

        uint256 toCreators = (msg.value * creatorShareBps) / 10000;
        uint256 toStakers = (msg.value * stakerShareBps) / 10000;
        uint256 toTreasury = msg.value - toCreators - toStakers; // Remainder to avoid rounding loss

        creatorPool += toCreators;
        stakerPool += toStakers;
        treasuryPool += toTreasury;
        totalRevenueDistributed += msg.value;

        emit RevenueDistributed(msg.value, toCreators, toStakers, toTreasury);
    }

    /**
     * @notice Receive ETH directly (marketplace can send fees here).
     */
    receive() external payable {
        // Auto-distribute if received via direct transfer
        if (msg.value > 0) {
            uint256 toCreators = (msg.value * creatorShareBps) / 10000;
            uint256 toStakers = (msg.value * stakerShareBps) / 10000;
            uint256 toTreasury = msg.value - toCreators - toStakers;

            creatorPool += toCreators;
            stakerPool += toStakers;
            treasuryPool += toTreasury;
            totalRevenueDistributed += msg.value;
        }
    }

    // ============================================================
    //                         STAKING
    // ============================================================

    /**
     * @notice Stake an INFT to earn revenue share.
     * @dev Caller must own the INFT and have approved this contract.
     * @param tokenId INFT token ID to stake
     */
    function stake(uint256 tokenId) external nonReentrant {
        require(inft.ownerOf(tokenId) == msg.sender, "DAO: not owner");
        require(!stakes[tokenId].isActive, "DAO: already staked");
        require(
            inft.getApproved(tokenId) == address(this) ||
            inft.isApprovedForAll(msg.sender, address(this)),
            "DAO: not approved"
        );

        // Transfer INFT to DAO (custodial staking)
        inft.transferFrom(msg.sender, address(this), tokenId);

        stakes[tokenId] = StakeInfo({
            owner: msg.sender,
            tokenId: tokenId,
            stakedAt: block.timestamp,
            lastClaimedAt: block.timestamp,
            isActive: true
        });

        stakerTokenCount[msg.sender]++;
        totalStaked++;

        emit INFTStaked(tokenId, msg.sender);
    }

    /**
     * @notice Unstake an INFT and claim pending rewards.
     * @param tokenId INFT token ID to unstake
     */
    function unstake(uint256 tokenId) external nonReentrant {
        StakeInfo storage info = stakes[tokenId];
        require(info.isActive, "DAO: not staked");
        require(info.owner == msg.sender, "DAO: not staker");

        // Calculate and pay rewards
        uint256 reward = _calculateStakerReward(tokenId);

        info.isActive = false;
        stakerTokenCount[msg.sender]--;
        totalStaked--;

        // Return INFT to owner
        inft.transferFrom(address(this), msg.sender, tokenId);

        // Pay rewards
        if (reward > 0 && reward <= stakerPool) {
            stakerPool -= reward;
            totalStakerRewardsPaid += reward;
            (bool sent, ) = payable(msg.sender).call{value: reward}("");
            require(sent, "DAO: reward payment failed");
        }

        emit INFTUnstaked(tokenId, msg.sender, reward);
    }

    /**
     * @notice Claim staking rewards without unstaking.
     * @param tokenId Staked INFT token ID
     */
    function claimStakerRewards(uint256 tokenId) external nonReentrant {
        StakeInfo storage info = stakes[tokenId];
        require(info.isActive, "DAO: not staked");
        require(info.owner == msg.sender, "DAO: not staker");

        uint256 reward = _calculateStakerReward(tokenId);
        require(reward > 0, "DAO: no rewards");
        require(reward <= stakerPool, "DAO: insufficient pool");

        info.lastClaimedAt = block.timestamp;
        stakerPool -= reward;
        totalStakerRewardsPaid += reward;

        (bool sent, ) = payable(msg.sender).call{value: reward}("");
        require(sent, "DAO: reward payment failed");

        emit StakerRewardsClaimed(msg.sender, reward);
    }

    /**
     * @notice Calculate pending staker reward for a staked INFT.
     * @dev Reward = (stakerPool / totalStaked) * time_weight
     *      time_weight = stake_duration / 30 days (capped at 1.0)
     */
    function _calculateStakerReward(uint256 tokenId) internal view returns (uint256) {
        StakeInfo storage info = stakes[tokenId];
        if (!info.isActive || totalStaked == 0 || stakerPool == 0) return 0;

        // Time since last claim
        uint256 timeSinceClaim = block.timestamp - info.lastClaimedAt;
        if (timeSinceClaim == 0) return 0;

        // Equal share per staked INFT
        uint256 sharePerToken = stakerPool / totalStaked;

        // Time weight: linearly vest over 30 days, capped at 100%
        uint256 timeWeight = timeSinceClaim > 30 days ? 10000 : (timeSinceClaim * 10000) / 30 days;

        return (sharePerToken * timeWeight) / 10000;
    }

    /**
     * @notice View pending staker reward for a staked INFT.
     */
    function pendingStakerReward(uint256 tokenId) external view returns (uint256) {
        return _calculateStakerReward(tokenId);
    }

    // ============================================================
    //                     CREATOR REWARDS
    // ============================================================

    /**
     * @notice Update creator rewards based on agent volume.
     * @dev Called by operator when a sale/rental occurs.
     * @param creator Creator address
     * @param volume Sale or rental volume to attribute
     */
    function updateCreatorRewards(
        address creator,
        uint256 volume
    ) external onlyRole(OPERATOR_ROLE) {
        require(creator != address(0), "DAO: zero creator");
        require(volume > 0, "DAO: zero volume");

        CreatorRewards storage cr = creatorRewards[creator];

        // Reward = proportional share from creatorPool based on volume
        // Simple: 1% of volume as reward (from pool)
        uint256 reward = volume / 100;
        if (reward > creatorPool) {
            reward = creatorPool;
        }

        cr.pendingRewards += reward;
        cr.totalVolume += volume;
        cr.lastUpdatedAt = block.timestamp;
        creatorPool -= reward;

        emit CreatorRewardsUpdated(creator, reward, volume);
    }

    /**
     * @notice Claim pending creator rewards.
     */
    function claimCreatorRewards() external nonReentrant {
        CreatorRewards storage cr = creatorRewards[msg.sender];
        uint256 amount = cr.pendingRewards;
        require(amount > 0, "DAO: no rewards");

        cr.pendingRewards = 0;
        cr.totalEarned += amount;
        totalCreatorRewardsPaid += amount;

        (bool sent, ) = payable(msg.sender).call{value: amount}("");
        require(sent, "DAO: payment failed");

        emit CreatorRewardsClaimed(msg.sender, amount);
    }

    // ============================================================
    //                      GOVERNANCE
    // ============================================================

    /**
     * @notice Create a governance proposal.
     * @dev Proposer must have at least 1 staked INFT.
     * @param title Proposal title
     * @param description Proposal description
     * @param recipient Address to receive treasury funds (if spending proposal)
     * @param amount Amount to disburse from treasury (0 for signaling proposals)
     */
    function createProposal(
        string calldata title,
        string calldata description,
        address payable recipient,
        uint256 amount
    ) external returns (uint256 proposalId) {
        require(stakerTokenCount[msg.sender] > 0, "DAO: must stake to propose");
        require(bytes(title).length > 0, "DAO: empty title");
        require(amount <= treasuryPool, "DAO: exceeds treasury");
        if (amount > 0) {
            require(recipient != address(0), "DAO: zero recipient");
        }

        proposalId = nextProposalId++;

        proposals[proposalId] = Proposal({
            id: proposalId,
            proposer: msg.sender,
            title: title,
            description: description,
            recipient: recipient,
            amount: amount,
            votesFor: 0,
            votesAgainst: 0,
            createdAt: block.timestamp,
            deadline: block.timestamp + votingPeriod,
            status: ProposalStatus.Active
        });

        emit ProposalCreated(proposalId, msg.sender, title, amount);
    }

    /**
     * @notice Vote on a proposal.
     * @dev Voter must have at least 1 staked INFT that has been staked for MIN_STAKE_FOR_VOTE.
     * @param proposalId Proposal to vote on
     * @param support True = for, false = against
     */
    function vote(uint256 proposalId, bool support) external {
        Proposal storage p = proposals[proposalId];
        require(p.status == ProposalStatus.Active, "DAO: not active");
        require(block.timestamp < p.deadline, "DAO: voting ended");
        require(!hasVoted[proposalId][msg.sender], "DAO: already voted");
        require(stakerTokenCount[msg.sender] > 0, "DAO: must stake to vote");

        hasVoted[proposalId][msg.sender] = true;

        // Voting power = number of staked INFTs
        uint256 votingPower = stakerTokenCount[msg.sender];

        if (support) {
            p.votesFor += votingPower;
        } else {
            p.votesAgainst += votingPower;
        }

        emit Voted(proposalId, msg.sender, support);
    }

    /**
     * @notice Execute a passed proposal.
     * @dev Can be called by anyone after voting ends if proposal passed.
     */
    function executeProposal(uint256 proposalId) external nonReentrant {
        Proposal storage p = proposals[proposalId];
        require(p.status == ProposalStatus.Active, "DAO: not active");
        require(block.timestamp >= p.deadline, "DAO: voting not ended");

        uint256 totalVotes = p.votesFor + p.votesAgainst;

        // Check quorum
        if (totalVotes < quorumVotes) {
            p.status = ProposalStatus.Rejected;
            return;
        }

        // Check majority
        if (p.votesFor > p.votesAgainst) {
            p.status = ProposalStatus.Passed;

            // Execute treasury disbursement if amount > 0
            if (p.amount > 0 && p.amount <= treasuryPool) {
                treasuryPool -= p.amount;
                p.status = ProposalStatus.Executed;

                (bool sent, ) = p.recipient.call{value: p.amount}("");
                require(sent, "DAO: disbursement failed");

                emit ProposalExecuted(proposalId, p.recipient, p.amount);
            } else if (p.amount == 0) {
                // Signaling proposal — just mark as executed
                p.status = ProposalStatus.Executed;
                emit ProposalExecuted(proposalId, p.recipient, 0);
            }
        } else {
            p.status = ProposalStatus.Rejected;
        }
    }

    /**
     * @notice Cancel a proposal (proposer or admin only).
     */
    function cancelProposal(uint256 proposalId) external {
        Proposal storage p = proposals[proposalId];
        require(p.status == ProposalStatus.Active, "DAO: not active");
        require(
            p.proposer == msg.sender || hasRole(ADMIN_ROLE, msg.sender),
            "DAO: not authorized"
        );

        p.status = ProposalStatus.Cancelled;
        emit ProposalCancelled(proposalId);
    }

    // ============================================================
    //                       VIEW FUNCTIONS
    // ============================================================

    function getProposal(uint256 proposalId) external view returns (Proposal memory) {
        return proposals[proposalId];
    }

    function getCreatorRewards(address creator) external view returns (CreatorRewards memory) {
        return creatorRewards[creator];
    }

    function getStakeInfo(uint256 tokenId) external view returns (StakeInfo memory) {
        return stakes[tokenId];
    }

    /**
     * @notice Get a summary of all three pools.
     */
    function getPoolBalances() external view returns (
        uint256 creators,
        uint256 stakers,
        uint256 treasury,
        uint256 totalDistributed
    ) {
        return (creatorPool, stakerPool, treasuryPool, totalRevenueDistributed);
    }

    /**
     * @notice Get DAO global stats.
     */
    function getDAOStats() external view returns (
        uint256 _totalStaked,
        uint256 _totalRevenueDistributed,
        uint256 _totalStakerRewardsPaid,
        uint256 _totalCreatorRewardsPaid,
        uint256 _totalProposals,
        uint256 _treasuryBalance
    ) {
        return (
            totalStaked,
            totalRevenueDistributed,
            totalStakerRewardsPaid,
            totalCreatorRewardsPaid,
            nextProposalId,
            treasuryPool
        );
    }

    // ============================================================
    //                    ADMIN FUNCTIONS
    // ============================================================

    /**
     * @notice Update the revenue split percentages.
     * @dev Must total 10000 bps (100%).
     */
    function setRevenueSplit(
        uint256 _creatorBps,
        uint256 _stakerBps,
        uint256 _treasuryBps
    ) external onlyRole(ADMIN_ROLE) {
        require(
            _creatorBps + _stakerBps + _treasuryBps == 10000,
            "DAO: split must total 10000"
        );

        creatorShareBps = _creatorBps;
        stakerShareBps = _stakerBps;
        treasuryShareBps = _treasuryBps;

        emit RevenueSplitUpdated(_creatorBps, _stakerBps, _treasuryBps);
    }

    /**
     * @notice Update governance parameters.
     */
    function setGovernanceParams(
        uint256 _votingPeriod,
        uint256 _quorumVotes
    ) external onlyRole(ADMIN_ROLE) {
        require(_votingPeriod >= 1 hours, "DAO: period too short");
        votingPeriod = _votingPeriod;
        quorumVotes = _quorumVotes;
    }

    function grantOperatorRole(address operator) external onlyRole(ADMIN_ROLE) {
        _grantRole(OPERATOR_ROLE, operator);
    }
}
