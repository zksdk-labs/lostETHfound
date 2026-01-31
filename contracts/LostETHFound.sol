// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";
import {IVerifier, IQuestionVerifier} from "./IVerifier.sol";

contract LostETHFound is ERC721 {
    using Strings for uint256;

    enum Status {
        Active,
        Lost,
        Returned
    }

    struct Item {
        bytes32 commitment; // Poseidon(secret) for tagged
        bytes32 categoryId;
        bytes32[] answerHashes; // Poseidon(index, answer) for questions (optional for tagged)
        uint8 threshold; // e.g., 3 out of 5 (0 if no questions)
        uint256 reward;
        Status status;
        address finder;
        bool isTagged; // true = has return code, false = question-only
        bytes encryptedContact;
    }

    struct Badge {
        uint256 originalItemId;
        bytes32 categoryId;
        uint256 rewardEarned;
        uint256 returnedAt;
    }

    IVerifier public immutable verifier;
    IQuestionVerifier public immutable questionVerifier;

    uint256 private _nextTokenId;
    uint256 private _nextBadgeId;

    mapping(uint256 => Item) public items; // tokenId -> item data
    mapping(bytes32 => uint256) public byCommitment; // commitment -> tokenId (tagged lookup)
    mapping(bytes32 => uint256) public byPackId; // packId -> tokenId (untagged lookup)
    mapping(bytes32 => bool) public nullifierUsed;
    mapping(uint256 => Badge) public badges; // badgeId -> badge data
    mapping(uint256 => bool) public isBadge; // tokenId -> is it a badge?

    event ItemRegistered(
        uint256 indexed tokenId,
        address indexed owner,
        bytes32 indexed commitment,
        bytes32 categoryId,
        uint256 reward,
        bool isTagged
    );

    event ItemStatusChanged(uint256 indexed tokenId, Status status);

    event ItemClaimed(uint256 indexed tokenId, address indexed finder, uint256 reward, uint256 badgeId);

    event QuestionPackCreated(
        uint256 indexed tokenId,
        bytes32 indexed packId,
        address indexed owner,
        bytes32 categoryId,
        uint8 threshold,
        uint256 reward
    );

    constructor(address verifierAddress, address questionVerifierAddress) ERC721("LostETHFound Ownership", "LOST") {
        require(verifierAddress != address(0), "verifier required");
        verifier = IVerifier(verifierAddress);
        // Question verifier can be zero if not deployed yet
        questionVerifier = IQuestionVerifier(questionVerifierAddress);
    }

    // ============ TAGGED FLOW ============

    /// @notice Register a tagged item (has secret code)
    function registerTagged(bytes32 commitment, bytes32 categoryId, bytes calldata encryptedContact)
        external
        payable
        returns (uint256 tokenId)
    {
        require(commitment != bytes32(0), "commitment required");
        require(byCommitment[commitment] == 0, "already registered");

        tokenId = ++_nextTokenId;
        _mint(msg.sender, tokenId);

        items[tokenId] = Item({
            commitment: commitment,
            categoryId: categoryId,
            answerHashes: new bytes32[](0),
            threshold: 0,
            reward: msg.value,
            status: Status.Active,
            finder: address(0),
            isTagged: true,
            encryptedContact: encryptedContact
        });

        byCommitment[commitment] = tokenId;

        emit ItemRegistered(tokenId, msg.sender, commitment, categoryId, msg.value, true);
    }

    /// @notice Finder claims a tagged item with ZK proof
    function claimTagged(
        bytes32 commitment,
        bytes32 nullifier,
        uint256[2] calldata pA,
        uint256[2][2] calldata pB,
        uint256[2] calldata pC,
        uint256[2] calldata publicSignals
    ) external {
        uint256 tokenId = byCommitment[commitment];
        require(tokenId != 0, "not registered");

        Item storage item = items[tokenId];
        require(item.status != Status.Returned, "already returned");
        require(!nullifierUsed[nullifier], "already claimed");

        // Verify public signals match
        require(publicSignals[0] == uint256(commitment), "commitment mismatch");
        require(publicSignals[1] == uint256(nullifier), "nullifier mismatch");

        // Verify ZK proof
        bool ok = verifier.verifyProof(pA, pB, pC, publicSignals);
        require(ok, "invalid proof");

        nullifierUsed[nullifier] = true;
        item.status = Status.Returned;
        item.finder = msg.sender;

        // Send reward
        uint256 reward = item.reward;
        item.reward = 0;

        // Mint Good Samaritan badge to finder
        uint256 badgeId = _mintBadge(msg.sender, tokenId, item.categoryId, reward);

        if (reward > 0) {
            (bool sent,) = msg.sender.call{value: reward}("");
            require(sent, "reward transfer failed");
        }

        emit ItemClaimed(tokenId, msg.sender, reward, badgeId);
        emit ItemStatusChanged(tokenId, Status.Returned);
    }

    // ============ UNTAGGED FLOW ============

    /// @notice Register an untagged item (question-based)
    function registerUntagged(
        bytes32 packId,
        bytes32 categoryId,
        bytes32[] calldata answerHashes,
        uint8 threshold,
        bytes calldata encryptedContact
    ) external payable returns (uint256 tokenId) {
        require(packId != bytes32(0), "packId required");
        require(byPackId[packId] == 0, "pack exists");
        require(answerHashes.length >= threshold, "threshold > answers");
        require(threshold > 0, "threshold required");

        tokenId = ++_nextTokenId;
        _mint(msg.sender, tokenId);

        items[tokenId] = Item({
            commitment: bytes32(0),
            categoryId: categoryId,
            answerHashes: answerHashes,
            threshold: threshold,
            reward: msg.value,
            status: Status.Active,
            finder: address(0),
            isTagged: false,
            encryptedContact: encryptedContact
        });

        byPackId[packId] = tokenId;

        emit ItemRegistered(tokenId, msg.sender, bytes32(0), categoryId, msg.value, false);
        emit QuestionPackCreated(tokenId, packId, msg.sender, categoryId, threshold, msg.value);
    }

    /// @notice Finder claims an untagged item (answered questions)
    function claimUntagged(
        bytes32 packId,
        uint256[2] calldata pA,
        uint256[2][2] calldata pB,
        uint256[2] calldata pC,
        uint256[8] calldata publicSignals // answerHashes[5], threshold, packId, valid
    ) external {
        require(address(questionVerifier) != address(0), "question verifier not set");

        uint256 tokenId = byPackId[packId];
        require(tokenId != 0, "pack not found");

        Item storage item = items[tokenId];
        require(item.status != Status.Returned, "already returned");

        // Verify the proof
        bool ok = questionVerifier.verifyProof(pA, pB, pC, publicSignals);
        require(ok, "invalid proof");

        // Check that valid == 1 (threshold met)
        require(publicSignals[7] == 1, "threshold not met");

        // Verify proof is for THIS item's answer hashes
        require(item.answerHashes.length == 5, "invalid answer count");
        for (uint256 i = 0; i < 5; i++) {
            require(publicSignals[i] == uint256(item.answerHashes[i]), "answer hash mismatch");
        }
        require(publicSignals[5] == item.threshold, "threshold mismatch");
        require(publicSignals[6] == uint256(packId), "packId mismatch");

        item.status = Status.Returned;
        item.finder = msg.sender;

        uint256 reward = item.reward;
        item.reward = 0;

        // Mint Good Samaritan badge to finder
        uint256 badgeId = _mintBadge(msg.sender, tokenId, item.categoryId, reward);

        if (reward > 0) {
            (bool sent,) = msg.sender.call{value: reward}("");
            require(sent, "reward transfer failed");
        }

        emit ItemClaimed(tokenId, msg.sender, reward, badgeId);
        emit ItemStatusChanged(tokenId, Status.Returned);
    }

    // ============ STATUS MANAGEMENT ============

    /// @notice Owner marks item as lost
    function markAsLost(uint256 tokenId) external {
        require(ownerOf(tokenId) == msg.sender, "not owner");
        require(!isBadge[tokenId], "badges cannot change status");
        require(items[tokenId].status == Status.Active, "not active");

        items[tokenId].status = Status.Lost;
        emit ItemStatusChanged(tokenId, Status.Lost);
    }

    /// @notice Owner marks item as active again
    function markAsActive(uint256 tokenId) external {
        require(ownerOf(tokenId) == msg.sender, "not owner");
        require(!isBadge[tokenId], "badges cannot change status");
        require(items[tokenId].status == Status.Lost, "not lost");

        items[tokenId].status = Status.Active;
        emit ItemStatusChanged(tokenId, Status.Active);
    }

    /// @notice Owner adds more reward
    function addReward(uint256 tokenId) external payable {
        require(ownerOf(tokenId) == msg.sender, "not owner");
        require(!isBadge[tokenId], "badges have no reward");
        require(items[tokenId].status != Status.Returned, "already returned");
        require(msg.value > 0, "no reward sent");

        items[tokenId].reward += msg.value;
    }

    /// @notice Owner withdraws reward (only if not returned)
    function withdrawReward(uint256 tokenId) external {
        require(ownerOf(tokenId) == msg.sender, "not owner");
        require(!isBadge[tokenId], "badges have no reward");
        require(items[tokenId].status != Status.Returned, "already returned");

        uint256 reward = items[tokenId].reward;
        require(reward > 0, "no reward to withdraw");

        items[tokenId].reward = 0;

        (bool sent,) = msg.sender.call{value: reward}("");
        require(sent, "withdraw failed");
    }

    // ============ VIEW FUNCTIONS ============

    /// @notice Get item details
    function getItem(uint256 tokenId)
        external
        view
        returns (
            bytes32 commitment,
            bytes32 categoryId,
            uint8 threshold,
            uint256 reward,
            Status status,
            address finder,
            bool isTagged,
            bytes memory encryptedContact
        )
    {
        Item storage item = items[tokenId];
        return (
            item.commitment,
            item.categoryId,
            item.threshold,
            item.reward,
            item.status,
            item.finder,
            item.isTagged,
            item.encryptedContact
        );
    }

    /// @notice Get answer hashes for an item
    function getAnswerHashes(uint256 tokenId) external view returns (bytes32[] memory) {
        return items[tokenId].answerHashes;
    }

    /// @notice Get badge details
    function getBadge(uint256 badgeId)
        external
        view
        returns (uint256 originalItemId, bytes32 categoryId, uint256 rewardEarned, uint256 returnedAt)
    {
        require(isBadge[badgeId], "not a badge");
        Badge storage badge = badges[badgeId];
        return (badge.originalItemId, badge.categoryId, badge.rewardEarned, badge.returnedAt);
    }

    // ============ METADATA ============

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);

        if (isBadge[tokenId]) {
            return _badgeURI(tokenId);
        }
        return _itemURI(tokenId);
    }

    function _itemURI(uint256 tokenId) internal view returns (string memory) {
        Item storage item = items[tokenId];

        string memory statusStr =
            item.status == Status.Active ? "Active" : item.status == Status.Lost ? "Lost" : "Returned";
        string memory typeStr = item.isTagged ? "Tagged" : "Question-Based";
        string memory rewardStr = _formatEther(item.reward);

        string memory svg = _generateItemSVG(tokenId, statusStr, typeStr, rewardStr);

        string memory json = string(
            abi.encodePacked(
                '{"name":"Ownership Proof #',
                tokenId.toString(),
                '","description":"ZK-verified proof of ownership",',
                '"image":"data:image/svg+xml;base64,',
                Base64.encode(bytes(svg)),
                '",',
                '"attributes":[',
                '{"trait_type":"Status","value":"',
                statusStr,
                '"},',
                '{"trait_type":"Type","value":"',
                typeStr,
                '"},',
                '{"trait_type":"Reward","value":"',
                rewardStr,
                ' ETH"}',
                "]}"
            )
        );

        return string(abi.encodePacked("data:application/json;base64,", Base64.encode(bytes(json))));
    }

    function _badgeURI(uint256 badgeId) internal view returns (string memory) {
        Badge storage badge = badges[badgeId];

        string memory rewardStr = _formatEther(badge.rewardEarned);
        string memory svg = _generateBadgeSVG(badgeId, rewardStr);

        string memory json = string(
            abi.encodePacked(
                '{"name":"Good Samaritan #',
                badgeId.toString(),
                '","description":"Verified item return via ZK proof",',
                '"image":"data:image/svg+xml;base64,',
                Base64.encode(bytes(svg)),
                '",',
                '"attributes":[',
                '{"trait_type":"Reward Earned","value":"',
                rewardStr,
                ' ETH"},',
                '{"trait_type":"Original Item","value":"#',
                badge.originalItemId.toString(),
                '"}',
                "]}"
            )
        );

        return string(abi.encodePacked("data:application/json;base64,", Base64.encode(bytes(json))));
    }

    function _generateItemSVG(uint256 tokenId, string memory status, string memory itemType, string memory reward)
        internal
        pure
        returns (string memory)
    {
        return string(
            abi.encodePacked(
                '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">',
                '<defs><linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">',
                '<stop offset="0%" style="stop-color:#1a1a2e"/>',
                '<stop offset="100%" style="stop-color:#16213e"/>',
                "</linearGradient></defs>",
                '<rect width="400" height="400" fill="url(#bg)"/>',
                '<text x="200" y="60" text-anchor="middle" fill="#f0f0f0" font-family="sans-serif" font-size="24" font-weight="bold">Ownership Proof</text>',
                '<text x="200" y="100" text-anchor="middle" fill="#888" font-family="monospace" font-size="14">#',
                tokenId.toString(),
                "</text>",
                '<rect x="50" y="140" width="300" height="200" rx="20" fill="#252550" stroke="#4a4a8a" stroke-width="2"/>',
                '<text x="70" y="180" fill="#aaa" font-family="sans-serif" font-size="12">STATUS</text>',
                '<text x="70" y="205" fill="#f0f0f0" font-family="sans-serif" font-size="18">',
                status,
                "</text>",
                '<text x="70" y="250" fill="#aaa" font-family="sans-serif" font-size="12">TYPE</text>',
                '<text x="70" y="275" fill="#f0f0f0" font-family="sans-serif" font-size="18">',
                itemType,
                "</text>",
                '<text x="70" y="320" fill="#aaa" font-family="sans-serif" font-size="12">BOUNTY</text>',
                '<text x="70" y="345" fill="#00d4aa" font-family="sans-serif" font-size="18">',
                reward,
                " ETH</text>",
                '<text x="200" y="380" text-anchor="middle" fill="#555" font-family="sans-serif" font-size="10">LostETHFound</text>',
                "</svg>"
            )
        );
    }

    function _generateBadgeSVG(uint256 badgeId, string memory reward) internal pure returns (string memory) {
        return string(
            abi.encodePacked(
                '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">',
                '<defs><linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">',
                '<stop offset="0%" style="stop-color:#0d4b3e"/>',
                '<stop offset="100%" style="stop-color:#1a5f4f"/>',
                "</linearGradient></defs>",
                '<rect width="400" height="400" fill="url(#bg)"/>',
                '<text x="200" y="60" text-anchor="middle" fill="#f0f0f0" font-family="sans-serif" font-size="24" font-weight="bold">Good Samaritan</text>',
                '<text x="200" y="100" text-anchor="middle" fill="#888" font-family="monospace" font-size="14">#',
                badgeId.toString(),
                "</text>",
                '<circle cx="200" cy="200" r="60" fill="#00d4aa" opacity="0.2"/>',
                '<text x="200" y="210" text-anchor="middle" fill="#00d4aa" font-family="sans-serif" font-size="48">&#10003;</text>',
                '<text x="200" y="300" text-anchor="middle" fill="#aaa" font-family="sans-serif" font-size="12">REWARD EARNED</text>',
                '<text x="200" y="330" text-anchor="middle" fill="#00d4aa" font-family="sans-serif" font-size="24">',
                reward,
                " ETH</text>",
                '<text x="200" y="380" text-anchor="middle" fill="#555" font-family="sans-serif" font-size="10">LostETHFound</text>',
                "</svg>"
            )
        );
    }

    function _formatEther(uint256 weiAmount) internal pure returns (string memory) {
        if (weiAmount == 0) return "0";

        uint256 ethWhole = weiAmount / 1e18;
        uint256 ethFrac = (weiAmount % 1e18) / 1e14; // 4 decimal places

        if (ethFrac == 0) {
            return ethWhole.toString();
        }

        // Remove trailing zeros
        while (ethFrac > 0 && ethFrac % 10 == 0) {
            ethFrac /= 10;
        }

        return string(abi.encodePacked(ethWhole.toString(), ".", ethFrac.toString()));
    }

    // ============ INTERNAL ============

    function _mintBadge(address to, uint256 originalItemId, bytes32 categoryId, uint256 rewardEarned)
        internal
        returns (uint256 badgeId)
    {
        badgeId = ++_nextBadgeId + 1000000; // Offset to distinguish from items
        _mint(to, badgeId);

        isBadge[badgeId] = true;
        badges[badgeId] = Badge({
            originalItemId: originalItemId,
            categoryId: categoryId,
            rewardEarned: rewardEarned,
            returnedAt: block.timestamp
        });
    }

    // Badges are soulbound by default
    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        address from = _ownerOf(tokenId);

        // Allow minting (from == address(0))
        // Block transfers of badges
        if (from != address(0) && isBadge[tokenId]) {
            revert("badges are soulbound");
        }

        return super._update(to, tokenId, auth);
    }
}
