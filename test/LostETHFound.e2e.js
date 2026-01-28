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

  it("verifies a real Groth16 proof on-chain", async function () {
    const wasmPath = path.join(
      __dirname,
      "..",
      "circuits",
      "build",
      "LOSTETHFOUND_js",
      "LOSTETHFOUND.wasm"
    );
    const zkeyPath = path.join(
      __dirname,
      "..",
      "circuits",
      "build",
      "LOSTETHFOUND_0001.zkey"
    );

    if (!fs.existsSync(wasmPath) || !fs.existsSync(zkeyPath)) {
      throw new Error("Missing ZK artifacts. Run `bun run zk:build` first.");
    }

    const [owner, finder] = await ethers.getSigners();

    const Verifier = await ethers.getContractFactory("Groth16Verifier");
    const verifier = await Verifier.deploy();
    await verifier.waitForDeployment();

    const LostETHFound = await ethers.getContractFactory("LostETHFound");
    const lost = await LostETHFound.deploy(await verifier.getAddress(), 0);
    await lost.waitForDeployment();

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

    const { pA, pB, pC, publicSignals: callSignals } = parseCallData(calldata);

    const commitment = callSignals[0];
    const nullifier = callSignals[1];

    const reward = ethers.parseEther("0.01");

    await expect(
      lost.connect(owner).registerItem(ethers.toBeHex(commitment, 32), "0x", reward, {
        value: reward,
      })
    ).to.emit(lost, "ItemRegistered");

    await expect(
      lost
        .connect(finder)
        .claim(
          ethers.toBeHex(commitment, 32),
          ethers.toBeHex(nullifier, 32),
          finder.address,
          pA,
          pB,
          pC,
          callSignals
        )
    ).to.emit(lost, "Claimed");

    const item = await lost.items(ethers.toBeHex(commitment, 32));
    expect(item.claimed).to.equal(true);
  });
});
