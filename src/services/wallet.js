const fs = require('fs');
const os = require('os');
const path = require('path');
const { Keypair, LAMPORTS_PER_SOL } = require('@solana/web3.js');
const { getConnection } = require('../utils/connection');
const chalk = require('chalk');

/**
 * Tạo một ví mới và lưu vào file
 * @returns {Promise<Object>} Keypair của ví mới
 */
async function createWallet() {
  try {
    const keypair = Keypair.generate();
    const secretKey = Buffer.from(keypair.secretKey).toString('hex');
    
    // Lưu secret key vào file
    const walletFile = path.join(os.homedir(), '.solana', 'id.json');
    const walletDir = path.dirname(walletFile);
    
    if (!fs.existsSync(walletDir)) {
      fs.mkdirSync(walletDir, { recursive: true });
    }
    
    fs.writeFileSync(walletFile, secretKey, 'utf-8');
    console.log(chalk.green(`✅ Đã tạo ví mới và lưu vào ${walletFile}`));
    console.log(chalk.cyan(`🔑 Public key: ${keypair.publicKey.toString()}`));
    
    // Airdrop SOL vào ví mới (chỉ hoạt động trên mạng test)
    try {
      const connection = getConnection();
      const airdropSignature = await connection.requestAirdrop(
        keypair.publicKey,
        LAMPORTS_PER_SOL
      );
      await connection.confirmTransaction(airdropSignature);
      console.log(chalk.green(`💰 Đã airdrop 1 SOL vào ví mới (chỉ hoạt động trên mạng test)`));
    } catch (e) {
      console.log(chalk.yellow(`⚠️ Airdrop không thành công. Bạn cần chuyển SOL vào ví thủ công.`));
    }
    
    return keypair;
  } catch (error) {
    console.error(chalk.red(`❌ Lỗi khi tạo ví: ${error.message}`));
    return null;
  }
}

/**
 * Tải ví từ file id.json
 * @param {string} keyPath Đường dẫn tùy chọn đến file keypair
 * @returns {Promise<Object>} Keypair đã tải
 */
async function loadWallet(keyPath) {
  try {
    const walletFile = keyPath || path.join(os.homedir(), '.solana', 'id.json');
    
    if (!fs.existsSync(walletFile)) {
      console.log(chalk.yellow(`⚠️ Không tìm thấy file ví tại ${walletFile}`));
      console.log(chalk.yellow(`⚠️ Bạn có thể tạo ví mới bằng lệnh: node cli.js init`));
      return null;
    }
    
    const secretKeyString = fs.readFileSync(walletFile, 'utf-8');
    const secretKey = Buffer.from(secretKeyString, 'hex');
    
    const keypair = Keypair.fromSecretKey(secretKey);
    console.log(chalk.green(`✅ Đã tải ví từ ${walletFile}`));
    console.log(chalk.cyan(`🔑 Public key: ${keypair.publicKey.toString()}`));
    
    return keypair;
  } catch (error) {
    console.error(chalk.red(`❌ Lỗi khi tải ví: ${error.message}`));
    return null;
  }
}

/**
 * Import ví từ secret key được cung cấp
 * @param {string} secretKeyString Secret key dạng hex hoặc base64
 * @returns {Object} Keypair đã import
 */
function importWallet(secretKeyString) {
  try {
    let secretKey;
    
    // Xử lý các định dạng secret key khác nhau
    if (secretKeyString.includes('[') && secretKeyString.includes(']')) {
      // Định dạng mảng số
      secretKey = new Uint8Array(JSON.parse(secretKeyString));
    } else if (secretKeyString.length === 64 || secretKeyString.length === 128) {
      // Định dạng hex
      secretKey = Buffer.from(secretKeyString, 'hex');
    } else {
      // Định dạng base64
      secretKey = Buffer.from(secretKeyString, 'base64');
    }
    
    const keypair = Keypair.fromSecretKey(secretKey);
    console.log(chalk.green('✅ Đã import ví thành công'));
    console.log(chalk.cyan(`🔑 Public key: ${keypair.publicKey.toString()}`));
    
    return keypair;
  } catch (error) {
    console.error(chalk.red(`❌ Lỗi khi import ví: ${error.message}`));
    return null;
  }
}

/**
 * Lấy số dư của một địa chỉ
 * @param {PublicKey} publicKey Địa chỉ cần kiểm tra
 * @returns {Promise<number>} Số dư của địa chỉ
 */
async function getBalance(publicKey) {
  try {
    const connection = getConnection();
    const balance = await connection.getBalance(publicKey);
    
    console.log(chalk.green(`💰 Số dư của địa chỉ ${publicKey.toString()}:`));
    console.log(chalk.cyan(`   ${balance / LAMPORTS_PER_SOL} SOL (${balance} lamports)`));
    
    return balance;
  } catch (error) {
    console.error(chalk.red(`❌ Lỗi khi lấy số dư: ${error.message}`));
    return 0;
  }
}

module.exports = {
  createWallet,
  loadWallet,
  importWallet,
  getBalance
}; 