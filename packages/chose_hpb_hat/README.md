# Game Chose HPB HAT

Dự án game "Chose HPB HAT" (Chọn Hình Phẳng Bé/Hát - Tên dự kiến từ mã nguồn), được xây dựng bằng **Phaser 3** và **TypeScript**, sử dụng **Vite** làm trình đóng gói (bundler). Game được tích hợp với hệ thống **Iruka Mini Game SDK**.

## 🛠 Công nghệ sử dụng

- **Core**: [Phaser 3](https://phaser.io/) (Framework game 2D)
- **Language**: TypeScript
- **Build Tool**: [Vite](https://vitejs.dev/)
- **SDK**: `@iruka-edu/mini-game-sdk`, `@iruka-edu/game-core`
- **Audio**: Howler.js

## ⚙️ Yêu cầu cài đặt

- [Node.js](https://nodejs.org/) (Khuyên dùng phiên bản LTS mới nhất)
- [pnpm](https://pnpm.io/) (Trình quản lý gói)

## 🚀 Hướng dẫn chạy dự án

### 1. Cài đặt thư viện (Dependencies)

Mở terminal tại thư mục gốc của dự án (`packages/chose_hpb_hat`) và chạy lệnh:

```bash
pnpm install
```

### 2. Chạy môi trường phát triển (Development)

Để chạy game ở chế độ dev (hot-reload):

```bash
pnpm run dev
```

Sau khi chạy xong, truy cập vào đường dẫn local (thường là `http://localhost:5173`) hiển thị trên terminal để xem game.

### 3. Đóng gói mã nguồn (Build Production)

Để build game ra thư mục `dist` (dùng để deploy):

```bash
pnpm run build
```

## 📂 Cấu trúc dự án

- `src/`: Chứa mã nguồn chính của game.
  - `scenes/`: Các màn chơi (Scene1, UI, EndGame...).
  - `consts/`: Các hằng số (Keys, GameConstants).
  - `utils/`: Các hàm tiện ích (GameUtils, IdleManager...).
  - `main.ts`: Điểm khởi chạy của game.
- `public/`: Chứa tài nguyên tĩnh (assets, images, audio...).
- `index.html`: File HTML chính.
- `vite.config.ts`: Cấu hình Vite.

## 📝 Ghi chú phát triển

- **Logic Delay**: Trong `Scene1.ts`, có logic delay 5 giây khi bắt đầu Intro để chặn người chơi chọn đáp án quá sớm.
- **Manifest**: File `manifest.json` trong `public` chứa thông tin định danh của game trên hệ thống Iruka.
