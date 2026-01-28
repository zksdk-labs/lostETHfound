pragma circom 2.1.5;

include "circomlib/circuits/poseidon.circom";

// Proves knowledge of a secret that binds to a public commitment and nullifier.
template LostETHFound() {
  // Private inputs
  signal input secret;
  signal input categoryId;
  signal input itemIdSalt;
  signal input claimId;

  // Public inputs
  signal input commitment;
  signal input nullifier;

  component poseidonCommit = Poseidon(3);
  poseidonCommit.inputs[0] <== secret;
  poseidonCommit.inputs[1] <== categoryId;
  poseidonCommit.inputs[2] <== itemIdSalt;
  commitment === poseidonCommit.out;

  component poseidonNull = Poseidon(2);
  poseidonNull.inputs[0] <== secret;
  poseidonNull.inputs[1] <== claimId;
  nullifier === poseidonNull.out;
}

component main {public [commitment, nullifier]} = LostETHFound();
