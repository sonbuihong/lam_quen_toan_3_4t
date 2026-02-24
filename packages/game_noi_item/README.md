# Game Khoanh Và Nối Số Lượng

## 1. Mô tả & Luật chơi

- **Mục tiêu**: Người chơi tìm và khoanh tròn **tất cả** đối tượng đúng trên màn hình, sau đó kéo đường nối từ vòng đã khoanh đến thẻ đáp án tương ứng.
- **Cơ chế**:
  1. **Scene 1 (Khoanh mục tiêu)**:
     - Người chơi nghe Voice hướng dẫn và dùng công cụ Lasso kéo vẽ vòng khép kín quanh các mục tiêu đúng (ví dụ: các cái mũ).
     - **Đúng**: Tạo ra một vòng xanh bao trọn tất cả hình đã khoanh, sau đó chuyển sang Scene 2.
     - **Sai (thiếu/thừa/sai)**: Các hình mục tiêu rung nhè nhẹ, phát âm thanh sai và yêu cầu khoanh lại.
  2. **Scene 2 (Kéo nối đáp án)**:
     - Màn hình giữ nguyên vòng xanh từ Scene 1 và hiển thị thêm các thẻ đáp án ở bên dưới.
     - Người chơi chạm vào vòng xanh và kéo rê một đường (drag line) tới thẻ đáp án đúng.
     - **Đúng**: Thẻ đáp án phóng to, viền vàng nhấp nháy, cộng điểm và chuyển màn tiếp theo hoặc kết thúc game (EndGame).
     - **Sai**: Thẻ đáp án mục tiêu bị rung lắc, chạy âm thanh sai và tiếp tục chờ người chơi kéo lại.
  3. **Idle Hint** (Gợi ý): Nếu để quá lâu không tương tác, bàn tay hướng dẫn sẽ xuất hiện gợi ý cách khoanh vòng (Scene 1) hoặc cách nối (Scene 2).

## 2. Config & Dữ liệu

- **File**: `public/assets/data/level_s1_config.json`
- **Cấu trúc Config**:
  - `answers`: Mảng định nghĩa các thẻ đáp án xuất hiện ở Scene 2 (dùng chung cho các level, đặt ở top-level).
  - `levels`: Danh sách cấu hình cho từng màn chơi, bao gồm:
    - `images`: Tập hợp đối tượng xuất hiện trên bảng (Scene 1).
    - `correctKey`: Mảng các `textureKey` xác định hình nào là hình đúng cần khoanh.
    - `correctAnswer`: `textureKey` của thẻ đáp án đúng ở Scene 2 để kéo nối tới.
- **Tiến trình (SDK)**: `game.setTotal()` dựa trên số lượng object trong mảng `levels` (tổng số màn), gọi ở lần tạo Scene 1 đầu tiên. Tiến độ được ghi nhận trọn vẹn ở Scene 2 (sau khi nối thành công).

## 3. Hướng dẫn Test

- **Happy Path**:
  - Nghe hướng dẫn -> Khoanh trúng và đủ các hình mục tiêu -> Chuyển sang màn kéo -> Nối vòng xanh với đáp án đúng -> Chuyển màn/Win.
- **Fail Path**:
  - Cố tình khoanh sai hình, khoanh thiếu hình hoặc khoanh thừa hình sai -> Check xem có bị rung + báo âm thanh sai không.
  - Cố tình nối với thẻ đáp án sai -> Check báo lỗi và rung đáp án.
- **Game Flow**: Test kỹ lúc bắt đầu chuyển màn (nút chơi lại / replay từ EndGame) xem State (voice, hint, mượt mà chuyển cảnh) có bị lỗi không.

## 4. Checklist Pre-merge

- [ ] **Config**: Các `correctKey` và `correctAnswer` ở tất cả level đều khớp với thiết kế.
- [ ] **Gameplay**: Lasso mượt, không bị dính / kẹt viền khi khoanh. Hint bàn tay xuất hiện đúng toạ độ vòng tròn.
- [ ] **SDK**:
  - [ ] Gọi `sdk.progress()` ngay từ Scene 1.
  - [ ] Gọi `game.recordWrong()` nếu khoanh sai hoặc kéo sai.
  - [ ] Gọi `game.recordCorrect()` và `sdk.score()` cập nhật khi kéo thả chính xác (Scene 2).
  - [ ] Gọi `game.finalizeAttempt()` đúng thời điểm ở level cuối cùng.
