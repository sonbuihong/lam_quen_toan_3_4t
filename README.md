# 🧮 Mini-game Toán: “Đếm & Chọn Số Đúng (1–10)”

## 🎯 Mục tiêu

Phát triển **mini-game đếm số từ 1 đến 10** giúp trẻ nhỏ rèn luyện kỹ năng **đếm và nhận diện số lượng cơ bản**.

---

## 👩‍💻 Thành viên phụ trách

- **Mảng phụ trách:** Mini-game Toán – Đếm 1–10
- **Phạm vi:** Frontend

---

## 🧱 Công nghệ sử dụng

| Công nghệ           | Mục đích                              |
| ------------------- | ------------------------------------- |
| **Next.js**         | Framework React cho frontend          |
| **React**           | Quản lý UI và logic component         |
| **TailwindCSS**     | Tạo giao diện, bố cục, hiệu ứng nhanh |
| **PixiJS / Phaser** | Render đồ họa 2D và logic game        |

---

## 🧩 Yêu cầu chức năng

### 🎮 Cơ chế trò chơi

- Hiển thị **n vật thể** (ví dụ: táo, bóng, sao,...) trên màn hình.
- Người chơi **chọn số đúng** tương ứng với số lượng vật thể xuất hiện.
- Chọn đúng → cộng điểm.  
  Chọn sai → trừ điểm hoặc kết thúc lượt.
- Có **giới hạn thời gian** theo độ khó.

---

### ⚙️ Props truyền vào

```ts
{
  difficulty: "easy" | "med"; // Mức độ khó
}
```

### 🧠 Kỹ năng rèn luyện

- count_1_10: giúp người chơi rèn luyện khả năng đếm và nhận biết số lượng từ 1–10.

### ✅ Output yêu cầu

1 mini-game hoàn chỉnh, có thể chơi được từ đầu đến cuối.

- Hiển thị và animation mượt mà.

- Không có lỗi console.

- Gửi event hợp lệ về server.

- Code sạch, có chú thích mô tả logic chính.

### ⚙️ Cách chạy project

```bash
# Cài dependencies
npm install

# Chạy server dev
npm run dev

# Mở trình duyệt tại
http://localhost:3000

```

### 🚀 Deployment

👉 Live Demo: [https://math-minigame-three.vercel.app/](https://math-minigame-three.vercel.app/)
