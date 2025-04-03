#!/usr/bin/env node

const chalk = require('chalk');
const { 
  init, 
  deposit, 
  transfer, 
  autoTransfer, 
  directTransfer,
  balance,
  treasuryBalance,
  claimCompoundInterest,
  fundTreasury,
  withdrawTreasury
} = require('./src/commands');
const { showHelp } = require('./src/commands/utils');

// Xử lý lệnh từ dòng lệnh
const command = process.argv[2];
const args = process.argv.slice(3);

// Đặt bộ bắt lỗi chung
process.on('unhandledRejection', (error) => {
  console.error(chalk.red('❌ Lỗi không xử lý được:'), error);
  process.exit(1);
});

// Tạo một bảng lệnh với mô tả ngắn
const commands = {
  'init': {
    fn: init,
    description: 'Khởi tạo vault với keypair của bạn',
    usage: 'init [đường dẫn đến keypair]'
  },
  'deposit': {
    fn: deposit,
    description: 'Gửi SOL vào treasury của bạn',
    usage: 'deposit [số lượng SOL] [đường dẫn đến keypair]'
  },
  'transfer': {
    fn: transfer,
    description: 'Chuyển SOL từ treasury của bạn đến địa chỉ đích',
    usage: 'transfer [số lượng SOL] [địa chỉ đích] [đường dẫn đến keypair]'
  },
  'auto-transfer': {
    fn: autoTransfer,
    description: 'Tự động khởi tạo, nạp và chuyển SOL trong một lệnh',
    usage: 'auto-transfer [số lượng SOL] [địa chỉ đích] [đường dẫn đến keypair]'
  },
  'direct-transfer': {
    fn: directTransfer,
    description: 'Chuyển SOL qua contract (deposit và transfer trong một lệnh)',
    usage: 'direct-transfer [số lượng SOL] [địa chỉ đích] [đường dẫn đến keypair]'
  },
  'balance': {
    fn: balance,
    description: 'Kiểm tra số dư của địa chỉ',
    usage: 'balance [địa chỉ (tùy chọn)] [đường dẫn đến keypair (tùy chọn)]'
  },
  'treasury-balance': {
    fn: treasuryBalance,
    description: 'Kiểm tra số dư trong treasury của bạn',
    usage: 'treasury-balance [đường dẫn đến keypair]'
  },
  'claim-interest': {
    fn: claimCompoundInterest,
    description: 'Nhận lãi kép đã tích lũy',
    usage: 'claim-interest [đường dẫn đến keypair]'
  },
  'fund-treasury': {
    fn: fundTreasury,
    description: 'Nạp SOL vào contract treasury để trả lãi',
    usage: 'fund-treasury [số lượng SOL] [đường dẫn đến keypair]'
  },
  'withdraw-treasury': {
    fn: withdrawTreasury,
    description: 'Rút SOL từ contract treasury (chỉ admin)',
    usage: 'withdraw-treasury [số lượng SOL] [địa chỉ nhận] [đường dẫn đến keypair]'
  },
  'help': {
    fn: () => showDetailedHelp(),
    description: 'Hiển thị thông tin trợ giúp',
    usage: 'help [tên lệnh (tùy chọn)]'
  }
};

// Hiển thị thông tin chi tiết về một lệnh cụ thể
function showCommandHelp(commandName) {
  const command = commands[commandName];
  if (!command) {
    console.error(chalk.red(`❌ Lệnh không tồn tại: ${commandName}`));
    return;
  }

  console.log(`
${chalk.green.bold(`Lệnh: ${commandName}`)}
${chalk.yellow('Mô tả:')} ${command.description}
${chalk.yellow('Cách sử dụng:')} ${chalk.cyan(`node cli.js ${command.usage}`)}
  `);
}

// Hiển thị trợ giúp chi tiết
function showDetailedHelp() {
  const specificCommand = args[0];
  
  if (specificCommand && commands[specificCommand]) {
    return showCommandHelp(specificCommand);
  }
  
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

// Hiển thị thông tin khi khởi chạy
console.log(chalk.bold.cyan(`
╔═══════════════════════════════════════════════╗
║       SOL Transfer CLI - Vault & Treasury     ║
╚═══════════════════════════════════════════════╝
`));

// Thực thi lệnh
async function runCommand() {
  // Nếu không có lệnh hoặc lệnh là help, hiển thị trợ giúp
  if (!command || command === 'help') {
    const cmdToShow = args[0];
    if (cmdToShow && commands[cmdToShow]) {
      showCommandHelp(cmdToShow);
    } else {
      showDetailedHelp();
    }
    return;
  }

  // Kiểm tra xem lệnh có tồn tại không
  const commandObj = commands[command];
  if (!commandObj) {
    console.error(chalk.red(`❌ Lệnh không hợp lệ: ${command}`));
    showDetailedHelp();
    return;
  }

  // Hiển thị thông tin đang thực thi
  console.log(chalk.yellow(`🚀 Đang thực thi lệnh: ${command}...`));

  // Thực thi lệnh với tham số
  try {
    await commandObj.fn(...args);
    console.log(chalk.green('✅ Thực thi lệnh thành công!'));
  } catch (error) {
    console.error(chalk.red(`❌ Lỗi khi thực thi lệnh '${command}':`), error.message);
    if (error.logs) {
      console.error(chalk.yellow('📜 Logs:'));
      error.logs.forEach(log => console.error(chalk.gray(`   ${log}`)));
    }
    process.exit(1);
  }
}

runCommand(); 