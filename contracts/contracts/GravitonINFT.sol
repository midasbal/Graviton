// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/interfaces/IERC2981.sol";

import "./interfaces/IERC7857Metadata.sol";
import {
    IERC7857DataVerifier,
    TransferValidityProof,
    TransferValidityProofOutput
} from "./interfaces/IERC7857DataVerifier.sol";

/**
 * @title GravitonINFT
 * @notice ERC-7857 compliant Intelligent NFT for tokenizing AI agents on 0G.
 *
 * Each token represents a complete AI agent with:
 *   - Encrypted LoRA weights (stored on 0G Storage, referenced by dataHash)
 *   - System prompt and configuration
 *   - Persistent memory / context
 *
 * Supports:
 *   - Minting with IntelligentData attachments
 *   - Verified transfer with oracle-backed re-encryption (TEE/ZKP)
 *   - Clone (duplicate agent with new owner)
 *   - Authorized usage (grant inference access without ownership)
 *   - ERC-2981 royalties for original creators
 *
 * @dev Non-upgradeable for hackathon simplicity. Uses MockVerifier on testnet.
 */
contract GravitonINFT is
    ERC721,
    ERC721Enumerable,
    ERC721URIStorage,
    AccessControl,
    ReentrancyGuard,
    IERC2981
{
    // ============================================================
    //                          ROLES
    // ============================================================

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    // ============================================================
    //                          STATE
    // ============================================================

    /// @notice The verifier contract (TEE/ZKP oracle) that validates transfer proofs
    IERC7857DataVerifier public verifier;

    /// @notice Auto-incrementing token ID counter
    uint256 private _nextTokenId;

    /// @notice Mint fee in native token (0G)
    uint256 public mintFee;

    /// @notice Default royalty rate in basis points (e.g. 500 = 5%)
    uint96 public constant DEFAULT_ROYALTY_BPS = 500;

    /// @notice Maximum authorized users per token
    uint256 public constant MAX_AUTHORIZED_USERS = 100;

    /// @notice Storage info string (e.g. 0G Storage endpoint or description)
    string public storageInfo;

    // ============================================================
    //                      DATA MAPPINGS
    // ============================================================

    /// @notice Intelligent data slots attached to each token
    mapping(uint256 => IntelligentData[]) private _intelligentDatas;

    /// @notice Original creator of each token (persists through transfers)
    mapping(uint256 => address) private _creators;

    /// @notice Custom royalty receiver overrides
    mapping(uint256 => address) private _royaltyReceivers;

    /// @notice Custom royalty BPS overrides
    mapping(uint256 => uint96) private _royaltyBps;

    /// @notice Authorized users per token (can use but not own)
    mapping(uint256 => address[]) private _authorizedUsers;

    /// @notice Quick lookup for authorization status
    mapping(uint256 => mapping(address => bool)) private _isUserAuthorized;

    /// @notice 0G Storage root hash for agent metadata package
    mapping(uint256 => string) private _storageRoots;

    /// @notice Agent category tags
    mapping(uint256 => string) private _categories;

    // ============================================================
    //                          EVENTS
    // ============================================================

    event AgentMinted(
        uint256 indexed tokenId,
        address indexed creator,
        string category,
        string storageRoot
    );
    event IntelligentDataUpdated(
        uint256 indexed tokenId,
        IntelligentData[] oldDatas,
        IntelligentData[] newDatas
    );
    event AgentTransferred(
        uint256 indexed tokenId,
        address indexed from,
        address indexed to,
        bytes[] sealedKeys
    );
    event AgentCloned(
        uint256 indexed originalTokenId,
        uint256 indexed newTokenId,
        address indexed to
    );
    event UsageAuthorized(
        uint256 indexed tokenId,
        address indexed owner,
        address indexed user
    );
    event UsageRevoked(
        uint256 indexed tokenId,
        address indexed owner,
        address indexed user
    );
    event VerifierUpdated(address oldVerifier, address newVerifier);
    event MintFeeUpdated(uint256 oldFee, uint256 newFee);

    // ============================================================
    //                        CONSTRUCTOR
    // ============================================================

    /**
     * @param _name Token collection name
     * @param _symbol Token collection symbol
     * @param _verifier Address of the IERC7857DataVerifier contract
     * @param _storageInfo Description or endpoint of the 0G Storage layer
     * @param _mintFee Initial mint fee in native token
     * @param _admin Address that receives admin roles
     */
    constructor(
        string memory _name,
        string memory _symbol,
        address _verifier,
        string memory _storageInfo,
        uint256 _mintFee,
        address _admin
    ) ERC721(_name, _symbol) {
        require(_verifier != address(0), "GravitonINFT: zero verifier");
        require(_admin != address(0), "GravitonINFT: zero admin");

        verifier = IERC7857DataVerifier(_verifier);
        storageInfo = _storageInfo;
        mintFee = _mintFee;
        _nextTokenId = 1;

        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(ADMIN_ROLE, _admin);
        _grantRole(MINTER_ROLE, _admin);
    }

    // ============================================================
    //                       MINTING
    // ============================================================

    /**
     * @notice Mint a new AI agent INFT.
     * @param to Recipient address
     * @param iDatas Array of IntelligentData to attach (LoRA hash, prompt hash, etc.)
     * @param category Agent category (e.g. "trading", "writing", "coding")
     * @param _storageRoot 0G Storage Merkle root hash of the encrypted agent package
     * @param uri Token metadata URI
     * @return tokenId The newly minted token ID
     */
    function mint(
        address to,
        IntelligentData[] calldata iDatas,
        string calldata category,
        string calldata _storageRoot,
        string calldata uri
    ) external payable nonReentrant returns (uint256 tokenId) {
        require(to != address(0), "GravitonINFT: zero address");
        require(iDatas.length > 0, "GravitonINFT: empty data array");
        require(msg.value >= mintFee, "GravitonINFT: insufficient mint fee");

        tokenId = _nextTokenId++;
        _safeMint(to, tokenId);

        // Store intelligent data
        for (uint256 i = 0; i < iDatas.length; i++) {
            _intelligentDatas[tokenId].push(iDatas[i]);
        }

        // Store metadata
        _creators[tokenId] = msg.sender;
        _categories[tokenId] = category;
        _storageRoots[tokenId] = _storageRoot;

        // Set default royalty to creator
        _royaltyReceivers[tokenId] = msg.sender;
        _royaltyBps[tokenId] = DEFAULT_ROYALTY_BPS;

        // Set token URI if provided
        if (bytes(uri).length > 0) {
            _setTokenURI(tokenId, uri);
        }

        // Refund excess payment
        if (msg.value > mintFee) {
            (bool success, ) = payable(msg.sender).call{value: msg.value - mintFee}("");
            require(success, "GravitonINFT: refund failed");
        }

        emit AgentMinted(tokenId, msg.sender, category, _storageRoot);
    }

    /**
     * @notice Mint without fee — restricted to MINTER_ROLE (e.g. marketplace contract).
     */
    function mintWithRole(
        address to,
        IntelligentData[] calldata iDatas,
        string calldata category,
        string calldata _storageRoot,
        string calldata uri,
        address creator
    ) external onlyRole(MINTER_ROLE) returns (uint256 tokenId) {
        require(to != address(0), "GravitonINFT: zero address");

        tokenId = _nextTokenId++;
        _safeMint(to, tokenId);

        for (uint256 i = 0; i < iDatas.length; i++) {
            _intelligentDatas[tokenId].push(iDatas[i]);
        }

        _creators[tokenId] = creator;
        _categories[tokenId] = category;
        _storageRoots[tokenId] = _storageRoot;
        _royaltyReceivers[tokenId] = creator;
        _royaltyBps[tokenId] = DEFAULT_ROYALTY_BPS;

        if (bytes(uri).length > 0) {
            _setTokenURI(tokenId, uri);
        }

        emit AgentMinted(tokenId, creator, category, _storageRoot);
    }

    // ============================================================
    //                  ERC-7857 TRANSFER (with proof)
    // ============================================================

    /**
     * @notice Transfer an INFT with oracle-verified re-encryption proofs.
     * @dev The verifier validates that metadata was correctly re-encrypted for the receiver.
     * @param from Current owner
     * @param to New owner
     * @param tokenId Token to transfer
     * @param proofs Array of TransferValidityProof (one per IntelligentData slot)
     */
    function iTransferFrom(
        address from,
        address to,
        uint256 tokenId,
        TransferValidityProof[] calldata proofs
    ) external nonReentrant {
        require(ownerOf(tokenId) == from, "GravitonINFT: not owner");
        require(to != address(0), "GravitonINFT: zero recipient");

        // Verify proofs via oracle
        bytes[] memory sealedKeys = _verifyAndExtract(from, to, tokenId, proofs);

        // Execute standard ERC-721 transfer
        _transfer(from, to, tokenId);

        // Clear authorized users on transfer
        _clearAuthorizedUsers(tokenId);

        emit AgentTransferred(tokenId, from, to, sealedKeys);
    }

    // ============================================================
    //                     CLONE
    // ============================================================

    /**
     * @notice Clone an agent — creates a new token with the same intelligent data.
     * @param to Recipient of the cloned token
     * @param tokenId Original token to clone
     * @param proofs Re-encryption proofs for the clone recipient
     * @return newTokenId The ID of the newly created clone
     */
    function iCloneFrom(
        address to,
        uint256 tokenId,
        TransferValidityProof[] calldata proofs
    ) external nonReentrant returns (uint256 newTokenId) {
        address from = ownerOf(tokenId);
        require(
            from == msg.sender || _isUserAuthorized[tokenId][msg.sender],
            "GravitonINFT: not owner or authorized"
        );
        require(to != address(0), "GravitonINFT: zero recipient");

        // Verify proofs
        bytes[] memory sealedKeys = _verifyAndExtract(from, to, tokenId, proofs);

        // Mint new token
        newTokenId = _nextTokenId++;
        _safeMint(to, newTokenId);

        // Copy intelligent data
        IntelligentData[] storage originalDatas = _intelligentDatas[tokenId];
        for (uint256 i = 0; i < originalDatas.length; i++) {
            _intelligentDatas[newTokenId].push(originalDatas[i]);
        }

        // Copy metadata
        _creators[newTokenId] = _creators[tokenId];
        _categories[newTokenId] = _categories[tokenId];
        _storageRoots[newTokenId] = _storageRoots[tokenId];
        _royaltyReceivers[newTokenId] = _creators[tokenId];
        _royaltyBps[newTokenId] = DEFAULT_ROYALTY_BPS;

        emit AgentCloned(tokenId, newTokenId, to);
        emit AgentTransferred(newTokenId, address(0), to, sealedKeys);
    }

    // ============================================================
    //                   AUTHORIZED USAGE
    // ============================================================

    /**
     * @notice Grant inference/usage rights to an address without transferring ownership.
     * @param tokenId Token to authorize
     * @param user Address to authorize
     */
    function authorizeUsage(uint256 tokenId, address user) external {
        address owner = ownerOf(tokenId);
        require(
            owner == msg.sender ||
            getApproved(tokenId) == msg.sender ||
            isApprovedForAll(owner, msg.sender),
            "GravitonINFT: not owner or approved"
        );
        require(user != address(0), "GravitonINFT: zero user");
        require(!_isUserAuthorized[tokenId][user], "GravitonINFT: already authorized");
        require(
            _authorizedUsers[tokenId].length < MAX_AUTHORIZED_USERS,
            "GravitonINFT: max users reached"
        );

        _authorizedUsers[tokenId].push(user);
        _isUserAuthorized[tokenId][user] = true;

        emit UsageAuthorized(tokenId, msg.sender, user);
    }

    /**
     * @notice Revoke usage rights from an address.
     */
    function revokeAuthorization(uint256 tokenId, address user) external {
        address owner = ownerOf(tokenId);
        require(
            owner == msg.sender ||
            getApproved(tokenId) == msg.sender ||
            isApprovedForAll(owner, msg.sender),
            "GravitonINFT: not owner or approved"
        );
        require(_isUserAuthorized[tokenId][user], "GravitonINFT: not authorized");

        _isUserAuthorized[tokenId][user] = false;

        // Remove from array
        address[] storage users = _authorizedUsers[tokenId];
        for (uint256 i = 0; i < users.length; i++) {
            if (users[i] == user) {
                users[i] = users[users.length - 1];
                users.pop();
                break;
            }
        }

        emit UsageRevoked(tokenId, msg.sender, user);
    }

    /**
     * @notice Get all authorized users for a token.
     */
    function authorizedUsersOf(uint256 tokenId) external view returns (address[] memory) {
        require(_ownerOf(tokenId) != address(0), "GravitonINFT: nonexistent token");
        return _authorizedUsers[tokenId];
    }

    /**
     * @notice Check if an address is authorized to use a token.
     */
    function isAuthorizedUser(uint256 tokenId, address user) external view returns (bool) {
        return _isUserAuthorized[tokenId][user];
    }

    // ============================================================
    //                    DATA UPDATE
    // ============================================================

    /**
     * @notice Update the intelligent data of a token (owner only).
     * @dev Used when agent memory or weights are updated.
     */
    function updateIntelligentData(
        uint256 tokenId,
        IntelligentData[] calldata newDatas
    ) external {
        require(ownerOf(tokenId) == msg.sender, "GravitonINFT: not owner");
        require(newDatas.length > 0, "GravitonINFT: empty data");

        IntelligentData[] memory oldDatas = _intelligentDatas[tokenId];

        delete _intelligentDatas[tokenId];
        for (uint256 i = 0; i < newDatas.length; i++) {
            _intelligentDatas[tokenId].push(newDatas[i]);
        }

        emit IntelligentDataUpdated(tokenId, oldDatas, newDatas);
    }

    /**
     * @notice Update the 0G Storage root hash for an agent.
     */
    function updateStorageRoot(uint256 tokenId, string calldata newRoot) external {
        require(ownerOf(tokenId) == msg.sender, "GravitonINFT: not owner");
        _storageRoots[tokenId] = newRoot;
    }

    // ============================================================
    //                       VIEWS
    // ============================================================

    /**
     * @notice Get intelligent data attached to a token.
     */
    function intelligentDatasOf(uint256 tokenId) external view returns (IntelligentData[] memory) {
        require(_ownerOf(tokenId) != address(0), "GravitonINFT: nonexistent token");
        return _intelligentDatas[tokenId];
    }

    /**
     * @notice Get the original creator of a token (persists through transfers).
     */
    function creatorOf(uint256 tokenId) external view returns (address) {
        require(_ownerOf(tokenId) != address(0), "GravitonINFT: nonexistent token");
        return _creators[tokenId];
    }

    /**
     * @notice Get the 0G Storage root hash for an agent.
     */
    function storageRootOf(uint256 tokenId) external view returns (string memory) {
        require(_ownerOf(tokenId) != address(0), "GravitonINFT: nonexistent token");
        return _storageRoots[tokenId];
    }

    /**
     * @notice Get the category of an agent.
     */
    function categoryOf(uint256 tokenId) external view returns (string memory) {
        require(_ownerOf(tokenId) != address(0), "GravitonINFT: nonexistent token");
        return _categories[tokenId];
    }

    /**
     * @notice Get the total number of minted tokens.
     */
    function totalMinted() external view returns (uint256) {
        return _nextTokenId - 1;
    }

    // ============================================================
    //                     ERC-2981 ROYALTIES
    // ============================================================

    /**
     * @notice ERC-2981 royalty info.
     */
    function royaltyInfo(
        uint256 tokenId,
        uint256 salePrice
    ) external view override returns (address receiver, uint256 royaltyAmount) {
        receiver = _royaltyReceivers[tokenId];
        if (receiver == address(0)) {
            receiver = _creators[tokenId];
        }
        royaltyAmount = (salePrice * _royaltyBps[tokenId]) / 10000;
    }

    /**
     * @notice Set custom royalty for a token (creator or admin only).
     */
    function setRoyalty(uint256 tokenId, address receiver, uint96 bps) external {
        require(
            _creators[tokenId] == msg.sender || hasRole(ADMIN_ROLE, msg.sender),
            "GravitonINFT: not creator or admin"
        );
        require(bps <= 1000, "GravitonINFT: royalty too high"); // Max 10%
        _royaltyReceivers[tokenId] = receiver;
        _royaltyBps[tokenId] = bps;
    }

    // ============================================================
    //                    ADMIN FUNCTIONS
    // ============================================================

    /**
     * @notice Update the verifier contract address.
     */
    function setVerifier(address _newVerifier) external onlyRole(ADMIN_ROLE) {
        require(_newVerifier != address(0), "GravitonINFT: zero verifier");
        address old = address(verifier);
        verifier = IERC7857DataVerifier(_newVerifier);
        emit VerifierUpdated(old, _newVerifier);
    }

    /**
     * @notice Update the mint fee.
     */
    function setMintFee(uint256 _newFee) external onlyRole(ADMIN_ROLE) {
        uint256 old = mintFee;
        mintFee = _newFee;
        emit MintFeeUpdated(old, _newFee);
    }

    /**
     * @notice Withdraw accumulated mint fees.
     */
    function withdrawFees() external onlyRole(ADMIN_ROLE) {
        uint256 balance = address(this).balance;
        require(balance > 0, "GravitonINFT: no fees");
        (bool success, ) = payable(msg.sender).call{value: balance}("");
        require(success, "GravitonINFT: withdraw failed");
    }

    /**
     * @notice Grant MINTER_ROLE to a trusted contract (e.g. marketplace).
     */
    function grantMinterRole(address minter) external onlyRole(ADMIN_ROLE) {
        _grantRole(MINTER_ROLE, minter);
    }

    // ============================================================
    //                     INTERNAL HELPERS
    // ============================================================

    /**
     * @dev Verify transfer proofs and extract sealed keys.
     */
    function _verifyAndExtract(
        address /* from */,
        address /* to */,
        uint256 tokenId,
        TransferValidityProof[] calldata proofs
    ) internal returns (bytes[] memory sealedKeys) {
        require(proofs.length > 0, "GravitonINFT: empty proofs");

        IntelligentData[] storage datas = _intelligentDatas[tokenId];
        require(proofs.length == datas.length, "GravitonINFT: proof count mismatch");

        TransferValidityProofOutput[] memory outputs = verifier.verifyTransferValidity(proofs);
        require(outputs.length == datas.length, "GravitonINFT: output count mismatch");

        sealedKeys = new bytes[](outputs.length);
        for (uint256 i = 0; i < outputs.length; i++) {
            // Verify data hash matches the stored intelligent data
            require(
                outputs[i].dataHash == datas[i].dataHash,
                "GravitonINFT: data hash mismatch"
            );
            sealedKeys[i] = outputs[i].sealedKey;

            // Update the data hash to the new encrypted version
            datas[i].dataHash = outputs[i].dataHash;
        }
    }

    /**
     * @dev Clear all authorized users when a token is transferred.
     */
    function _clearAuthorizedUsers(uint256 tokenId) internal {
        address[] storage users = _authorizedUsers[tokenId];
        for (uint256 i = 0; i < users.length; i++) {
            _isUserAuthorized[tokenId][users[i]] = false;
        }
        delete _authorizedUsers[tokenId];
    }

    // ============================================================
    //                 REQUIRED OVERRIDES
    // ============================================================

    function _update(
        address to,
        uint256 tokenId,
        address auth
    ) internal override(ERC721, ERC721Enumerable) returns (address) {
        return super._update(to, tokenId, auth);
    }

    function _increaseBalance(
        address account,
        uint128 value
    ) internal override(ERC721, ERC721Enumerable) {
        super._increaseBalance(account, value);
    }

    function tokenURI(
        uint256 tokenId
    ) public view override(ERC721, ERC721URIStorage) returns (string memory) {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(
        bytes4 interfaceId
    ) public view override(ERC721, ERC721Enumerable, ERC721URIStorage, AccessControl, IERC165) returns (bool) {
        return
            interfaceId == type(IERC2981).interfaceId ||
            super.supportsInterface(interfaceId);
    }
}
