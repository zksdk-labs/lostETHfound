const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("LostETHFound", function () {
  let verifier;
  let questionVerifier;
  let lost;
  let owner;
  let finder;

  beforeEach(async function () {
    [owner, finder] = await ethers.getSigners();

    const VerifierMock = await ethers.getContractFactory("VerifierMock");
    verifier = await VerifierMock.deploy();
    await verifier.waitForDeployment();

    const QuestionVerifierMock = await ethers.getContractFactory(
      "QuestionVerifierMock"
    );
    questionVerifier = await QuestionVerifierMock.deploy();
    await questionVerifier.waitForDeployment();

    const LostETHFound = await ethers.getContractFactory("LostETHFound");
    lost = await LostETHFound.deploy(
      await verifier.getAddress(),
      await questionVerifier.getAddress()
    );
    await lost.waitForDeployment();
  });

  describe("ERC-721 Basics", function () {
    it("has correct name and symbol", async function () {
      expect(await lost.name()).to.equal("LostETHFound Ownership");
      expect(await lost.symbol()).to.equal("LOST");
    });
  });

  describe("Tagged Flow", function () {
    const commitment = ethers.keccak256(
      ethers.toUtf8Bytes("secret-serial-123")
    );
    const categoryId = ethers.keccak256(ethers.toUtf8Bytes("laptop"));
    const nullifier = ethers.keccak256(ethers.toUtf8Bytes("claim-nullifier-1"));
    const encryptedContact = ethers.toUtf8Bytes("encrypted:owner@email.com");
    const reward = ethers.parseEther("0.05");

    it("registers a tagged item and mints NFT", async function () {
      const tx = await lost
        .connect(owner)
        .registerTagged(commitment, categoryId, encryptedContact, {
          value: reward,
        });

      await expect(tx)
        .to.emit(lost, "ItemRegistered")
        .withArgs(1, owner.address, commitment, categoryId, reward, true);

      // Check NFT ownership
      expect(await lost.ownerOf(1)).to.equal(owner.address);
      expect(await lost.balanceOf(owner.address)).to.equal(1);

      // Check item data
      const item = await lost.getItem(1);
      expect(item.commitment).to.equal(commitment);
      expect(item.categoryId).to.equal(categoryId);
      expect(item.threshold).to.equal(0);
      expect(item.reward).to.equal(reward);
      expect(item.status).to.equal(0); // Active
      expect(item.finder).to.equal(ethers.ZeroAddress);
      expect(item.isTagged).to.equal(true);

      // Check lookup
      expect(await lost.byCommitment(commitment)).to.equal(1);
    });

    it("prevents duplicate commitment registration", async function () {
      await lost
        .connect(owner)
        .registerTagged(commitment, categoryId, encryptedContact, {
          value: reward,
        });

      await expect(
        lost
          .connect(owner)
          .registerTagged(commitment, categoryId, encryptedContact, {
            value: reward,
          })
      ).to.be.revertedWith("already registered");
    });

    it("claims tagged item with ZK proof and mints badge", async function () {
      await lost
        .connect(owner)
        .registerTagged(commitment, categoryId, encryptedContact, {
          value: reward,
        });

      const pA = [0, 0];
      const pB = [
        [0, 0],
        [0, 0],
      ];
      const pC = [0, 0];
      const publicSignals = [BigInt(commitment), BigInt(nullifier)];

      const finderBalanceBefore = await ethers.provider.getBalance(
        finder.address
      );

      const tx = await lost
        .connect(finder)
        .claimTagged(commitment, nullifier, pA, pB, pC, publicSignals);

      const receipt = await tx.wait();
      const gasUsed = receipt.gasUsed * receipt.gasPrice;

      // Check events
      await expect(tx)
        .to.emit(lost, "ItemClaimed")
        .withArgs(1, finder.address, reward, 1000001);

      await expect(tx).to.emit(lost, "ItemStatusChanged").withArgs(1, 2); // Status.Returned

      // Check item status updated
      const item = await lost.getItem(1);
      expect(item.status).to.equal(2); // Returned
      expect(item.finder).to.equal(finder.address);
      expect(item.reward).to.equal(0);

      // Check reward transferred
      const finderBalanceAfter = await ethers.provider.getBalance(
        finder.address
      );
      expect(finderBalanceAfter).to.equal(
        finderBalanceBefore + reward - gasUsed
      );

      // Check badge minted to finder
      expect(await lost.ownerOf(1000001)).to.equal(finder.address);
      expect(await lost.isBadge(1000001)).to.equal(true);

      // Check badge data
      const badge = await lost.getBadge(1000001);
      expect(badge.originalItemId).to.equal(1);
      expect(badge.categoryId).to.equal(categoryId);
      expect(badge.rewardEarned).to.equal(reward);
    });

    it("prevents double claim with same nullifier", async function () {
      // Register two items to test nullifier reuse
      const commitment2 = ethers.keccak256(
        ethers.toUtf8Bytes("secret-serial-456")
      );

      await lost
        .connect(owner)
        .registerTagged(commitment, categoryId, encryptedContact, {
          value: reward,
        });

      await lost
        .connect(owner)
        .registerTagged(commitment2, categoryId, encryptedContact, {
          value: reward,
        });

      const pA = [0, 0];
      const pB = [
        [0, 0],
        [0, 0],
      ];
      const pC = [0, 0];
      const publicSignals = [BigInt(commitment), BigInt(nullifier)];

      // Claim first item
      await lost
        .connect(finder)
        .claimTagged(commitment, nullifier, pA, pB, pC, publicSignals);

      // Try to claim second item with same nullifier
      const publicSignals2 = [BigInt(commitment2), BigInt(nullifier)];
      await expect(
        lost
          .connect(finder)
          .claimTagged(commitment2, nullifier, pA, pB, pC, publicSignals2)
      ).to.be.revertedWith("already claimed");
    });

    it("prevents claiming already returned item", async function () {
      await lost
        .connect(owner)
        .registerTagged(commitment, categoryId, encryptedContact, {
          value: reward,
        });

      const pA = [0, 0];
      const pB = [
        [0, 0],
        [0, 0],
      ];
      const pC = [0, 0];
      const publicSignals = [BigInt(commitment), BigInt(nullifier)];

      await lost
        .connect(finder)
        .claimTagged(commitment, nullifier, pA, pB, pC, publicSignals);

      // Try with a different nullifier
      const nullifier2 = ethers.keccak256(
        ethers.toUtf8Bytes("claim-nullifier-2")
      );
      const publicSignals2 = [BigInt(commitment), BigInt(nullifier2)];

      await expect(
        lost
          .connect(finder)
          .claimTagged(commitment, nullifier2, pA, pB, pC, publicSignals2)
      ).to.be.revertedWith("already returned");
    });
  });

  describe("Untagged Flow", function () {
    const packId = ethers.keccak256(ethers.toUtf8Bytes("pack-laptop-answers"));
    const categoryId = ethers.keccak256(ethers.toUtf8Bytes("laptop"));
    const encryptedContact = ethers.toUtf8Bytes("encrypted:owner@email.com");
    const reward = ethers.parseEther("0.1");

    // 5 answer hashes
    const answerHashes = [
      ethers.keccak256(ethers.toUtf8Bytes("answer-0")),
      ethers.keccak256(ethers.toUtf8Bytes("answer-1")),
      ethers.keccak256(ethers.toUtf8Bytes("answer-2")),
      ethers.keccak256(ethers.toUtf8Bytes("answer-3")),
      ethers.keccak256(ethers.toUtf8Bytes("answer-4")),
    ];
    const threshold = 3;

    it("registers an untagged item with question pack", async function () {
      const tx = await lost
        .connect(owner)
        .registerUntagged(
          packId,
          categoryId,
          answerHashes,
          threshold,
          encryptedContact,
          { value: reward }
        );

      await expect(tx)
        .to.emit(lost, "ItemRegistered")
        .withArgs(1, owner.address, ethers.ZeroHash, categoryId, reward, false);

      await expect(tx)
        .to.emit(lost, "QuestionPackCreated")
        .withArgs(1, packId, owner.address, categoryId, threshold, reward);

      // Check NFT ownership
      expect(await lost.ownerOf(1)).to.equal(owner.address);

      // Check item data
      const item = await lost.getItem(1);
      expect(item.commitment).to.equal(ethers.ZeroHash);
      expect(item.categoryId).to.equal(categoryId);
      expect(item.threshold).to.equal(threshold);
      expect(item.reward).to.equal(reward);
      expect(item.status).to.equal(0); // Active
      expect(item.isTagged).to.equal(false);

      // Check answer hashes
      const storedHashes = await lost.getAnswerHashes(1);
      expect(storedHashes.length).to.equal(5);
      for (let i = 0; i < 5; i++) {
        expect(storedHashes[i]).to.equal(answerHashes[i]);
      }

      // Check lookup
      expect(await lost.byPackId(packId)).to.equal(1);
    });

    it("prevents duplicate pack registration", async function () {
      await lost
        .connect(owner)
        .registerUntagged(
          packId,
          categoryId,
          answerHashes,
          threshold,
          encryptedContact,
          { value: reward }
        );

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
      ).to.be.revertedWith("pack exists");
    });

    it("requires threshold > 0", async function () {
      await expect(
        lost.connect(owner).registerUntagged(
          packId,
          categoryId,
          answerHashes,
          0, // invalid threshold
          encryptedContact,
          { value: reward }
        )
      ).to.be.revertedWith("threshold required");
    });

    it("requires threshold <= answers length", async function () {
      await expect(
        lost.connect(owner).registerUntagged(
          packId,
          categoryId,
          answerHashes,
          10, // threshold > 5 answers
          encryptedContact,
          { value: reward }
        )
      ).to.be.revertedWith("threshold > answers");
    });

    it("claims untagged item with ZK proof and mints badge", async function () {
      await lost
        .connect(owner)
        .registerUntagged(
          packId,
          categoryId,
          answerHashes,
          threshold,
          encryptedContact,
          { value: reward }
        );

      const pA = [0, 0];
      const pB = [
        [0, 0],
        [0, 0],
      ];
      const pC = [0, 0];
      // publicSignals: [valid, answerHashes[5], threshold, packId] (snarkjs order)
      const publicSignals = [
        1n, // valid = 1 (threshold met)
        BigInt(answerHashes[0]),
        BigInt(answerHashes[1]),
        BigInt(answerHashes[2]),
        BigInt(answerHashes[3]),
        BigInt(answerHashes[4]),
        BigInt(threshold),
        BigInt(packId),
      ];

      const finderBalanceBefore = await ethers.provider.getBalance(
        finder.address
      );

      const tx = await lost
        .connect(finder)
        .claimUntagged(packId, pA, pB, pC, publicSignals);

      const receipt = await tx.wait();
      const gasUsed = receipt.gasUsed * receipt.gasPrice;

      // Check events
      await expect(tx)
        .to.emit(lost, "ItemClaimed")
        .withArgs(1, finder.address, reward, 1000001);

      // Check item status
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

      // Check badge
      expect(await lost.ownerOf(1000001)).to.equal(finder.address);
      expect(await lost.isBadge(1000001)).to.equal(true);
    });

    it("rejects claim when threshold not met", async function () {
      await lost
        .connect(owner)
        .registerUntagged(
          packId,
          categoryId,
          answerHashes,
          threshold,
          encryptedContact,
          { value: reward }
        );

      const pA = [0, 0];
      const pB = [
        [0, 0],
        [0, 0],
      ];
      const pC = [0, 0];
      // valid = 0 (threshold not met) - snarkjs order: [valid, hashes..., threshold, packId]
      const publicSignals = [
        0n, // valid = 0
        BigInt(answerHashes[0]),
        BigInt(answerHashes[1]),
        BigInt(answerHashes[2]),
        BigInt(answerHashes[3]),
        BigInt(answerHashes[4]),
        BigInt(threshold),
        BigInt(packId),
      ];

      await expect(
        lost.connect(finder).claimUntagged(packId, pA, pB, pC, publicSignals)
      ).to.be.revertedWith("threshold not met");
    });
  });

  describe("Status Management", function () {
    const commitment = ethers.keccak256(ethers.toUtf8Bytes("test-item"));
    const categoryId = ethers.keccak256(ethers.toUtf8Bytes("laptop"));
    const encryptedContact = ethers.toUtf8Bytes("contact");
    const reward = ethers.parseEther("0.01");

    beforeEach(async function () {
      await lost
        .connect(owner)
        .registerTagged(commitment, categoryId, encryptedContact, {
          value: reward,
        });
    });

    it("owner can mark item as lost", async function () {
      const tx = await lost.connect(owner).markAsLost(1);

      await expect(tx).to.emit(lost, "ItemStatusChanged").withArgs(1, 1); // Status.Lost

      const item = await lost.getItem(1);
      expect(item.status).to.equal(1);
    });

    it("owner can mark lost item as active again", async function () {
      await lost.connect(owner).markAsLost(1);

      const tx = await lost.connect(owner).markAsActive(1);

      await expect(tx).to.emit(lost, "ItemStatusChanged").withArgs(1, 0); // Status.Active

      const item = await lost.getItem(1);
      expect(item.status).to.equal(0);
    });

    it("non-owner cannot change status", async function () {
      await expect(lost.connect(finder).markAsLost(1)).to.be.revertedWith(
        "not owner"
      );
    });

    it("cannot mark active item as active", async function () {
      await expect(lost.connect(owner).markAsActive(1)).to.be.revertedWith(
        "not lost"
      );
    });

    it("cannot mark lost item as lost", async function () {
      await lost.connect(owner).markAsLost(1);

      await expect(lost.connect(owner).markAsLost(1)).to.be.revertedWith(
        "not active"
      );
    });
  });

  describe("Reward Management", function () {
    const commitment = ethers.keccak256(ethers.toUtf8Bytes("test-item"));
    const categoryId = ethers.keccak256(ethers.toUtf8Bytes("laptop"));
    const encryptedContact = ethers.toUtf8Bytes("contact");
    const reward = ethers.parseEther("0.01");

    beforeEach(async function () {
      await lost
        .connect(owner)
        .registerTagged(commitment, categoryId, encryptedContact, {
          value: reward,
        });
    });

    it("owner can add more reward", async function () {
      const additionalReward = ethers.parseEther("0.02");

      await lost.connect(owner).addReward(1, { value: additionalReward });

      const item = await lost.getItem(1);
      expect(item.reward).to.equal(reward + additionalReward);
    });

    it("owner can withdraw reward", async function () {
      const ownerBalanceBefore = await ethers.provider.getBalance(
        owner.address
      );

      const tx = await lost.connect(owner).withdrawReward(1);
      const receipt = await tx.wait();
      const gasUsed = receipt.gasUsed * receipt.gasPrice;

      const ownerBalanceAfter = await ethers.provider.getBalance(owner.address);
      expect(ownerBalanceAfter).to.equal(ownerBalanceBefore + reward - gasUsed);

      const item = await lost.getItem(1);
      expect(item.reward).to.equal(0);
    });

    it("non-owner cannot add reward", async function () {
      await expect(
        lost.connect(finder).addReward(1, { value: ethers.parseEther("0.01") })
      ).to.be.revertedWith("not owner");
    });

    it("non-owner cannot withdraw reward", async function () {
      await expect(lost.connect(finder).withdrawReward(1)).to.be.revertedWith(
        "not owner"
      );
    });

    it("cannot withdraw zero reward", async function () {
      await lost.connect(owner).withdrawReward(1);

      await expect(lost.connect(owner).withdrawReward(1)).to.be.revertedWith(
        "no reward to withdraw"
      );
    });
  });

  describe("Badge Soulbound", function () {
    it("badges cannot be transferred", async function () {
      const commitment = ethers.keccak256(ethers.toUtf8Bytes("test-item"));
      const categoryId = ethers.keccak256(ethers.toUtf8Bytes("laptop"));
      const nullifier = ethers.keccak256(ethers.toUtf8Bytes("nullifier"));
      const encryptedContact = ethers.toUtf8Bytes("contact");
      const reward = ethers.parseEther("0.01");

      await lost
        .connect(owner)
        .registerTagged(commitment, categoryId, encryptedContact, {
          value: reward,
        });

      const pA = [0, 0];
      const pB = [
        [0, 0],
        [0, 0],
      ];
      const pC = [0, 0];
      const publicSignals = [BigInt(commitment), BigInt(nullifier)];

      await lost
        .connect(finder)
        .claimTagged(commitment, nullifier, pA, pB, pC, publicSignals);

      // Badge is owned by finder
      expect(await lost.ownerOf(1000001)).to.equal(finder.address);

      // Try to transfer badge
      await expect(
        lost
          .connect(finder)
          .transferFrom(finder.address, owner.address, 1000001)
      ).to.be.revertedWith("badges are soulbound");
    });

    it("ownership NFTs can be transferred", async function () {
      const commitment = ethers.keccak256(ethers.toUtf8Bytes("test-item"));
      const categoryId = ethers.keccak256(ethers.toUtf8Bytes("laptop"));
      const encryptedContact = ethers.toUtf8Bytes("contact");

      await lost
        .connect(owner)
        .registerTagged(commitment, categoryId, encryptedContact);

      // Transfer ownership NFT
      await lost.connect(owner).transferFrom(owner.address, finder.address, 1);

      expect(await lost.ownerOf(1)).to.equal(finder.address);
    });
  });

  describe("Token URI", function () {
    it("returns valid metadata for items", async function () {
      const commitment = ethers.keccak256(ethers.toUtf8Bytes("test-item"));
      const categoryId = ethers.keccak256(ethers.toUtf8Bytes("laptop"));
      const encryptedContact = ethers.toUtf8Bytes("contact");

      await lost
        .connect(owner)
        .registerTagged(commitment, categoryId, encryptedContact, {
          value: ethers.parseEther("0.05"),
        });

      const uri = await lost.tokenURI(1);
      expect(uri).to.match(/^data:application\/json;base64,/);

      // Decode and verify JSON structure
      const json = Buffer.from(uri.split(",")[1], "base64").toString();
      const metadata = JSON.parse(json);

      expect(metadata.name).to.equal("Ownership Proof #1");
      expect(metadata.description).to.equal("ZK-verified proof of ownership");
      expect(metadata.image).to.match(/^data:image\/svg\+xml;base64,/);
      expect(metadata.attributes).to.be.an("array");
    });

    it("returns valid metadata for badges", async function () {
      const commitment = ethers.keccak256(ethers.toUtf8Bytes("test-item"));
      const categoryId = ethers.keccak256(ethers.toUtf8Bytes("laptop"));
      const nullifier = ethers.keccak256(ethers.toUtf8Bytes("nullifier"));
      const encryptedContact = ethers.toUtf8Bytes("contact");
      const reward = ethers.parseEther("0.05");

      await lost
        .connect(owner)
        .registerTagged(commitment, categoryId, encryptedContact, {
          value: reward,
        });

      const pA = [0, 0];
      const pB = [
        [0, 0],
        [0, 0],
      ];
      const pC = [0, 0];
      const publicSignals = [BigInt(commitment), BigInt(nullifier)];

      await lost
        .connect(finder)
        .claimTagged(commitment, nullifier, pA, pB, pC, publicSignals);

      const uri = await lost.tokenURI(1000001);
      const json = Buffer.from(uri.split(",")[1], "base64").toString();
      const metadata = JSON.parse(json);

      expect(metadata.name).to.equal("Good Samaritan #1000001");
      expect(metadata.description).to.equal(
        "Verified item return via ZK proof"
      );
    });
  });
});
