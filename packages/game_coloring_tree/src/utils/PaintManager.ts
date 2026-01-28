import Phaser from 'phaser';
import { GameConstants } from '../consts/GameConstants';
import AudioManager from '../audio/AudioManager';
import { game } from "@iruka-edu/mini-game-sdk";

export class PaintManager {
    private scene: Phaser.Scene;
    
    // Config
    private brushColor: number = GameConstants.PAINT.DEFAULT_COLOR;
    private brushSize: number = GameConstants.PAINT.BRUSH_SIZE;
    private brushTexture: string = 'brush_circle';
    
    // State
    private isErasing: boolean = false;
    private activeRenderTexture: Phaser.GameObjects.RenderTexture | null = null;
    private activeHitArea: Phaser.GameObjects.Image | null = null;

    // ✅ FIX LAG: Biến lưu vị trí cũ để vẽ LERP
    private lastX: number = 0;
    private lastY: number = 0;

    // Config camera filter
    private ignoreCameraId: number = 0;

    // ✅ LOGIC MÀU: Map lưu danh sách màu đã dùng cho từng phần (Key: ID, Value: Set màu)
    private partColors: Map<string, Set<number>> = new Map();

    // ✅ OPTIMIZATION: Track unchecked painting distance per part
    private partUncheckedMetrics: Map<string, number> = new Map();
    // ✅ OPTIMIZATION: Cache mask data to avoid redundant draw calls and readback
    private maskCache: Map<string, Uint8ClampedArray> = new Map();
    
    private readonly CHECK_THRESHOLD: number = 300; // Check progress every ~300px of painting

    // ✅ TỐI ƯU RAM: Tạo sẵn Canvas tạm để tái sử dụng, không new mới liên tục
    private helperCanvasPaint: HTMLCanvasElement;
    private helperCanvasMask: HTMLCanvasElement;

    // Callback trả về cả Set màu thay vì 1 màu lẻ
    private onPartComplete: (id: string, rt: Phaser.GameObjects.RenderTexture, usedColors: Set<number>) => void;

    constructor(scene: Phaser.Scene, onComplete: (id: string, rt: Phaser.GameObjects.RenderTexture, usedColors: Set<number>) => void) {
        this.scene = scene;
        this.onPartComplete = onComplete;
        this.scene.input.topOnly = false;
        
        // Khởi tạo Canvas tạm 1 lần duy nhất
        this.helperCanvasPaint = document.createElement('canvas');
        this.helperCanvasMask = document.createElement('canvas');
        
        this.createBrushTexture();
    }

    private createBrushTexture() {
        if (!this.scene.textures.exists(this.brushTexture)) {
            const canvas = this.scene.textures.createCanvas(this.brushTexture, this.brushSize, this.brushSize);
            if (canvas) {
                const ctx = canvas.context;
                const grd = ctx.createRadialGradient(this.brushSize/2, this.brushSize/2, 0, this.brushSize/2, this.brushSize/2, this.brushSize/2);
                grd.addColorStop(0, 'rgba(255, 255, 255, 1)');
                grd.addColorStop(1, 'rgba(255, 255, 255, 0)');
                ctx.fillStyle = grd;
                ctx.fillRect(0, 0, this.brushSize, this.brushSize);
                canvas.refresh();
            }
        }
    }

    public setColor(color: number) {
        this.isErasing = false;
        this.brushColor = color;
    }

    public setEraser() {
        this.isErasing = true;
    }

    public setIgnoreCameraId(id: number) {
        this.ignoreCameraId = id;
    }

    public isPainting(): boolean {
        return this.activeRenderTexture !== null;
    }

    public createPaintableLayer(x: number, y: number, key: string, scale: number, uniqueId: string): Phaser.GameObjects.Image {
        const maskImage = this.scene.make.image({ x, y, key, add: false }).setScale(scale);
        const mask = maskImage.createBitmapMask();

        const rtW = maskImage.width * scale;
        const rtH = maskImage.height * scale;
        const rt = this.scene.add.renderTexture(x - rtW/2, y - rtH/2, rtW, rtH);
        
        // @NOTE: clear dữ liệu của GPU để không bị issue tô dữ liệu sai vào vùng nội dung
        rt.clear().setAlpha(0);
        
        // ✅ TỐI ƯU: Không set mask ngay lập tức để giảm tải render
        // rt.setMask(mask); 
        rt.setOrigin(0, 0).setDepth(10);
        
        rt.setData('id', uniqueId);
        rt.setData('key', key); 
        rt.setData('isFinished', false);
        rt.setData('mask', mask); // Lưu mask vào data để dùng sau
        
        if (this.ignoreCameraId) rt.cameraFilter = this.ignoreCameraId;
        
        // ✅ LOGIC MÀU: Tạo hitArea với opacity thấp để dễ nhìn
        const hitArea = this.scene.add.image(x, y, key).setScale(scale).setAlpha(0.01).setDepth(50);
        hitArea.setInteractive({ useHandCursor: true, pixelPerfect: true });
        if (this.ignoreCameraId) hitArea.cameraFilter = this.ignoreCameraId;

        // ✅ NEW: Link layer and ID to hitArea for switching logic
        hitArea.setData('layer', rt);
        hitArea.setData('id', uniqueId);

        hitArea.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
            // ✅ CHECK FINISHED: Không cho phép tô lại nếu đã hoàn thành
            const currentLayer = hitArea.getData('layer');
            if (currentLayer && currentLayer.getData('isFinished')) {
                return;
            }

            // 🔥 CƠ CHẾ CHUYỂN ĐỔI THÔNG MINH (SWITCHING) 🔥
            if (this.activeHitArea !== hitArea) {
                if (this.activeHitArea) {
                    this.freezePart(this.activeHitArea);
                }
                this.unfreezePart(hitArea);
                this.activeHitArea = hitArea;
            }

            // Retrieve the CURRENT active layer (it might be a new RT after unfreeze)
            const activeLayer = hitArea.getData('layer');
            if (!(activeLayer instanceof Phaser.GameObjects.RenderTexture)) return;

            // ✅ TỐI ƯU: Khi chạm vào mới bật mask lên
            if (!activeLayer.mask) {
                const storedMask = activeLayer.getData('mask');
                if (storedMask) activeLayer.setMask(storedMask);
            }

            this.activeRenderTexture = activeLayer;
            
            // ✅ QUAN TRỌNG: Lưu vị trí bắt đầu để tính toán LERP
            this.lastX = pointer.x - activeLayer.x;
            this.lastY = pointer.y - activeLayer.y;

            this.paint(pointer, activeLayer);
        });

        return hitArea;
    }

    public handlePointerMove(pointer: Phaser.Input.Pointer) {
        if (pointer.isDown && this.activeRenderTexture) {
            this.paint(pointer, this.activeRenderTexture);
        }
    }

    public handlePointerUp() {
        if (this.isErasing) {
            this.activeRenderTexture = null;
            return;
        }
        if (this.activeRenderTexture) {
            // ✅ TỐI ƯU: Chỉ check progress nếu đã vẽ đủ nhiều (Throttle)
            const id = this.activeRenderTexture.getData('id');
            const dist = this.partUncheckedMetrics.get(id) || 0;
            
            if (dist > this.CHECK_THRESHOLD) {
                this.checkProgress(this.activeRenderTexture);
                this.partUncheckedMetrics.set(id, 0); // Reset distance
            }
            
            this.activeRenderTexture = null;
        }
    }

    private freezePart(hitArea: Phaser.GameObjects.Image) {
        const currentLayer = hitArea.getData('layer');
        if (currentLayer instanceof Phaser.GameObjects.RenderTexture) {
            const uniqueId = hitArea.getData('id');
            const key = `painted_tex_${uniqueId}`;
            
            // Save current RT content to Texture Manager
            if (this.scene.textures.exists(key)) {
                this.scene.textures.remove(key);
            }
            currentLayer.saveTexture(key);
            
            // Create static Image replacement
            const img = this.scene.add.image(currentLayer.x, currentLayer.y, key);
            img.setOrigin(0, 0).setDepth(10);
            
            // Transfer Mask
            const storedMask = currentLayer.getData('mask');
            if (storedMask) img.setMask(storedMask);
            if (this.ignoreCameraId) img.cameraFilter = this.ignoreCameraId;
            
            // Transfer Data
            img.setData('id', uniqueId);
            img.setData('key', currentLayer.getData('key'));
            img.setData('isFinished', currentLayer.getData('isFinished'));
            img.setData('mask', storedMask);
            
            // Update link
            hitArea.setData('layer', img);
            
            // Destroy heavy RT
            currentLayer.destroy();
        }
    }

    private unfreezePart(hitArea: Phaser.GameObjects.Image) {
        const currentLayer = hitArea.getData('layer');
        
        // If it's a static Image, convert back to RT
        if (currentLayer instanceof Phaser.GameObjects.Image) {
            const width = currentLayer.width;
            const height = currentLayer.height;
            const x = currentLayer.x;
            const y = currentLayer.y;
            
            const rt = this.scene.add.renderTexture(x, y, width, height);
            rt.setOrigin(0, 0).setDepth(10);
            
            // Clear mask
            currentLayer.clearMask();

            // Draw the frozen texture onto the new RT
            rt.draw(currentLayer, 0, 0);
            
            // Restore context
            const storedMask = currentLayer.getData('mask');
            if (storedMask) rt.setMask(storedMask);
            if (this.ignoreCameraId) rt.cameraFilter = this.ignoreCameraId;
            
            // Restore Data
            rt.setData('id', currentLayer.getData('id'));
            rt.setData('key', currentLayer.getData('key'));
            rt.setData('isFinished', currentLayer.getData('isFinished'));
            rt.setData('mask', storedMask);
            
            // Update link
            hitArea.setData('layer', rt);
            
            // Cleanup static Image
            currentLayer.destroy();
        }
    }

    // ✅ HÀM PAINT MỚI: DÙNG LERP ĐỂ VẼ MƯỢT
    private paint(pointer: Phaser.Input.Pointer, rt: Phaser.GameObjects.RenderTexture) {
        // --- VALIDATION: LOẠI BỎ HARD BLOCK ---
        // Cho phép tô sai màu, nhưng sẽ kiểm tra lại ở checkProgress
        
        // 1. Lấy toạ độ hiện tại (Local)
        const currentX = pointer.x - rt.x;
        const currentY = pointer.y - rt.y;

        // 2. Tính khoảng cách
        const distance = Phaser.Math.Distance.Between(this.lastX, this.lastY, currentX, currentY);

        // Tối ưu: Nếu di chuyển quá ít (< 5px) thì bỏ qua
        if (distance < 10) return;

        // ✅ Accumulate distance for throttling checks
        const id = rt.getData('id');
        const currentDist = this.partUncheckedMetrics.get(id) || 0;
        this.partUncheckedMetrics.set(id, currentDist + distance);

        // 3. Thuật toán LERP (Nội suy)
        const stepSize = this.brushSize * 0.65;
        let steps = Math.ceil(distance / stepSize);
        if (steps > 50) steps = 50;
        const offset = this.brushSize / 2;

        for (let i = 0; i < steps; i++) {
            const t = i / steps;
            const interpX = this.lastX + (currentX - this.lastX) * t;
            const interpY = this.lastY + (currentY - this.lastY) * t;

            if (this.isErasing) {
                rt.erase(this.brushTexture, interpX - offset, interpY - offset);
            } else {
                rt.draw(this.brushTexture, interpX - offset, interpY - offset, 1.0, this.brushColor);
            }
        }

        // Vẽ chốt hạ tại điểm cuối
        if (this.isErasing) {
            rt.erase(this.brushTexture, currentX - offset, currentY - offset);
        } else {
            rt.draw(this.brushTexture, currentX - offset, currentY - offset, 1.0, this.brushColor);
            
            // ✅ MOVED OUTSIDE OF LOOP: color tracking only triggers ONCE per paint action
            // Optimization: checking set has/add is fast, but doing it inside loop is wasteful.
            // Since activeRenderTexture is set, we do it here (once per pointermove event).
            if (!this.partColors.has(id)) {
                this.partColors.set(id, new Set());
            }
            this.partColors.get(id)?.add(this.brushColor);
        }

        // 4. Cập nhật vị trí cũ
        this.lastX = currentX;
        this.lastY = currentY;
    }

    // ✅ HÀM CHECK PROGRESS MỚI: TỐI ƯU BỘ NHỚ
    private checkProgress(rt: Phaser.GameObjects.RenderTexture) {
        if (rt.getData('isFinished')) return;
        
        const id = rt.getData('id');
        const key = rt.getData('key');

        // Lấy màu đúng nếu có (Validation)
        const correctColor = this.activeHitArea?.getData('correctColor');
        
        rt.snapshot((snapshot) => {
            if (!(snapshot instanceof HTMLImageElement)) return;
            
            const w = snapshot.width;
            const h = snapshot.height;
            const checkW = Math.floor(w / 4);
            const checkH = Math.floor(h / 4);

            // ✅ TÁI SỬ DỤNG CANVAS (Không tạo mới)
            const ctxPaint = this.getRecycledContext(this.helperCanvasPaint, snapshot, checkW, checkH);

            if (!ctxPaint) return;
            const paintData = ctxPaint.getImageData(0, 0, checkW, checkH).data;
            
            // ✅ TỐI ƯU HIỆU NĂNG: Lấy Mask Data từ Cache (nếu có) hoặc tính mới 1 lần
            let maskData = this.maskCache.get(id);

            if (!maskData) {
                 const sourceImg = this.scene.textures.get(key).getSourceImage() as HTMLImageElement;
                 const ctxMask = this.getRecycledContext(this.helperCanvasMask, sourceImg, checkW, checkH);
                 
                 if (!ctxMask) return;
                 
                 // Lưu vào cache dạng TypedArray
                 maskData = ctxMask.getImageData(0, 0, checkW, checkH).data;
                 this.maskCache.set(id, maskData);
            }

            let painted = 0; // Tổng số pixel đã tô (bất kể màu)
            let wrongCount = 0; // Số pixel bị tô sai màu
            let total = 0; // Tổng số pixel của Mask

            // Chuyển đối màu target sang RGB để so sánh (nếu có yêu cầu)
            let tr = 0, tg = 0, tb = 0;
            if (correctColor !== undefined) {
                 const c = Phaser.Display.Color.IntegerToColor(correctColor);
                 tr = c.red;
                 tg = c.green;
                 tb = c.blue;
            }

            // Thuật toán đếm Pixel: Check Coverage & Color Accuracy
            for (let i = 3; i < paintData.length; i += 4) {
                if (maskData[i] > 0) { // Nếu pixel thuộc vùng mask
                    total++;
                    const alpha = paintData[i];

                    if (alpha > 20) { // Nếu đã được tô (chấp nhận cả viền mờ để tính coverage)
                        painted++;
                        
                        // Check màu sai nếu có cấu hình correctColor
                        // CHỈ CHECK TRÊN PIXEL ĐẬM (Alpha > 220) để tránh lỗi do bias màu biên (Anti-aliasing artifacts)
                        if (correctColor !== undefined && alpha > 220) {
                            const r = paintData[i - 3];
                            const g = paintData[i - 2];
                            const b = paintData[i - 1];

                            // Tính sai số màu (Manhattan distance)
                            const diff = Math.abs(r - tr) + Math.abs(g - tg) + Math.abs(b - tb);
                            
                            // Nếu sai số quá lớn -> Coi là màu sai
                            if (diff > 80) {
                                wrongCount++;
                            }
                        }
                    }
                }
            }

            // Tính toán tỷ lệ
            const totalPixels = total > 0 ? total : 1;
            const paintedPercentage = painted / totalPixels;
            const wrongPercentage = wrongCount / totalPixels;

            // 1. Check điều kiện thua (Tô sai > 5%)
            if (wrongPercentage > 0.00000001) {
                console.log(`Wrong color detected! Wrong: ${(wrongPercentage*100).toFixed(1)}%`);
                AudioManager.play('sfx-wrong');
                game.recordWrong();

                rt.clear();
                
                // Reset metrics
                this.partUncheckedMetrics.set(id, 0);
                this.partColors.delete(id); // Reset used colors

                // Hiệu ứng Visual báo sai (Lắc nhẹ)
                this.scene.tweens.add({
                    targets: rt,
                    x: '+=5',
                    duration: 50,
                    yoyo: true,
                    repeat: 3
                });
                return;
            }

            // 2. Check điều kiện thắng (Tô > 90%)
            // Nếu đã qua được cửa ải 5% sai ở trên -> Vùng tô hiện tại là chấp nhận được
            if (paintedPercentage > GameConstants.PAINT.WIN_PERCENT) {
                // Check lại bằng Set màu cho chắc chắn (Double check logic user request)
                const usedColors = this.partColors.get(id);
                // Nếu Set chứa màu đúng (và ko bị fail ở trên) -> OK
                // Hoặc simply trust the pixel check
                
                rt.setData('isFinished', true);

                // ✅ GỬI DANH SÁCH MÀU VỀ SCENE
                this.onPartComplete(id, rt, usedColors || new Set());
                
                // Clear bộ nhớ màu của phần này cho nhẹ
                this.partColors.delete(id);
                this.partUncheckedMetrics.delete(id);
            }
        });
    }

    // Hàm helper để tái sử dụng Context
    private getRecycledContext(canvas: HTMLCanvasElement, img: HTMLImageElement, w: number, h: number) {
        canvas.width = w; // Set lại width tự động clear nội dung cũ
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.clearRect(0, 0, w, h); // Clear chắc chắn lần nữa
            ctx.drawImage(img, 0, 0, w, h);
        }
        return ctx;
    }
}