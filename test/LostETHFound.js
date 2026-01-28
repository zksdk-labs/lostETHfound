const { expect } = require("chai");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
const { ethers } = require("hardhat");

describe("LostETHFound", function () {
  it("registers and claims with a mock verifier", async function () {
    const [owner, finder] = await ethers.getSigners();

    const VerifierMock = await ethers.getContractFactory("VerifierMock");
    const verifier = await VerifierMock.deploy();
    await verifier.waitForDeployment();

    const LostETHFound = await ethers.getContractFactory("LostETHFound");
    const lost = await LostETHFound.deploy(await verifier.getAddress(), 0);
    await lost.waitForDeployment();

    const commitment = ethers.keccak256(ethers.toUtf8Bytes("item-1"));
    const nullifier = ethers.keccak256(ethers.toUtf8Bytes("claim-1"));
    const reward = ethers.parseEther("0.01");

    await expect(
      lost.connect(owner).registerItem(commitment, "0x", reward, { value: reward })
    ).to.emit(lost, "ItemRegistered");

    const pA = [0, 0];
    const pB = [
      [0, 0],
      [0, 0]
    ];
    const pC = [0, 0];
    const publicSignals = [BigInt(commitment), BigInt(nullifier)];

    await expect(
      lost
        .connect(finder)
        .claim(commitment, nullifier, finder.address, pA, pB, pC, publicSignals)
    ).to.emit(lost, "Claimed");

    const item = await lost.items(commitment);
    expect(item.claimed).to.equal(true);
    expect(item.reward).to.equal(0n);
  });

  it("emits lost/found report events", async function () {
    const [owner, finder] = await ethers.getSigners();

    const VerifierMock = await ethers.getContractFactory("VerifierMock");
    const verifier = await VerifierMock.deploy();
    await verifier.waitForDeployment();

    const LostETHFound = await ethers.getContractFactory("LostETHFound");
    const lost = await LostETHFound.deploy(await verifier.getAddress(), 0);
    await lost.waitForDeployment();

    const categoryId = ethers.keccak256(ethers.toUtf8Bytes("electronics"));
    const contact = ethers.toUtf8Bytes("contact:demo");
    const hints = ethers.toUtf8Bytes("color:black;location:cafe");
    const message = ethers.toUtf8Bytes("found near campus");

    await expect(lost.connect(owner).reportLost(categoryId, contact, hints))
      .to.emit(lost, "LostReported")
      .withArgs(
        anyValue,
        categoryId,
        owner.address,
        ethers.hexlify(contact),
        ethers.hexlify(hints)
      );

    await expect(lost.connect(finder).reportFound(categoryId, message))
      .to.emit(lost, "FoundReported")
      .withArgs(
        anyValue,
        categoryId,
        finder.address,
        ethers.hexlify(message)
      );
  });
});
