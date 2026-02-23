# Game Khoanh Số 4 (game_khoanh_so_4)

## 1. Mô tả & Luật chơi

- **Mục tiêu**: Người chơi tìm và khoanh tròn **tất cả** đối tượng đúng (số lượng động theo config).
- **Cơ chế**:
  1. **Intro**: Voice hướng dẫn.
  2. **Gameplay**:
     - Tương tự game khoanh số 2 nhưng số lượng mục tiêu không cố định là 2.
     - Game tự đếm `totalTargets` dựa trên config.
  3. **Kết quả**:
     - Khoanh đúng -> Vòng xanh -> Cộng điểm.
     - Khoanh đủ `totalTargets` -> Win -> EndGame.

## 2. Config & Dữ liệu

- **File**: `public/assets/data/level_s1_config.json`
- **Logic**:
  - `totalTargets` = số lượng object có `isCorrectAnswer() == true`.
  - `game.setTotal(this.totalTargets)`: Config động.

## 3. Hướng dẫn Test

- **Happy Path**: Đếm số vật đúng trên màn hình (VD: 4 cái) -> Khoanh hết 4 cái -> Win.
- **Fail Path**: Khoanh vật sai -> Rung lắc.
- **Retry**: Nhấn chơi lại -> Reset số đã tìm về 0.

## 4. Checklist Pre-merge

- [ ] **Config**: Check số lượng vật đúng thực tế khớp với thiết kế level.
- [ ] **SDK**:
  - [ ] `game.setTotal()` nhận đúng số lượng từ config.
  - [ ] `sdk.progress()` cập nhật đúng từng bước (1/4, 2/4...).
