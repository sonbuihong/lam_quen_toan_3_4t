
# 🚀 LỘ TRÌNH CODE GAME “SO SÁNH SỐ LƯỢNG: BÊN NÀO NHIỀU HƠN / ÍT HƠN / BẰNG NHAU”

Game cho bé 3–4 tuổi → ưu tiên: ít chữ, icon to, thao tác chạm đơn giản.

---

## Giai đoạn 1: Chuẩn bị project

1. Tạo project Phaser (hoặc engine chung team đang dùng) với cấu trúc thư mục tương tự game cũ:

   * public/assets/images: nền biển, con vật, panel, icon dấu, nút UI.
   * public/assets/audio: âm đúng, sai, nhạc nền nhẹ.
   * src/scenes: CompareScene, ResultScene (nếu tách).
   * main.ts: khởi tạo game, add CompareScene.

2. Cấu hình bundler (Vite/Webpack) cho phép load:

   * hình (webp/png),
   * audio (ogg/mp3),
   * json (level config, text).

3. Đặt asset:

   * Background chủ đề biển.
   * Sprite con vật: rùa, cá heo, cá.
   * Panel / bảng cho bên trái, bên phải.
   * Icon dấu: “=”, “>”, “<”.
   * Nút home, replay, next.

---

## Giai đoạn 2: Tạo CompareScene (scene chính)

4. Tạo file CompareScene với 3 phần cơ bản:

   * preload: load hình + âm thanh.
   * create: dựng UI, khởi tạo dữ liệu level, hiển thị câu đầu.
   * update: (nếu cần, chủ yếu cho animation nền, không bắt buộc).

5. Trong preload:

   * Load tất cả hình, âm thanh, file json level (nếu tách ra).
   * Kiểm tra console đảm bảo không thiếu file.

---

## Giai đoạn 3: Dựng UI nền (không logic)

6. Trong create:

   * Vẽ background.
   * Vẽ 2 panel/bảng trái – phải (chỗ hiển thị con vật).
   * Vẽ khu vực tiêu đề/câu hỏi trên cùng:

     * Text lớn, ngắn: “Bên nào nhiều hơn?”, “Bên nào ít hơn?”, “Hai bên có giống nhau không?”
   * Vẽ khu vực nút:

     * Với mode “chọn bên”: không cần nút, bé chạm trực tiếp panel.
     * Với mode “chọn dấu”: 3 nút tròn chứa dấu “>”, “<”, “=”.
   * Vẽ nút home, replay (chưa cần xử lý logic chi tiết, chỉ log).

7. Xác định vị trí “lưới” để sắp con vật:

   * Số cột cố định (ví dụ 3–4 cột),
   * Khoảng cách đều, đảm bảo nhìn rõ trên mobile.

---

## Giai đoạn 4: Thiết kế dữ liệu màn chơi

8. Thiết kế cấu trúc dữ liệu level đơn giản, phù hợp 3–4 tuổi:

   * Mỗi level gồm:

     * mode: “chọn bên” hoặc “chọn dấu”.
     * left: loại con vật, số lượng.
     * right: loại con vật, số lượng.
     * questionType (mode chọn bên): “nhiều hơn” hoặc “ít hơn”.
     * correctSide (mode chọn bên): “left” hoặc “right”.
     * relation (mode chọn dấu): “<”, “>”, “=” đúng.

9. Tạo một mảng level mẫu:

   * 3–5 level đầu thật đơn giản (chênh lệch rõ: 2 vs 5, 1 vs 4…),
   * tối đa khoảng 1–6/1–8 cho đúng độ tuổi.

10. (Tuỳ scope) Tách dữ liệu:

    * Ban đầu có thể hard-code trong scene để nhanh.
    * Sau đó chuyển sang file json để team nội dung chỉnh sửa mà không cần đụng code.

---

## Giai đoạn 5: Tạo nhóm con vật & hiển thị câu hỏi

11. Viết luồng “loadLevel”:

    * Nhận index level → lấy dữ liệu level tương ứng.
    * Xoá toàn bộ con vật, nút, highlight của level cũ.
    * Hiển thị text câu hỏi phù hợp:

      * mode “chọn bên” + questionType “nhiều hơn” → “Chạm vào bên có nhiều con hơn”.
      * mode “chọn bên” + questionType “ít hơn” → “Chạm vào bên có ít con hơn”.
      * mode “chọn dấu” → “Chọn dấu đúng”.

12. Vẽ nhóm con vật bên trái và bên phải:

    * Dựa vào count, icon.
    * Sắp theo grid.
    * Với bé 3–4 tuổi: tránh quá nhiều con vật khiến rối mắt (tối đa khoảng 8/con).

13. Với mode “chọn dấu”:

    * Hiển thị 3 nút/dấu ở dưới màn hình (to, dễ bấm).
    * Giữa 2 nhóm có một chỗ trống dự kiến sẽ hiện dấu đúng sau khi bé chọn.

---

## Giai đoạn 6: Xử lý chạm chọn đúng – sai

14. Xác định vùng tương tác:

    * Mode “chọn bên”: panel trái và panel phải có trạng thái interactive.
    * Mode “chọn dấu”: 3 nút/dấu interactive.

15. Viết luồng xử lý khi bé chạm:

    * Nếu mode “chọn bên”: so sánh panel bé chọn với correctSide.
    * Nếu mode “chọn dấu”: so sánh dấu bé chọn với relation.

16. Quản lý state đơn giản:

    * Khi đang xử lý đúng/sai thì tạm khoá input (không nhận thêm chạm).
    * Chỉ mở lại khi đã xong feedback và chuyển sang câu mới.

17. Quy tắc sai:

    * Với bé 3–4 tuổi: cho phép chọn lại, không phạt.
    * Lần đầu sai: chỉ rung nhẹ & âm thanh “sai rồi”.
    * Sau 2 lần sai liên tiếp (tuỳ setting): hiển thị gợi ý rõ hơn hoặc show đáp án.

---

## Giai đoạn 7: Hiệu ứng, âm thanh, nhân vật dẫn chuyện

18. Định nghĩa bộ hiệu ứng khi:

    * Bé chọn đúng:

      * Panel hoặc dấu được chọn nhảy nhẹ/tỏa sáng.
      * Con vật có thể nhún nhảy nhỏ.
      * Âm thanh khen ngợi vui, ngắn.
    * Bé chọn sai:

      * Vùng chọn lắc nhẹ.
      * Âm thanh báo sai nhưng không “nặng nề”.

19. Nếu có nhân vật dẫn chuyện (ví dụ bạn nhỏ dưới góc màn hình):

    * Cần 2 trạng thái cơ bản: bình thường và vui mừng khi đúng.
    * Có thể chuyển trạng thái khi bé trả lời đúng.

20. Quản lý thời gian giữa các bước:

    * Sau khi đúng: delay khoảng 1–1.5 giây rồi tự chuyển câu.
    * Tránh delay quá lâu làm bé mất tập trung.

---

## Giai đoạn 8: Màn tổng kết & kết nối với hệ thống Iruka

21. Khi hết danh sách level:

    * Hiển thị màn tổng kết cực đơn giản:

      * Số câu bé làm đúng.
      * Sticker/sao hoặc icon khen ngợi.
      * Nút “Chơi lại” (reset về level 1).
      * Nút “Thoát” (gửi sự kiện ra shell).

22. Tích hợp event với shell Iruka:

    * Khi bắt đầu game: gửi event “game_started”.
    * Khi kết thúc: gửi event “game_finished” kèm:

      * tổng câu, số đúng, thời gian chơi (nếu có).

---

## Giai đoạn 9: Tối ưu & tách nhỏ code

23. Sau khi game hoạt động trơn tru, tách code thành các khối rõ ràng:

    * Khối UI:

      * tạo nền, panel, nút, text câu hỏi, progress.
    * Khối logic:

      * quản lý level, chấm đúng/sai, tính điểm.
    * Khối feedback:

      * hiệu ứng, âm thanh, đổi trạng thái nhân vật.

24. Tối ưu dung lượng:

    * Dùng webp/spritesheet cho hình.
    * Gộp nhiều icon vào 1 sheet.
    * Âm thanh ngắn, ít file, dùng ogg.

25. Chuẩn hoá để reuse:

    * Thiết kế sao cho chỉ cần đổi sprite + file json level là làm được phiên bản khác (chủ đề rừng, nông trại…) mà không đổi logic.

