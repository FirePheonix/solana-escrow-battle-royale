use anchor_lang::prelude::*;
use anchor_lang::system_program;

declare_id!("9TfDHxkW2frqNGboBBxSyYtMCEg6FkAEEodmbCJRfK96");

#[program]
pub mod game_stake {
    use super::*;

    pub fn initialize_room(ctx: Context<InitializeRoom>, stake_lamports: u64) -> Result<()> {
        require!(stake_lamports > 0, GameError::InvalidStake);

        // Write fields in a block so the mutable borrow is dropped before the CPI.
        {
            let room = &mut ctx.accounts.room;
            room.creator        = ctx.accounts.creator.key();
            room.stake_lamports = stake_lamports;
            room.players        = vec![ctx.accounts.creator.key()];
            room.is_settled     = false;
        }

        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.creator.to_account_info(),
                    to:   ctx.accounts.room.to_account_info(),
                },
            ),
            stake_lamports,
        )?;

        emit!(RoomCreated {
            creator: ctx.accounts.creator.key(),
            stake_lamports,
        });

        Ok(())
    }

    /// A player joins an existing room and deposits the required stake.
    /// Join order determines team: index 0-1 = red, index 2-3 = blue.
    pub fn join_room(ctx: Context<JoinRoom>) -> Result<()> {
        // Read all needed values upfront — avoids holding a mutable borrow across the CPI.
        let is_settled   = ctx.accounts.room.is_settled;
        let player_count = ctx.accounts.room.players.len();
        let already_in   = ctx.accounts.room.players.contains(&ctx.accounts.player.key());
        let stake        = ctx.accounts.room.stake_lamports;
        let player_key   = ctx.accounts.player.key();

        require!(!is_settled,      GameError::AlreadySettled);
        require!(player_count < 4, GameError::RoomFull);
        require!(!already_in,      GameError::AlreadyJoined);

        // CPI: deposit stake — no active mutable borrow on room.
        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.player.to_account_info(),
                    to:   ctx.accounts.room.to_account_info(),
                },
            ),
            stake,
        )?;

        // Mutably borrow AFTER the CPI is done.
        ctx.accounts.room.players.push(player_key);

        emit!(PlayerJoined {
            player: player_key,
            player_count: (player_count + 1) as u8,
        });

        Ok(())
    }

    /// Host settles the game: entire pot goes to the single FFA winner.
    /// winner1 must be one of the registered players.
    pub fn settle_game(ctx: Context<SettleGame>) -> Result<()> {
        let winner_key = ctx.accounts.winner1.key();
        let players    = ctx.accounts.room.players.clone();
        let is_settled = ctx.accounts.room.is_settled;

        require!(!is_settled,        GameError::AlreadySettled);
        require!(players.len() >= 2, GameError::NotEnoughPlayers);
        require!(players.contains(&winner_key), GameError::InvalidWinner);

        // Keep the rent-exempt minimum; close=creator will return it to host.
        let rent          = Rent::get()?.minimum_balance(ctx.accounts.room.to_account_info().data_len());
        let total         = ctx.accounts.room.to_account_info().lamports();
        let distributable = total.saturating_sub(rent);

        **ctx.accounts.room.to_account_info().try_borrow_mut_lamports()?   -= distributable;
        **ctx.accounts.winner1.to_account_info().try_borrow_mut_lamports()? += distributable;

        ctx.accounts.room.is_settled = true;

        emit!(GameSettled { winner: winner_key, total_pot: distributable });

        Ok(())
        // After body: `close = creator` returns the leftover rent to person who is the host.
    }

    // Emergency: creator cancels the room and refunds all depositors.
    // Pass every player AccountInfo in `remaining_accounts`.
    pub fn refund_all(ctx: Context<RefundAll>) -> Result<()> {
        let is_settled = ctx.accounts.room.is_settled;
        require!(!is_settled, GameError::AlreadySettled);

        let stake   = ctx.accounts.room.stake_lamports;
        let players = ctx.accounts.room.players.clone();

        for acct in ctx.remaining_accounts.iter() {
            if players.contains(&acct.key()) {
                **ctx.accounts.room.to_account_info().try_borrow_mut_lamports()? -= stake;
                **acct.try_borrow_mut_lamports()? += stake;
            }
        }

        ctx.accounts.room.is_settled = true;
        Ok(())
    }
}


#[account]
pub struct GameRoom {
    pub creator: Pubkey,
    pub stake_lamports: u64,
    pub players: Vec<Pubkey>, //4 + 32 * 4 = 132  (max 4 players)
    pub is_settled: bool,
}

impl GameRoom {
    pub const MAX_SIZE: usize = 8 + 32 + 8 + (4 + 32 * 4) + 1;
}

#[derive(Accounts)]
pub struct InitializeRoom<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    #[account(
        init,
        payer = creator,
        space = GameRoom::MAX_SIZE,
        seeds = [b"room", creator.key().as_ref()],
        bump,
    )]
    pub room: Account<'info, GameRoom>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct JoinRoom<'info> {
    #[account(mut)]
    pub player: Signer<'info>,

    #[account(
        mut,
        seeds = [b"room", room.creator.as_ref()],
        bump,
    )]
    pub room: Account<'info, GameRoom>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SettleGame<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    #[account(
        mut,
        seeds = [b"room", creator.key().as_ref()],
        bump,
        constraint = room.creator == creator.key() @ GameError::Unauthorized,
        close = creator,
    )]
    pub room: Account<'info, GameRoom>,

    /// CHECK: Validated against room.players in the instruction body
    #[account(mut)]
    pub winner1: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RefundAll<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    #[account(
        mut,
        seeds = [b"room", creator.key().as_ref()],
        bump,
        constraint = room.creator == creator.key() @ GameError::Unauthorized,
        close = creator,
    )]
    pub room: Account<'info, GameRoom>,

    pub system_program: Program<'info, System>,
}


#[event]
pub struct RoomCreated {
    pub creator: Pubkey,
    pub stake_lamports: u64,
}

#[event]
pub struct PlayerJoined {
    pub player: Pubkey,
    pub player_count: u8,
}

#[event]
pub struct GameSettled {
    pub winner: Pubkey,
    pub total_pot: u64,
}

#[error_code]
pub enum GameError {
    #[msg("Room is full (max 4 players)")]
    RoomFull,
    #[msg("Player already joined this room")]
    AlreadyJoined,
    #[msg("Game has already been settled")]
    AlreadySettled,
    #[msg("Only the room creator can call this")]
    Unauthorized,
    #[msg("Need at least 2 players to settle")]
    NotEnoughPlayers,
    #[msg("Winner account does not match room records")]
    InvalidWinner,
    #[msg("Stake amount must be greater than 0")]
    InvalidStake,
}
