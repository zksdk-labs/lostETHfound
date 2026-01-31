pragma circom 2.1.5;

include "circomlib/circuits/poseidon.circom";
include "circomlib/circuits/comparators.circom";

// Proves: "I know answers where >= threshold match the committed hashes"
// Without revealing: which answers, or which ones matched
template QuestionPackProof(numQuestions) {
    // PRIVATE inputs (finder's answers as field elements)
    signal input answers[numQuestions];

    // PUBLIC inputs
    signal input answerHashes[numQuestions];  // Owner's committed hashes
    signal input threshold;                    // Minimum correct needed
    signal input packId;                       // Identifies the pack

    // PUBLIC output
    signal output valid;                       // 1 if >= threshold correct

    // Intermediate signals for counting
    signal matchResults[numQuestions];
    signal runningSum[numQuestions + 1];

    component hashers[numQuestions];
    component isEquals[numQuestions];

    // Initialize running sum
    runningSum[0] <== 0;

    for (var i = 0; i < numQuestions; i++) {
        // Hash the answer: Poseidon(index, answer)
        hashers[i] = Poseidon(2);
        hashers[i].inputs[0] <== i;
        hashers[i].inputs[1] <== answers[i];

        // Check if it matches the committed hash
        isEquals[i] = IsEqual();
        isEquals[i].in[0] <== hashers[i].out;
        isEquals[i].in[1] <== answerHashes[i];

        // Store match result (1 if match, 0 if not)
        matchResults[i] <== isEquals[i].out;

        // Add to running sum
        runningSum[i + 1] <== runningSum[i] + matchResults[i];
    }

    // Check threshold met using GreaterEqThan
    component gte = GreaterEqThan(8);  // 8 bits enough for count up to 255
    gte.in[0] <== runningSum[numQuestions];
    gte.in[1] <== threshold;

    valid <== gte.out;
}

// Fixed size: 5 questions (typical use case)
component main {public [answerHashes, threshold, packId]} = QuestionPackProof(5);
