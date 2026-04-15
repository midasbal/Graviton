// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/interfaces/IERC2981.sol";

import "./GravitonINFT.sol";
import "./GravitonRegistry.sol";
import "./GravitonDAO.sol";

/**
 * @title GravitonMarketplace
 * @notice Decentralized marketplace for buying, selling, and renting AI agent INFTs on 0G.
 *
 * Features:
 *   - List agents for sale with a fixed price
 *   - Buy agents with escrow + automatic royalty distribution (ERC-2981)
 *   - Rent agents for temporary authorized usage
 *   - Platform fee collection
 *   - Pausable for emergency
 *
 * @dev Deployed on 0G Chain. Interacts with GravitonINFT for ownership and authorization.
 */
contract GravitonMarketplace is AccessControl, ReentrancyGuard, Pausable {
    // ============================================================
    //                          ROLES
    // ============================================================

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    // ============================================================
    //                         STRUCTS
    // ============================================================

    struct Listing {
        address seller;
        uint256 price;         // In native token (0G)
        string category;
        bool isActive;
        uint256 listedAt;
    }

    struct RentalTerms {
        address renter;
        uint256 pricePerDay;   // Daily rental price in native token
        uint256 startTime;
        uint256 endTime;
        bool isActive;
    }

    // ============================================================
    //                          STATE
    // ============================================================

    /// @notice Reference to the GravitonINFT contract
    GravitonINFT public immutable inft;

    /// @notice Platform fee in basis points (e.g. 250 = 2.5%)
    uint256 public platformFeeBps;

    /// @notice Maximum platform fee (10%)
    uint256 public constant MAX_PLATFORM_FEE_BPS = 1000;

    /// @notice Accumulated platform fees available for withdrawal
    uint256 public accumulatedFees;

    /// @notice Active listings by token ID
    mapping(uint256 => Listing) public listings;

    /// @notice Active rentals by token ID
    mapping(uint256 => RentalTerms) public rentals;

    /// @notice Total number of sales completed
    uint256 public totalSales;

    /// @notice Total volume traded (in native token)
    uint256 public totalVolume;

    // ── Cross-Contract Hooks (E4) ──

    /// @notice GravitonRegistry for automatic analytics updates
    GravitonRegistry public registry;

    /// @notice GravitonDAO for automatic creator-reward distribution
    GravitonDAO public dao;

    // ============================================================
    //                          EVENTS
    // ============================================================

    event AgentListed(
        uint256 indexed tokenId,
        address indexed seller,
        uint256 price,
        string category
    );
    event AgentDelisted(uint256 indexed tokenId, address indexed seller);
    event AgentSold(
        uint256 indexed tokenId,
        address indexed seller,
        address indexed buyer,
        uint256 price,
        uint256 royaltyAmount,
        uint256 platformFee
    );
    event AgentRented(
        uint256 indexed tokenId,
        address indexed owner,
        address indexed renter,
        uint256 pricePerDay,
        uint256 duration
    );
    event RentalEnded(uint256 indexed tokenId, address indexed renter);
    event PlatformFeeUpdated(uint256 oldFee, uint256 newFee);
    event FeesWithdrawn(address indexed admin, uint256 amount);
    event HooksConfigured(address indexed registry, address indexed dao);

    // ============================================================
    //                        CONSTRUCTOR
    // ============================================================

    /**
     * @param _inft Address of the GravitonINFT contract
     * @param _platformFeeBps Initial platform fee in basis points
     * @param _admin Admin address
     */
    constructor(
        address _inft,
        uint256 _platformFeeBps,
        address _admin
    ) {
        require(_inft != address(0), "Marketplace: zero INFT address");
        require(_admin != address(0), "Marketplace: zero admin");
        require(_platformFeeBps <= MAX_PLATFORM_FEE_BPS, "Marketplace: fee too high");

        inft = GravitonINFT(_inft);
        platformFeeBps = _platformFeeBps;

        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(ADMIN_ROLE, _admin);
        _grantRole(OPERATOR_ROLE, _admin);
    }

    // ============================================================
    //                       LIST / DELIST
    // ============================================================

    /**
     * @notice List an AI agent for sale.
     * @dev Seller must have approved this contract for the token.
     * @param tokenId Token ID to list
     * @param price Sale price in native token
     */
    function listAgent(uint256 tokenId, uint256 price) external whenNotPaused {
        require(inft.ownerOf(tokenId) == msg.sender, "Marketplace: not owner");
        require(price > 0, "Marketplace: zero price");
        require(!listings[tokenId].isActive, "Marketplace: already listed");
        require(
            inft.getApproved(tokenId) == address(this) ||
            inft.isApprovedForAll(msg.sender, address(this)),
            "Marketplace: not approved"
        );

        string memory category = inft.categoryOf(tokenId);

        listings[tokenId] = Listing({
            seller: msg.sender,
            price: price,
            category: category,
            isActive: true,
            listedAt: block.timestamp
        });

        emit AgentListed(tokenId, msg.sender, price, category);
    }

    /**
     * @notice Remove a listing.
     */
    function delistAgent(uint256 tokenId) external {
        Listing storage listing = listings[tokenId];
        require(listing.isActive, "Marketplace: not listed");
        require(
            listing.seller == msg.sender || hasRole(ADMIN_ROLE, msg.sender),
            "Marketplace: not seller or admin"
        );

        listing.isActive = false;

        emit AgentDelisted(tokenId, msg.sender);
    }

    // ============================================================
    //                        PURCHASE
    // ============================================================

    /**
     * @notice Buy a listed AI agent.
     * @dev Handles escrow, royalty distribution, and platform fee in one transaction.
     *      For MVP, uses standard ERC-721 transfer (without re-encryption proofs).
     *      Full ERC-7857 iTransferFrom can be added when TEE oracle is live.
     * @param tokenId Token ID to purchase
     */
    function buyAgent(uint256 tokenId) external payable nonReentrant whenNotPaused {
        Listing storage listing = listings[tokenId];
        require(listing.isActive, "Marketplace: not listed");
        require(msg.value >= listing.price, "Marketplace: insufficient payment");
        require(msg.sender != listing.seller, "Marketplace: cannot buy own agent");

        address seller = listing.seller;
        uint256 price = listing.price;

        // Mark listing as inactive
        listing.isActive = false;

        // Calculate fee splits
        uint256 platformFee = (price * platformFeeBps) / 10000;
        uint256 royaltyAmount = 0;
        address royaltyReceiver;

        // Check ERC-2981 royalty
        try inft.royaltyInfo(tokenId, price) returns (address receiver, uint256 amount) {
            // Only apply royalty if receiver is not the seller (avoid double payment)
            if (receiver != address(0) && receiver != seller && amount > 0) {
                royaltyReceiver = receiver;
                royaltyAmount = amount;
            }
        } catch {
            // No royalty support, continue without
        }

        uint256 sellerProceeds = price - platformFee - royaltyAmount;

        // Accumulate platform fees
        accumulatedFees += platformFee;

        // Transfer the INFT to buyer
        inft.transferFrom(seller, msg.sender, tokenId);

        // Distribute payments
        (bool sellerPaid, ) = payable(seller).call{value: sellerProceeds}("");
        require(sellerPaid, "Marketplace: seller payment failed");

        if (royaltyAmount > 0 && royaltyReceiver != address(0)) {
            (bool royaltyPaid, ) = payable(royaltyReceiver).call{value: royaltyAmount}("");
            require(royaltyPaid, "Marketplace: royalty payment failed");
        }

        // Refund excess
        if (msg.value > price) {
            (bool refunded, ) = payable(msg.sender).call{value: msg.value - price}("");
            require(refunded, "Marketplace: refund failed");
        }

        // Update stats
        totalSales++;
        totalVolume += price;

        // ── Cross-Contract Hooks (E4) ──
        // Auto-update registry analytics and DAO creator rewards on every sale
        address creator = inft.creatorOf(tokenId);

        if (address(registry) != address(0)) {
            try registry.recordInference(tokenId) {} catch {}
        }

        if (address(dao) != address(0) && creator != address(0)) {
            try dao.updateCreatorRewards(creator, price) {} catch {}
        }

        emit AgentSold(tokenId, seller, msg.sender, price, royaltyAmount, platformFee);
    }

    // ============================================================
    //                         RENTAL
    // ============================================================

    /**
     * @notice Rent an agent for temporary usage.
     * @dev Owner sets rental terms, renter pays and gets authorized usage.
     * @param tokenId Token to offer for rent
     * @param pricePerDay Daily rental price
     */
    function setRentalTerms(uint256 tokenId, uint256 pricePerDay) external whenNotPaused {
        require(inft.ownerOf(tokenId) == msg.sender, "Marketplace: not owner");
        require(pricePerDay > 0, "Marketplace: zero price");
        require(!rentals[tokenId].isActive, "Marketplace: already rented");

        rentals[tokenId] = RentalTerms({
            renter: address(0),
            pricePerDay: pricePerDay,
            startTime: 0,
            endTime: 0,
            isActive: false
        });
    }

    /**
     * @notice Rent an agent.
     * @param tokenId Token to rent
     * @param durationDays Number of days to rent
     */
    function rentAgent(
        uint256 tokenId,
        uint256 durationDays
    ) external payable nonReentrant whenNotPaused {
        RentalTerms storage rental = rentals[tokenId];
        require(rental.pricePerDay > 0, "Marketplace: no rental terms");
        require(!rental.isActive, "Marketplace: already rented");
        require(durationDays > 0 && durationDays <= 365, "Marketplace: invalid duration");

        uint256 totalPrice = rental.pricePerDay * durationDays;
        require(msg.value >= totalPrice, "Marketplace: insufficient payment");

        address owner = inft.ownerOf(tokenId);
        require(msg.sender != owner, "Marketplace: cannot rent own agent");

        // Activate rental
        rental.renter = msg.sender;
        rental.startTime = block.timestamp;
        rental.endTime = block.timestamp + (durationDays * 1 days);
        rental.isActive = true;

        // Authorize renter for usage
        inft.authorizeUsage(tokenId, msg.sender);

        // Calculate platform fee
        uint256 platformFee = (totalPrice * platformFeeBps) / 10000;
        uint256 ownerProceeds = totalPrice - platformFee;
        accumulatedFees += platformFee;

        // Pay owner
        (bool ownerPaid, ) = payable(owner).call{value: ownerProceeds}("");
        require(ownerPaid, "Marketplace: owner payment failed");

        // Refund excess
        if (msg.value > totalPrice) {
            (bool refunded, ) = payable(msg.sender).call{value: msg.value - totalPrice}("");
            require(refunded, "Marketplace: refund failed");
        }

        // ── Cross-Contract Hooks (E4) ──
        // Auto-update registry rental counter and DAO creator rewards on every rental
        address creator = inft.creatorOf(tokenId);

        if (address(registry) != address(0)) {
            try registry.recordRental(tokenId) {} catch {}
        }

        if (address(dao) != address(0) && creator != address(0)) {
            try dao.updateCreatorRewards(creator, totalPrice) {} catch {}
        }

        emit AgentRented(tokenId, owner, msg.sender, rental.pricePerDay, durationDays);
    }

    /**
     * @notice End an expired rental and revoke authorization.
     * @param tokenId Token whose rental to end
     */
    function endRental(uint256 tokenId) external {
        RentalTerms storage rental = rentals[tokenId];
        require(rental.isActive, "Marketplace: not rented");
        require(
            block.timestamp >= rental.endTime ||
            msg.sender == inft.ownerOf(tokenId) ||
            hasRole(ADMIN_ROLE, msg.sender),
            "Marketplace: rental not expired"
        );

        address renter = rental.renter;
        rental.isActive = false;
        rental.renter = address(0);

        // Revoke usage authorization
        try inft.revokeAuthorization(tokenId, renter) {} catch {}

        emit RentalEnded(tokenId, renter);
    }

    // ============================================================
    //                       VIEW HELPERS
    // ============================================================

    /**
     * @notice Get listing details.
     */
    function getListing(uint256 tokenId) external view returns (Listing memory) {
        return listings[tokenId];
    }

    /**
     * @notice Get rental details.
     */
    function getRental(uint256 tokenId) external view returns (RentalTerms memory) {
        return rentals[tokenId];
    }

    /**
     * @notice Check if a rental is currently active and not expired.
     */
    function isRentalActive(uint256 tokenId) external view returns (bool) {
        RentalTerms storage rental = rentals[tokenId];
        return rental.isActive && block.timestamp < rental.endTime;
    }

    // ============================================================
    //                    ADMIN FUNCTIONS
    // ============================================================

    /**
     * @notice Update platform fee.
     */
    function setPlatformFee(uint256 _newFeeBps) external onlyRole(ADMIN_ROLE) {
        require(_newFeeBps <= MAX_PLATFORM_FEE_BPS, "Marketplace: fee too high");
        uint256 old = platformFeeBps;
        platformFeeBps = _newFeeBps;
        emit PlatformFeeUpdated(old, _newFeeBps);
    }

    /**
     * @notice Wire cross-contract hooks to Registry and DAO.
     * @dev After calling this, buyAgent() will auto-call registry.recordInference()
     *      and dao.updateCreatorRewards(). rentAgent() will auto-call registry.recordRental().
     * @param _registry Address of GravitonRegistry (or address(0) to disable)
     * @param _dao Address of GravitonDAO (or address(0) to disable)
     */
    function setHooks(address _registry, address _dao) external onlyRole(ADMIN_ROLE) {
        registry = GravitonRegistry(_registry);
        dao = GravitonDAO(payable(_dao));
        emit HooksConfigured(_registry, _dao);
    }

    /**
     * @notice Withdraw accumulated platform fees.
     */
    function withdrawFees() external onlyRole(ADMIN_ROLE) {
        uint256 amount = accumulatedFees;
        require(amount > 0, "Marketplace: no fees");
        accumulatedFees = 0;

        (bool success, ) = payable(msg.sender).call{value: amount}("");
        require(success, "Marketplace: withdraw failed");

        emit FeesWithdrawn(msg.sender, amount);
    }

    /**
     * @notice Pause the marketplace in case of emergency.
     */
    function pause() external onlyRole(OPERATOR_ROLE) {
        _pause();
    }

    /**
     * @notice Unpause the marketplace.
     */
    function unpause() external onlyRole(OPERATOR_ROLE) {
        _unpause();
    }
}
