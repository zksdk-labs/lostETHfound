const hre = require("hardhat");

async function main() {
  const verifierName = process.env.VERIFIER_NAME || "VerifierMock";
  const claimBondWei = process.env.CLAIM_BOND_WEI || "0";

  const Verifier = await hre.ethers.getContractFactory(verifierName);
  const verifier = await Verifier.deploy();
  await verifier.waitForDeployment();
  const verifierAddress = await verifier.getAddress();

  const LostETHFound = await hre.ethers.getContractFactory("LostETHFound");
  const lost = await LostETHFound.deploy(verifierAddress, claimBondWei);
  await lost.waitForDeployment();

  console.log("Verifier:", verifierAddress);
  console.log("LostETHFound:", await lost.getAddress());
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
