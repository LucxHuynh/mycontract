const { PublicKey, SYSVAR_RENT_PUBKEY } = require('@solana/web3.js');
const { PROGRAM_ID } = require('./connection');

/**
 * Tìm PDA của vault
 * @param {PublicKey} authority - Khóa công khai của người dùng sở hữu vault
 * @returns {Promise<[PublicKey, number]>} - Địa chỉ PDA và bump seed
 */
async function findVaultPDA(authority) {
  return PublicKey.findProgramAddress(
    [Buffer.from('vault'), authority.toBuffer()],
    PROGRAM_ID
  );
}

/**
 * Tìm PDA của treasury
 * @param {PublicKey} authority - Khóa công khai của người dùng sở hữu treasury
 * @returns {Promise<[PublicKey, number]>} - Địa chỉ PDA và bump seed
 */
async function findTreasuryPDA(authority) {
  return PublicKey.findProgramAddress(
    [Buffer.from('treasury'), authority.toBuffer()],
    PROGRAM_ID
  );
}

/**
 * Tìm PDA của một số dư
 * @param {PublicKey} mint - Mint address của token (null cho SOL)
 * @param {PublicKey} owner - Chủ sở hữu
 * @returns {Promise<[PublicKey, number]>} - Địa chỉ PDA và bump seed
 */
async function findBalancePDA(mint, owner) {
  const mintKey = mint || PublicKey.default;
  return PublicKey.findProgramAddress(
    [Buffer.from('balance'), mintKey.toBuffer(), owner.toBuffer()],
    PROGRAM_ID
  );
}

/**
 * Tìm PDA của contract treasury
 * @returns {Promise<[PublicKey, number]>} - Địa chỉ PDA và bump seed
 */
async function findContractTreasuryPDA() {
  return PublicKey.findProgramAddress(
    [Buffer.from('contract_treasury')],
    PROGRAM_ID
  );
}

/**
 * Tìm tất cả các PDAs liên quan đến một authority
 * @param {PublicKey} authority - Khóa công khai của người dùng
 * @returns {Promise<Object>} - Đối tượng chứa các địa chỉ PDA
 */
async function findAllPDAs(authority) {
  const [vaultPDA, vaultBump] = await findVaultPDA(authority);
  const [treasuryPDA, treasuryBump] = await findTreasuryPDA(authority);
  const [balancePDA, balanceBump] = await findBalancePDA(null, authority);
  
  return {
    vault: { address: vaultPDA, bump: vaultBump },
    treasury: { address: treasuryPDA, bump: treasuryBump },
    balance: { address: balancePDA, bump: balanceBump }
  };
}

module.exports = {
  findVaultPDA,
  findTreasuryPDA,
  findBalancePDA,
  findContractTreasuryPDA,
  findAllPDAs
}; 