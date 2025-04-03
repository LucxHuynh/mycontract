const chalk = require('chalk');

/**
 * Hiển thị thông tin trợ giúp
 */
function showHelp() {
  console.log(`
${chalk.green.bold('SOL Transfer CLI - Hệ thống quản lý Treasury với lãi kép')}

${chalk.yellow('Cách sử dụng:')}
  ${chalk.cyan('node cli.js <lệnh> [tùy chọn]')}

${chalk.yellow('Các lệnh và tính năng chính:')}
  ${chalk.cyan('init')}               - Khởi tạo vault với keypair của bạn
  ${chalk.cyan('deposit')}            - Gửi SOL vào treasury của bạn
  ${chalk.cyan('transfer')}           - Chuyển SOL từ treasury của bạn đến địa chỉ đích
  ${chalk.cyan('auto-transfer')}      - Tự động khởi tạo, nạp và chuyển SOL trong một lệnh
  ${chalk.cyan('direct-transfer')}    - Chuyển SOL qua contract (deposit và transfer trong một lệnh)
  ${chalk.cyan('balance')}            - Kiểm tra số dư của địa chỉ
  ${chalk.cyan('treasury-balance')}   - Kiểm tra số dư trong treasury của bạn
  ${chalk.cyan('claim-interest')}     - Nhận lãi kép đã tích lũy (5% APY)
  ${chalk.cyan('fund-treasury')}      - Nạp SOL vào contract treasury để trả lãi
  ${chalk.cyan('withdraw-treasury')}  - Rút SOL từ contract treasury (chỉ admin)
  ${chalk.cyan('help')}               - Hiển thị thông tin trợ giúp này

${chalk.yellow('Ví dụ thông dụng:')}
  ${chalk.cyan('node cli.js init')}
  ${chalk.cyan('node cli.js deposit 0.1')}
  ${chalk.cyan('node cli.js transfer 0.05 [địa chỉ đích]')}
  ${chalk.cyan('node cli.js claim-interest')}

${chalk.yellow('Để xem chi tiết về một lệnh cụ thể:')}
  ${chalk.cyan('node cli.js help [tên lệnh]')}
  `);
}

// Tạo readline interface
const readline = require('readline');

/**
 * Hỏi người dùng và nhận phản hồi
 * @param {string} question Câu hỏi muốn hỏi người dùng
 * @returns {Promise<string>} Phản hồi của người dùng
 */
async function question(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

/**
 * Hỏi người dùng xác nhận (yes/no)
 * @param {string} question Câu hỏi xác nhận
 * @returns {Promise<boolean>} Kết quả xác nhận
 */
async function confirm(question) {
  const answer = await question(`${question} (y/n): `);
  return answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes';
}

/**
 * Format số dư SOL để hiển thị đẹp hơn
 * @param {number} lamports Số dư tính bằng lamports
 * @returns {string} Chuỗi hiển thị số dư đã định dạng
 */
function formatBalance(lamports) {
  const sol = lamports / 1_000_000_000;
  return `${sol.toFixed(9)} SOL (${lamports.toLocaleString()} lamports)`;
}

module.exports = {
  showHelp,
  question,
  confirm,
  formatBalance
}; 