const { Connection, PublicKey, clusterApiUrl } = require('@solana/web3.js');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Cấu hình kết nối
const DEFAULT_CLUSTER_URL = 'http://localhost:8899';
const PROGRAM_ID = new PublicKey('G282eaMza7v7527pDjt4yAA4FzuFZsSnJRSPuZFerCz6');

// Đường dẫn tới IDL
const IDL_PATH = path.resolve(__dirname, '../../target/idl/mycontract.json');

// Kiểm tra môi trường
const isWSL = () => {
  if (process.platform !== 'linux') return false;
  
  try {
    const release = fs.readFileSync('/proc/version', 'utf8');
    return release.toLowerCase().includes('microsoft');
  } catch (error) {
    return false;
  }
};

// Lấy URL của cluster dựa vào biến môi trường
const getClusterUrl = () => {
  const envCluster = process.env.SOLANA_CLUSTER;
  
  if (envCluster === 'mainnet') {
    return clusterApiUrl('mainnet-beta');
  } else if (envCluster === 'testnet') {
    return clusterApiUrl('testnet');
  } else if (envCluster === 'devnet') {
    return clusterApiUrl('devnet');
  } else {
    return process.env.SOLANA_CLUSTER_URL || DEFAULT_CLUSTER_URL;
  }
};

// Tạo kết nối
const getConnection = () => {
  const url = getClusterUrl();
  return new Connection(url, 'confirmed');
};

const connection = getConnection();

// Lấy tên cluster hiện tại
const getClusterName = () => {
  const url = getClusterUrl();
  
  if (url.includes('mainnet')) {
    return 'Mainnet';
  } else if (url.includes('testnet')) {
    return 'Testnet';
  } else if (url.includes('devnet')) {
    return 'Devnet';
  } else {
    return 'Localnet';
  }
};

// Tìm file IDL
const findIdlFile = () => {
  const possiblePaths = [
    IDL_PATH,
    path.resolve(process.cwd(), 'target/idl/mycontract.json'),
    path.resolve(os.homedir(), '.config/solana/mycontract.json')
  ];
  
  for (const idlPath of possiblePaths) {
    try {
      if (fs.existsSync(idlPath)) {
        return idlPath;
      }
    } catch (error) {
      // Bỏ qua lỗi và thử đường dẫn tiếp theo
    }
  }
  
  return null;
};

// Load IDL từ file
const loadIDL = () => {
  try {
    const idlPath = findIdlFile();
    
    if (idlPath) {
      console.log(`📄 Đang đọc IDL từ: ${idlPath}`);
      return JSON.parse(fs.readFileSync(idlPath, 'utf8'));
    }
    
    // IDL mẫu nếu không tìm thấy file
    console.warn('⚠️ Không tìm thấy file IDL, sử dụng IDL mẫu');
    return {
      "version": "0.1.0",
      "name": "mycontract",
      "instructions": [
        {
          "name": "initialize",
          "accounts": [
            { "name": "vault", "isMut": true, "isSigner": false },
            { "name": "treasury", "isMut": true, "isSigner": false },
            { "name": "authority", "isMut": true, "isSigner": true },
            { "name": "systemProgram", "isMut": false, "isSigner": false }
          ],
          "args": [
            { "name": "bump", "type": "u8" }
          ]
        },
        {
          "name": "depositSol",
          "accounts": [
            { "name": "sender", "isMut": true, "isSigner": true },
            { "name": "vault", "isMut": true, "isSigner": false },
            { "name": "treasury", "isMut": true, "isSigner": false },
            { "name": "systemProgram", "isMut": false, "isSigner": false }
          ],
          "args": [
            { "name": "amount", "type": "u64" }
          ]
        },
        {
          "name": "transferSol",
          "accounts": [
            { "name": "authority", "isMut": true, "isSigner": true },
            { "name": "vault", "isMut": true, "isSigner": false },
            { "name": "treasury", "isMut": true, "isSigner": false },
            { "name": "destination", "isMut": true, "isSigner": false },
            { "name": "systemProgram", "isMut": false, "isSigner": false }
          ],
          "args": [
            { "name": "amount", "type": "u64" }
          ]
        }
      ],
      "accounts": [
        {
          "name": "Vault",
          "type": {
            "kind": "struct",
            "fields": [
              { "name": "authority", "type": "publicKey" },
              { "name": "bump", "type": "u8" }
            ]
          }
        }
      ],
      "errors": [
        { "code": 6000, "name": "InsufficientFunds", "msg": "Không đủ SOL trong treasury" },
        { "code": 6001, "name": "Unauthorized", "msg": "Bạn không có quyền thực hiện hành động này" }
      ]
    };
  } catch (error) {
    console.error('❌ Lỗi khi đọc IDL:', error);
    process.exit(1);
  }
};

// Thông tin runtime
const runtimeInfo = {
  isWSL: isWSL(),
  platform: process.platform,
  homeDir: os.homedir(),
  clusterName: getClusterName(),
  clusterUrl: getClusterUrl()
};

// Log thông tin khi khởi tạo module
console.log(`
💻 Thông tin môi trường:
- Cluster: ${runtimeInfo.clusterName} (${runtimeInfo.clusterUrl})
- WSL: ${runtimeInfo.isWSL ? 'Có' : 'Không'}
- Platform: ${runtimeInfo.platform}
`);

module.exports = {
  connection,
  getConnection,
  PROGRAM_ID,
  loadIDL,
  runtimeInfo,
  getClusterName
}; 