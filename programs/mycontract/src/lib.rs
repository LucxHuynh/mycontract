use anchor_lang::prelude::*;
use anchor_lang::solana_program::{program::invoke, program::invoke_signed, system_instruction};

declare_id!("G282eaMza7v7527pDjt4yAA4FzuFZsSnJRSPuZFerCz6");

#[program]
pub mod mycontract {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        // Khởi tạo vault PDA để lưu trữ thông tin
        let vault = &mut ctx.accounts.vault;
        vault.authority = ctx.accounts.authority.key();
        vault.bump = ctx.bumps.vault;
        vault.treasury_bump = ctx.bumps.treasury;
        vault.contract_treasury_bump = ctx.bumps.contract_treasury;
        vault.total_deposited = 0;
        vault.accrued_interest = 0; // Lãi đã tích lũy nhưng chưa thêm vào tổng tiền gửi
        vault.last_deposit_time = ctx.accounts.clock.unix_timestamp;
        vault.last_interest_claim_time = ctx.accounts.clock.unix_timestamp;
        
        msg!("Đã khởi tạo vault với authority: {}", ctx.accounts.authority.key());
        msg!("Vault bump: {}, Treasury bump: {}, Contract treasury bump: {}", 
            vault.bump, vault.treasury_bump, vault.contract_treasury_bump);
        Ok(())
    }

    // Hàm chuyển SOL từ treasury đến một địa chỉ đích
    pub fn transfer_sol(ctx: Context<TransferSol>, amount: u64, destination: Pubkey) -> Result<()> {
        // Cần tính lãi kép đã tích lũy trước khi rút tiền
        update_interest(&mut ctx.accounts.vault, ctx.accounts.clock.unix_timestamp)?;
        
        // Kiểm tra người gọi có phải là authority của vault không
        require!(
            ctx.accounts.vault.authority == ctx.accounts.authority.key(),
            CustomError::UnauthorizedAccess
        );
        
        // Kiểm tra số dư
        let available_balance = ctx.accounts.vault.total_deposited;
        require!(available_balance >= amount, CustomError::InsufficientFunds);
        
        // Kiểm tra số dư thực tế trong treasury
        let treasury_balance = ctx.accounts.treasury.lamports();
        require!(treasury_balance >= amount, CustomError::InsufficientFunds);
        
        // Cập nhật số tiền trong vault
        let vault = &mut ctx.accounts.vault;
        vault.total_deposited -= amount;
        
        // Chuyển SOL từ treasury PDA đến địa chỉ đích
        let seeds = &[
            b"treasury",
            vault.authority.as_ref(),
            &[vault.treasury_bump],
        ];
        let signer = &[&seeds[..]];
        
        // Tạo CPI context để treasury PDA làm signer
        let transfer_ix = system_instruction::transfer(
            &ctx.accounts.treasury.key(),
            &destination,
            amount
        );
        
        invoke_signed(
            &transfer_ix,
            &[
                ctx.accounts.treasury.to_account_info(),
                ctx.accounts.destination.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
            signer,
        )?;

        msg!("Đã chuyển {} lamports từ treasury đến {}", amount, destination);
        Ok(())
    }

    // Hàm để gửi SOL vào treasury PDA
    pub fn deposit_sol(ctx: Context<DepositSol>, amount: u64) -> Result<()> {
        // Nếu đã có tiền gửi từ trước, tính lãi từ lần gửi trước
        if ctx.accounts.vault.total_deposited > 0 {
            update_interest(&mut ctx.accounts.vault, ctx.accounts.clock.unix_timestamp)?;
            
            // Nếu đã tích lũy lãi, thanh toán lãi từ contract treasury
            let accrued_interest = ctx.accounts.vault.accrued_interest;
            if accrued_interest > 0 {
                // Thanh toán lãi từ contract treasury
                let contract_treasury_bump = ctx.accounts.vault.contract_treasury_bump;
                let seeds = &[
                    b"contract_treasury".as_ref(),
                    &[contract_treasury_bump],
                ];
                let signer = &[&seeds[..]];
                
                // Tạo ix để contract treasury PDA làm signer
                let transfer_ix = system_instruction::transfer(
                    &ctx.accounts.contract_treasury.key(),
                    &ctx.accounts.treasury.key(),
                    accrued_interest
                );
                
                invoke_signed(
                    &transfer_ix,
                    &[
                        ctx.accounts.contract_treasury.to_account_info(),
                        ctx.accounts.treasury.to_account_info(),
                        ctx.accounts.system_program.to_account_info(),
                    ],
                    signer,
                )?;
                
                // Reset lãi tích lũy
                ctx.accounts.vault.accrued_interest = 0;
                
                msg!("Đã thanh toán {} lamports tiền lãi cho vault", accrued_interest);
            }
        }
        
        // Chuyển SOL từ người gửi đến treasury PDA
        let transfer_instruction = system_instruction::transfer(
            &ctx.accounts.sender.key(),
            &ctx.accounts.treasury.key(),
            amount
        );

        invoke(
            &transfer_instruction,
            &[
                ctx.accounts.sender.to_account_info(),
                ctx.accounts.treasury.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ]
        )?;

        // Cập nhật thông tin vault
        let vault = &mut ctx.accounts.vault;
        vault.total_deposited += amount;
        vault.last_deposit_time = ctx.accounts.clock.unix_timestamp;

        msg!("Đã gửi {} lamports vào treasury", amount);
        msg!("Tổng số tiền đã gửi: {} lamports", vault.total_deposited);
        Ok(())
    }

    // Hàm tính lãi kép 5% APY, tính liên tục theo thời gian thực và cập nhật biến lãi tích lũy
    pub fn claim_interest(ctx: Context<ClaimInterest>) -> Result<()> {
        let vault = &mut ctx.accounts.vault;
        let current_time = ctx.accounts.clock.unix_timestamp;
        
        // Kiểm tra người gọi có phải là authority của vault không
        require!(
            vault.authority == ctx.accounts.authority.key(),
            CustomError::UnauthorizedAccess
        );
        
        // Tính và cập nhật lãi
        update_interest(vault, current_time)?;
        
        // Kiểm tra nếu không có lãi tích lũy
        require!(vault.accrued_interest > 0, CustomError::NoInterestToClaimYet);
        
        // Thanh toán lãi từ contract treasury
        let accrued_interest = vault.accrued_interest;
        let contract_treasury_bump = vault.contract_treasury_bump;
        
        // Chuyển SOL từ contract treasury PDA đến treasury người dùng
        let seeds = &[
            b"contract_treasury".as_ref(),
            &[contract_treasury_bump],
        ];
        let signer = &[&seeds[..]];
        
        // Tạo ix để contract treasury PDA làm signer
        let transfer_ix = system_instruction::transfer(
            &ctx.accounts.contract_treasury.key(),
            &ctx.accounts.treasury.key(),
            accrued_interest
        );
        
        invoke_signed(
            &transfer_ix,
            &[
                ctx.accounts.contract_treasury.to_account_info(),
                ctx.accounts.treasury.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
            signer,
        )?;
        
        // Cập nhật thông tin vault
        vault.total_deposited += accrued_interest;
        vault.accrued_interest = 0;
        
        msg!("Đã thanh toán và thêm {} lamports tiền lãi vào tổng số tiền gửi", accrued_interest);
        msg!("Tổng số tiền trong vault hiện tại: {} lamports", vault.total_deposited);
        Ok(())
    }

    // Hàm gửi tiền vào contract treasury để trả lãi
    pub fn fund_contract_treasury(ctx: Context<FundContractTreasury>, amount: u64) -> Result<()> {
        // Chuyển SOL từ người gửi đến contract treasury PDA
        let transfer_instruction = system_instruction::transfer(
            &ctx.accounts.sender.key(),
            &ctx.accounts.contract_treasury.key(),
            amount
        );

        invoke(
            &transfer_instruction,
            &[
                ctx.accounts.sender.to_account_info(),
                ctx.accounts.contract_treasury.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ]
        )?;

        msg!("Đã gửi {} lamports vào contract treasury để trả lãi", amount);
        Ok(())
    }

    // Hàm rút tiền từ contract treasury (chỉ admin)
    pub fn withdraw_from_contract_treasury(ctx: Context<WithdrawFromContractTreasury>, amount: u64) -> Result<()> {
        // Kiểm tra số dư trong contract treasury
        let treasury_balance = ctx.accounts.contract_treasury.lamports();
        require!(treasury_balance >= amount, CustomError::InsufficientFunds);
        
        // Chuyển SOL từ contract treasury PDA đến người nhận
        let contract_treasury_bump = ctx.accounts.vault.contract_treasury_bump;
        let seeds = &[
            b"contract_treasury".as_ref(),
            &[contract_treasury_bump],
        ];
        let signer = &[&seeds[..]];
        
        // Tạo CPI context để contract treasury PDA làm signer
        let transfer_ix = system_instruction::transfer(
            &ctx.accounts.contract_treasury.key(),
            &ctx.accounts.recipient.key(),
            amount
        );
        
        invoke_signed(
            &transfer_ix,
            &[
                ctx.accounts.contract_treasury.to_account_info(),
                ctx.accounts.recipient.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
            signer,
        )?;

        msg!("Đã rút {} lamports từ contract treasury", amount);
        Ok(())
    }
}

// Hàm nội bộ để tính và cập nhật lãi suất
fn update_interest(vault: &mut Vault, current_time: i64) -> Result<()> {
    // Tính thời gian đã trôi qua kể từ lần tính lãi cuối cùng (tính bằng giây)
    let time_elapsed = current_time - vault.last_interest_claim_time;
    
    // Đảm bảo đã có thời gian trôi qua
    if time_elapsed <= 0 {
        return Ok(());
    }
    
    // Tính lãi suất (5% APY) liên tục theo thời gian thực
    // Công thức: principal * (tỷ lệ lãi suất theo giây) * số giây trôi qua
    
    // Tính toán tỷ lệ lãi suất theo giây
    // 5% APY = 0.05/31536000 mỗi giây (31536000 giây = 1 năm)
    let apy_rate: f64 = 5.0; // 5% APY
    let interest_rate_per_second: f64 = apy_rate / (100.0 * 31536000.0);
    
    // Tính lãi
    let interest: f64 = vault.total_deposited as f64 * interest_rate_per_second * time_elapsed as f64;
    
    // Chuyển đổi lãi thành lamports (làm tròn xuống)
    let interest_lamports = interest as u64;
    
    // Cộng thêm vào lãi tích lũy
    vault.accrued_interest += interest_lamports;
    
    // Cập nhật thời gian tính lãi cuối cùng
    vault.last_interest_claim_time = current_time;
    
    msg!("Đã tính {} lamports tiền lãi, lãi tích lũy hiện tại: {} lamports", 
        interest_lamports, vault.accrued_interest);
    
    Ok(())
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    
    #[account(
        init,
        payer = authority,
        space = 8 + 32 + 1 + 1 + 1 + 8 + 8 + 8 + 8, // discriminator + pubkey + bump + treasury_bump + contract_treasury_bump + total_deposited + accrued_interest + last_deposit_time + last_interest_claim_time
        seeds = [b"vault", authority.key().as_ref()],
        bump
    )]
    pub vault: Account<'info, Vault>,
    
    /// CHECK: Treasury PDA không lưu trữ dữ liệu, chỉ lưu SOL
    #[account(
        mut,
        seeds = [b"treasury", authority.key().as_ref()],
        bump
    )]
    pub treasury: AccountInfo<'info>,
    
    /// CHECK: Contract Treasury PDA không lưu trữ dữ liệu, dùng để trả lãi
    #[account(
        mut,
        seeds = [b"contract_treasury"],
        bump
    )]
    pub contract_treasury: AccountInfo<'info>,
    
    /// System Program của Solana
    pub system_program: Program<'info, System>,
    pub clock: Sysvar<'info, Clock>,
}

#[derive(Accounts)]
pub struct TransferSol<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    
    #[account(
        mut,
        seeds = [b"vault", authority.key().as_ref()],
        bump = vault.bump,
        has_one = authority,
    )]
    pub vault: Account<'info, Vault>,
    
    /// CHECK: Treasury PDA chứa SOL
    #[account(
        mut,
        seeds = [b"treasury", vault.authority.as_ref()],
        bump = vault.treasury_bump
    )]
    pub treasury: AccountInfo<'info>,
    
    /// CHECK: Địa chỉ đích nhận SOL
    #[account(mut)]
    pub destination: AccountInfo<'info>,
    
    /// Sử dụng System Program ID chuẩn của Solana
    pub system_program: Program<'info, System>,
    pub clock: Sysvar<'info, Clock>,
}

#[derive(Accounts)]
pub struct DepositSol<'info> {
    /// Người gửi SOL
    #[account(mut)]
    pub sender: Signer<'info>,
    
    #[account(
        mut,
        seeds = [b"vault", vault.authority.as_ref()],
        bump = vault.bump
    )]
    pub vault: Account<'info, Vault>,
    
    /// CHECK: Treasury PDA chứa SOL
    #[account(
        mut,
        seeds = [b"treasury", vault.authority.as_ref()],
        bump = vault.treasury_bump
    )]
    pub treasury: AccountInfo<'info>,
    
    /// CHECK: Contract Treasury PDA dùng để trả lãi
    #[account(
        mut,
        seeds = [b"contract_treasury"],
        bump = vault.contract_treasury_bump
    )]
    pub contract_treasury: AccountInfo<'info>,
    
    /// System program
    pub system_program: Program<'info, System>,
    
    // Clock sysvar để lấy thời gian hiện tại
    pub clock: Sysvar<'info, Clock>,
}

#[derive(Accounts)]
pub struct ClaimInterest<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    
    #[account(
        mut,
        seeds = [b"vault", authority.key().as_ref()],
        bump = vault.bump,
        has_one = authority,
    )]
    pub vault: Account<'info, Vault>,
    
    /// CHECK: Treasury PDA chứa SOL
    #[account(
        mut,
        seeds = [b"treasury", vault.authority.as_ref()],
        bump = vault.treasury_bump
    )]
    pub treasury: AccountInfo<'info>,
    
    /// CHECK: Contract Treasury PDA dùng để trả lãi
    #[account(
        mut,
        seeds = [b"contract_treasury"],
        bump = vault.contract_treasury_bump
    )]
    pub contract_treasury: AccountInfo<'info>,
    
    /// System program
    pub system_program: Program<'info, System>,
    
    // Clock sysvar để lấy thời gian hiện tại
    pub clock: Sysvar<'info, Clock>,
}

#[derive(Accounts)]
pub struct FundContractTreasury<'info> {
    #[account(mut)]
    pub sender: Signer<'info>,
    
    #[account(
        mut,
        seeds = [b"contract_treasury"],
        bump
    )]
    /// CHECK: Contract Treasury PDA dùng để trả lãi
    pub contract_treasury: AccountInfo<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct WithdrawFromContractTreasury<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    
    #[account(
        mut,
        seeds = [b"vault", admin.key().as_ref()],
        bump = vault.bump,
        has_one = authority @ CustomError::UnauthorizedAccess,
    )]
    pub vault: Account<'info, Vault>,
    
    /// CHECK: Đảm bảo admin là authority của vault
    pub authority: AccountInfo<'info>,
    
    /// CHECK: Contract Treasury PDA dùng để trả lãi
    #[account(
        mut,
        seeds = [b"contract_treasury"],
        bump = vault.contract_treasury_bump
    )]
    pub contract_treasury: AccountInfo<'info>,
    
    /// CHECK: Người nhận SOL
    #[account(mut)]
    pub recipient: AccountInfo<'info>,
    
    pub system_program: Program<'info, System>,
}

#[account]
pub struct Vault {
    pub authority: Pubkey,
    pub bump: u8,
    pub treasury_bump: u8,
    pub contract_treasury_bump: u8,
    pub total_deposited: u64, // Tổng số SOL đã gửi (lamports)
    pub accrued_interest: u64, // Lãi đã tích lũy chưa được thêm vào total_deposited
    pub last_deposit_time: i64, // Thời gian lần gửi cuối (unix timestamp)
    pub last_interest_claim_time: i64, // Thời gian lần tính lãi cuối (unix timestamp)
}

#[error_code]
pub enum CustomError {
    #[msg("Không đủ SOL trong treasury")]
    InsufficientFunds,
    
    #[msg("Bạn không có quyền để thực hiện hành động này")]
    UnauthorizedAccess,
    
    #[msg("Chưa đủ thời gian để nhận lãi (tối thiểu 1 giây)")]
    TooEarlyToClaim,
    
    #[msg("Chưa có tiền lãi để nhận")]
    NoInterestToClaimYet,
    
    #[msg("Không đủ SOL trong contract treasury để trả lãi")]
    InsufficientFundsInContractTreasury,
}
