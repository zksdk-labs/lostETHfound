// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IVerifier, IQuestionVerifier} from "./IVerifier.sol";

/// @notice Mock verifier for testing tagged flow - always returns true
contract VerifierMock is IVerifier {
    function verifyProof(uint256[2] calldata, uint256[2][2] calldata, uint256[2] calldata, uint256[2] calldata)
        external
        pure
        override
        returns (bool)
    {
        return true;
    }
}

/// @notice Mock verifier for testing question flow - always returns true
contract QuestionVerifierMock is IQuestionVerifier {
    function verifyProof(uint256[2] calldata, uint256[2][2] calldata, uint256[2] calldata, uint256[8] calldata)
        external
        pure
        override
        returns (bool)
    {
        return true;
    }
}
