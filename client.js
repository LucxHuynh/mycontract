// Client để tương tác với contract mycontract

const { Connection, PublicKey, Keypair, LAMPORTS_PER_SOL, Transaction, sendAndConfirmTransaction } = require('@solana/web3.js');
const { Program, AnchorProvider, web3, BN, utils } = require('@project-serum/anchor');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Kết nối đến Solana localnet
const connection = new Connection('http://localhost:8899', 'confirmed');

// Load IDL từ file được tạo ra sau khi build
const idl = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'target/idl/mycontract.json'), 'utf8'));

// ID chương trình
const programId = new PublicKey('G282eaMza7v7527pDjt4yAA4FzuFZsSnJRSPuZFerCz6');

// Tạo interface để đọc input từ command line
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Hàm để đọc input
function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

/**
 * Tạo một keypair từ secret key dạng mảng
 * @param {Array|Uint8Array|string} secretKey - Secret key (mảng số, Uint8Array, hoặc chuỗi JSON)
 * @returns {Keypair} Keypair được tạo
 */
function createKeypairFromSecretKey(secretKey) {
  try {
    // Xử lý trường hợp secretKey là chuỗi JSON
    let secretKeyInput = secretKey;
    if (typeof secretKey === 'string') {
      try {
        secretKeyInput = JSON.parse(secretKey);
      } catch (e) {
        throw new Error('Secret key không đúng định dạng JSON');
      }
    }
    
    // Đảm bảo secretKey là Uint8Array
    let secretKeyArray;
    if (Array.isArray(secretKeyInput)) {
      // Kiểm tra độ dài của secret key (phải là 64 byte)
      if (secretKeyInput.length !== 64) {
        throw new Error(`Secret key phải có đúng 64 byte, hiện tại có ${secretKeyInput.length} byte`);
      }
      
      secretKeyArray = Uint8Array.from(secretKeyInput);
    } else if (secretKeyInput instanceof Uint8Array) {
      secretKeyArray = secretKeyInput;
    } else {
      throw new Error('Secret key phải là mảng số, Uint8Array, hoặc chuỗi JSON');
    }
    
    // Tạo keypair từ secret key
    const keypair = Keypair.fromSecretKey(secretKeyArray);
    return keypair;
  } catch (error) {
    throw new Error(`Không thể tạo keypair từ secret key: ${error.message}`);
  }
}

/**
 * Đọc file keypair an toàn
 * @param {string} filepath - Đường dẫn đến file
 * @returns {Keypair} Keypair được đọc từ file
 */
function readKeypairFromFile(filepath) {
  try {
    // Đọc file và parse nội dung
    const fileContent = fs.readFileSync(filepath, 'utf-8');
    let secretKey;
    
    try {
      secretKey = JSON.parse(fileContent);
    } catch (e) {
      throw new Error(`File không chứa JSON hợp lệ: ${e.message}`);
    }
    
    return createKeypairFromSecretKey(secretKey);
  } catch (error) {
    throw new Error(`Không thể đọc keypair từ file: ${error.message}`);
  }
}

/**
 * Hàm để load wallet từ người dùng với nhiều cách nhập
 */
async function loadWalletFromInput() {
  try {
    console.log('\n=== 🔑 NHẬP THÔNG TIN VÍ ===');
    console.log('1. Nhập Secret Key trực tiếp');
    console.log('2. Đọc từ file Keypair');
    console.log('3. Tạo keypair mới cho localnet testing');
    
    const choice = await question('👉 Chọn cách nhập (1-3): ');
    
    let walletKeypair;
    
    switch (choice) {
      case '1': {
        console.log('\n📝 Vui lòng nhập Secret Key (dạng mảng [số1, số2, ...]):');
        const secretKeyInput = await question('Secret Key: ');
        
        try {
          // Xử lý định dạng input
          let cleaned = secretKeyInput.trim();
          // Nếu không có dấu [] bên ngoài, thêm vào
          if (!cleaned.startsWith('[')) cleaned = '[' + cleaned;
          if (!cleaned.endsWith(']')) cleaned = cleaned + ']';
          
          walletKeypair = createKeypairFromSecretKey(cleaned);
          console.log(`✅ Đã tạo keypair thành công với địa chỉ: ${walletKeypair.publicKey.toString()}`);
          
          // Thêm airdrop cho ví nhập trực tiếp trên localnet
          const walletBalance = await connection.getBalance(walletKeypair.publicKey);
          if (walletBalance < 0.1 * LAMPORTS_PER_SOL) {
            console.log('🚰 Đang yêu cầu airdrop 2 SOL cho ví hiện tại...');
            try {
              const signature = await connection.requestAirdrop(walletKeypair.publicKey, 2 * LAMPORTS_PER_SOL);
              await connection.confirmTransaction(signature);
              console.log('✅ Đã nhận airdrop thành công');
            } catch (e) {
              console.warn(`⚠️ Không thể nhận airdrop: ${e.message}`);
              console.warn('Bạn vẫn có thể tiếp tục nhưng có thể gặp lỗi khi thực hiện giao dịch');
            }
          }
        } catch (e) {
          throw new Error(`Secret Key không hợp lệ: ${e.message}`);
        }
        break;
      }
      
      case '2': {
        const filePath = await question('\n📄 Nhập đường dẫn đến file keypair: ');
        try {
          walletKeypair = readKeypairFromFile(filePath);
          console.log(`✅ Đã đọc keypair từ file với địa chỉ: ${walletKeypair.publicKey.toString()}`);
        } catch (e) {
          throw new Error(`Không thể đọc file: ${e.message}`);
        }
        break;
      }
      
      case '3': {
        console.log('\n🆕 Tạo keypair mới cho localnet testing...');
        walletKeypair = Keypair.generate();
        console.log(`✅ Đã tạo keypair mới với địa chỉ: ${walletKeypair.publicKey.toString()}`);
        
        // Request airdrop cho keypair mới
        console.log('🚰 Đang yêu cầu airdrop 2 SOL...');
        try {
          const signature = await connection.requestAirdrop(walletKeypair.publicKey, 2 * LAMPORTS_PER_SOL);
          await connection.confirmTransaction(signature);
          console.log('✅ Đã nhận airdrop thành công');
        } catch (e) {
          console.warn(`⚠️ Không thể nhận airdrop: ${e.message}`);
          console.warn('Bạn vẫn có thể tiếp tục nhưng có thể gặp lỗi khi thực hiện giao dịch');
        }
        break;
      }
      
      default:
        throw new Error('Lựa chọn không hợp lệ');
    }
    
    // Kiểm tra số dư của ví
    const balance = await connection.getBalance(walletKeypair.publicKey);
    console.log(`💰 Số dư hiện tại: ${(balance / LAMPORTS_PER_SOL).toFixed(9)} SOL`);
    
    // Cảnh báo nếu số dư thấp
    if (balance < 0.01 * LAMPORTS_PER_SOL) {
      console.warn('⚠️ Cảnh báo: Số dư của ví quá thấp, có thể không đủ để thực hiện giao dịch!');
      const continue1 = await question('🤔 Bạn vẫn muốn tiếp tục? (y/n): ');
      if (continue1.toLowerCase() !== 'y') {
        rl.close();
        process.exit(0);
      }
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
 * Tìm địa chỉ vault PDA
 * @param {PublicKey} authority - Public key của người sở hữu vault
 * @returns {Promise<PublicKey>} Địa chỉ vault PDA
 */
async function findVaultPDA(authority) {
  const [vaultPDA] = await PublicKey.findProgramAddress(
    [Buffer.from('vault'), authority.toBuffer()],
    programId
  );
  return vaultPDA;
}

/**
 * Tìm địa chỉ treasury PDA
 * @param {PublicKey} authority - Public key của người sở hữu treasury
 * @returns {Promise<PublicKey>} Địa chỉ treasury PDA
 */
async function findTreasuryPDA(authority) {
  const [treasuryPDA] = await PublicKey.findProgramAddress(
    [Buffer.from('treasury'), authority.toBuffer()],
    programId
  );
  return treasuryPDA;
}

/**
 * Tìm địa chỉ contract treasury PDA
 * @returns {Promise<PublicKey>} Địa chỉ contract treasury PDA
 */
async function findContractTreasuryPDA() {
  const [contractTreasuryPDA] = await PublicKey.findProgramAddress(
    [Buffer.from('contract_treasury')],
    programId
  );
  return contractTreasuryPDA;
}

/**
 * Tạo vault mới
 * @param {Keypair} walletKeypair - Keypair của người dùng
 */
async function initializeVault(walletKeypair) {
  try {
    console.log(`\n🏗️ Đang tạo vault mới cho ví ${walletKeypair.publicKey.toString()}...`);
    
    // Tìm PDAs
    const vaultPDA = await findVaultPDA(walletKeypair.publicKey);
    const treasuryPDA = await findTreasuryPDA(walletKeypair.publicKey);
    const contractTreasuryPDA = await findContractTreasuryPDA();
    const systemProgramId = web3.SystemProgram.programId;
    
    console.log(`📍 Địa chỉ vault: ${vaultPDA.toString()}`);
    console.log(`📍 Địa chỉ treasury: ${treasuryPDA.toString()}`);
    console.log(`📍 Địa chỉ contract treasury: ${contractTreasuryPDA.toString()}`);
    console.log(`📍 Địa chỉ System Program: ${systemProgramId.toString()}`);
    
    // Tạo wallet adapter
    const wallet = {
      publicKey: walletKeypair.publicKey,
      signTransaction: async (tx) => {
        tx.sign(walletKeypair);
        return tx;
      },
      signAllTransactions: async (txs) => {
        return txs.map(tx => {
          tx.sign(walletKeypair);
          return tx;
        });
      },
      payer: walletKeypair
    };
    
    // Tạo provider
    const provider = new AnchorProvider(
      connection,
      wallet,
      { preflightCommitment: 'confirmed' }
    );
    
    // Tạo instance của program
    const program = new Program(idl, programId, provider);

    // Kiểm tra xem vault đã tồn tại chưa
    try {
      const vaultAccount = await program.account.vault.fetch(vaultPDA);
      console.log(`ℹ️ Vault đã tồn tại với authority: ${vaultAccount.authority.toString()}`);
      return { vaultPDA, treasuryPDA, contractTreasuryPDA };
    } catch (e) {
      // Vault chưa tồn tại, khởi tạo mới
      console.log(`🆕 Vault chưa tồn tại, đang khởi tạo...`);

      try {
        // Hãy lưu ý: Ở đây chúng ta phải sử dụng contractTreasuryPDA làm systemProgram
        // vì contract mong đợi như vậy (có thể do IDL cũ)
        console.log("Khởi tạo vault với contractTreasuryPDA làm systemProgram...");

        // Tạo transaction
        const tx = await program.methods
          .initialize()
          .accounts({
            authority: walletKeypair.publicKey,
            vault: vaultPDA,
            treasury: treasuryPDA,
            contractTreasury: contractTreasuryPDA,
            systemProgram: contractTreasuryPDA, // Đây là điểm khác biệt quan trọng!
            clock: web3.SYSVAR_CLOCK_PUBKEY,
          })
          .signers([walletKeypair])
          .rpc();
        
        console.log(`✅ Đã tạo vault. Transaction ID: ${tx}`);
        
        // Lấy thông tin vault
        const vaultAccount = await program.account.vault.fetch(vaultPDA);
        console.log(`🔑 Authority: ${vaultAccount.authority.toString()}`);
        console.log(`📊 Vault bump: ${vaultAccount.bump}, Treasury bump: ${vaultAccount.treasuryBump}, Contract Treasury bump: ${vaultAccount.contractTreasuryBump}`);

        return { vaultPDA, treasuryPDA, contractTreasuryPDA };
        
      } catch (error) {
        console.error("Lỗi khi khởi tạo vault:", error);
        throw error;
      }
    }
  } catch (error) {
    console.error('Lỗi khi tạo vault:', error);
    throw error;
  }
}

/**
 * Gửi SOL vào treasury PDA
 * @param {Keypair} walletKeypair - Keypair của người dùng
 * @param {number} amount - Số lượng SOL
 */
async function depositSol(walletKeypair, amount) {
  try {
    console.log(`\n💸 Đang gửi ${amount} SOL từ ví ${walletKeypair.publicKey.toString()} vào treasury...`);
    
    // Kiểm tra số dư của ví
    const balance = await connection.getBalance(walletKeypair.publicKey);
    const lamports = amount * LAMPORTS_PER_SOL;
    
    if (balance < lamports + 0.005 * LAMPORTS_PER_SOL) {
      console.error(`❌ Không đủ SOL! Cần ${amount + 0.005} SOL, hiện có ${balance / LAMPORTS_PER_SOL} SOL`);
      return null;
    }
    
    // Tìm PDAs
    const vaultPDA = await findVaultPDA(walletKeypair.publicKey);
    const treasuryPDA = await findTreasuryPDA(walletKeypair.publicKey);
    const contractTreasuryPDA = await findContractTreasuryPDA();
    
    // Tạo wallet adapter
    const wallet = {
      publicKey: walletKeypair.publicKey,
      signTransaction: async (tx) => {
        tx.sign(walletKeypair);
        return tx;
      },
      signAllTransactions: async (txs) => {
        return txs.map(tx => {
          tx.sign(walletKeypair);
          return tx;
        });
      },
      payer: walletKeypair
    };
    
    // Tạo provider
    const provider = new AnchorProvider(
      connection,
      wallet,
      { preflightCommitment: 'confirmed' }
    );
    
    // Tạo instance của program
    const program = new Program(idl, programId, provider);
    
    // Kiểm tra xem vault đã tồn tại chưa
    try {
      await program.account.vault.fetch(vaultPDA);
    } catch (e) {
      // Vault chưa tồn tại, khởi tạo mới
      console.log(`🆕 Vault chưa tồn tại, đang khởi tạo...`);
      await initializeVault(walletKeypair);
    }
    
    // Gọi hàm deposit_sol từ contract
    const tx = await program.methods
      .depositSol(new BN(lamports))
      .accounts({
        sender: walletKeypair.publicKey,
        vault: vaultPDA,
        treasury: treasuryPDA,
        contractTreasury: contractTreasuryPDA,
        systemProgram: contractTreasuryPDA, // Sử dụng contractTreasuryPDA làm systemProgram
        clock: web3.SYSVAR_CLOCK_PUBKEY
      })
      .signers([walletKeypair])
      .rpc();
    
    console.log(`✅ Đã gửi ${amount} SOL vào treasury. Transaction ID: ${tx}`);
    
    // Kiểm tra số dư của treasury sau khi gửi
    const treasuryBalance = await connection.getBalance(treasuryPDA);
    console.log(`💰 Số dư của treasury sau khi gửi: ${treasuryBalance / LAMPORTS_PER_SOL} SOL`);
    
    return tx;
  } catch (error) {
    console.error('Lỗi khi gửi SOL:', error);
    
    // Hiển thị thêm thông tin lỗi
    if (error instanceof Error) {
      console.error('Chi tiết lỗi:', error.message);
    }
    
    throw error;
  }
}

/**
 * Chuyển SOL từ treasury PDA đến địa chỉ đích
 * @param {Keypair} walletKeypair - Keypair của người dùng (authority)
 * @param {number} amount - Số lượng SOL
 * @param {PublicKey} destination - Địa chỉ đích
 */
async function transferSol(walletKeypair, amount, destination) {
  try {
    console.log(`\n🔄 Đang chuyển ${amount} SOL từ treasury đến ${destination.toString()}...`);
    
    // Tìm PDAs
    const vaultPDA = await findVaultPDA(walletKeypair.publicKey);
    const treasuryPDA = await findTreasuryPDA(walletKeypair.publicKey);
    const contractTreasuryPDA = await findContractTreasuryPDA();
    
    // Kiểm tra số dư của treasury
    const treasuryBalance = await connection.getBalance(treasuryPDA);
    const lamports = amount * LAMPORTS_PER_SOL;
    
    if (treasuryBalance < lamports) {
      console.error(`❌ Không đủ SOL trong treasury! Cần ${amount} SOL, hiện có ${treasuryBalance / LAMPORTS_PER_SOL} SOL`);
      return null;
    }
    
    // Tạo wallet adapter
    const wallet = {
      publicKey: walletKeypair.publicKey,
      signTransaction: async (tx) => {
        tx.sign(walletKeypair);
        return tx;
      },
      signAllTransactions: async (txs) => {
        return txs.map(tx => {
          tx.sign(walletKeypair);
          return tx;
        });
      },
      payer: walletKeypair
    };
    
    // Tạo provider
    const provider = new AnchorProvider(
      connection,
      wallet,
      { preflightCommitment: 'confirmed' }
    );
    
    // Tạo instance của program
    const program = new Program(idl, programId, provider);
    
    // Gọi hàm transfer_sol từ contract
    const tx = await program.methods
      .transferSol(new BN(lamports), destination)
      .accounts({
        authority: walletKeypair.publicKey,
        vault: vaultPDA,
        treasury: treasuryPDA,
        contractTreasury: contractTreasuryPDA,
        destination: destination,
        systemProgram: contractTreasuryPDA, // Sử dụng contractTreasuryPDA làm systemProgram
        clock: web3.SYSVAR_CLOCK_PUBKEY
      })
      .signers([walletKeypair])
      .rpc();
    
    console.log(`✅ Đã chuyển ${amount} SOL đến ${destination.toString()}. Transaction ID: ${tx}`);
    
    // Kiểm tra số dư sau khi chuyển
    const newTreasuryBalance = await connection.getBalance(treasuryPDA);
    console.log(`💰 Số dư của treasury sau khi chuyển: ${newTreasuryBalance / LAMPORTS_PER_SOL} SOL`);
    
    const destinationBalance = await connection.getBalance(destination);
    console.log(`💰 Số dư của địa chỉ đích: ${destinationBalance / LAMPORTS_PER_SOL} SOL`);
    
    return tx;
  } catch (error) {
    console.error('Lỗi khi chuyển SOL:', error);
    
    // Hiển thị thêm thông tin lỗi
    if (error instanceof Error) {
      console.error('Chi tiết lỗi:', error.message);
    }
    
    throw error;
  }
}

/**
 * Kiểm tra số dư của tài khoản
 * @param {PublicKey|string} address - Địa chỉ tài khoản
 */
async function checkBalance(address) {
  try {
    const pubkey = typeof address === 'string' ? new PublicKey(address) : address;
    const balance = await connection.getBalance(pubkey);
    console.log(`💰 Số dư của ${pubkey.toString()}: ${(balance / LAMPORTS_PER_SOL).toFixed(9)} SOL`);
    return balance;
  } catch (error) {
    console.error(`Lỗi khi kiểm tra số dư: ${error.message}`);
    throw error;
  }
}

/**
 * Kiểm tra số dư của treasury
 * @param {PublicKey} authority - Địa chỉ authority
 */
async function checkTreasuryBalance(authority) {
  try {
    const vaultPDA = await findVaultPDA(authority);
    const treasuryPDA = await findTreasuryPDA(authority);
    
    try {
      // Tạo wallet adapter giả
      const dummyWallet = {
        publicKey: authority,
        signTransaction: async (tx) => tx,
        signAllTransactions: async (txs) => txs,
      };
      
      // Tạo provider
      const provider = new AnchorProvider(
        connection,
        dummyWallet,
        { preflightCommitment: 'confirmed' }
      );
      
      // Tạo instance của program
      const program = new Program(idl, programId, provider);
      
      // Thử lấy thông tin vault để xác nhận sự tồn tại
      try {
        await program.account.vault.fetch(vaultPDA);
        
        console.log(`🏦 Thông tin vault của ${authority.toString()}:`);
        console.log(`📍 Địa chỉ vault: ${vaultPDA.toString()}`);
        console.log(`📍 Địa chỉ treasury: ${treasuryPDA.toString()}`);
        
        const treasuryBalance = await connection.getBalance(treasuryPDA);
        console.log(`💰 Số dư treasury: ${(treasuryBalance / LAMPORTS_PER_SOL).toFixed(9)} SOL`);
        return treasuryBalance;
      } catch (e) {
        console.log(`⚠️ Vault chưa được khởi tạo cho địa chỉ ${authority.toString()}`);
        
        // Vẫn hiển thị các địa chỉ và số dư dự kiến
        console.log(`📍 Địa chỉ vault dự kiến: ${vaultPDA.toString()}`);
        console.log(`📍 Địa chỉ treasury dự kiến: ${treasuryPDA.toString()}`);
        
        const treasuryBalance = await connection.getBalance(treasuryPDA);
        if (treasuryBalance > 0) {
          console.log(`💰 Số dư treasury: ${(treasuryBalance / LAMPORTS_PER_SOL).toFixed(9)} SOL`);
        } else {
          console.log(`💰 Chưa có SOL trong treasury`);
        }
        
        return 0;
      }
    } catch (e) {
      console.log(`⚠️ Không thể kết nối đến contract: ${e.message}`);
      return 0;
    }
  } catch (error) {
    console.error(`Lỗi khi kiểm tra số dư treasury: ${error.message}`);
    throw error;
  }
}

/**
 * Gửi SOL trực tiếp qua contract đến địa chỉ đích
 * @param {Keypair} walletKeypair - Keypair của người gửi
 * @param {number} amount - Số lượng SOL
 * @param {PublicKey} destination - Địa chỉ đích
 */
async function autoTransferSol(walletKeypair, amount, destination) {
  try {
    console.log(`\n🔄 Đang gửi ${amount} SOL từ ví ${walletKeypair.publicKey.toString()} đến ${destination.toString()}...`);
    
    // Kiểm tra số dư của ví
    const balance = await connection.getBalance(walletKeypair.publicKey);
    const lamports = amount * LAMPORTS_PER_SOL;
    
    if (balance < lamports + 0.01 * LAMPORTS_PER_SOL) {
      console.error(`❌ Không đủ SOL! Cần ${amount + 0.01} SOL, hiện có ${balance / LAMPORTS_PER_SOL} SOL`);
      return null;
    }
    
    // Tìm PDAs
    const vaultPDA = await findVaultPDA(walletKeypair.publicKey);
    const treasuryPDA = await findTreasuryPDA(walletKeypair.publicKey);
    const contractTreasuryPDA = await findContractTreasuryPDA();
    
    // Tạo wallet adapter
    const wallet = {
      publicKey: walletKeypair.publicKey,
      signTransaction: async (tx) => {
        tx.sign(walletKeypair);
        return tx;
      },
      signAllTransactions: async (txs) => {
        return txs.map(tx => {
          tx.sign(walletKeypair);
          return tx;
        });
      },
      payer: walletKeypair
    };
    
    // Tạo provider
    const provider = new AnchorProvider(
      connection,
      wallet,
      { preflightCommitment: 'confirmed' }
    );
    
    // Tạo instance của program
    const program = new Program(idl, programId, provider);
    
    // Kiểm tra xem vault đã tồn tại chưa, nếu chưa thì khởi tạo
    try {
      await program.account.vault.fetch(vaultPDA);
    } catch (e) {
      console.log(`🆕 Vault chưa tồn tại, đang khởi tạo...`);
      await initializeVault(walletKeypair);
    }
    
    console.log(`🏦 Bước 1: Gửi ${amount} SOL vào treasury...`);
    
    // Gọi hàm deposit_sol từ contract
    const txDeposit = await program.methods
      .depositSol(new BN(lamports))
      .accounts({
        sender: walletKeypair.publicKey,
        vault: vaultPDA,
        treasury: treasuryPDA,
        contractTreasury: contractTreasuryPDA,
        systemProgram: contractTreasuryPDA, // Sử dụng contractTreasuryPDA làm systemProgram
        clock: web3.SYSVAR_CLOCK_PUBKEY
      })
      .signers([walletKeypair])
      .rpc();
    
    console.log(`✅ Đã gửi SOL vào treasury. Transaction ID: ${txDeposit}`);
    
    // Chờ một chút để giao dịch được xác nhận
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log(`🏦 Bước 2: Chuyển ${amount} SOL từ treasury đến ${destination.toString()}...`);
    
    // Gọi hàm transfer_sol từ contract
    const txTransfer = await program.methods
      .transferSol(new BN(lamports), destination)
      .accounts({
        authority: walletKeypair.publicKey,
        vault: vaultPDA,
        treasury: treasuryPDA,
        contractTreasury: contractTreasuryPDA,
        destination: destination,
        systemProgram: contractTreasuryPDA, // Sử dụng contractTreasuryPDA làm systemProgram
        clock: web3.SYSVAR_CLOCK_PUBKEY
      })
      .signers([walletKeypair])
      .rpc();
    
    console.log(`✅ Đã chuyển SOL đến địa chỉ đích. Transaction ID: ${txTransfer}`);
    
    // Kiểm tra số dư sau khi chuyển
    const destinationBalance = await connection.getBalance(destination);
    console.log(`💰 Số dư của địa chỉ đích: ${destinationBalance / LAMPORTS_PER_SOL} SOL`);
    
    return { txDeposit, txTransfer };
  } catch (error) {
    console.error('Lỗi khi gửi SOL:', error);
    
    // Hiển thị thêm thông tin lỗi
    if (error instanceof Error) {
      console.error('Chi tiết lỗi:', error.message);
    }
    
    throw error;
  }
}

/**
 * Tính lãi kép cho vault (5% APY) - tự động tái đầu tư vào vault
 * @param {Keypair} walletKeypair - Keypair của người dùng
 */
async function claimInterest(walletKeypair) {
  try {
    console.log(`\n🏦 Đang kiểm tra và tính lãi kép cho ví ${walletKeypair.publicKey.toString()}...`);
    
    // Tìm PDAs
    const vaultPDA = await findVaultPDA(walletKeypair.publicKey);
    const treasuryPDA = await findTreasuryPDA(walletKeypair.publicKey);
    const contractTreasuryPDA = await findContractTreasuryPDA();
    
    // Tạo wallet adapter
    const wallet = {
      publicKey: walletKeypair.publicKey,
      signTransaction: async (tx) => {
        tx.sign(walletKeypair);
        return tx;
      },
      signAllTransactions: async (txs) => {
        return txs.map(tx => {
          tx.sign(walletKeypair);
          return tx;
        });
      },
      payer: walletKeypair
    };
    
    // Tạo provider
    const provider = new AnchorProvider(
      connection,
      wallet,
      { preflightCommitment: 'confirmed' }
    );
    
    // Tạo instance của program
    const program = new Program(idl, programId, provider);
    
    // Kiểm tra xem vault đã tồn tại chưa
    try {
      const vault = await program.account.vault.fetch(vaultPDA);
      
      // Tính toán lãi suất dự kiến theo thời gian thực
      const now = Math.floor(Date.now() / 1000);
      const lastClaimTime = vault.lastInterestClaimTime.toNumber();
      const timeElapsed = now - lastClaimTime;
      
      const totalDeposited = vault.totalDeposited.toNumber() / LAMPORTS_PER_SOL;
      
      console.log('\n📊 Thông tin về vault của bạn:');
      console.log(`   Số tiền đã gửi: ${totalDeposited.toFixed(9)} SOL`);
      console.log(`   Thời gian gửi cuối: ${new Date(vault.lastDepositTime.toNumber() * 1000).toLocaleString()}`);
      console.log(`   Thời gian tính lãi cuối: ${new Date(lastClaimTime * 1000).toLocaleString()}`);
      console.log(`   Thời gian đã trôi qua: ${timeElapsed} giây`);
      
      if (timeElapsed < 1) {
        console.log(`\n⏰ Bạn vừa mới tính lãi. Vui lòng đợi ít nhất 1 giây trước khi tính lãi tiếp.`);
        return null;
      }
      
      // Tính lãi theo thời gian thực
      const interestRatePerSecond = 0.05 / (100 * 31536000); // 5% APY chia cho số giây trong năm
      const estimatedInterest = totalDeposited * interestRatePerSecond * timeElapsed;
      console.log(`   Ước tính lãi suất: ${estimatedInterest.toFixed(12)} SOL (5% APY tính liên tục)`);
      
      // Cảnh báo nếu lãi quá nhỏ
      const lamportsInterest = Math.floor(estimatedInterest * LAMPORTS_PER_SOL);
      if (lamportsInterest < 1) {
        console.log(`\n⚠️ Lãi suất quá nhỏ để tính (${lamportsInterest} lamports < 1 lamport).`);
        console.log(`   Bạn có thể đợi thêm thời gian để tích lũy lãi, hoặc tiếp tục tính lãi để cập nhật thời gian.`);
      }
      
      // Hiển thị thông tin về treasury
      const treasuryBalance = await connection.getBalance(treasuryPDA);
      console.log(`   Số dư trong Treasury: ${(treasuryBalance / LAMPORTS_PER_SOL).toFixed(9)} SOL`);
      
      // Xác nhận người dùng có muốn tính lãi kép không
      const confirm = await question(`\n🤔 Bạn có muốn tính lãi kép ngay bây giờ không? (y/n): `);
      
      if (confirm.toLowerCase() !== 'y') {
        console.log('\n❌ Đã hủy tính lãi kép.');
        return null;
      }
      
      // Gọi hàm claim_interest từ contract
      console.log('\n🔄 Đang tính lãi kép...');
      
      const tx = await program.methods
        .claimInterest()
        .accounts({
          authority: walletKeypair.publicKey,
          vault: vaultPDA,
          treasury: treasuryPDA,
          contractTreasury: contractTreasuryPDA,
          systemProgram: contractTreasuryPDA, // Sử dụng contractTreasuryPDA làm systemProgram
          clock: web3.SYSVAR_CLOCK_PUBKEY,
        })
        .signers([walletKeypair])
        .rpc();
      
      console.log(`\n✅ Đã tính lãi kép thành công. Transaction ID: ${tx}`);
      
      // Lấy thông tin vault sau khi tính lãi
      const updatedVault = await program.account.vault.fetch(vaultPDA);
      const newTotalDeposited = updatedVault.totalDeposited.toNumber() / LAMPORTS_PER_SOL;
      const interestEarned = newTotalDeposited - totalDeposited;
      
      console.log(`   Số tiền trong vault mới: ${newTotalDeposited.toFixed(9)} SOL`);
      console.log(`   Lãi đã tính và tái đầu tư: ${interestEarned.toFixed(9)} SOL`);
      console.log(`   Thời gian tính lãi mới: ${new Date(updatedVault.lastInterestClaimTime.toNumber() * 1000).toLocaleString()}`);
      
      return tx;
    } catch (error) {
      if (error.message.includes('TooEarlyToClaim')) {
        console.log('\n⏰ Vui lòng đợi ít nhất 1 giây trước khi tính lãi tiếp.');
        return null;
      }
      
      console.log('\n⚠️ Vault chưa được khởi tạo. Vui lòng khởi tạo vault trước khi tính lãi kép.');
      console.error('Chi tiết lỗi:', error);
    }
  } catch (error) {
    console.error('Lỗi khi tính lãi kép:', error);
    
    // Hiển thị thêm thông tin lỗi
    if (error instanceof Error) {
      console.error('Chi tiết lỗi:', error.message);
    }
    
    throw error;
  }
}

/**
 * Gửi SOL vào contract treasury để trả lãi
 * @param {Keypair} walletKeypair - Keypair của người gửi
 * @param {number} amount - Số lượng SOL muốn gửi
 */
async function fundContractTreasury(walletKeypair, amount) {
  try {
    console.log(`\n💰 Đang gửi ${amount} SOL vào contract treasury để trả lãi...`);
    
    // Kiểm tra số dư của ví
    const balance = await connection.getBalance(walletKeypair.publicKey);
    const lamports = amount * LAMPORTS_PER_SOL;
    
    if (balance < lamports + 0.005 * LAMPORTS_PER_SOL) {
      console.error(`❌ Không đủ SOL! Cần ${amount + 0.005} SOL, hiện có ${balance / LAMPORTS_PER_SOL} SOL`);
      return null;
    }
    
    // Tìm contractTreasury PDA
    const contractTreasuryPDA = await findContractTreasuryPDA();
    
    // Tạo wallet adapter
    const wallet = {
      publicKey: walletKeypair.publicKey,
      signTransaction: async (tx) => {
        tx.sign(walletKeypair);
        return tx;
      },
      signAllTransactions: async (txs) => {
        return txs.map(tx => {
          tx.sign(walletKeypair);
          return tx;
        });
      },
      payer: walletKeypair
    };
    
    // Tạo provider
    const provider = new AnchorProvider(
      connection,
      wallet,
      { preflightCommitment: 'confirmed' }
    );
    
    // Tạo instance của program
    const program = new Program(idl, programId, provider);
    
    // Gọi hàm fund_contract_treasury từ contract
    const tx = await program.methods
      .fundContractTreasury(new BN(lamports))
      .accounts({
        sender: walletKeypair.publicKey,
        contractTreasury: contractTreasuryPDA,
        systemProgram: contractTreasuryPDA, // Sử dụng contractTreasuryPDA làm systemProgram
      })
      .signers([walletKeypair])
      .rpc();
    
    console.log(`✅ Đã gửi ${amount} SOL vào contract treasury. Transaction ID: ${tx}`);
    
    // Kiểm tra số dư của contract treasury sau khi gửi
    const treasuryBalance = await connection.getBalance(contractTreasuryPDA);
    console.log(`💰 Số dư của contract treasury sau khi gửi: ${treasuryBalance / LAMPORTS_PER_SOL} SOL`);
    
    return tx;
  } catch (error) {
    console.error('Lỗi khi gửi SOL vào contract treasury:', error);
    
    // Hiển thị thêm thông tin lỗi
    if (error instanceof Error) {
      console.error('Chi tiết lỗi:', error.message);
    }
    
    throw error;
  }
}

// Hàm chính
async function main() {
  try {
    const args = process.argv.slice(2);
    const command = args[0];
    
    console.log(`🚀 Solana Contract Client (Localnet)`);
    console.log(`📦 Program ID: ${programId.toString()}`);
    
    if (!command) {
      console.log('\n📋 Sử dụng:');
      console.log('  node client.js init - Khởi tạo vault mới');
      console.log('  node client.js deposit [amount] - Gửi SOL vào treasury');
      console.log('  node client.js transfer [amount] [destination] - Chuyển SOL từ treasury đến địa chỉ khác');
      console.log('  node client.js auto-transfer [amount] [destination] - Tự động gửi SOL qua contract đến địa chỉ đích');
      console.log('  node client.js claim-interest - Nhận lãi suất từ vault (5% APY)');
      console.log('  node client.js balance [address?] - Kiểm tra số dư');
      console.log('  node client.js treasury-balance - Kiểm tra số dư treasury');
      console.log('  node client.js fund-treasury [amount] - Gửi SOL vào contract treasury để trả lãi');
      rl.close();
      return;
    }
    
    if (command === 'balance') {
      if (args[1]) {
        await checkBalance(args[1]);
      } else {
        const walletKeypair = await loadWalletFromInput();
        await checkBalance(walletKeypair.publicKey);
      }
      rl.close();
      return;
    }
    
    // Các lệnh cần keypair
    const walletKeypair = await loadWalletFromInput();
    
    switch (command) {
      case 'init':
        await initializeVault(walletKeypair);
        break;
        
      case 'treasury-balance':
        await checkTreasuryBalance(walletKeypair.publicKey);
        break;
        
      case 'deposit':
        if (!args[1]) {
          console.error('❌ Vui lòng chỉ định số lượng SOL: node client.js deposit 0.1');
          break;
        }
        const depositAmount = parseFloat(args[1]);
        const confirmDeposit = await question(`🤔 Xác nhận gửi ${depositAmount} SOL vào treasury? (y/n): `);
        if (confirmDeposit.toLowerCase() === 'y') {
          await depositSol(walletKeypair, depositAmount);
        }
        break;
        
      case 'transfer':
        if (!args[1]) {
          console.error('❌ Vui lòng chỉ định số lượng SOL: node client.js transfer 0.05 [địa_chỉ_đích]');
          break;
        }
        const transferAmount = parseFloat(args[1]);
        const destinationInput = args[2] || await question('👉 Nhập địa chỉ ví đích: ');
        if (!destinationInput) {
          console.error('❌ Địa chỉ đích không được để trống');
          break;
        }
        
        try {
          const destination = new PublicKey(destinationInput);
          console.log(`📍 Địa chỉ đích: ${destination.toString()}`);
          const confirmTransfer = await question(`🤔 Xác nhận chuyển ${transferAmount} SOL từ treasury đến địa chỉ trên? (y/n): `);
          if (confirmTransfer.toLowerCase() === 'y') {
            await transferSol(walletKeypair, transferAmount, destination);
          }
        } catch (e) {
          console.error(`❌ Địa chỉ không hợp lệ: ${e.message}`);
        }
        break;
        
      case 'auto-transfer':
        if (!args[1]) {
          console.error('❌ Vui lòng chỉ định số lượng SOL: node client.js auto-transfer 0.05 [địa_chỉ_đích]');
          break;
        }
        const autoTransferAmount = parseFloat(args[1]);
        const autoDestInput = args[2] || await question('👉 Nhập địa chỉ ví đích: ');
        if (!autoDestInput) {
          console.error('❌ Địa chỉ đích không được để trống');
          break;
        }
        
        try {
          const autoDest = new PublicKey(autoDestInput);
          console.log(`📍 Địa chỉ đích: ${autoDest.toString()}`);
          const confirmAutoTransfer = await question(`🤔 Xác nhận gửi ${autoTransferAmount} SOL qua contract đến địa chỉ trên? (y/n): `);
          if (confirmAutoTransfer.toLowerCase() === 'y') {
            await autoTransferSol(walletKeypair, autoTransferAmount, autoDest);
          }
        } catch (e) {
          console.error(`❌ Địa chỉ không hợp lệ: ${e.message}`);
        }
        break;
        
      case 'claim-interest':
        await claimInterest(walletKeypair);
        break;
        
      case 'fund-treasury':
        const fundAmount = parseFloat(args[1]) || 0.1; // Mặc định 0.1 SOL
        await fundContractTreasury(walletKeypair, fundAmount);
        break;
        
      default:
        console.log('❓ Lệnh không hợp lệ. Sử dụng: node client.js [init|deposit|transfer|auto-transfer|claim-interest|balance|treasury-balance|fund-treasury]');
        break;
    }
  } catch (error) {
    console.error(`❌ Lỗi: ${error.message}`);
  } finally {
    rl.close();
  }
}

main().catch(err => {
  console.error(`❌ Lỗi không xử lý được: ${err.message}`);
  rl.close();
  process.exit(1);
});

// Export các functions
module.exports = {
  // ... existing exports ...
  fundContractTreasury,
}; 