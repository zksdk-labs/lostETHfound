// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IVerifier} from "./IVerifier.sol";

contract LostETHFound {
    struct Item {
        address owner;
        bytes encryptedContact;
        uint256 reward;
        bool claimed;
    }

    IVerifier public immutable verifier;
    uint256 public immutable claimBond;

    mapping(bytes32 => Item) public items;
    mapping(bytes32 => bool) public nullifierUsed;

    event ItemRegistered(bytes32 indexed commitment, address indexed owner, uint256 reward);
    event Claimed(bytes32 indexed commitment, bytes32 indexed nullifier, address indexed payout);

    constructor(address verifierAddress, uint256 claimBondWei) {
        require(verifierAddress != address(0), "verifier required");
        verifier = IVerifier(verifierAddress);
        claimBond = claimBondWei;
    }

    function registerItem(
        bytes32 commitment,
        bytes calldata encryptedContact,
        uint256 rewardWei
    ) external payable {
        require(commitment != bytes32(0), "commitment required");
        require(items[commitment].owner == address(0), "already registered");
        require(msg.value == rewardWei, "reward mismatch");

        items[commitment] = Item({
            owner: msg.sender,
            encryptedContact: encryptedContact,
            reward: rewardWei,
            claimed: false
        });

        emit ItemRegistered(commitment, msg.sender, rewardWei);
    }

    function claim(
        bytes32 commitment,
        bytes32 nullifier,
        address payout,
        uint256[2] calldata pA,
        uint256[2][2] calldata pB,
        uint256[2] calldata pC,
        uint256[2] calldata publicSignals
    ) external payable {
        require(payout != address(0), "payout required");
        require(items[commitment].owner != address(0), "not registered");
        require(!items[commitment].claimed, "already claimed");
        require(!nullifierUsed[nullifier], "nullifier used");

        if (claimBond > 0) {
            require(msg.value == claimBond, "bond required");
        } else {
            require(msg.value == 0, "no bond required");
        }

        require(publicSignals[0] == uint256(commitment), "commitment mismatch");
        require(publicSignals[1] == uint256(nullifier), "nullifier mismatch");

        bool ok = verifier.verifyProof(pA, pB, pC, publicSignals);
        require(ok, "invalid proof");

        nullifierUsed[nullifier] = true;
        items[commitment].claimed = true;

        uint256 reward = items[commitment].reward;
        items[commitment].reward = 0;

        if (reward > 0) {
            (bool sent, ) = payout.call{value: reward}("");
            require(sent, "reward transfer failed");
        }

        if (claimBond > 0) {
            (bool bondSent, ) = payout.call{value: claimBond}("");
            require(bondSent, "bond transfer failed");
        }

        emit Claimed(commitment, nullifier, payout);
    }
}
