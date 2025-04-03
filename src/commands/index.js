const { PublicKey } = require('@solana/web3.js');
const { loadWalletFromInput, confirm } = require('../utils/input');
const { initializeVault, depositSol, transferSol, checkTreasuryBalance, autoTransferSol, directTransferSol, claimInterest, fundContractTreasury, withdrawFromContractTreasury } = require('../services/contract');
const { checkBalance } = require('../utils/wallet');
const { question } = require('./utils');
const { createWallet, loadWallet, importWallet, getBalance } = require('../services/wallet');
const { getConnection } = require('../utils/connection');

/**
 * Lệnh khởi tạo vault
 */
const init = async () => {
  const walletKeypair = await loadWalletFromInput();
  await initializeVault(walletKeypair);
};

/**
 * Lệnh gửi SOL vào treasury
 * @param {string} amountStr - Số lượng SOL
 */
const deposit = async (amountStr) => {
  if (!amountStr) {
    console.error('❌ Vui lòng chỉ định số lượng SOL: node cli.js deposit 0.1');
    return;
  }
  
  const amount = parseFloat(amountStr);
  const walletKeypair = await loadWalletFromInput();
  
  const confirmDeposit = await confirm(`🤔 Xác nhận gửi ${amount} SOL vào treasury? (y/n): `);
  if (confirmDeposit) {
    await depositSol(walletKeypair, amount);
  }
};

/**
 * Lệnh chuyển SOL từ treasury đến địa chỉ đích
 * @param {string} amountStr - Số lượng SOL
 * @param {string} destinationStr - Địa chỉ đích
 */
const transfer = async (amountStr, destinationStr) => {
  if (!amountStr) {
    console.error('❌ Vui lòng chỉ định số lượng SOL: node cli.js transfer 0.05 [địa_chỉ_đích]');
    return;
  }
  
  const amount = parseFloat(amountStr);
  const walletKeypair = await loadWalletFromInput();
  
  const destinationInput = destinationStr || await question('👉 Nhập địa chỉ ví đích: ');
  if (!destinationInput) {
    console.error('❌ Địa chỉ đích không được để trống');
    return;
  }
  
  try {
    const destination = new PublicKey(destinationInput);
    console.log(`📍 Địa chỉ đích: ${destination.toString()}`);
    
    const confirmTransfer = await confirm(`🤔 Xác nhận chuyển ${amount} SOL từ treasury đến địa chỉ trên? (y/n): `);
    if (confirmTransfer) {
      await transferSol(walletKeypair, amount, destination);
    }
  } catch (e) {
    console.error(`❌ Địa chỉ không hợp lệ: ${e.message}`);
  }
};

/**
 * Lệnh tự động chuyển SOL qua contract đến địa chỉ đích
 * @param {string} amountStr - Số lượng SOL
 * @param {string} destinationStr - Địa chỉ đích
 */
const autoTransfer = async (amountStr, destinationStr) => {
  if (!amountStr) {
    console.error('❌ Vui lòng chỉ định số lượng SOL: node cli.js auto-transfer 0.05 [địa_chỉ_đích]');
    return;
  }
  
  const amount = parseFloat(amountStr);
  const walletKeypair = await loadWalletFromInput();
  
  const destinationInput = destinationStr || await question('👉 Nhập địa chỉ ví đích: ');
  if (!destinationInput) {
    console.error('❌ Địa chỉ đích không được để trống');
    return;
  }
  
  try {
    const destination = new PublicKey(destinationInput);
    console.log(`📍 Địa chỉ đích: ${destination.toString()}`);
    
    const confirmAutoTransfer = await confirm(`🤔 Xác nhận gửi ${amount} SOL qua contract đến địa chỉ trên? (y/n): `);
    if (confirmAutoTransfer) {
      await autoTransferSol(walletKeypair, amount, destination);
    }
  } catch (e) {
    console.error(`❌ Địa chỉ không hợp lệ: ${e.message}`);
  }
};

/**
 * Lệnh chuyển SOL qua contract đến địa chỉ đích (hàm đơn)
 * @param {string} amountStr - Số lượng SOL
 * @param {string} destinationStr - Địa chỉ đích
 */
const directTransfer = async (amountStr, destinationStr) => {
  if (!amountStr) {
    console.error('❌ Vui lòng chỉ định số lượng SOL: node cli.js direct-transfer 0.05 [địa_chỉ_đích]');
    return;
  }
  
  const amount = parseFloat(amountStr);
  const walletKeypair = await loadWalletFromInput();
  
  const destinationInput = destinationStr || await question('👉 Nhập địa chỉ ví đích: ');
  if (!destinationInput) {
    console.error('❌ Địa chỉ đích không được để trống');
    return;
  }
  
  try {
    const destination = new PublicKey(destinationInput);
    console.log(`📍 Địa chỉ đích: ${destination.toString()}`);
    
    const confirmDirectTransfer = await confirm(`🤔 Xác nhận gửi ${amount} SOL vào contract và contract chuyển đến địa chỉ trên? (y/n): `);
    if (confirmDirectTransfer) {
      await directTransferSol(walletKeypair, amount, destination);
    }
  } catch (e) {
    console.error(`❌ Địa chỉ không hợp lệ: ${e.message}`);
  }
};

/**
 * Lệnh kiểm tra số dư của một địa chỉ
 * @param {string} addressStr - Địa chỉ cần kiểm tra
 */
const balance = async (addressStr) => {
  if (addressStr) {
    try {
      const address = new PublicKey(addressStr);
      await checkBalance(address);
    } catch (e) {
      console.error(`❌ Địa chỉ không hợp lệ: ${e.message}`);
    }
  } else {
    const walletKeypair = await loadWalletFromInput();
    await checkBalance(walletKeypair.publicKey);
  }
};

/**
 * Lệnh kiểm tra số dư treasury
 */
const treasuryBalance = async () => {
  const walletKeypair = await loadWalletFromInput();
  await checkTreasuryBalance(walletKeypair.publicKey);
};

/**
 * Lệnh để claim lãi kép từ contract
 */
const claimCompoundInterest = async () => {
  try {
    // Đọc keypair từ file
    const walletKeypair = await loadWalletFromInput();
    
    // Kiểm tra số dư hiện tại
    console.log('📊 Kiểm tra số dư và lãi tích lũy...');
    
    // Gọi hàm claim lãi từ contract
    await claimInterest(walletKeypair);
  } catch (error) {
    console.error(`❌ Lỗi khi claim lãi: ${error.message}`);
  }
};

/**
 * Lệnh nạp tiền vào contract treasury
 */
const fundTreasury = async (amountStr) => {
  try {
    if (!amountStr) {
      console.error('❌ Vui lòng chỉ định số lượng SOL: node cli.js fund-treasury 0.1');
      return;
    }
    
    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0) {
      console.log('❌ Số lượng không hợp lệ. Vui lòng nhập một số dương.');
      return;
    }
    
    // Đọc keypair từ file
    const walletKeypair = await loadWalletFromInput();

    // Truy vấn thông tin số dư
    await getBalance(walletKeypair.publicKey);

    const confirmFunding = await confirm(`🤔 Xác nhận nạp ${amount} SOL vào contract treasury để trả lãi? (y/n): `);
    if (confirmFunding) {
      // Nạp tiền vào contract treasury
      await fundContractTreasury(walletKeypair, amount);
    }
  } catch (error) {
    console.error(`❌ Lỗi khi nạp tiền vào contract treasury: ${error.message}`);
  }
};

/**
 * Lệnh để rút tiền từ contract treasury (chỉ dành cho admin)
 */
const withdrawTreasury = async (amountStr, recipientStr) => {
  try {
    if (!amountStr) {
      console.error('❌ Vui lòng chỉ định số lượng SOL: node cli.js withdraw-treasury 0.05 [địa_chỉ_nhận]');
      return;
    }
    
    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0) {
      console.log('❌ Số lượng không hợp lệ. Vui lòng nhập một số dương.');
      return;
    }

    // Đọc keypair từ file
    const walletKeypair = await loadWalletFromInput();

    // Truy vấn thông tin số dư
    await getBalance(walletKeypair.publicKey);

    // Lấy địa chỉ nhận
    const recipientInput = recipientStr || await question('👉 Nhập địa chỉ nhận SOL: ');
    if (!recipientInput) {
      console.error('❌ Địa chỉ nhận không được để trống');
      return;
    }
    
    let recipientPubkey;
    try {
      recipientPubkey = new PublicKey(recipientInput);
    } catch (error) {
      console.log('❌ Địa chỉ nhận không hợp lệ.');
      return;
    }

    const confirmWithdraw = await confirm(`🤔 Xác nhận rút ${amount} SOL từ contract treasury đến địa chỉ ${recipientPubkey.toString()}? (y/n): `);
    if (confirmWithdraw) {
      // Rút tiền từ contract treasury
      await withdrawFromContractTreasury(walletKeypair, amount, recipientPubkey);
    }
  } catch (error) {
    console.error(`❌ Lỗi khi rút tiền từ contract treasury: ${error.message}`);
  }
};

module.exports = {
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
}; 