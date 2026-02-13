
import Phaser from 'phaser';

/**
 * Quản lý tính năng vẽ Lasso (Khoanh vòng dây).
 * Nhiệm vụ:
 * 1. Xử lý sự kiện vẽ (Pointer Down/Move/Up).
 * 2. Vẽ hình ảnh trực quan của nét dây.
 * 3. Tạo ra Polygon từ nét vẽ để kiểm tra va chạm.
 * 4. Giới hạn vẽ chỉ trong phạm vi board.
 */
export class LassoManager {
    private scene: Phaser.Scene;
    private graphics: Phaser.GameObjects.Graphics;
    private maskGraphics?: Phaser.GameObjects.Graphics; // Graphics dùng để tạo mask
    private points: Phaser.Math.Vector2[] = [];
    private isDrawing: boolean = false;
    
    // Giới hạn vẽ (bounds của board)
    private boardBounds?: Phaser.Geom.Rectangle;
    
    // Cấu hình vẽ
    private readonly LINE_COLOR = 0xff0000;
    private readonly LINE_WIDTH = 10;
    private readonly SIMPLIFY_TOLERANCE = 5; // Độ lệch tối thiểu để thêm điểm mới (giảm số lượng điểm)

    // Sự kiện callback khi khoanh xong
    public onLassoComplete?: (polygon: Phaser.Geom.Polygon) => void;

    constructor(scene: Phaser.Scene) {
        this.scene = scene;
        this.graphics = this.scene.add.graphics();
        this.graphics.setDepth(100); // Đảm bảo vẽ đè lên trên các vật thể
    }

    /**
     * Thiết lập giới hạn vẽ (bounds của board).
     * @param bounds Hình chữ nhật giới hạn vẽ lasso
     */
    public setBoardBounds(bounds: Phaser.Geom.Rectangle) {
        this.boardBounds = bounds;
        
        // Tạo Graphics dùng để làm mask/clipping
        if (!this.maskGraphics) {
            this.maskGraphics = this.scene.add.graphics();
            this.maskGraphics.setVisible(false); // Ẩn, chỉ dùng làm mask
        }
        
        // Vẽ hình chữ nhật trên mask graphics
        this.maskGraphics.fillStyle(0xffffff, 1);
        this.maskGraphics.fillRectShape(bounds);
        
        // Áp dụng mask lên graphics vẽ lasso
        const mask = this.maskGraphics.createGeometryMask();
        this.graphics.setMask(mask);
    }

    /**
     * Kích hoạt chế độ vẽ Lasso.
     * Thường gọi một lần trong create() của Scene.
     */
    public enable() {
        this.scene.input.on('pointerdown', this.onPointerDown, this);
        this.scene.input.on('pointermove', this.onPointerMove, this);
        this.scene.input.on('pointerup', this.onPointerUp, this);
        
        // Thay đổi cursor khi được phép vẽ
        document.body.style.cursor = 'crosshair';
    }

    public disable() {
        this.scene.input.off('pointerdown', this.onPointerDown, this);
        this.scene.input.off('pointermove', this.onPointerMove, this);
        this.scene.input.off('pointerup', this.onPointerUp, this);
        
        // Khôi phục cursor mặc định
        document.body.style.cursor = 'auto';
        
        // Xóa mask và mask graphics
        this.graphics.clearMask();
        if (this.maskGraphics) {
            this.maskGraphics.destroy();
            this.maskGraphics = undefined;
        }
        
        this.clear();
    }

    private onPointerDown(pointer: Phaser.Input.Pointer) {
        // Kiểm tra xem điểm bắt đầu có nằm trong bounds không
        if (this.boardBounds && !Phaser.Geom.Rectangle.Contains(this.boardBounds, pointer.x, pointer.y)) {
            return; // Không cho phép bắt đầu vẽ ngoài board
        }

        this.isDrawing = true;
        this.points = [];
        this.graphics.clear();
        
        // Thêm điểm đầu tiên
        this.addPoint(pointer.x, pointer.y);
        
        // Bắt đầu vẽ path
        this.graphics.lineStyle(this.LINE_WIDTH, this.LINE_COLOR, 1);
        this.graphics.beginPath();
        this.graphics.moveTo(pointer.x, pointer.y);
    }

    private onPointerMove(pointer: Phaser.Input.Pointer) {
        if (!this.isDrawing) return;

        // Vẫn cho phép vẽ tiếp dù con trỏ ra ngoài bounds
        // Nhưng chỉ thêm điểm và vẽ nếu điểm đủ xa (optimization)
        const lastPoint = this.points[this.points.length - 1];
        if (lastPoint && Phaser.Math.Distance.Between(lastPoint.x, lastPoint.y, pointer.x, pointer.y) > this.SIMPLIFY_TOLERANCE) {
            this.addPoint(pointer.x, pointer.y);
            
            // Vẽ tiếp (mask sẽ tự động ẩn những gì ngoài bounds)
            this.graphics.lineTo(pointer.x, pointer.y);
            this.graphics.strokePath();
        }
    }

    private onPointerUp(pointer: Phaser.Input.Pointer) {
        if (!this.isDrawing) return;
        this.isDrawing = false;

        // Đóng path visually
        this.graphics.closePath();
        this.graphics.strokePath();

        // Tạo Polygon từ các điểm đã vẽ
        const polygon = new Phaser.Geom.Polygon(this.points);

        // Gọi callback để Scene xử lý logic tiếp theo
        if (this.onLassoComplete) {
            this.onLassoComplete(polygon);
        }

        // Tự động xóa nét vẽ sau một khoảng thời gian ngắn (tùy chọn UI/UX)
        this.scene.time.delayedCall(500, () => {
            // Hiệu ứng fade out hoặc clear
            this.graphics.clear();
        });
    }

    private addPoint(x: number, y: number) {
        this.points.push(new Phaser.Math.Vector2(x, y));
    }

    /**
     * Tính tổng độ dài của nét vẽ (theo pixel)
     */
    public getPathLengthPx(): number {
        if (this.points.length < 2) return 0;
        
        let length = 0;
        for (let i = 0; i < this.points.length - 1; i++) {
            length += this.points[i].distance(this.points[i + 1]);
        }
        return length;
    }

    public clear() {
        this.graphics.clear();
        this.points = [];
        this.isDrawing = false;
    }
}
