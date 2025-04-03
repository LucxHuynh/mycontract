#!/usr/bin/env node

const chalk = require('chalk');
const readline = require('readline');
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

// Tạo interface readline với tắt echo để ngăn hiển thị nhập liệu kép
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false // Tắt chế độ terminal để tránh hiển thị kép
});

// Hàm hỏi người dùng
const question = (question) => {
  return new Promise((resolve) => {
    process.stdout.write(question); // Sử dụng process.stdout.write thay vì rl.question
    rl.once('line', (answer) => {
      resolve(answer.trim());
    });
  });
};

// Hiển thị menu chính
async function showMainMenu() {
  console.clear(); // Xóa màn hình
  console.log(`${chalk.bold.cyan('=== SOL TRANSFER MENU ===')}

${chalk.cyan('1.')} Khởi tạo vault
${chalk.cyan('2.')} Gửi SOL vào treasury
${chalk.cyan('3.')} Chuyển SOL từ treasury
${chalk.cyan('4.')} Tự động khởi tạo và chuyển
${chalk.cyan('5.')} Chuyển SOL qua contract
${chalk.cyan('6.')} Kiểm tra số dư địa chỉ
${chalk.cyan('7.')} Kiểm tra số dư treasury
${chalk.cyan('8.')} Nhận lãi kép
${chalk.cyan('9.')} Nạp SOL vào contract treasury
${chalk.cyan('0.')} Thoát`);

  const choice = await question(chalk.green('\nNhập số (0-9): '));
  
  // Xử lý lựa chọn
  switch (choice) {
    case '0':
      console.log(chalk.yellow('👋 Tạm biệt!'));
      rl.close();
      process.exit(0);
      break;
    case '1':
      await handleInit();
      break;
    case '2':
      await handleDeposit();
      break;
    case '3':
      await handleTransfer();
      break;
    case '4':
      await handleAutoTransfer();
      break;
    case '5':
      await handleDirectTransfer();
      break;
    case '6':
      await handleBalance();
      break;
    case '7':
      await handleTreasuryBalance();
      break;
    case '8':
      await handleClaimInterest();
      break;
    case '9':
      await handleFundTreasury();
      break;
    default:
      console.log(chalk.red('❌ Lựa chọn không hợp lệ (0-9)'));
  }
  
  // Đợi người dùng bấm phím trước khi hiển thị lại menu
  await waitForKey();
  return showMainMenu();
}

// Đợi người dùng bấm phím bất kỳ để tiếp tục
async function waitForKey() {
  console.log(chalk.green('\nBấm phím bất kỳ để tiếp tục...'));
  
  return new Promise(resolve => {
    rl.once('line', () => {
      resolve();
    });
  });
}

// Xử lý khởi tạo vault
async function handleInit() {
  console.clear();
  console.log(chalk.bold.cyan('=== Khởi tạo Vault ===\n'));
  
  try {
    await init();
    console.log(chalk.green('✅ Khởi tạo vault thành công!'));
  } catch (error) {
    console.error(chalk.red(`❌ Lỗi: ${error.message}`));
  }
}

// Xử lý gửi SOL
async function handleDeposit() {
  console.clear();
  console.log(chalk.bold.cyan('=== Gửi SOL vào Treasury ===\n'));
  
  try {
    const amount = await question(chalk.yellow('Số lượng SOL: '));
    
    // Kiểm tra giá trị hợp lệ
    if (isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      console.log(chalk.red('❌ Số lượng không hợp lệ'));
      return;
    }
    
    await deposit(amount);
    console.log(chalk.green(`✅ Đã gửi ${amount} SOL thành công!`));
  } catch (error) {
    console.error(chalk.red(`❌ Lỗi: ${error.message}`));
  }
}

// Xử lý chuyển SOL
async function handleTransfer() {
  console.clear();
  console.log(chalk.bold.cyan('=== Chuyển SOL từ Treasury ===\n'));
  
  try {
    const amount = await question(chalk.yellow('Số lượng SOL: '));
    
    // Kiểm tra giá trị hợp lệ
    if (isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      console.log(chalk.red('❌ Số lượng không hợp lệ'));
      return;
    }
    
    const destination = await question(chalk.yellow('Địa chỉ đích: '));
    
    // Kiểm tra địa chỉ
    if (!destination || destination.length < 32) {
      console.log(chalk.red('❌ Địa chỉ không hợp lệ'));
      return;
    }
    
    await transfer(amount, destination);
    console.log(chalk.green(`✅ Đã chuyển ${amount} SOL thành công!`));
  } catch (error) {
    console.error(chalk.red(`❌ Lỗi: ${error.message}`));
  }
}

// Xử lý auto transfer
async function handleAutoTransfer() {
  console.clear();
  console.log(chalk.bold.cyan('=== Tự Động Khởi Tạo và Chuyển SOL ===\n'));
  
  try {
    const amount = await question(chalk.yellow('Số lượng SOL: '));
    
    // Kiểm tra giá trị hợp lệ
    if (isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      console.log(chalk.red('❌ Số lượng không hợp lệ'));
      return;
    }
    
    const destination = await question(chalk.yellow('Địa chỉ đích: '));
    
    // Kiểm tra địa chỉ
    if (!destination || destination.length < 32) {
      console.log(chalk.red('❌ Địa chỉ không hợp lệ'));
      return;
    }
    
    await autoTransfer(amount, destination);
    console.log(chalk.green(`✅ Đã tự động chuyển ${amount} SOL thành công!`));
  } catch (error) {
    console.error(chalk.red(`❌ Lỗi: ${error.message}`));
  }
}

// Xử lý direct transfer
async function handleDirectTransfer() {
  console.clear();
  console.log(chalk.bold.cyan('=== Chuyển SOL Qua Contract ===\n'));
  
  try {
    const amount = await question(chalk.yellow('Số lượng SOL: '));
    
    // Kiểm tra giá trị hợp lệ
    if (isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      console.log(chalk.red('❌ Số lượng không hợp lệ'));
      return;
    }
    
    const destination = await question(chalk.yellow('Địa chỉ đích: '));
    
    // Kiểm tra địa chỉ
    if (!destination || destination.length < 32) {
      console.log(chalk.red('❌ Địa chỉ không hợp lệ'));
      return;
    }
    
    await directTransfer(amount, destination);
    console.log(chalk.green(`✅ Đã chuyển ${amount} SOL qua contract thành công!`));
  } catch (error) {
    console.error(chalk.red(`❌ Lỗi: ${error.message}`));
  }
}

// Xử lý kiểm tra số dư
async function handleBalance() {
  console.clear();
  console.log(chalk.bold.cyan('=== Kiểm Tra Số Dư Địa Chỉ ===\n'));
  
  try {
    const useAddress = await question(chalk.yellow('Kiểm tra địa chỉ cụ thể? (y/n): '));
    
    if (useAddress.toLowerCase() === 'y') {
      const address = await question(chalk.yellow('Nhập địa chỉ: '));
      await balance(address);
    } else {
      await balance();
    }
  } catch (error) {
    console.error(chalk.red(`❌ Lỗi: ${error.message}`));
  }
}

// Xử lý kiểm tra số dư treasury
async function handleTreasuryBalance() {
  console.clear();
  console.log(chalk.bold.cyan('=== Kiểm Tra Số Dư Treasury ===\n'));
  
  try {
    await treasuryBalance();
  } catch (error) {
    console.error(chalk.red(`❌ Lỗi: ${error.message}`));
  }
}

// Xử lý nhận lãi kép
async function handleClaimInterest() {
  console.clear();
  console.log(chalk.bold.cyan('=== Nhận Lãi Kép ===\n'));
  
  try {
    await claimCompoundInterest();
    console.log(chalk.green('✅ Đã nhận lãi kép thành công!'));
  } catch (error) {
    console.error(chalk.red(`❌ Lỗi: ${error.message}`));
  }
}

// Xử lý nạp tiền vào contract treasury
async function handleFundTreasury() {
  console.clear();
  console.log(chalk.bold.cyan('=== Nạp SOL Vào Contract Treasury ===\n'));
  
  try {
    const amount = await question(chalk.yellow('Số lượng SOL: '));
    
    // Kiểm tra giá trị hợp lệ
    if (isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      console.log(chalk.red('❌ Số lượng không hợp lệ'));
      return;
    }
    
    await fundTreasury(amount);
    console.log(chalk.green(`✅ Đã nạp ${amount} SOL vào contract treasury!`));
  } catch (error) {
    console.error(chalk.red(`❌ Lỗi: ${error.message}`));
  }
}

// Bắt lỗi không xử lý được
process.on('unhandledRejection', (error) => {
  console.error(chalk.red(`❌ Lỗi không xử lý được: ${error.message}`));
  rl.close();
  process.exit(1);
});

// Bắt CTRL+C để thoát
process.on('SIGINT', () => {
  console.log(chalk.yellow('\n👋 Tạm biệt!'));
  rl.close();
  process.exit(0);
});

// Bắt đầu chương trình
console.clear();
console.log(chalk.green('Đang khởi động...'));
showMainMenu().catch(error => {
  console.error(chalk.red(`❌ Lỗi: ${error.message}`));
  rl.close();
  process.exit(1);
}); 