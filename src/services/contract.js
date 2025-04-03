const { Program, AnchorProvider, BN } = require('@project-serum/anchor');
const anchor = require('@project-serum/anchor');
const { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } = require('@solana/web3.js');
const { getConnection, loadIDL, PROGRAM_ID } = require('../utils/connection');
const { findVaultPDA, findTreasuryPDA, findContractTreasuryPDA } = require('../utils/pda');

/**
 * Tạo Anchor Provider từ keypair của người dùng
 * @param {Keypair} walletKeypair - Keypair của người dùng
 * @returns {AnchorProvider} - Đối tượng Anchor Provider
 */
const createProvider = (walletKeypair) => {
  const connection = getConnection();
  const wallet = {
    publicKey: walletKeypair.publicKey,
    signTransaction: async (transaction) => {
      transaction.partialSign(walletKeypair);
      return transaction;
    },
    signAllTransactions: async (transactions) => {
      return transactions.map((transaction) => {
        transaction.partialSign(walletKeypair);
        return transaction;
      });
    },
  };
  
  return new AnchorProvider(connection, wallet, {
    preflightCommitment: 'confirmed',
  });
};

/**
 * Tạo đối tượng Program từ Provider
 * @param {AnchorProvider} provider - Đối tượng Anchor Provider
 * @returns {Program} - Đối tượng Anchor Program
 */
const createProgram = (provider) => {
  const idl = loadIDL();
  return new Program(idl, PROGRAM_ID, provider);
};

/**
 * Khởi tạo vault để lưu trữ SOL
 * @param {Keypair} walletKeypair - Keypair của người dùng
 */
const initializeVault = async (walletKeypair) => {
  try {
    console.log(`\n🔑 Ví của bạn: ${walletKeypair.publicKey.toString()}`);
    console.log('\n🔄 Đang khởi tạo vault...');
    
    // Tìm PDAs cho vault và treasury
    const [vaultPDA, vaultBump] = await findVaultPDA(walletKeypair.publicKey);
    const [treasuryPDA] = await findTreasuryPDA(walletKeypair.publicKey);
    const [contractTreasuryPDA] = await findContractTreasuryPDA();
    
    // Khởi tạo vault
    const provider = createProvider(walletKeypair);
    const program = createProgram(provider);
    
    // Kiểm tra vault đã tồn tại chưa
    try {
      const vault = await program.account.vault.fetch(vaultPDA);
      console.log('\n✅ Vault đã được khởi tạo trước đó:');
      console.log(`   Vault: ${vaultPDA.toString()}`);
      console.log(`   Treasury: ${treasuryPDA.toString()}`);
      console.log(`   Contract Treasury: ${contractTreasuryPDA.toString()}`);
      console.log(`   Authority: ${vault.authority.toString()}`);
      return vault;
    } catch (e) {
      // Nếu không tìm thấy vault, tạo mới
      console.log('\n🔄 Đang khởi tạo vault mới...');
      
      const tx = await program.methods
        .initialize()
        .accounts({
          vault: vaultPDA,
          treasury: treasuryPDA,
          contractTreasury: contractTreasuryPDA,
          authority: walletKeypair.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
          clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
        })
        .signers([walletKeypair])
        .rpc();
      
      console.log('\n✅ Đã khởi tạo vault thành công');
      console.log(`   Transaction: ${tx}`);
      console.log(`   Vault: ${vaultPDA.toString()}`);
      console.log(`   Treasury: ${treasuryPDA.toString()}`);
      console.log(`   Contract Treasury: ${contractTreasuryPDA.toString()}`);
      
      const vault = await program.account.vault.fetch(vaultPDA);
      return vault;
    }
  } catch (error) {
    console.error(`\n❌ Lỗi khi khởi tạo vault: ${error.message}`);
    throw error;
  }
};

/**
 * Gửi SOL vào treasury
 * @param {Keypair} walletKeypair - Keypair của người dùng
 * @param {number} amount - Số lượng SOL
 */
const depositSol = async (walletKeypair, amount) => {
  try {
    console.log(`\n🔑 Ví của bạn: ${walletKeypair.publicKey.toString()}`);
    
    // Kiểm tra số dư
    const connection = getConnection();
    const balance = await connection.getBalance(walletKeypair.publicKey);
    const balanceInSOL = balance / LAMPORTS_PER_SOL;
    
    console.log(`💰 Số dư hiện tại: ${balanceInSOL.toFixed(7)} SOL`);
    
    if (balanceInSOL < amount) {
      throw new Error(`Không đủ SOL để gửi. Bạn cần tối thiểu ${amount} SOL`);
    }
    
    // Tìm PDA cho treasury
    const [vaultPDA] = await findVaultPDA(walletKeypair.publicKey);
    const [treasuryPDA] = await findTreasuryPDA(walletKeypair.publicKey);
    const [contractTreasuryPDA] = await findContractTreasuryPDA();
    
    // Khởi tạo vault nếu chưa tồn tại
    const provider = createProvider(walletKeypair);
    const program = createProgram(provider);
    
    try {
      await program.account.vault.fetch(vaultPDA);
    } catch (e) {
      console.log('\n⚠️ Vault chưa được khởi tạo. Đang khởi tạo...');
      await initializeVault(walletKeypair);
    }
    
    // Gửi SOL vào treasury
    console.log(`\n🔄 Đang gửi ${amount} SOL vào treasury...`);
    
    const lamports = amount * LAMPORTS_PER_SOL;
    const tx = await program.methods
      .depositSol(new BN(lamports))
      .accounts({
        sender: walletKeypair.publicKey,
        vault: vaultPDA,
        treasury: treasuryPDA,
        contractTreasury: contractTreasuryPDA,
        systemProgram: anchor.web3.SystemProgram.programId,
        clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
      })
      .signers([walletKeypair])
      .rpc();
    
    console.log(`\n✅ Đã gửi ${amount} SOL vào treasury`);
    console.log(`   Transaction: ${tx}`);
    
    // Kiểm tra số dư mới
    const newBalance = await connection.getBalance(walletKeypair.publicKey);
    const newBalanceInSOL = newBalance / LAMPORTS_PER_SOL;
    console.log(`💰 Số dư mới: ${newBalanceInSOL.toFixed(7)} SOL`);
    
    return tx;
  } catch (error) {
    console.error(`\n❌ Lỗi khi gửi SOL: ${error.message}`);
    throw error;
  }
};

/**
 * Chuyển SOL từ treasury đến địa chỉ đích
 * @param {Keypair} walletKeypair - Keypair của người dùng
 * @param {number} amount - Số lượng SOL
 * @param {PublicKey} destination - Địa chỉ đích
 */
const transferSol = async (walletKeypair, amount, destination) => {
  try {
    console.log(`\n🔑 Ví của bạn: ${walletKeypair.publicKey.toString()}`);
    console.log(`📍 Địa chỉ đích: ${destination.toString()}`);
    
    // Tìm PDA cho vault và treasury
    const [vaultPDA] = await findVaultPDA(walletKeypair.publicKey);
    const [treasuryPDA] = await findTreasuryPDA(walletKeypair.publicKey);
    const [contractTreasuryPDA] = await findContractTreasuryPDA();
    
    // Kiểm tra số dư trong treasury
    const connection = getConnection();
    const treasuryBalance = await connection.getBalance(treasuryPDA);
    const treasuryBalanceInSOL = treasuryBalance / LAMPORTS_PER_SOL;
    
    console.log(`\n💰 Số dư trong treasury: ${treasuryBalanceInSOL.toFixed(7)} SOL`);
    
    if (treasuryBalanceInSOL < amount) {
      throw new Error(`Không đủ SOL trong treasury. Hiện có ${treasuryBalanceInSOL.toFixed(7)} SOL`);
    }
    
    // Chuyển SOL từ treasury đến địa chỉ đích
    console.log(`\n🔄 Đang chuyển ${amount} SOL từ treasury đến địa chỉ đích...`);
    
    const provider = createProvider(walletKeypair);
    const program = createProgram(provider);
    
    try {
      await program.account.vault.fetch(vaultPDA);
    } catch (e) {
      throw new Error('Vault chưa được khởi tạo. Vui lòng khởi tạo vault trước.');
    }
    
    const lamports = amount * LAMPORTS_PER_SOL;
    const tx = await program.methods
      .transferSol(new BN(lamports), destination)
      .accounts({
        authority: walletKeypair.publicKey,
        vault: vaultPDA,
        treasury: treasuryPDA,
        contractTreasury: contractTreasuryPDA,
        destination: destination,
        systemProgram: anchor.web3.SystemProgram.programId,
        clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
      })
      .signers([walletKeypair])
      .rpc();
    
    console.log(`\n✅ Đã chuyển ${amount} SOL đến địa chỉ đích`);
    console.log(`   Transaction: ${tx}`);
    
    // Kiểm tra số dư mới của treasury và địa chỉ đích
    const newTreasuryBalance = await connection.getBalance(treasuryPDA);
    const newTreasuryBalanceInSOL = newTreasuryBalance / LAMPORTS_PER_SOL;
    console.log(`💰 Số dư mới của treasury: ${newTreasuryBalanceInSOL.toFixed(7)} SOL`);
    
    const destinationBalance = await connection.getBalance(destination);
    const destinationBalanceInSOL = destinationBalance / LAMPORTS_PER_SOL;
    console.log(`💰 Số dư của địa chỉ đích: ${destinationBalanceInSOL.toFixed(7)} SOL`);
    
    return tx;
  } catch (error) {
    console.error(`\n❌ Lỗi khi chuyển SOL: ${error.message}`);
    throw error;
  }
};

/**
 * Kiểm tra số dư trong treasury
 * @param {Keypair} walletKeypair - Keypair của người dùng
 * @returns {Promise<number>} - Số dư trong treasury (SOL)
 */
const checkTreasuryBalance = async (walletKeypair) => {
  try {
    console.log(`\n🔑 Ví của bạn: ${walletKeypair.publicKey.toString()}`);
    
    // Tìm treasury PDA
    const [treasuryPDA] = await findTreasuryPDA(walletKeypair.publicKey);
    
    // Kiểm tra số dư
    const connection = getConnection();
    const balance = await connection.getBalance(treasuryPDA);
    const balanceInSOL = balance / LAMPORTS_PER_SOL;
    
    console.log(`\n💰 Số dư trong treasury: ${balanceInSOL.toFixed(7)} SOL`);
    console.log(`   Treasury: ${treasuryPDA.toString()}`);
    
    // Kiểm tra vault
    const provider = createProvider(walletKeypair);
    const program = createProgram(provider);
    const [vaultPDA] = await findVaultPDA(walletKeypair.publicKey);
    
    try {
      const vault = await program.account.vault.fetch(vaultPDA);
      console.log(`   Vault: ${vaultPDA.toString()}`);
      console.log(`   Authority: ${vault.authority.toString()}`);
    } catch (e) {
      console.log(`\n⚠️ Vault chưa được khởi tạo cho ví này.`);
    }
    
    return balanceInSOL;
  } catch (error) {
    console.error(`\n❌ Lỗi khi kiểm tra số dư treasury: ${error.message}`);
    throw error;
  }
};

/**
 * Tự động chuyển SOL qua contract đến địa chỉ đích
 * @param {Keypair} walletKeypair - Keypair của người dùng
 * @param {number} amount - Số lượng SOL
 * @param {PublicKey} destination - Địa chỉ đích
 */
const autoTransferSol = async (walletKeypair, amount, destination) => {
  try {
    console.log(`\n🔑 Ví của bạn: ${walletKeypair.publicKey.toString()}`);
    console.log(`📍 Địa chỉ đích: ${destination.toString()}`);
    
    // Kiểm tra số dư ví
    const connection = getConnection();
    const walletBalance = await connection.getBalance(walletKeypair.publicKey);
    const walletBalanceInSOL = walletBalance / LAMPORTS_PER_SOL;
    
    console.log(`\n💰 Số dư ví của bạn: ${walletBalanceInSOL.toFixed(7)} SOL`);
    
    if (walletBalanceInSOL < amount) {
      throw new Error(`Không đủ SOL trong ví. Hiện có ${walletBalanceInSOL.toFixed(7)} SOL, cần ${amount} SOL`);
    }
    
    // Khởi tạo vault nếu chưa tồn tại
    console.log('\n1️⃣ Kiểm tra và khởi tạo vault nếu cần...');
    await initializeVault(walletKeypair);
    
    // Gửi SOL vào treasury
    console.log(`\n2️⃣ Gửi ${amount} SOL vào treasury...`);
    await depositSol(walletKeypair, amount);
    
    // Chuyển SOL từ treasury đến địa chỉ đích
    console.log(`\n3️⃣ Chuyển ${amount} SOL từ treasury đến địa chỉ đích...`);
    const txId = await transferSol(walletKeypair, amount, destination);
    
    console.log(`\n✅ Đã hoàn tất quy trình chuyển SOL!`);
    console.log(`   Transaction ID: ${txId}`);
    
    return txId;
  } catch (error) {
    console.error(`\n❌ Lỗi trong quá trình tự động chuyển SOL: ${error.message}`);
    throw error;
  }
};

/**
 * Chuyển SOL vào contract và contract chuyển tiếp đến địa chỉ đích
 * @param {Keypair} walletKeypair - Keypair của người dùng
 * @param {number} amount - Số lượng SOL
 * @param {PublicKey} destination - Địa chỉ đích
 * @returns {Promise<string>} - Transaction ID
 */
const directTransferSol = async (walletKeypair, amount, destination) => {
  try {
    console.log(`\n🔑 Ví của bạn: ${walletKeypair.publicKey.toString()}`);
    console.log(`📍 Địa chỉ đích: ${destination.toString()}`);
    
    // Kiểm tra số dư ví
    const connection = getConnection();
    const walletBalance = await connection.getBalance(walletKeypair.publicKey);
    const walletBalanceInSOL = walletBalance / LAMPORTS_PER_SOL;
    
    console.log(`\n💰 Số dư ví của bạn: ${walletBalanceInSOL.toFixed(7)} SOL`);
    
    if (walletBalanceInSOL < amount + 0.001) { // Thêm phí giao dịch
      throw new Error(`Không đủ SOL trong ví. Hiện có ${walletBalanceInSOL.toFixed(7)} SOL, cần ${amount + 0.001} SOL (bao gồm phí giao dịch)`);
    }
    
    // Tìm PDAs cho vault và treasury
    const [vaultPDA, vaultBump] = await findVaultPDA(walletKeypair.publicKey);
    const [treasuryPDA] = await findTreasuryPDA(walletKeypair.publicKey);
    const [contractTreasuryPDA] = await findContractTreasuryPDA();
    
    // Khởi tạo provider và program
    const provider = createProvider(walletKeypair);
    const program = createProgram(provider);
    
    // Khởi tạo vault nếu chưa tồn tại
    try {
      await program.account.vault.fetch(vaultPDA);
      console.log('\n✅ Vault đã tồn tại, tiếp tục giao dịch');
    } catch (e) {
      console.log('\n🔄 Vault chưa tồn tại, đang khởi tạo...');
      await initializeVault(walletKeypair);
    }
    
    console.log(`\n🔄 Đang thực hiện chuyển ${amount} SOL thông qua contract đến ${destination.toString()}...`);
    
    // Tạo transaction gửi SOL vào treasury
    const lamports = amount * LAMPORTS_PER_SOL;
    
    // 1. Gửi SOL vào treasury
    console.log(`\n1️⃣ Đang gửi ${amount} SOL vào treasury...`);
    const depositTx = await program.methods
      .depositSol(new BN(lamports))
      .accounts({
        sender: walletKeypair.publicKey,
        vault: vaultPDA,
        treasury: treasuryPDA,
        contractTreasury: contractTreasuryPDA,
        systemProgram: anchor.web3.SystemProgram.programId,
        clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
      })
      .signers([walletKeypair])
      .rpc();
    
    console.log(`✅ Đã gửi SOL vào treasury. Transaction ID: ${depositTx}`);
    
    // Đợi một chút để giao dịch được xác nhận
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 2. Chuyển SOL từ treasury đến địa chỉ đích
    console.log(`\n2️⃣ Đang chuyển ${amount} SOL từ treasury đến địa chỉ đích...`);
    const transferTx = await program.methods
      .transferSol(new BN(lamports), destination)
      .accounts({
        authority: walletKeypair.publicKey,
        vault: vaultPDA,
        treasury: treasuryPDA,
        contractTreasury: contractTreasuryPDA,
        destination: destination,
        systemProgram: anchor.web3.SystemProgram.programId,
        clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
      })
      .signers([walletKeypair])
      .rpc();
    
    console.log(`✅ Đã chuyển SOL đến địa chỉ đích. Transaction ID: ${transferTx}`);
    
    // Kiểm tra số dư của địa chỉ đích sau khi chuyển
    const destinationBalance = await connection.getBalance(destination);
    const destinationBalanceInSOL = destinationBalance / LAMPORTS_PER_SOL;
    console.log(`\n💰 Số dư của địa chỉ đích: ${destinationBalanceInSOL.toFixed(7)} SOL`);
    
    console.log(`\n✅ Đã hoàn tất quy trình chuyển SOL qua contract!`);
    
    return { depositTx, transferTx };
  } catch (error) {
    console.error(`\n❌ Lỗi khi chuyển SOL: ${error.message}`);
    throw error;
  }
};

/**
 * Tính lãi kép cho vault (5% APY) và yêu cầu thanh toán lãi từ contract treasury
 * @param {Keypair} walletKeypair - Keypair của người dùng
 * @returns {Promise<string>} - Transaction ID
 */
const claimInterest = async (walletKeypair) => {
  try {
    console.log(`\n🔑 Ví của bạn: ${walletKeypair.publicKey.toString()}`);
    
    // Tìm PDA cho vault và treasury
    const [vaultPDA] = await findVaultPDA(walletKeypair.publicKey);
    const [treasuryPDA] = await findTreasuryPDA(walletKeypair.publicKey);
    const [contractTreasuryPDA] = await findContractTreasuryPDA();
    
    // Khởi tạo provider và program
    const provider = createProvider(walletKeypair);
    const program = createProgram(provider);
    
    // Kiểm tra vault đã tồn tại chưa
    try {
      const vaultAccount = await program.account.vault.fetch(vaultPDA);
      
      // Tính toán thông tin lãi suất dự kiến theo thời gian thực
      const now = Math.floor(Date.now() / 1000); // Thời gian hiện tại (unix timestamp)
      const lastClaimTime = vaultAccount.lastInterestClaimTime.toNumber();
      const timeElapsed = now - lastClaimTime;
      const secondsElapsed = timeElapsed;
      
      // Tính toán và hiển thị thông tin lãi suất
      const totalDeposited = vaultAccount.totalDeposited.toNumber() / LAMPORTS_PER_SOL;
      const accruedInterest = vaultAccount.accruedInterest.toNumber() / LAMPORTS_PER_SOL;
      const interestRatePerSecond = 0.05 / (100 * 31536000); // 5% APY chia cho số giây trong năm
      const estimatedNewInterest = totalDeposited * interestRatePerSecond * secondsElapsed;
      const totalEstimatedInterest = accruedInterest + estimatedNewInterest;
      
      console.log(`\n💰 Thông tin vault của bạn:`);
      console.log(`   Số tiền gửi hiện tại: ${totalDeposited.toFixed(7)} SOL`);
      console.log(`   Lãi đã tích lũy nhưng chưa thanh toán: ${accruedInterest.toFixed(7)} SOL`);
      console.log(`   Thời gian gửi cuối: ${new Date(vaultAccount.lastDepositTime.toNumber() * 1000).toLocaleString()}`);
      console.log(`   Thời gian tính lãi cuối: ${new Date(lastClaimTime * 1000).toLocaleString()}`);
      console.log(`   Thời gian đã trôi qua: ${secondsElapsed} giây`);
      console.log(`   Lãi mới ước tính: ${estimatedNewInterest.toFixed(9)} SOL`);
      console.log(`   Tổng lãi ước tính: ${totalEstimatedInterest.toFixed(9)} SOL`);
      
      // Nếu quá ít thời gian trôi qua, cảnh báo người dùng
      if (timeElapsed < 1) {
        console.log(`\n⏰ Bạn vừa mới tính lãi. Vui lòng đợi ít nhất 1 giây trước khi tính lãi tiếp.`);
        return null;
      }
      
      // Kiểm tra số dư trong contract treasury
      const connection = getConnection();
      const contractTreasuryBalance = await connection.getBalance(contractTreasuryPDA);
      const contractTreasuryBalanceInSOL = contractTreasuryBalance / LAMPORTS_PER_SOL;
      console.log(`   Số dư trong Contract Treasury: ${contractTreasuryBalanceInSOL.toFixed(7)} SOL`);
      
      // So sánh lãi ước tính với số dư trong contract treasury
      if (contractTreasuryBalanceInSOL < totalEstimatedInterest) {
        console.log(`\n⚠️ Cảnh báo: Số dư trong Contract Treasury (${contractTreasuryBalanceInSOL.toFixed(7)} SOL) có thể không đủ để thanh toán lãi (${totalEstimatedInterest.toFixed(7)} SOL).`);
        console.log(`   Bạn có thể cần phải nạp thêm tiền vào Contract Treasury.`);
      }
      
      // Gọi hàm claim_interest từ contract
      console.log(`\n🔄 Đang tính lãi và yêu cầu thanh toán từ contract treasury...`);
      
      const tx = await program.methods
        .claimInterest()
        .accounts({
          authority: walletKeypair.publicKey,
          vault: vaultPDA,
          treasury: treasuryPDA,
          contractTreasury: contractTreasuryPDA,
          systemProgram: anchor.web3.SystemProgram.programId,
          clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
        })
        .signers([walletKeypair])
        .rpc();
      
      console.log(`\n✅ Đã tính lãi và nhận thanh toán từ contract treasury thành công`);
      console.log(`   Transaction: ${tx}`);
      
      // Lấy thông tin vault mới
      const updatedVault = await program.account.vault.fetch(vaultPDA);
      const newTotalDeposited = updatedVault.totalDeposited.toNumber() / LAMPORTS_PER_SOL;
      const interestEarned = newTotalDeposited - totalDeposited;
      
      console.log(`   Số tiền trong vault mới: ${newTotalDeposited.toFixed(7)} SOL`);
      console.log(`   Lãi được thanh toán và thêm vào tổng số tiền gửi: ${interestEarned.toFixed(9)} SOL`);
      console.log(`   Thời gian tính lãi mới: ${new Date(updatedVault.lastInterestClaimTime.toNumber() * 1000).toLocaleString()}`);
      
      // Kiểm tra số dư treasury
      const treasuryBalance = await connection.getBalance(treasuryPDA);
      console.log(`   Số dư mới trong Treasury: ${(treasuryBalance / LAMPORTS_PER_SOL).toFixed(7)} SOL`);
      
      return tx;
    } catch (e) {
      if (e.message.includes('TooEarlyToClaim')) {
        console.log('\n⏰ Vui lòng đợi ít nhất 1 giây trước khi tính lãi.');
        return null;
      } else if (e.message.includes('NoInterestToClaimYet')) {
        console.log('\n⚠️ Chưa có lãi nào để nhận. Hãy đợi thêm thời gian để tích lũy lãi.');
        return null;
      } else if (e.message.includes('InsufficientFundsInContractTreasury')) {
        console.log('\n❌ Không đủ SOL trong contract treasury để trả lãi. Vui lòng nạp thêm SOL vào contract treasury.');
        return null;
      }
      
      console.log('\n⚠️ Vault chưa được khởi tạo hoặc có lỗi khác:');
      console.error(e);
      throw new Error('Vault chưa được khởi tạo. Vui lòng khởi tạo vault trước.');
    }
  } catch (error) {
    console.error(`\n❌ Lỗi khi tính lãi kép: ${error.message}`);
    throw error;
  }
};

/**
 * Nạp tiền vào contract treasury để thanh toán lãi
 * @param {Keypair} walletKeypair - Keypair của người gửi
 * @param {number} amount - Số lượng SOL
 * @returns {Promise<string>} - Transaction ID
 */
const fundContractTreasury = async (walletKeypair, amount) => {
  try {
    console.log(`\n🔑 Ví của bạn: ${walletKeypair.publicKey.toString()}`);
    
    // Kiểm tra số dư
    const connection = getConnection();
    const balance = await connection.getBalance(walletKeypair.publicKey);
    const balanceInSOL = balance / LAMPORTS_PER_SOL;
    
    console.log(`💰 Số dư hiện tại: ${balanceInSOL.toFixed(7)} SOL`);
    
    if (balanceInSOL < amount) {
      throw new Error(`Không đủ SOL để gửi. Bạn cần tối thiểu ${amount} SOL`);
    }
    
    // Tìm PDA cho contract treasury
    const [contractTreasuryPDA] = await findContractTreasuryPDA();
    
    // Gửi SOL vào contract treasury
    console.log(`\n🔄 Đang gửi ${amount} SOL vào contract treasury...`);
    
    // Khởi tạo provider và program
    const provider = createProvider(walletKeypair);
    const program = createProgram(provider);
    
    const lamports = amount * LAMPORTS_PER_SOL;
    const tx = await program.methods
      .fundContractTreasury(new BN(lamports))
      .accounts({
        sender: walletKeypair.publicKey,
        contractTreasury: contractTreasuryPDA,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([walletKeypair])
      .rpc();
    
    console.log(`\n✅ Đã gửi ${amount} SOL vào contract treasury`);
    console.log(`   Transaction: ${tx}`);
    
    // Kiểm tra số dư mới
    const newBalance = await connection.getBalance(walletKeypair.publicKey);
    const newBalanceInSOL = newBalance / LAMPORTS_PER_SOL;
    console.log(`💰 Số dư ví mới: ${newBalanceInSOL.toFixed(7)} SOL`);
    
    const contractTreasuryBalance = await connection.getBalance(contractTreasuryPDA);
    const contractTreasuryBalanceInSOL = contractTreasuryBalance / LAMPORTS_PER_SOL;
    console.log(`💰 Số dư contract treasury: ${contractTreasuryBalanceInSOL.toFixed(7)} SOL`);
    
    return tx;
  } catch (error) {
    console.error(`\n❌ Lỗi khi gửi SOL vào contract treasury: ${error.message}`);
    throw error;
  }
};

/**
 * Rút tiền từ contract treasury (chỉ admin)
 * @param {Keypair} walletKeypair - Keypair của admin
 * @param {number} amount - Số lượng SOL
 * @param {PublicKey} recipient - Địa chỉ người nhận
 * @returns {Promise<string>} - Transaction ID
 */
const withdrawFromContractTreasury = async (walletKeypair, amount, recipient) => {
  try {
    console.log(`\n🔑 Ví của bạn: ${walletKeypair.publicKey.toString()}`);
    console.log(`📍 Địa chỉ nhận: ${recipient.toString()}`);
    
    // Tìm PDA cho vault và contract treasury
    const [vaultPDA] = await findVaultPDA(walletKeypair.publicKey);
    const [contractTreasuryPDA] = await findContractTreasuryPDA();
    
    // Kiểm tra số dư trong contract treasury
    const connection = getConnection();
    const contractTreasuryBalance = await connection.getBalance(contractTreasuryPDA);
    const contractTreasuryBalanceInSOL = contractTreasuryBalance / LAMPORTS_PER_SOL;
    
    console.log(`\n💰 Số dư trong contract treasury: ${contractTreasuryBalanceInSOL.toFixed(7)} SOL`);
    
    if (contractTreasuryBalanceInSOL < amount) {
      throw new Error(`Không đủ SOL trong contract treasury. Hiện có ${contractTreasuryBalanceInSOL.toFixed(7)} SOL`);
    }
    
    // Khởi tạo provider và program
    const provider = createProvider(walletKeypair);
    const program = createProgram(provider);
    
    // Kiểm tra vault đã tồn tại chưa
    try {
      await program.account.vault.fetch(vaultPDA);
    } catch (e) {
      throw new Error('Vault chưa được khởi tạo. Vui lòng khởi tạo vault trước.');
    }
    
    // Rút tiền từ contract treasury
    console.log(`\n🔄 Đang rút ${amount} SOL từ contract treasury...`);
    
    const lamports = amount * LAMPORTS_PER_SOL;
    const tx = await program.methods
      .withdrawFromContractTreasury(new BN(lamports))
      .accounts({
        admin: walletKeypair.publicKey,
        vault: vaultPDA,
        authority: walletKeypair.publicKey,
        contractTreasury: contractTreasuryPDA,
        recipient: recipient,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([walletKeypair])
      .rpc();
    
    console.log(`\n✅ Đã rút ${amount} SOL từ contract treasury`);
    console.log(`   Transaction: ${tx}`);
    
    // Kiểm tra số dư mới
    const newContractTreasuryBalance = await connection.getBalance(contractTreasuryPDA);
    const newContractTreasuryBalanceInSOL = newContractTreasuryBalance / LAMPORTS_PER_SOL;
    console.log(`💰 Số dư mới của contract treasury: ${newContractTreasuryBalanceInSOL.toFixed(7)} SOL`);
    
    const recipientBalance = await connection.getBalance(recipient);
    const recipientBalanceInSOL = recipientBalance / LAMPORTS_PER_SOL;
    console.log(`💰 Số dư của người nhận: ${recipientBalanceInSOL.toFixed(7)} SOL`);
    
    return tx;
  } catch (error) {
    console.error(`\n❌ Lỗi khi rút tiền từ contract treasury: ${error.message}`);
    throw error;
  }
};

module.exports = {
  initializeVault,
  depositSol,
  transferSol,
  checkTreasuryBalance,
  autoTransferSol,
  directTransferSol,
  claimInterest,
  fundContractTreasury,
  withdrawFromContractTreasury,
}; 