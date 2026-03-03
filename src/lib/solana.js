import { AnchorProvider, Program, BN } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { IDL, PROGRAM_ID } from "./idl";

// ─── Constants ────────────────────────────────────────────────────────────────

export const DEVNET_RPC = "https://api.devnet.solana.com";

export const SOL = (n) => Math.round(n * LAMPORTS_PER_SOL);
export const fromLamports = (n) => n / LAMPORTS_PER_SOL;

// ─── Program factory ──────────────────────────────────────────────────────────

export function getProgram(wallet, connection) {
  const provider = new AnchorProvider(connection, wallet, {
    commitment: "confirmed",
    preflightCommitment: "confirmed",
  });
  return new Program(IDL, new PublicKey(PROGRAM_ID), provider);
}

// ─── PDA helpers ─────────────────────────────────────────────────────────────

export function getRoomPDA(creatorPubkey) {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("room"), new PublicKey(creatorPubkey).toBuffer()],
    new PublicKey(PROGRAM_ID)
  );
  return pda;
}

// ─── Instructions ────────────────────────────────────────────────────────────

/**
 * Room creator initialises the escrow and deposits their stake.
 * @param {Program}   program
 * @param {PublicKey} creatorPubkey
 * @param {number}    stakeSOL  — amount in SOL (e.g. 0.1)
 */
export async function initializeRoom(program, creatorPubkey, stakeSOL) {
  const roomPDA = getRoomPDA(creatorPubkey);
  const stakeLamports = new BN(SOL(stakeSOL));

  const tx = await program.methods
    .initializeRoom(stakeLamports)
    .accounts({
      creator: creatorPubkey,
      room: roomPDA,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  return tx;
}

/**
 * A player joins an existing room and deposits the stake.
 * @param {Program}   program
 * @param {PublicKey} playerPubkey
 * @param {PublicKey|string} creatorPubkey — the room creator's wallet
 */
export async function joinRoom(program, playerPubkey, creatorPubkey) {
  const roomPDA = getRoomPDA(creatorPubkey);

  const tx = await program.methods
    .joinRoom()
    .accounts({
      player: playerPubkey,
      room: roomPDA,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  return tx;
}

/**
 * Host settles the game and pays the entire pot to the FFA winner.
 * @param {Program}          program
 * @param {PublicKey}        creatorPubkey
 * @param {PublicKey|string} winnerPubkey  — the last player standing
 */
export async function settleGame(program, creatorPubkey, winnerPubkey) {
  const roomPDA = getRoomPDA(creatorPubkey);
  const winner  = new PublicKey(winnerPubkey);

  const tx = await program.methods
    .settleGame()
    .accounts({
      creator: creatorPubkey,
      room: roomPDA,
      winner1: winner,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  return tx;
}

/**
 * Creator cancels the room and refunds everyone.
 * @param {Program}   program
 * @param {PublicKey} creatorPubkey
 * @param {PublicKey[]} playerPubkeys  — all players to refund
 */
export async function refundAll(program, creatorPubkey, playerPubkeys) {
  const roomPDA = getRoomPDA(creatorPubkey);

  const remainingAccounts = playerPubkeys.map((pk) => ({
    pubkey: new PublicKey(pk),
    isWritable: true,
    isSigner: false,
  }));

  const tx = await program.methods
    .refundAll()
    .accounts({
      creator: creatorPubkey,
      room: roomPDA,
      systemProgram: SystemProgram.programId,
    })
    .remainingAccounts(remainingAccounts)
    .rpc();

  return tx;
}

/**
 * Fetch the on-chain room state.
 * Returns null if not initialised yet.
 */
export async function fetchRoom(program, creatorPubkey) {
  try {
    const roomPDA = getRoomPDA(creatorPubkey);
    return await program.account.gameRoom.fetch(roomPDA);
  } catch {
    return null;
  }
}

/**
 * Fetch wallet SOL balance on devnet.
 */
export async function getBalance(connection, pubkey) {
  const lamports = await connection.getBalance(new PublicKey(pubkey));
  return fromLamports(lamports);
}
