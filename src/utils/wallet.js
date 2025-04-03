const fs = require('fs');
const os = require('os');
const path = require('path');
const readline = require('readline');
const { Keypair, Connection, PublicKey, LAMPORTS_PER_SOL, clusterApiUrl } = require('@solana/web3.js');
const chalk = require('chalk');

const CONNECTION_CONFIG = process.env.SOLANA_RPC_URL || 'http://localhost:8899';

// Tạo readline interface để tương tác với người dùng
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

/**
 * Hàm prompt hỏi người dùng
 * @param {string} question - Câu hỏi
 * @returns {Promise<string>} - Câu trả lời
 */
const question = (question) => {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
};

/**
 * Tạo keypair từ secret key
 * @param {string} secretKeyString - Secret key dạng base58 hoặc mảng số
 * @returns {Keypair} - Keypair tạo được
 */
const createKeypairFromSecretKey = (secretKeyString) => {
  try {
    let secretKey;
    
    // Nếu là mảng JSON
    if (secretKeyString.trim().startsWith('[') && secretKeyString.trim().endsWith(']')) {
      secretKey = Uint8Array.from(JSON.parse(secretKeyString));
    } 
    // Nếu là base64 hoặc hex
    else {
      try {
        // Thử xem có phải hex không
        if (/^[0-9a-fA-F]+$/.test(secretKeyString) && secretKeyString.length === 128) {
          secretKey = Buffer.from(secretKeyString, 'hex');
        } 
        // Mặc định xử lý như base58
        else {
          const bs58 = require('bs58');
          secretKey = bs58.decode(secretKeyString);
        }
      } catch {
        // Nếu không đúng định dạng, báo lỗi
        throw new Error("Secret key không đúng định dạng");
      }
    }
    
    return Keypair.fromSecretKey(secretKey);
  } catch (e) {
    throw new Error(`Không thể tạo keypair: ${e.message}`);
  }
};

/**
 * Đọc keypair từ file
 * @param {string} filePath - Đường dẫn tới file
 * @returns {Keypair} - Keypair đọc được
 */
const readKeypairFromFile = (filePath) => {
  try {
    // Mở rộng ~ sang đường dẫn đầy đủ
    if (filePath.startsWith('~')) {
      filePath = filePath.replace('~', os.homedir());
    }
    
    // Đọc file
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const cleanedContent = fileContent.trim();
    
    // Xử lý nội dung file tùy theo định dạng
    return createKeypairFromSecretKey(cleanedContent);
  } catch (e) {
    throw new Error(`Không thể đọc keypair từ file: ${e.message}`);
  }
};

/**
 * Hiển thị secret key của keypair
 * @param {Keypair} keypair - Keypair cần hiển thị
 */
const showSecretKey = (keypair) => {
  // Hiển thị dạng mảng Uint8Array
  const secretKeyArray = Array.from(keypair.secretKey);
  console.log(chalk.yellow(`🔐 Secret Key (dạng mảng): [${secretKeyArray}]`));
  
  // Hiển thị dạng base58 (thường dùng cho Solana)
  const bs58 = require('bs58');
  const base58Key = bs58.encode(keypair.secretKey);
  console.log(chalk.yellow(`🔐 Secret Key (dạng base58): ${base58Key}`));
};

/**
 * Lấy kết nối Solana
 * @returns {Connection} - Kết nối Solana
 */
const getConnection = () => {
  // Xác định URL kết nối dựa vào môi trường
  const isLocalhost = CONNECTION_CONFIG.includes('localhost') || CONNECTION_CONFIG.includes('127.0.0.1');
  
  // Khởi tạo kết nối
  let connection;
  try {
    if (isLocalhost) {
      connection = new Connection(CONNECTION_CONFIG, 'confirmed');
      console.log(chalk.cyan('📡 Kết nối đến: Localnet (validator cục bộ)'));
    } else {
      connection = new Connection(CONNECTION_CONFIG, 'confirmed');
      console.log(chalk.cyan(`📡 Kết nối đến: ${CONNECTION_CONFIG}`));
    }
    return connection;
  } catch (e) {
    console.error(chalk.red(`❌ Không thể kết nối: ${e.message}`));
    throw e;
  }
};

/**
 * Kiểm tra số dư của địa chỉ
 * @param {PublicKey} address - Địa chỉ cần kiểm tra
 * @returns {number} - Số dư (lamports)
 */
const checkBalance = async (address) => {
  try {
    const connection = getConnection();
    const balance = await connection.getBalance(address);
    
    console.log(chalk.green(`💰 Số dư của địa chỉ ${address.toString()}:`));
    console.log(chalk.cyan(`   ${balance / LAMPORTS_PER_SOL} SOL (${balance} lamports)`));
    
    return balance;
  } catch (e) {
    console.error(chalk.red(`❌ Không thể kiểm tra số dư: ${e.message}`));
    return 0;
  }
};

/**
 * Yêu cầu airdrop SOL cho testing
 * @param {PublicKey} address - Địa chỉ cần airdrop
 * @returns {Promise<boolean>} - Thành công hay không
 */
const requestAirdrop = async (address) => {
  try {
    console.log(chalk.yellow('🚁 Đang yêu cầu airdrop 1 SOL...'));
    
    const connection = getConnection();
    const signature = await connection.requestAirdrop(
      address,
      1 * LAMPORTS_PER_SOL
    );
    
    await connection.confirmTransaction(signature);
    console.log(chalk.green('✅ Airdrop thành công 1 SOL!'));
    return true;
  } catch (e) {
    console.error(chalk.red(`❌ Không thể airdrop: ${e.message}`));
    console.log(chalk.yellow('⚠️ Airdrop chỉ hoạt động trên môi trường localnet hoặc devnet.'));
    return false;
  }
};

module.exports = {
  rl,
  question,
  createKeypairFromSecretKey,
  readKeypairFromFile,
  showSecretKey,
  getConnection,
  checkBalance,
  requestAirdrop
}; 