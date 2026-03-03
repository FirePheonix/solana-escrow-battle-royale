/**
 * IDL for the game_stake Anchor program.
 * This file is generated from the Rust program – keep it in sync with lib.rs.
 *
 * After you deploy (`anchor deploy --provider.cluster devnet`), copy the
 * program ID printed in the terminal and replace PROGRAM_ID below AND in
 * anchor/programs/game-stake/src/lib.rs (declare_id!) and anchor/Anchor.toml.
 */

export const PROGRAM_ID = "9TfDHxkW2frqNGboBBxSyYtMCEg6FkAEEodmbCJRfK96";

export const IDL = {
  version: "0.1.0",
  name: "game_stake",
  instructions: [
    {
      name: "initializeRoom",
      accounts: [
        { name: "creator",       isMut: true,  isSigner: true  },
        { name: "room",          isMut: true,  isSigner: false },
        { name: "systemProgram", isMut: false, isSigner: false },
      ],
      args: [{ name: "stakeLamports", type: "u64" }],
    },
    {
      name: "joinRoom",
      accounts: [
        { name: "player",        isMut: true,  isSigner: true  },
        { name: "room",          isMut: true,  isSigner: false },
        { name: "systemProgram", isMut: false, isSigner: false },
      ],
      args: [],
    },
    {
      name: "settleGame",
      accounts: [
        { name: "creator",       isMut: true,  isSigner: true  },
        { name: "room",          isMut: true,  isSigner: false },
        { name: "winner1",       isMut: true,  isSigner: false },
        { name: "systemProgram", isMut: false, isSigner: false },
      ],
      args: [],
    },
    {
      name: "refundAll",
      accounts: [
        { name: "creator",       isMut: true,  isSigner: true  },
        { name: "room",          isMut: true,  isSigner: false },
        { name: "systemProgram", isMut: false, isSigner: false },
      ],
      args: [],
    },
  ],
  accounts: [
    {
      name: "GameRoom",
      type: {
        kind: "struct",
        fields: [
          { name: "creator",        type: "publicKey"            },
          { name: "stakeLamports",  type: "u64"                  },
          { name: "players",        type: { vec: "publicKey" }   },
          { name: "isSettled",      type: "bool"                 },
        ],
      },
    },
  ],
  errors: [
    { code: 6000, name: "RoomFull",          msg: "Room is full (max 4 players)"            },
    { code: 6001, name: "AlreadyJoined",     msg: "Player already joined this room"         },
    { code: 6002, name: "AlreadySettled",    msg: "Game has already been settled"           },
    { code: 6003, name: "Unauthorized",      msg: "Only the room creator can call this"     },
    { code: 6004, name: "NotEnoughPlayers",  msg: "Need at least 2 players to settle"       },
    { code: 6005, name: "InvalidWinner",     msg: "Winner account does not match records"   },
    { code: 6006, name: "InvalidStake",      msg: "Stake amount must be greater than 0"     },
  ],
};
