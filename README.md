# Solana Escrow Battle Royale

A browser-based multiplayer 3D shooter where players wager real SOL. The smart contract holds everyone's entry fee in escrow — last player standing wins the pot.

## Stack

| Layer | Tech |
|-------|------|
| 3D / Rendering | React Three Fiber, Three.js, @react-three/drei |
| Physics | @react-three/rapier |
| Multiplayer | PlayroomKit |
| Blockchain | Solana (devnet), Anchor framework |
| Wallet | @solana/wallet-adapter (Phantom, Solflare) |
| Frontend | React + Vite, Tailwind CSS |

## How it works

1. **Host** connects a wallet and creates a room — sets the SOL entry fee and deposits it on-chain.
2. **Other players** join, each depositing the same amount into the program-owned escrow account.
3. The game starts — free-for-all with a shrinking safe zone.
4. When one player is left standing, the host's client automatically calls `settle_game` on-chain.
5. The entire pot is transferred to the winner's wallet. The escrow account is closed.

## Smart Contract

- **Program ID (devnet):** `9TfDHxkW2frqNGboBBxSyYtMCEg6FkAEEodmbCJRfK96`
- **Instructions:** `initialize_room`, `join_room`, `settle_game`, `refund_all`
- Located in [anchor/programs/game-stake/src/lib.rs](anchor/programs/game-stake/src/lib.rs)

## Getting Started

```bash
npm install
npm run dev
```

Open `localhost:5173` in two browser tabs (or on two devices on the same network). Connect a Solana devnet wallet in each tab.

> Devnet SOL is free — get some at https://faucet.solana.com

## Redeploying the contract

```bash
# Install: Rust, Solana CLI, Anchor CLI v0.29
solana config set --url devnet
solana airdrop 2
cd anchor
anchor build && anchor deploy --provider.cluster devnet
```

Copy the new program ID and update it in:
- `src/lib/idl.js` → `PROGRAM_ID`
- `anchor/programs/game-stake/src/lib.rs` → `declare_id!`
- `anchor/Anchor.toml` → `[programs.devnet]`
