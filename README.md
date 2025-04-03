# Solana SOL Transfer Smart Contract

## Tổng quan

Đây là một smart contract trên Solana cho phép người dùng:
- Khởi tạo một vault để lưu trữ SOL
- Gửi SOL vào vault
- Chuyển SOL từ vault đến một địa chỉ đích
- Tạo giao dịch tự động gửi SOL qua contract đến địa chỉ đích

## Cấu trúc dự án

```
mycontract/
  ├── programs/
  │   └── mycontract/
  │       └── src/
  │           ├── lib.rs           # Mã nguồn của smart contract
  │           └── error.rs         # Định nghĩa lỗi
  ├── src/
  │   ├── commands/                # Các lệnh CLI
  │   │   ├── index.js
  │   │   └── utils.js
  │   ├── services/                # Các dịch vụ
  │   │   └── contract.js
  │   └── utils/                   # Các tiện ích
  │       ├── connection.js
  │       ├── input.js
  │       ├── pda.js
  │       └── wallet.js
  ├── cli.js                       # Giao diện dòng lệnh
  ├── client.js                    # Script client cũ (sẽ được thay thế bởi CLI)
  └── package.json
```

## Cài đặt

1. Clone repository
```bash
git clone <repository-url>
cd mycontract
```

2. Cài đặt dependencies
```bash
npm install
```

3. Biên dịch smart contract
```bash
anchor build
```

4. Deploy smart contract (localnet)
```bash
anchor deploy
```

## Sử dụng CLI

1. Hiển thị trợ giúp
```bash
node cli.js help
```

2. Khởi tạo vault
```bash
node cli.js initialize
```

3. Gửi SOL vào treasury
```bash
node cli.js deposit 0.1
```

4. Kiểm tra số dư treasury
```bash
node cli.js treasury-balance
```

5. Chuyển SOL từ treasury đến địa chỉ đích
```bash
node cli.js transfer 0.05 <địa_chỉ_đích>
```

6. Tự động chuyển SOL qua contract đến địa chỉ đích
```bash
node cli.js auto-transfer 0.05 <địa_chỉ_đích>
```

7. Kiểm tra số dư của một địa chỉ
```bash
node cli.js balance <địa_chỉ>
```

## Cài đặt CLI toàn cục (tùy chọn)

```bash
npm link
```

Sau khi cài đặt, bạn có thể sử dụng CLI từ bất kỳ đâu:

```bash
sol-transfer help
```

## License

MIT 