const hre = require("hardhat");

async function main() {
  console.log("Deploying to", hre.network.name);

  // Deploy Tagged Verifier (LOSTETHFOUND circuit)
  const Verifier = await hre.ethers.getContractFactory(
    "contracts/Verifier.sol:Groth16Verifier"
  );
  const verifier = await Verifier.deploy();
  await verifier.waitForDeployment();
  const verifierAddress = await verifier.getAddress();
  console.log("Tagged Verifier:", verifierAddress);

  // Deploy Question Verifier (QuestionPackProof circuit)
  const QuestionVerifier = await hre.ethers.getContractFactory(
    "contracts/QuestionVerifier.sol:Groth16Verifier"
  );
  const questionVerifier = await QuestionVerifier.deploy();
  await questionVerifier.waitForDeployment();
  const questionVerifierAddress = await questionVerifier.getAddress();
  console.log("Question Verifier:", questionVerifierAddress);

  // Deploy main contract
  const LostETHFound = await hre.ethers.getContractFactory("LostETHFound");
  const lost = await LostETHFound.deploy(
    verifierAddress,
    questionVerifierAddress
  );
  await lost.waitForDeployment();
  const lostAddress = await lost.getAddress();
  console.log("LostETHFound:", lostAddress);

  console.log("\n--- Deployment Summary ---");
  console.log("Network:", hre.network.name);
  console.log("Tagged Verifier:", verifierAddress);
  console.log("Question Verifier:", questionVerifierAddress);
  console.log("LostETHFound:", lostAddress);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
