import Phaser from 'phaser';

/**
 * ConnectionLineManager - Quản lý toàn bộ logic vẽ đường nối giữa 2 ảnh.
 *
 * Nhiệm vụ:
 * 1. Tính điểm nối chính xác bằng pixel raycast (bỏ qua vùng transparent).
 * 2. Vẽ đường kéo tạm thời (drag line) khi người chơi đang kéo.
 * 3. Vẽ đường nối cố định (permanent line) khi trả lời đúng.
 * 4. Dọn dẹp tài nguyên khi reset/chuyển màn.
 *
 * Thiết kế:
 * - Dùng Dependency Injection (nhận Phaser.Scene) để tái sử dụng cho nhiều game khác nhau.
 * - Không phụ thuộc Scene cụ thể nào, chỉ cần Phaser.Scene có textures.
 */
export class ConnectionLineManager {
    private scene: Phaser.Scene;
    private dragLine: Phaser.GameObjects.Graphics;
    private permanentLines: Phaser.GameObjects.Graphics[] = [];

    constructor(scene: Phaser.Scene) {
        this.scene = scene;
        this.dragLine = scene.add.graphics();
        this.dragLine.setDepth(200);
        this.dragLine.setAlpha(0);
    }

    // =================================================================
    // PIXEL RAYCAST - Tìm điểm nối chính xác trên ảnh
    // =================================================================

    /**
     * Tính điểm nối chính xác trên ảnh bằng pixel raycast.
     * Quét từ viền ảnh hướng vào tâm theo vector (fromX, fromY) -> (cx, cy),
     * tìm pixel non-transparent đầu tiên (alpha > 0).
     * Kết quả đường kẻ là đường ngắn nhất giữa 2 nội dung ảnh thật.
     */
    public getContentEdgePoint(
        img: Phaser.GameObjects.Image,
        fromX: number, fromY: number
    ): { x: number; y: number } {
        const cx = img.x;
        const cy = img.y;
        const angle = Math.atan2(fromY - cy, fromX - cx);

        // Tính bán kính lớn nhất (nửa đường chéo) để bắt đầu raycast từ viền ngoài cùng
        const halfW = img.displayWidth / 2;
        const halfH = img.displayHeight / 2;
        const maxRadius = Math.sqrt(halfW * halfW + halfH * halfH);

        const textureKey = img.texture.key;
        const textureWidth = img.texture.getSourceImage().width;
        const textureHeight = img.texture.getSourceImage().height;

        // Bước quét: mỗi bước ~ 2 pixel trên texture gốc cho tốc độ + độ chính xác
        const scaleX = img.displayWidth / textureWidth;
        const scaleY = img.displayHeight / textureHeight;
        const avgScale = (scaleX + scaleY) / 2;
        const stepSize = Math.max(avgScale * 2, 1);
        const totalSteps = Math.ceil(maxRadius / stepSize);

        // Raycast: đi từ viền (maxRadius) vào tâm (0)
        for (let i = 0; i <= totalSteps; i++) {
            const dist = maxRadius - i * stepSize;
            if (dist < 0) break;

            const worldX = cx + dist * Math.cos(angle);
            const worldY = cy + dist * Math.sin(angle);

            // Chuyển tọa độ World -> tọa độ Texture (local pixel)
            // Origin mặc định 0.5 -> tâm ảnh ở (textureWidth/2, textureHeight/2)
            const localX = Math.round((worldX - cx) / scaleX + textureWidth * img.originX);
            const localY = Math.round((worldY - cy) / scaleY + textureHeight * img.originY);

            // Bỏ qua nếu ra ngoài ảnh texture
            if (localX < 0 || localX >= textureWidth || localY < 0 || localY >= textureHeight) continue;

            const pixel = this.scene.textures.getPixel(localX, localY, textureKey);
            if (pixel && pixel.alpha > 0) {
                return { x: worldX, y: worldY };
            }
        }

        // Fallback: nếu raycast không tìm thấy (ảnh 100% transparent), dùng 60% radius
        const fallbackRadius = Math.min(halfW, halfH) * 0.6;
        return {
            x: cx + fallbackRadius * Math.cos(angle),
            y: cy + fallbackRadius * Math.sin(angle),
        };
    }

    // =================================================================
    // ĐƯỜNG KÉO TẠM THỜI (DRAG LINE)
    // =================================================================

    /** Bật hiển thị đường kéo khi bắt đầu drag. */
    public startDragLine(): void {
        this.dragLine.setAlpha(1);
    }

    /**
     * Cập nhật đường kéo tạm từ ảnh nguồn đến vị trí con trỏ.
     * Tự động tính điểm bắt đầu bằng pixel raycast trên ảnh nguồn.
     */
    public updateDragLine(sourceImg: Phaser.GameObjects.Image, toX: number, toY: number): void {
        this.dragLine.clear();

        // Tính điểm bắt đầu sát mép nội dung ảnh nguồn, hướng về phía con trỏ
        const edgePoint = this.getContentEdgePoint(sourceImg, toX, toY);
        const startX = edgePoint.x;
        const startY = edgePoint.y;

        // Vẽ đường chính (màu xanh lá)
        this.dragLine.lineStyle(6, 0x00dd44, 0.9);
        this.dragLine.beginPath();
        this.dragLine.moveTo(startX, startY);
        this.dragLine.lineTo(toX, toY);
        this.dragLine.strokePath();

        // Vẽ đường viền ngoài mỏng hơn (màu vàng)
        this.dragLine.lineStyle(2, 0xffff00, 0.5);
        this.dragLine.beginPath();
        this.dragLine.moveTo(startX, startY);
        this.dragLine.lineTo(toX, toY);
        this.dragLine.strokePath();

        // Vẽ chấm tròn tại điểm cuối
        this.dragLine.fillStyle(0x00dd44, 1);
        this.dragLine.fillCircle(toX, toY, 10);
    }

    /** Ẩn đường kéo tạm khi nhả tay hoặc hoàn thành nối. */
    public stopDragLine(): void {
        this.dragLine.clear();
        this.dragLine.setAlpha(0);
    }

    // =================================================================
    // ĐƯỜNG NỐI CỐ ĐỊNH (PERMANENT LINE)
    // =================================================================

    /**
     * Vẽ đường nối cố định giữa 2 ảnh (ngắn nhất, chạm vào pixel thật).
     * Tự động tính điểm nối bằng pixel raycast trên cả 2 ảnh.
     * Kèm animation fade in.
     */
    public drawFinalLine(
        sourceImg: Phaser.GameObjects.Image,
        targetImg: Phaser.GameObjects.Image,
        color: number
    ): void {
        // Tính điểm neo từ sát mép nội dung ảnh nguồn hướng về phía ảnh đích
        const edgeStart = this.getContentEdgePoint(sourceImg, targetImg.x, targetImg.y);
        // Tính điểm neo từ sát mép nội dung ảnh đích hướng về phía ảnh nguồn
        const edgeEnd = this.getContentEdgePoint(targetImg, sourceImg.x, sourceImg.y);

        const finalLine = this.scene.add.graphics();
        finalLine.setDepth(150);

        // Vẽ đường chính
        finalLine.lineStyle(8, color, 1);
        finalLine.beginPath();
        finalLine.moveTo(edgeStart.x, edgeStart.y);
        finalLine.lineTo(edgeEnd.x, edgeEnd.y);
        finalLine.strokePath();

        // Vẽ chấm tròn 2 đầu
        finalLine.fillStyle(color, 1);
        finalLine.fillCircle(edgeStart.x, edgeStart.y, 12);
        finalLine.fillCircle(edgeEnd.x, edgeEnd.y, 12);

        // Animation fade in
        finalLine.setAlpha(0);
        this.scene.tweens.add({
            targets: finalLine,
            alpha: 1,
            duration: 300,
            ease: 'Cubic.easeOut',
        });

        this.permanentLines.push(finalLine);
    }

    // =================================================================
    // DỌN DẸP TÀI NGUYÊN (CLEANUP)
    // =================================================================

    /** Xóa tất cả đường nối cố định. Gọi khi reset/chuyển màn. */
    public clearAll(): void {
        this.permanentLines.forEach(line => line.destroy());
        this.permanentLines = [];
        this.stopDragLine();
    }
}
