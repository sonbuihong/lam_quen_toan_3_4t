# Game Tô Màu Ô Tô (game_coloring_car)

## 1. Giới thiệu chung & Mục tiêu

- **Mục tiêu**: Giúp các bé làm quen với thế giới màu sắc, nhận biết hình dáng thông qua việc tô màu một chiếc ô tô chi tiết (bánh xe, thân xe, cửa sổ...).
- **Cơ chế hoạt động**: Người chơi chọn màu yêu thích từ bảng màu (palette) dự kiến, chạm và giữ/miết tay trên màn hình để tô màu các vùng (mảnh/part) của chiếc xe. Giống với các hệ thống chuẩn thuộc thể loại "Paint" của Love Math / Iruka.

---

## 2. Luật chơi

- Bé bấm chọn màu tại bảng công cụ (UI Palette).
- Nhấp và di chuyển tay vào vị trí chưa được tô của bộ phận xe.
- Khi diện tích vùng tô đạt được tỷ lệ tối thiểu (ví dụ: `min_region_coverage = 0.9` tương đương 90%), vùng đó tự động chuyển sang trạng thái hoàn thành.
- **Trigger Kết Thúc**: Khi tất cả các bộ phận của chiếc ô tô được tô xong, xe có thể diễn hoạt (lăn bánh, hiệu ứng pháo hoa, nhảy múa) để chúc mừng.

---

## 3. Cấu trúc kỹ thuật chính (Tech Stack)

Trò chơi tuân thủ kiến trúc phân rã chuẩn của Iruka/Love Math:

- `scenes/Scene1.ts`: Quản lý luồng chính của game (khởi tạo màn chơi, lắng nghe sự kiện Pointer, quản lý vòng đời PaintTracker SDK).
- `scenes/UIScene.ts`: Hiển thị UI như bảng màu, nút bấm, điểm số, và hiệu ứng chiến thắng (Victory Animation).
- `utils/PaintManager.ts`: Core logic xử lý tô màu _pixel-perfect_. Tính toán tỷ lệ điểm ảnh để xác thực độ phủ (coverage) thông qua đường quét toạ độ chuột.
- `utils/GameUtils.ts`: Các hàm tiện ích dùng chung (Preload layer, Resize canvas, Utility chức năng).

---

## 4. Dữ liệu & Cấu hình (Level Config)

Toàn bộ thông số game được tải từ file cấu hình JSON, ví dụ điển hình là `public/assets/data/level_s1_config.json`. Hệ thống sử dụng định dạng chuẩn dành cho dòng game "Paint" nhằm tương thích với SDK Tracking.

### Ví dụ cấu trúc JSON chuẩn:

```jsonc
{
  "min_region_coverage": 0.9,
  "max_spill_ratio": 0.1,
  "parts": [
    {
      "id": "CarBody_01",
      "key": "CarBody",
      "hintX": 400,
      "hintY": 300,
      "area_px": 5200, // MUST HAVE: Diện tích vùng tô tính bằng pixel
      "allowed_colors": ["any"], // Tùy chọn: Bảng màu bé được phép chọn
      "correct_color": null, // Tùy chọn: Màu yêu cầu chính xác (nếu null là tự do)
    },
  ],
}
```

_Giải thích tham số:_

- **area_px**: Tổng diện tích (pixels) chuẩn của đối tượng. Bắt buộc để hệ thống Tracker tính toán phần trăm độ phủ.
- **hintX, hintY**: Tọa độ bàn tay hướng dẫn khi bé ở trạng thái rảnh rỗi quá lâu.
- **min_region_coverage**: Tỷ lệ tối thiểu cần đạt để hoàn thành tô màu một vùng.

---

## 5. Tích hợp BI & Tracking SDK (PaintTracker)

Core Game đã được chuẩn hóa để gửi dữ liệu về hệ thống phân tích. Code phải tuân thủ nghiêm ngặt tài liệu `game-paint.md`:

- **Quản lý Vòng đời Tracker:**
  - Mỗi bộ phận (part) chiếc xe là 1 đối tượng Tracker `ItemResult`. Mỗi lần bé chạm (`pointerdown`) và nhấc lên (`pointerup`) cấu trúc thành 1 `attempt`.
- **Dữ liệu Đầu vào (Expected Data):**
  - Chắc chắn `area_px`, `allowed_colors` được load từ JSON/HitArea Config truyền đúng cho SDK.
- **Kết quả Hành vi người chơi:**
  - Dữ liệu hoàn thành (`completion_pct`), số lần thay màu (`color_change_count`), mã màu đã dùng... đóng gói gửi đi sau khi người dùng nhấc tay lên qua lệnh `onDone()`.
- **Trạng thái đóng (Clean-up Phase):**
  - Khi màn chơi kết thúc hoặc người chơi đột ngột thoát (Quit/Exit game), toàn bộ session tracking đang mở dở sẽ được gọi `.finalize()` để ghi nhận hành vi huỷ bỏ (Abandoned).

---

## 6. Hướng dẫn Test & QA Checklist (Pre-merge)

Để đảm bảo Game hoạt động tuyệt đối ổn định trước khi Release, tuân thủ danh sách kiểm định sau:

1. **Test Luồng Chính (Happy Path):**
   - [ ] Tô màu đầy đủ từng mô-đun trên xe. Kiểm tra hiệu ứng hoàn thành (pháo hoa hoặc xe di chuyển) diễn ra trơn tru.
   - [ ] Dữ liệu gửi đi (Payload `history[].response`) đã bao gồm field `area_px` và `selected_color`.
2. **Test Các Trường Hợp Biên (Edge Cases):**
   - [ ] Vẽ loang (Spill): Bút tô chờm vị trí từ vùng này phủ nét lên vùng khác sát vách, kiểm tra tracking và Hit Area có bị tính nhầm không.
   - [ ] Đổi kích thước bút liên tục khi tô chưa xong, kiểm tra UI cập nhật brush size.
3. **Test Gọi Ý Thông Minh (Idle Hint):**
   - [ ] Không thao tác màn hình trong 10s, bàn tay hướng dẫn có xuất hiện trỏ đúng vào tọa độ `hintX`, `hintY` của part chưa được tô hay không.
4. **Hiệu Suất & Đồ họa (Performance):**
   - [ ] Asset Resolutions: Độ phân giải của bánh xe (wheel), thân hình xe (body) không bị răng cưa mờ nhòe ở thiết bị màn hình lớn (Tablet/Monitor độ phân giải cao).
   - [ ] FPS: Rà lỗi lag giật frame nếu đường tô/chấm nét bút sinh ra quá nhiều pixel thừa.
   - [ ] Cleanup Leak: Thử thoát scene vào lại liên tục, Memory/Trackers RAM phải được thu dọn hoàn toàn mà không sinh ra Trackers ma.
