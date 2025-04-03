const { Keypair } = require('@solana/web3.js');
const { rl, question, createKeypairFromSecretKey, readKeypairFromFile, showSecretKey, requestAirdrop, checkBalance } = require('./wallet');
const path = require('path');
const os = require('os');

/**
 * Chuyển đổi đường dẫn Windows sang định dạng Linux cho WSL
 * @param {string} windowsPath - Đường dẫn Windows (ví dụ: D:\file.txt)
 * @returns {string} - Đường dẫn WSL (ví dụ: /mnt/d/file.txt)
 */
const convertToWslPath = (windowsPath) => {
  if (!windowsPath) return windowsPath;
  
  // Chỉ chuyển đổi nếu là đường dẫn Windows
  if (windowsPath.match(/^[a-zA-Z]:\\/)) {
    // Lấy ký tự ổ đĩa
    const drive = windowsPath.charAt(0).toLowerCase();
    
    // Chuyển đổi C:\path\to\file thành /mnt/c/path/to/file
    return windowsPath
      .replace(/^[a-zA-Z]:/, `/mnt/${drive}`)
      .replace(/\\/g, '/');
  }
  
  return windowsPath;
};

/**
 * Hàm để load wallet từ người dùng với nhiều cách nhập
 * @returns {Promise<Keypair>} - Keypair của người dùng
 */
async function loadWalletFromInput() {
  try {
    console.log('\n=== 🔑 NHẬP THÔNG TIN VÍ ===');
    console.log('1. Nhập Secret Key trực tiếp');
    console.log('2. Đọc từ file Keypair');
    console.log('3. Tạo keypair mới cho testing');
    
    const choice = await question('👉 Chọn cách nhập (1-3): ');
    
    let walletKeypair;
    
    switch (choice) {
      case '1': {
        console.log('\n📝 Vui lòng nhập Secret Key (dạng mảng [số1, số2, ...] hoặc base58):');
        const secretKeyInput = await question('Secret Key: ');
        
        try {
          // Xử lý định dạng input
          let cleaned = secretKeyInput.trim();
          
          // Thử tạo keypair
          walletKeypair = createKeypairFromSecretKey(cleaned);
          console.log(`✅ Đã tạo keypair thành công với địa chỉ: ${walletKeypair.publicKey.toString()}`);
          
          // Kiểm tra và airdrop nếu cần
          const walletBalance = await checkBalance(walletKeypair.publicKey);
          if (walletBalance < 0.1 * 1_000_000_000) { // 0.1 SOL
            await requestAirdrop(walletKeypair.publicKey);
          }
        } catch (e) {
          throw new Error(`Secret Key không hợp lệ: ${e.message}`);
        }
        break;
      }
      
      case '2': {
        const filePath = await question('\n📄 Nhập đường dẫn đến file keypair (Windows hoặc WSL path): ');
        try {
          // Chuyển đổi đường dẫn Windows sang WSL nếu cần
          const wslPath = convertToWslPath(filePath);
          console.log(`🔄 Đang đọc từ đường dẫn: ${wslPath}`);
          
          walletKeypair = readKeypairFromFile(wslPath);
          console.log(`✅ Đã đọc keypair từ file với địa chỉ: ${walletKeypair.publicKey.toString()}`);
          await checkBalance(walletKeypair.publicKey);
        } catch (e) {
          throw new Error(`Không thể đọc file: ${e.message}`);
        }
        break;
      }
      
      case '3': {
        console.log('\n🆕 Tạo keypair mới cho testing...');
        walletKeypair = Keypair.generate();
        console.log(`✅ Đã tạo keypair mới với địa chỉ: ${walletKeypair.publicKey.toString()}`);
        
        // Hiển thị secret key cho người dùng
        showSecretKey(walletKeypair);
        
        // Request airdrop cho keypair mới
        await requestAirdrop(walletKeypair.publicKey);
        await checkBalance(walletKeypair.publicKey);
        break;
      }
      
      default:
        throw new Error('Lựa chọn không hợp lệ');
    }
    
    return walletKeypair;
  } catch (error) {
    console.error(`❌ Lỗi: ${error.message}`);
    const retry = await question('🔄 Bạn muốn thử lại? (y/n): ');
    if (retry.toLowerCase() === 'y') {
      return loadWalletFromInput();
    }
    rl.close();
    process.exit(1);
  }
}

/**
 * Hàm để xác nhận hành động từ người dùng
 * @param {string} message - Tin nhắn xác nhận
 * @returns {Promise<boolean>} - Có xác nhận hay không
 */
async function confirm(message) {
  const answer = await question(message);
  return answer.toLowerCase() === 'y';
}

module.exports = {
  loadWalletFromInput,
  confirm,
  convertToWslPath
}; 