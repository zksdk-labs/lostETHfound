// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IVerifier {
    // Groth16 verifier interface for tagged flow (2 public signals)
    function verifyProof(
        uint256[2] calldata pA,
        uint256[2][2] calldata pB,
        uint256[2] calldata pC,
        uint256[2] calldata publicSignals
    ) external view returns (bool);
}

interface IQuestionVerifier {
    // Groth16 verifier interface for question flow (8 public signals)
    function verifyProof(
        uint256[2] calldata pA,
        uint256[2][2] calldata pB,
        uint256[2] calldata pC,
        uint256[8] calldata publicSignals
    ) external view returns (bool);
}
