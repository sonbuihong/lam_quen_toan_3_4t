// src/utils/GameUtils.ts
import Phaser from 'phaser';
import { GameConstants } from '../consts/GameConstants';

export class GameUtils {
    /**
     * Lấy chiều rộng màn hình game
     */
    static getW(scene: Phaser.Scene): number {
        return scene.scale.width;
    }

    /**
     * Lấy chiều cao màn hình game
     */
    static getH(scene: Phaser.Scene): number {
        return scene.scale.height;
    }

    /**
     * Lấy tọa độ X theo phần trăm (0.0 -> 1.0)
     * Ví dụ: pctX(this, 0.5) => Giữa màn hình theo chiều ngang
     */
    static pctX(scene: Phaser.Scene, percent: number): number {
        return scene.scale.width * percent;
    }

    /**
     * Lấy tọa độ Y theo phần trăm (0.0 -> 1.0)
     * Ví dụ: pctY(this, 0.1) => Cách mép trên 10%
     */
    static pctY(scene: Phaser.Scene, percent: number): number {
        return scene.scale.height * percent;
    }

    static centerObj(scene: Phaser.Scene, object: Phaser.GameObjects.Image | Phaser.GameObjects.Text) {
        object.setPosition(scene.scale.width / 2, scene.scale.height / 2);
    }

    /**
     * Tính toán trọng tâm (Centroid) của vùng ảnh không trong suốt.
     * Trả về offset (dx, dy) tính từ tâm hình ảnh (Center) đến trọng tâm thực tế.
     * @param scene Context scene để truy cập TextureManager
     * @param textureKey Key của texture cần tính
     * @returns {x: number, y: number} Offset từ tâm
     */
    /**
     * Tính toán điểm gợi ý tốt nhất trên vùng ảnh không trong suốt.
     * 1. Tính trọng tâm (Centroid).
     * 2. Nếu trọng tâm rơi vào vùng trong suốt -> Tìm pixel đặc gần nhất.
     * @param scene Context scene
     * @param textureKey Texture Key
     */
    static calculateCenteredOffset(scene: Phaser.Scene, textureKey: string): { x: number, y: number } {
        const texture = scene.textures.get(textureKey);
        const sourceImage = texture.getSourceImage();

        if (sourceImage instanceof HTMLImageElement || sourceImage instanceof HTMLCanvasElement) {
            const w = sourceImage.width;
            const h = sourceImage.height;

            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            if (!ctx) return { x: 0, y: 0 };

            ctx.drawImage(sourceImage as CanvasImageSource, 0, 0);
            const imgData = ctx.getImageData(0, 0, w, h);
            const data = imgData.data;

            let sumX = 0;
            let sumY = 0;
            let pixelCount = 0;

            // Lưu danh sách các pixel đặc để fallback nếu trọng tâm bị rỗng
            const validPixels: { x: number, y: number }[] = [];

            // Bước nhảy: 4 pixel (tăng tốc độ xử lý)
            const step = 4;
            
            for (let y = 0; y < h; y += step) {
                for (let x = 0; x < w; x += step) {
                    const index = (y * w + x) * 4;
                    const alpha = data[index + 3];
                    
                    if (alpha > 50) { // Ngưỡng alpha an toàn
                        sumX += x;
                        sumY += y;
                        pixelCount++;
                        validPixels.push({ x, y });
                    }
                }
            }

            if (pixelCount === 0 || validPixels.length === 0) return { x: 0, y: 0 };

            // 1. Tính trọng tâm lý thuyết
            let centerX = Math.floor(sumX / pixelCount);
            let centerY = Math.floor(sumY / pixelCount);

            // 2. Kiểm tra xem trọng tâm có nằm trên pixel đặc không
            const centerIndex = (centerY * w + centerX) * 4;
            const centerAlpha = data[centerIndex + 3];

            // Hàm kiểm tra một pixel có phải là "nội bộ" không (được bao quanh bởi pixel đặc)
            // Check 8 hướng (trên, dưới, trái, phải, và 4 góc chéo) để đảm bảo nằm sâu bên trong
            const isSurrounded = (tx: number, ty: number) => {
                const dist = 2; // Khoảng cách check (offset)
                const offsets = [
                    { dx: 0, dy: -dist },     // Trên
                    { dx: 0, dy: dist },      // Dưới
                    { dx: -dist, dy: 0 },     // Trái
                    { dx: dist, dy: 0 },      // Phải
                    { dx: -dist, dy: -dist }, // Trái-Trên
                    { dx: dist, dy: -dist },  // Phải-Trên
                    { dx: -dist, dy: dist },  // Trái-Dưới
                    { dx: dist, dy: dist }    // Phải-Dưới
                ];
                
                for (const o of offsets) {
                    const nx = tx + o.dx;
                    const ny = ty + o.dy;
                    if (nx < 0 || nx >= w || ny < 0 || ny >= h) return false;
                    const nIdx = (ny * w + nx) * 4;
                    // Kiểm tra alpha (phải là pixel đặc)
                    if (data[nIdx + 3] <= 50) return false;
                }
                return true;
            };

            // Nếu trọng tâm là pixel trong suốt (hoặc mờ)
            if (!centerAlpha || centerAlpha <= 50) {
                let minDist = Infinity;
                let bestP = validPixels[0];
                let foundSurrounded = false;

                // Ưu tiên tìm pixel được bao quanh (inner pixel)
                for (const p of validPixels) {
                    const dist = (p.x - centerX) ** 2 + (p.y - centerY) ** 2;
                    const surrounded = isSurrounded(p.x, p.y);

                    // Logic chọn:
                    // 1. Nếu chưa tìm thấy điểm surrounded nào -> Chấp nhận mọi điểm, tìm min dist.
                    // 2. Nếu đã tìm thấy ít nhất 1 điểm surrounded -> Chỉ quan tâm điểm surrounded, tìm min dist.
                    // 3. Nếu điểm hiện tại surrounded mà trước đó chưa có -> Reset min dist, chọn điểm này.
                    
                    if (surrounded) {
                        if (!foundSurrounded) {
                            // Tìm thấy điểm surrounded đầu tiên -> Reset để ưu tiên nhóm này
                            foundSurrounded = true;
                            minDist = dist;
                            bestP = p;
                        } else if (dist < minDist) {
                            minDist = dist;
                            bestP = p;
                        }
                    } else if (!foundSurrounded) {
                        // Nếu chưa tìm thấy surrounded nào, cứ tìm min dist bình thường
                        if (dist < minDist) {
                            minDist = dist;
                            bestP = p;
                        }
                    }
                }
                centerX = bestP.x;
                centerY = bestP.y;
            }

            // Tính offset so với tâm ảnh (0.5, 0.5)
            const offsetX = centerX - (w / 2);
            const offsetY = centerY - (h / 2);

            return { x: offsetX, y: offsetY };
        }

        return { x: 0, y: 0 };
    }
    /**
     * Tự động chuyển màn dựa vào cấu hình FLOW trong GameConstants.
     * @param scene Scene hiện tại
     * @param sessionId Session ID hiện tại
     * @param quota Quota còn lại
     * @param onFinish Callback khi đến màn cuối (thường gọi finishEvaluation)
     */
    static handleSceneTransition(
        scene: Phaser.Scene, 
        sessionId: string | null, 
        quota: number, 
        onFinish: () => void
    ) {
        // Sử dụng trực tiếp import
        
        const flow = GameConstants.FLOW;
        const currentKey = scene.scene.key;
        const currentIndex = (flow as readonly string[]).indexOf(currentKey);

        if (currentIndex === -1) {
            console.error(`[Flow] Scene ${currentKey} not found in FLOW config!`);
            return;
        }

        const nextIndex = currentIndex + 1;
        if (nextIndex < flow.length) {
            const nextSceneKey = flow[nextIndex];
            console.log(`[Flow] Transitioning: ${currentKey} -> ${nextSceneKey}`);
            
            scene.time.delayedCall(GameConstants.TRANSITION_DELAY, () => {
                // Tắt popup UI nếu có
                const uiScene = scene.scene.get('UIScene') as any;
                if (uiScene?.hideScorePopup) uiScene.hideScorePopup();
                
                // Stop UI Scene để Scene tiếp theo init lại UI với Title mới
                scene.scene.stop('UIScene');

                scene.scene.start(nextSceneKey, {
                    sessionId: sessionId,
                    quota: quota
                });
            });
        } else {
            // Màn cuối
            console.log(`[Flow] Reached End of Flow (${currentKey}). Finishing...`);
            scene.time.delayedCall(GameConstants.TRANSITION_DELAY, () => {
                const uiScene = scene.scene.get('UIScene') as any;
                if (uiScene?.hideScorePopup) uiScene.hideScorePopup();
                onFinish();
            });
        }
    }


    /**
     * Tạo hiệu ứng vòng tròn tỏa ra (Ripple) xung quanh một đối tượng.
     * @param scene Context scene
     * @param target Đối tượng trung tâm (ví dụ: nút Mic)
     * @param circleArray Mảng lưu trữ các vòng tròn để cleanup sau này
     */
    static startRadiatingEffect(scene: Phaser.Scene, target: Phaser.GameObjects.Image | Phaser.GameObjects.Sprite, circleArray: Phaser.GameObjects.Arc[]) {
        GameUtils.stopRadiatingEffect(scene, circleArray);

        const x = target.x;
        const y = target.y;
        // Base radius derived from target width
        const baseRadius = (target.displayWidth || 100) / 2;
        
        // Ensure target is above circles
        target.setDepth(10); 

        for (let i = 0; i < 3; i++) {
            const circle = scene.add.circle(x, y, baseRadius, 0x000, 0.5);
            circle.setDepth(target.depth - 1);
            circle.setVisible(false);
            circleArray.push(circle);

            scene.tweens.add({
                targets: circle,
                scale: { from: 1, to: 3 },
                alpha: { from: 0.5, to: 0 },
                duration: 1500,
                repeat: -1,
                delay: i * 500,
                onStart: () => {
                     circle.setVisible(true);
                     circle.setScale(1);
                     circle.setAlpha(0.5);
                },
                onRepeat: () => {
                     circle.setScale(1);
                     circle.setAlpha(0.5);
                }
            });
        }
    }

    /**
     * Dừng và xóa hiệu ứng vòng tròn tỏa ra.
     * @param scene Context scene
     * @param circleArray Mảng chứa các vòng tròn cần xóa
     */
    static stopRadiatingEffect(scene: Phaser.Scene, circleArray: Phaser.GameObjects.Arc[]) {
        if (!circleArray || circleArray.length === 0) return;

        circleArray.forEach(circle => {
            scene.tweens.killTweensOf(circle);
            circle.destroy();
        });
        // Clear array content in place
        circleArray.length = 0;
    }
}