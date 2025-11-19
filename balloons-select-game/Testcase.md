
# ✅ **I. Test Case: Khởi động game**

### **TC01 — Game load thành công**

* **Step**: Mở game → đợi preload.
* **Expected**:

  * Không lỗi console.
  * Background, thỏ, banner và 4 bóng hiển thị.
  * Noise loading không treo.

---

### **TC02 — Tải audio thành công**

* **Step**: Load game khi đã có file audio 1–4.
* **Expected**:

  * Không lỗi 404 audio.
  * Không lỗi "audioKey undefined".

---

### **TC03 — Prompt hiển thị đúng**

* **Step**: Vào Level 1.
* **Expected**: Text hiển thị: **"Chạm vào số 1"**

---

### **TC04 — Prompt Audio đọc ngay khi vào game**

* **Step**: Reload F5.
* **Expected**:

  * Giọng đọc “Chạm vào số X” phát ngay.
  * Không cần click mới phát.

---

# ✅ **II. Test Case: Logic chọn đúng/sai**

### **TC10 — Chọn đúng số**

* **Step**:

  * Ví dụ prompt là số 3 → click vào bóng có số 3.
* **Expected**:

  * Bóng đó phóng to nhẹ + di chuyển ra giữa màn hình.
  * Âm thanh “correct” hoặc pop.
  * Các bóng khác disableInteractive.
  * Hiện bảng show hình táo/hay cà rốt đúng số lượng.

---

### **TC11 — Chọn sai số**

* **Step**:

  * Prompt “3” → click vào bóng số 2.
* **Expected**:

  * Hiệu ứng sai (shake hoặc đỏ).
  * Âm thanh "wrong".
  * Không chuyển màn.
  * Các bóng còn lại vẫn bấm được.

---

### **TC12 — Click liên tục vào bóng đã chọn**

* **Expected**:

  * Không lỗi.
  * Không chạy logic nhiều lần.

---

### **TC13 — Click 2 bóng cùng lúc**

* **Step**: Bấm nhanh vào 2 bóng.
* **Expected**:

  * Chỉ 1 đúng được xử lý.
  * Không duplicate table.

---

# ✅ **III. Test Case: Hiển thị bảng số lượng**

### **TC20 — Bảng hiển thị đúng vị trí**

* **Expected**:

  * Center X=640 Y=400.

---

### **TC21 — Item hiển thị đúng số lượng**

* Test với correctNumber = 1, 2, 3, 4.
* Expected:

  * 1 → 1 hình.
  * 2 → 2 hình.
  * 3 → 3 hình (2 hàng).
  * 4 → 4 hình (2 hàng, 2×2).

---

### **TC22 — Kích thước item chính xác**

* **Expected**:

  * Mỗi item 200×200.
  * Không bị chồng lên nhau.
  * Padding đúng.

---

### **TC23 — Hiển thị tuần tự từng hình**

* **Expected**:

  * Hình xuất hiện từng cái → 1 → 2 → 3 → …
  * Nếu có âm thanh đếm, audio sync đúng thứ tự.

---

# ✅ **IV. Test Case: Âm thanh**

### **TC30 — Prompt Audio đúng số**

* correctNumber = 2 → phát "vo_prompt_2.mp3".

---

### **TC31 — Âm thanh sai**

* Bấm sai → phát "sfx_wrong".

---

### **TC32 — Âm thanh đúng**

* Bấm đúng → phát "sfx_correct" hoặc pop.

---

### **TC33 — Âm thanh đếm trong bảng**

* **Expected**:

  * 1 → đọc “một”
  * 2 → đọc “hai”
  * 3 → đọc “ba”
  * 4 → đọc “bốn”

---

### **TC34 — Không chồng âm thanh**

* **Expected**: Nếu prompt chưa đọc xong mà bấm đúng → âm thanh cũ stop hoặc fade.

---

# ✅ **V. Test Case: Animation**

### **TC40 — Animation bóng bay co giãn**

* Expected:

  * 4 bóng balloon pulsate nhẹ liên tục.
  * FPS ổn định.

---

### **TC41 — Animation phóng to khi chọn đúng**

* Expected:

  * Zoom lên 1.3–1.5 scale.
  * Move to center.
  * Fade out.

---

### **TC42 — Rabbit animation (nếu có)**

* Rabbit idle animation chạy đúng.

---

# ✅ **VI. Test Case: Navigation**

### **TC50 — Nút mũi tên “Tiếp theo” hoạt động**

* Step:

  * Chọn đúng số.
  * Bấm nút mũi tên dưới bên phải.
* Expected:

  * Sang level tiếp theo.
  * Không tự động qua level.

---

### **TC51 — Restart scene truyền đúng currentLevel**

* Expected:

  * Không lỗi undefined correctNumber.
  * Prompt đúng số level.

---

### **TC52 — Đủ hết levels chuyển sang EndScene**

* Expected:

  * Màn hình kết thúc hiển thị.
  * Có nút “Chơi lại”.

---

# ✅ VII. Test Case: End Game**

### **TC60 — EndScene hiển thị đúng**

* Background đẹp.
* Nút “Chơi lại” rõ ràng.

---

### **TC61 — Click “Chơi lại”**

* Expected:

  * Quay lại GameScene.
  * currentLevel = 0.
  * Không lỗi.

---

# ✅ **VIII. Test Case: Tương thích**

### **TC70 — Test trên mobile**

* Touch sensitivity chuẩn.
* Không zoom màn.
* UI không bị lệch.

---

### **TC71 — Performance**

* FPS luôn > 50.
* Không lag khi xuất hiện bảng với 4 hình.

---

### **TC72 — Reload game**

* Reload F5 → prompt audio đọc.

---