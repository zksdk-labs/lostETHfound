const path = require("path");
const fs = require("fs");
const { expect } = require("chai");
const { ethers } = require("hardhat");
const snarkjs = require("snarkjs");
const { buildPoseidon } = require("circomlibjs");

function parseCallData(calldata) {
  const argv = calldata
    .replace(/\[|\]|\s|"/g, "")
    .split(",")
    .filter(Boolean);

  const pA = [argv[0], argv[1]];
  const pB = [
    [argv[2], argv[3]],
    [argv[4], argv[5]],
  ];
  const pC = [argv[6], argv[7]];
  const publicSignals = argv.slice(8);

  return { pA, pB, pC, publicSignals };
}

describe("LostETHFound (e2e)", function () {
  this.timeout(120000);

  const BUILD_DIR = path.join(__dirname, "..", "circuits", "build");

  function checkArtifacts(circuitName) {
    const wasmPath = path.join(
      BUILD_DIR,
      `${circuitName}_js`,
      `${circuitName}.wasm`
    );
    const zkeyPath = path.join(BUILD_DIR, `${circuitName}_0001.zkey`);

    if (!fs.existsSync(wasmPath) || !fs.existsSync(zkeyPath)) {
      throw new Error(
        `Missing ZK artifacts for ${circuitName}. Run \`bun run zk:build\` first.`
      );
    }

    return { wasmPath, zkeyPath };
  }

  describe("Tagged Flow", function () {
    it("verifies a real Groth16 proof on-chain", async function () {
      const { wasmPath, zkeyPath } = checkArtifacts("LOSTETHFOUND");

      const [owner, finder] = await ethers.getSigners();

      // Deploy real verifier (use fully qualified name)
      const Verifier = await ethers.getContractFactory(
        "contracts/Verifier.sol:Groth16Verifier"
      );
      const verifier = await Verifier.deploy();
      await verifier.waitForDeployment();

      // Deploy question verifier too
      const QuestionVerifier = await ethers.getContractFactory(
        "contracts/QuestionVerifier.sol:Groth16Verifier"
      );
      const questionVerifier = await QuestionVerifier.deploy();
      await questionVerifier.waitForDeployment();

      // Deploy main contract
      const LostETHFound = await ethers.getContractFactory("LostETHFound");
      const lost = await LostETHFound.deploy(
        await verifier.getAddress(),
        await questionVerifier.getAddress()
      );
      await lost.waitForDeployment();

      // Generate ZK proof
      const secret = 123456789n;
      const categoryId = 111n;
      const itemIdSalt = 0n;
      const claimId = 999n;

      const poseidon = await buildPoseidon();
      const commitmentValue = poseidon.F.toObject(
        poseidon([secret, categoryId, itemIdSalt])
      );
      const nullifierValue = poseidon.F.toObject(poseidon([secret, claimId]));

      const input = {
        secret: secret.toString(),
        categoryId: categoryId.toString(),
        itemIdSalt: itemIdSalt.toString(),
        claimId: claimId.toString(),
        commitment: commitmentValue.toString(),
        nullifier: nullifierValue.toString(),
      };

      const { proof, publicSignals } = await snarkjs.groth16.fullProve(
        input,
        wasmPath,
        zkeyPath
      );

      const calldata = await snarkjs.groth16.exportSolidityCallData(
        proof,
        publicSignals
      );

      const {
        pA,
        pB,
        pC,
        publicSignals: callSignals,
      } = parseCallData(calldata);

      const commitment = ethers.toBeHex(callSignals[0], 32);
      const nullifier = ethers.toBeHex(callSignals[1], 32);
      const categoryIdBytes32 = ethers.toBeHex(categoryId, 32);
      const encryptedContact = ethers.toUtf8Bytes(
        "encrypted:contact@email.com"
      );

      const reward = ethers.parseEther("0.01");

      // Register item
      await expect(
        lost
          .connect(owner)
          .registerTagged(commitment, categoryIdBytes32, encryptedContact, {
            value: reward,
          })
      ).to.emit(lost, "ItemRegistered");

      // Claim with ZK proof
      const finderBalanceBefore = await ethers.provider.getBalance(
        finder.address
      );

      const tx = await lost
        .connect(finder)
        .claimTagged(commitment, nullifier, pA, pB, pC, callSignals);

      const receipt = await tx.wait();
      const gasUsed = receipt.gasUsed * receipt.gasPrice;

      await expect(tx).to.emit(lost, "ItemClaimed");
      await expect(tx).to.emit(lost, "ItemStatusChanged").withArgs(1, 2); // Returned

      // Check item state
      const item = await lost.getItem(1);
      expect(item.status).to.equal(2); // Returned
      expect(item.finder).to.equal(finder.address);

      // Check reward transferred
      const finderBalanceAfter = await ethers.provider.getBalance(
        finder.address
      );
      expect(finderBalanceAfter).to.equal(
        finderBalanceBefore + reward - gasUsed
      );

      // Check badge minted
      expect(await lost.ownerOf(1000001)).to.equal(finder.address);
      expect(await lost.isBadge(1000001)).to.equal(true);
    });
  });

  describe("Untagged Flow", function () {
    it("verifies a real QuestionPackProof on-chain", async function () {
      const { wasmPath, zkeyPath } = checkArtifacts("QuestionPackProof");

      const [owner, finder] = await ethers.getSigners();

      // Deploy verifiers
      const Verifier = await ethers.getContractFactory(
        "contracts/Verifier.sol:Groth16Verifier"
      );
      const verifier = await Verifier.deploy();
      await verifier.waitForDeployment();

      const QuestionVerifier = await ethers.getContractFactory(
        "contracts/QuestionVerifier.sol:Groth16Verifier"
      );
      const questionVerifier = await QuestionVerifier.deploy();
      await questionVerifier.waitForDeployment();

      // Deploy main contract
      const LostETHFound = await ethers.getContractFactory("LostETHFound");
      const lost = await LostETHFound.deploy(
        await verifier.getAddress(),
        await questionVerifier.getAddress()
      );
      await lost.waitForDeployment();

      const poseidon = await buildPoseidon();

      // Generate answer hashes: Poseidon(index, answer)
      const answers = [42n, 100n, 256n, 999n, 12345n];
      const answerHashes = answers.map((answer, i) => {
        const hash = poseidon.F.toObject(poseidon([BigInt(i), answer]));
        return ethers.toBeHex(hash, 32);
      });

      const threshold = 3;
      // Use a packId that won't be reduced by BN254 field (smaller than the prime)
      const packIdValue = 123456789n;
      const packId = ethers.toBeHex(packIdValue, 32);
      const categoryId = ethers.keccak256(ethers.toUtf8Bytes("laptop"));
      const encryptedContact = ethers.toUtf8Bytes("encrypted:owner@email.com");
      const reward = ethers.parseEther("0.05");

      // Register untagged item
      await expect(
        lost
          .connect(owner)
          .registerUntagged(
            packId,
            categoryId,
            answerHashes,
            threshold,
            encryptedContact,
            { value: reward }
          )
      ).to.emit(lost, "QuestionPackCreated");

      // Generate ZK proof with correct answers
      const input = {
        answers: answers.map((a) => a.toString()),
        answerHashes: answerHashes.map((h) => BigInt(h).toString()),
        threshold: threshold.toString(),
        packId: packIdValue.toString(),
      };

      const { proof, publicSignals } = await snarkjs.groth16.fullProve(
        input,
        wasmPath,
        zkeyPath
      );

      const calldata = await snarkjs.groth16.exportSolidityCallData(
        proof,
        publicSignals
      );

      const {
        pA,
        pB,
        pC,
        publicSignals: callSignals,
      } = parseCallData(calldata);

      // Verify public signals format: [valid, answerHashes[5], threshold, packId] (snarkjs order)
      expect(callSignals.length).to.equal(8);
      expect(BigInt(callSignals[0])).to.equal(1n); // valid = 1 (first in snarkjs output)

      // Claim with ZK proof
      const finderBalanceBefore = await ethers.provider.getBalance(
        finder.address
      );

      const tx = await lost
        .connect(finder)
        .claimUntagged(packId, pA, pB, pC, callSignals);

      const receipt = await tx.wait();
      const gasUsed = receipt.gasUsed * receipt.gasPrice;

      await expect(tx).to.emit(lost, "ItemClaimed");
      await expect(tx).to.emit(lost, "ItemStatusChanged").withArgs(1, 2); // Returned

      // Check item state
      const item = await lost.getItem(1);
      expect(item.status).to.equal(2); // Returned
      expect(item.finder).to.equal(finder.address);

      // Check reward transferred
      const finderBalanceAfter = await ethers.provider.getBalance(
        finder.address
      );
      expect(finderBalanceAfter).to.equal(
        finderBalanceBefore + reward - gasUsed
      );

      // Check badge minted
      expect(await lost.ownerOf(1000001)).to.equal(finder.address);
    });

    it("rejects proof with wrong answer hashes (security fix)", async function () {
      const { wasmPath, zkeyPath } = checkArtifacts("QuestionPackProof");

      const [owner, finder, attacker] = await ethers.getSigners();

      // Deploy verifiers
      const Verifier = await ethers.getContractFactory(
        "contracts/Verifier.sol:Groth16Verifier"
      );
      const verifier = await Verifier.deploy();
      await verifier.waitForDeployment();

      const QuestionVerifier = await ethers.getContractFactory(
        "contracts/QuestionVerifier.sol:Groth16Verifier"
      );
      const questionVerifier = await QuestionVerifier.deploy();
      await questionVerifier.waitForDeployment();

      // Deploy main contract
      const LostETHFound = await ethers.getContractFactory("LostETHFound");
      const lost = await LostETHFound.deploy(
        await verifier.getAddress(),
        await questionVerifier.getAddress()
      );
      await lost.waitForDeployment();

      const poseidon = await buildPoseidon();

      // Owner's real answers (attacker doesn't know these)
      const ownerAnswers = [42n, 100n, 256n, 999n, 12345n];
      const ownerAnswerHashes = ownerAnswers.map((answer, i) => {
        const hash = poseidon.F.toObject(poseidon([BigInt(i), answer]));
        return ethers.toBeHex(hash, 32);
      });

      // Attacker's fake easy answers
      const attackerAnswers = [1n, 1n, 1n, 1n, 1n];
      const attackerAnswerHashes = attackerAnswers.map((answer, i) => {
        const hash = poseidon.F.toObject(poseidon([BigInt(i), answer]));
        return ethers.toBeHex(hash, 32);
      });

      const threshold = 3;
      // Use a packId that won't be reduced by BN254 field (smaller than the prime)
      const packIdValue = 987654321n;
      const packId = ethers.toBeHex(packIdValue, 32);
      const categoryId = ethers.keccak256(ethers.toUtf8Bytes("laptop"));
      const encryptedContact = ethers.toUtf8Bytes("encrypted:owner@email.com");
      const reward = ethers.parseEther("1.0"); // High reward target

      // Owner registers item with REAL answer hashes
      await lost
        .connect(owner)
        .registerUntagged(
          packId,
          categoryId,
          ownerAnswerHashes,
          threshold,
          encryptedContact,
          { value: reward }
        );

      // Attacker generates valid proof for THEIR OWN easy answers
      const attackerInput = {
        answers: attackerAnswers.map((a) => a.toString()),
        answerHashes: attackerAnswerHashes.map((h) => BigInt(h).toString()),
        threshold: threshold.toString(),
        packId: packIdValue.toString(),
      };

      const { proof, publicSignals } = await snarkjs.groth16.fullProve(
        attackerInput,
        wasmPath,
        zkeyPath
      );

      const calldata = await snarkjs.groth16.exportSolidityCallData(
        proof,
        publicSignals
      );

      const {
        pA,
        pB,
        pC,
        publicSignals: callSignals,
      } = parseCallData(calldata);

      // The proof is mathematically valid for attacker's answers
      expect(BigInt(callSignals[0])).to.equal(1n); // valid = 1 (first in snarkjs output)

      // But the contract should reject it because answer hashes don't match stored hashes
      await expect(
        lost.connect(attacker).claimUntagged(packId, pA, pB, pC, callSignals)
      ).to.be.revertedWith("answer hash mismatch");
    });
  });
});
