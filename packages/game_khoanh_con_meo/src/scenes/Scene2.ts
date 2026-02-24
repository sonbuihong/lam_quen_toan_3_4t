import Phaser from 'phaser';
import { SceneKeys, AudioKeys, DataKeys } from '../consts/Keys';
import { GameConstants } from '../consts/GameConstants';
import { GameUtils } from '../utils/GameUtils';
import AudioManager from '../audio/AudioManager';
import { showGameButtons } from '../main';
import { game } from '@iruka-edu/mini-game-sdk';
import { sdk } from '../main';
import Scene1 from './Scene1';
import UIScene from './UIScene';
import { IdleManager } from '../utils/IdleManager';
import { setGameSceneReference, resetVoiceState, playVoiceLocked } from '../utils/rotateOrientation';

// ===============================================================
// Kiểu dữ liệu nhận từ Scene1
// Scene1 truyền sang thông tin về ellipse đã khoanh đúng
// ===============================================================
interface Scene1Data {
    ellipse: {
        centerX: number;
        centerY: number;
        radiusX: number;
        radiusY: number;
    };
    // Index màn hiện tại (0 = màn 1, 1 = màn 2, ...)
    levelIndex?: number;
}


export default class Scene2 extends Phaser.Scene {
    private bgm!: Phaser.Sound.BaseSound;

    // Dữ liệu ellipse nhận từ Scene1
    private ellipseData!: Scene1Data['ellipse'];

    // Đồ họa đường kéo (line) từ ellipse đến con trỏ
    private dragLine!: Phaser.GameObjects.Graphics;

    // Vị trí tâm ellipse (điểm bắt đầu kéo)
    private ellipseCenterX: number = 0;
    private ellipseCenterY: number = 0;

    // Điểm cố định trên viền ellipse dùng làm điểm bắt đầu đường nối
    // = đáy ellipse: (centerX, centerY + radiusY) - gần nhất với vùng đáp án phía dưới
    private ellipseAnchorX: number = 0;
    private ellipseAnchorY: number = 0;

    // Trạng thái kéo
    private isDragging: boolean = false;

    // Danh sách ảnh đáp án được spawn ra
    private answerImages: Phaser.GameObjects.Image[] = [];

    // Key của đáp án đúng - lấy từ config (correctAnswer)
    private correctAnswerKey: string = 'ans2';

    // Index màn hiện tại - nhận từ Scene1
    private currentLevelIndex: number = 0;

    // Tổng số màn chơi (lấy từ config.levels.length)
    private totalLevels: number = 1;

    // Tutorial và hint
    private uiScene!: UIScene;
    private idleManager!: IdleManager;
    private isIntroActive: boolean = false;
    private activeHintTween: Phaser.Tweens.Tween | null = null;
    private activeHandTween: Phaser.Tweens.Tween | null = null;
    private activeHintTarget: Phaser.GameObjects.Image | null = null;

    constructor() {
        super(SceneKeys.Scene2);
    }

    /**
     * init() được gọi trước create(), nhận data từ scene.start(Scene2, { data })
     * Scene1 sẽ truyền thông tin ellipse đã khoanh.
     */
    init(data: Scene1Data) {
        // Nhận levelIndex từ Scene1
        this.currentLevelIndex = data?.levelIndex ?? 0;
        this.isDragging = false;
        this.isIntroActive = true;
        this.answerImages = [];
        console.log(`[Scene2] init - levelIndex = ${this.currentLevelIndex}`);

        // Nhận dữ liệu ellipse từ Scene1
        if (data && data.ellipse) {
            this.ellipseData = data.ellipse;
        } else {
            // Fallback: ellipse ở giữa trên màn hình
            this.ellipseData = {
                centerX: GameUtils.pctX(this, 0.5),
                centerY: GameUtils.pctY(this, 0.38),
                radiusX: 120,
                radiusY: 80,
            };
        }
    }

    create() {
        showGameButtons();
        
        // Phaser KHÔNG tự gọi method shutdown() - phải đăng ký thủ công
        this.events.once('shutdown', this.shutdown, this);

        this.loadConfigAndSetup();
        this.createEllipseDisplay();
        this.createDragLine();
        this.setupDragInput();

        // Scene2 được launch đè lên Scene1 đang pause.
        // Cần bringToTop để Scene2 render sau Scene1 (ở trên).
        this.scene.bringToTop(SceneKeys.Scene2);

        // Khởi tạo UIScene
        const uiSceneTemp = this.scene.get(SceneKeys.UI) as UIScene;
        if (uiSceneTemp.scene.isActive()) {
            uiSceneTemp.updateLevel(this.currentLevelIndex);
            this.scene.bringToTop(SceneKeys.UI);
        } else {
            this.scene.launch(SceneKeys.UI, { sceneKey: SceneKeys.Scene2, levelIndex: this.currentLevelIndex });
            this.scene.bringToTop(SceneKeys.UI);
        }
        this.uiScene = this.scene.get(SceneKeys.UI) as UIScene;

        // Khởi tạo IdleManager
        this.idleManager = new IdleManager(GameConstants.IDLE.THRESHOLD, () => {
            if (!this.isDragging && !this.isIntroActive) {
                this.showHint();
            }
        });

        this.playIntroSequence();
    }

    shutdown() {
        this.events.off('shutdown', this.shutdown, this);
        // this.bgm không được set ở Scene2 (BGM do Scene1 quản lý) → if guard là đủ
        if (this.bgm) this.bgm.stop();
        this.tweens.killAll();
        this.input.off('pointermove');
        this.input.off('pointerup');
        // Không gọi AudioManager.stopAll() ở đây để tránh dừng BGM của Scene1
        // khi Scene2 kết thúc mà còn chuyển sang Scene1 màn mới.
        // AudioManager.stopAll() sẽ được gọi bởi Scene1.shutdown() khi thích hợp.
    }

    update(time: number, delta: number) {
        if (this.idleManager) {
            this.idleManager.update(delta);
        }
    }

    // ==================================================================
    // PHẦN 1: CÀI ĐẶT NỀN & ÂM THANH
    // ==================================================================

    private playIntroSequence() {
        this.isIntroActive = true;
        
        let playIntro = this.currentLevelIndex === 0 ? "voice_intro2" : "voice_intro2";
        AudioManager.play(playIntro);

        // Đợi 1 chút rồi chạy animation tay hướng dẫn
        this.time.delayedCall(200, () => {
            if (this.isIntroActive) {
                this.runHandTutorial();
            }
        });
    }

    // ==================================================================
    // PHẦN 2: TẠO LEVEL
    // ==================================================================

    private loadConfigAndSetup() {
        const fullConfig = this.cache.json.get(DataKeys.LevelS1Config);

        // Hỗ trợ cấu trúc levels[] mới và flat object cũ
        const rawLevelConfig = fullConfig.levels
            ? fullConfig.levels[this.currentLevelIndex]
            : fullConfig;

        this.totalLevels = fullConfig.levels ? fullConfig.levels.length : 1;

        if (!rawLevelConfig) {
            console.error(`[Scene2] Không tìm thấy config cho levelIndex=${this.currentLevelIndex}`);
            return;
        }

        // Merge answers từ top-level nếu level không có answers riêng
        const levelConfig = {
            ...rawLevelConfig,
            answers: rawLevelConfig.answers ?? fullConfig.answers ?? [],
        };

        // Lấy key đáp án đúng của màn này
        this.correctAnswerKey = levelConfig.correctAnswer ?? 'ans2';

        // Lấy trực tiếp ảnh đáp án từ Scene1 đang pause - không spawn mới.
        // Scene1 pause() vẫn render chúng nên chịnh là tham chiếu đến objects đó.
        const scene1 = this.scene.get(SceneKeys.Scene1) as Scene1;
        this.answerImages = scene1?.getAnswerObjects() ?? [];

        // Chỉ thêm decoration (Graphics) lên trên ảnh của Scene1, không tạo Image mới
        this.answerImages.forEach(img => {
            this.addAnswerDecoration(img, img.getData('textureKey') === this.correctAnswerKey);
        });

        console.log(`[Scene2] Màn ${this.currentLevelIndex + 1}/${this.totalLevels} - correctAnswerKey = ${this.correctAnswerKey}`);
        console.log(`[Scene2] Số đáp án từ Scene1: ${this.answerImages.length}`);
    }

    /**
     * Vẽ khung trang trí xung quanh ô đáp án (nét đứt mờ để gợi ý vùng thả).
     * Không phân biệt đúng/sai ở đây để game không lộ đáp án.
     */
    private addAnswerDecoration(img: Phaser.GameObjects.Image, _isCorrect: boolean) {
        const gfx = this.add.graphics();
        gfx.setDepth(9);
        const w = img.displayWidth + 16;
        const h = img.displayHeight + 16;
        // Khung trắng mờ làm placeholder
        gfx.lineStyle(3, 0xffffff, 0.3);
        gfx.strokeRect(img.x - w / 2, img.y - h / 2, w, h);
    }

    // ==================================================================
    // PHẦN 3: VẼ ELLIPSE ĐÃ KHOANH TỪ SCENE1
    // ==================================================================

    private createEllipseDisplay() {
        const { centerX, centerY, radiusX, radiusY } = this.ellipseData;

        this.ellipseCenterX = centerX;
        this.ellipseCenterY = centerY;

        // Điểm cố định trên VIỀN ellipse (= đáy của ellipse)
        // strokeEllipse dùng width=radiusX*1.8 nên bán kính thực = radiusX*0.9
        // Đáy ellipse = trung tâm dọi, phía dưới: (cx, cy + radiusY*0.9)
        this.ellipseAnchorX = centerX;
        this.ellipseAnchorY = centerY + radiusY * 1;

        // Vẽ lại ellipse xanh (giống Scene1) để người chơi thấy điểm bắt đầu kéo
        const gfx = this.add.graphics();
        gfx.setDepth(50);
        gfx.lineStyle(10, 0x00ff00, 1);
        gfx.strokeEllipse(centerX, centerY, radiusX * 2, radiusY * 2);

        // Thêm hiệu ứng nhấp nháy nhẹ để gợi ý người dùng kéo từ đây
        this.tweens.add({
            targets: gfx,
            alpha: { from: 1, to: 0.4 },
            duration: 700,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
        });

        // Vùng tương tác (hit zone) tại ellipse để bắt đầu kéo
        // Dùng một vòng tròn hit zone vô hình đặt tại tâm ellipse
        // Vùng tương tác: ellipse được strokeEllipse với width=radiusX*1.8, height=radiusY*1.8
        // => bán kính thực theo trục X = radiusX*0.9, trục Y = radiusY*0.9
        // Ta dùng bán kính lớn nhất + padding để dễ touch
        const hitZoneRadius = Math.max(radiusX, radiusY) * 0.9 + 30;
        // Arc shape được Phaser tự động dùng hình tròn làm hitArea khi .setInteractive() không tham số
        const hitZone = this.add.circle(centerX, centerY, hitZoneRadius, 0xffffff, 0)
            .setDepth(60)
            .setInteractive({ useHandCursor: true });

        // Lắng nghe pointerdown trên vùng ellipse để bắt đầu kéo
        hitZone.on('pointerdown', (_pointer: Phaser.Input.Pointer) => {
            this.startDrag();
        });
    }

    // ==================================================================
    // PHẦN 4: LOGIC DRAG (KÉO NỐI)
    // ==================================================================

    private createDragLine() {
        this.dragLine = this.add.graphics();
        this.dragLine.setDepth(200);
        this.dragLine.setAlpha(0); // Ẩn cho đến khi kéo
    }

    private startDrag() {
        if (this.isDragging) return;
        this.stopActiveHint();
        this.idleManager.reset();
        this.isDragging = true;
        this.dragLine.setAlpha(1);
        console.log('[Scene2] Bắt đầu kéo từ ellipse.');
    }

    private setupDragInput() {
        // Cập nhật đường kéo khi di chuyển con trỏ
        this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
            if (!this.isDragging) return;
            this.idleManager.reset();
            this.drawDragLine(pointer.x, pointer.y);
        });

        // Khi nhả tay - kiểm tra xem rơi vào ảnh nào
        this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
            if (!this.isDragging) return;
            this.isDragging = false;
            this.dragLine.clear();
            this.dragLine.setAlpha(0);

            this.evaluateDrop(pointer.x, pointer.y);
            this.idleManager.start();
        });
    }

    /**
     * Tính điểm trên VIỀN hình tròn của ảnh đáp án theo hướng từ (fromX, fromY).
     * Do ảnh đáp án (vòng gạch ngang đỏ) hình tròn, nối hình tròn sẽ đẹp và sát viền hơn chữ nhật.
     */
    private getCircleEdgePoint(
        img: Phaser.GameObjects.Image,
        fromX: number, fromY: number
    ): { x: number; y: number } {
        const cx = img.x;
        const cy = img.y;

        // Bán kính phần hiển thị của ảnh (thường là min(width, height) / 2)
        // Cộng/trừ pad nếu muốn lùi ra hoặc thụt vào (0 là chạm chính xác viền ảnh)
        const radius = Math.min(img.displayWidth, img.displayHeight) / 2;

        // Góc từ tâm ảnh hướng về (fromX, fromY)
        const angle = Math.atan2(fromY - cy, fromX - cx);

        return {
            x: cx + radius * Math.cos(angle),
            y: cy + radius * Math.sin(angle),
        };
    }

    /**
     * Vẽ đường nối từ VIỀN ellipse đến vị trí con trỏ hiện tại.
     */
    private drawDragLine(toX: number, toY: number) {
        this.dragLine.clear();

        // Tính điểm xuất phát CỐ ĐỊNH trên vIỀN ellipse (ở phía đáy)
        const startX = this.ellipseAnchorX;
        const startY = this.ellipseAnchorY;

        // Vẽ đường chính (màu xanh lá)
        this.dragLine.lineStyle(6, 0x00dd44, 0.9);
        this.dragLine.beginPath();
        this.dragLine.moveTo(startX, startY);
        this.dragLine.lineTo(toX, toY);
        this.dragLine.strokePath();

        // Vẽ đường viền ngoài mỏng hơn (màu vàng, làm nổi bật)
        this.dragLine.lineStyle(2, 0xffff00, 0.5);
        this.dragLine.beginPath();
        this.dragLine.moveTo(startX, startY);
        this.dragLine.lineTo(toX, toY);
        this.dragLine.strokePath();

        // Vẽ chấm tròn tại điểm cuối (đầu mũi tên giả)
        this.dragLine.fillStyle(0x00dd44, 1);
        this.dragLine.fillCircle(toX, toY, 10);
    }

    /**
     * Kiểm tra khi người dùng thả tay:
     * - Nếu rơi vào ảnh đáp án đúng -> WIN
     * - Nếu rơi vào ảnh đáp án khác -> SAI
     * - Nếu không rơi vào ảnh nào -> SAI
     */
    private evaluateDrop(dropX: number, dropY: number) {
        let hitAnswer: Phaser.GameObjects.Image | null = null;

        // Kiểm tra xem điểm thả có chạm vào ảnh đáp án nào không
        for (const img of this.answerImages) {
            const bounds = img.getBounds();
            if (bounds.contains(dropX, dropY)) {
                hitAnswer = img;
                break;
            }
        }

        if (hitAnswer === null) {
            // Không chạm vào đáp án nào
            this.handleWrongDrop(null);
            return;
        }

        const hitKey = hitAnswer.texture.key;
        if (hitKey === this.correctAnswerKey) {
            this.handleCorrectDrop(hitAnswer);
        } else {
            this.handleWrongDrop(hitAnswer);
        }
    }

    // ==================================================================
    // PHẦN 5: XỬ LÝ KẾT QUẢ
    // ==================================================================

    private handleCorrectDrop(targetImage: Phaser.GameObjects.Image) {
        console.log(`[Scene2] ĐÚNG! Màn ${this.currentLevelIndex + 1}/${this.totalLevels}`);

        AudioManager.stopAll();
        AudioManager.play('sfx-correct');

        // Vẽ đường nối CỐ ĐỊNH từ VIỀN ellipse đến VIỀN ảnh đáp án (hình tròn)
        // Tâm thả (từ đâu) là đáy viền ellipse
        const edgeEnd = this.getCircleEdgePoint(targetImage, this.ellipseAnchorX, this.ellipseAnchorY);
        this.drawFinalConnectionLine(
            this.ellipseAnchorX, this.ellipseAnchorY,
            edgeEnd.x, edgeEnd.y,
            0x00ff00
        );

        // Hiệu ứng phóng to - thu nhỏ ảnh đáp án đúng
        this.tweens.add({
            targets: targetImage,
            scale: targetImage.scale * 1.25,
            duration: 250,
            yoyo: true,
            repeat: 2,
            ease: 'Sine.easeInOut',
        });

        this.highlightCorrectAnswer(targetImage);

        // Ghi nhận SDK
        game.recordCorrect({ scoreDelta: 1 });
        sdk.score(this.currentLevelIndex + 1, this.totalLevels);
        sdk.progress({ levelIndex: this.currentLevelIndex + 1, total: this.totalLevels, score: this.currentLevelIndex + 1 });

        // Vô hiệu hóa tương tác
        this.disableAllInteraction();

        const nextLevelIndex = this.currentLevelIndex + 1;
        const isLastLevel = nextLevelIndex >= this.totalLevels;

        this.time.delayedCall(GameConstants.SCENE1.TIMING.WIN_DELAY, () => {
            if (isLastLevel) {
                // Đã hoàn thành tất cả màn chơi -> EndGame
                console.log('[Scene2] Hoàn thành tất cả màn! Chuyển EndGame.');
                game.finalizeAttempt();
                game.finishQuestionTimer();
                // Stop Scene1 đang pause trước khi EndGame (giải phóng memory)
                this.scene.stop(SceneKeys.Scene1);
                this.scene.stop(SceneKeys.UI);
                this.scene.start(SceneKeys.EndGame);
            } else {
                console.log(`[Scene2] Chuyển sang màn ${nextLevelIndex + 1}.`);
                this.scene.start(SceneKeys.Scene1, { levelIndex: nextLevelIndex });
            }
        });
    }

    private handleWrongDrop(targetImage: Phaser.GameObjects.Image | null) {
        console.log('[Scene2] SAI! Kéo ra ngoài hoặc vào đáp án sai.');

        AudioManager.play('sfx-wrong');
        game.recordWrong();

        // Rung ảnh đáp án sai (nếu có)
        if (targetImage) {
            this.tweens.add({
                targets: targetImage,
                x: targetImage.x + 12,
                duration: 50,
                yoyo: true,
                repeat: 4,
                ease: 'Linear',
                onComplete: () => {
                    // Đảm bảo ảnh về đúng vị trí gốc sau khi rung
                    targetImage.setX(targetImage.x);
                },
            });
        }

        // Sau khi sai, cho phép kéo lại
        this.time.delayedCall(600, () => {
            console.log('[Scene2] Cho phép kéo lại sau khi sai.');
        });
    }

    // ==================================================================
    // PHẦN 6: HIỆU ỨNG TRỰC QUAN
    // ==================================================================

    /**
     * Vẽ đường nối cố định (không xóa đi) khi trả lời đúng,
     * kèm animation xuất hiện từ từ.
     */
    private drawFinalConnectionLine(
        fromX: number, fromY: number,
        toX: number, toY: number,
        color: number
    ) {
        const finalLine = this.add.graphics();
        finalLine.setDepth(150);

        // Vẽ đường chính
        finalLine.lineStyle(8, color, 1);
        finalLine.beginPath();
        finalLine.moveTo(fromX, fromY);
        finalLine.lineTo(toX, toY);
        finalLine.strokePath();

        // Vẽ chấm đầu và cuối
        finalLine.fillStyle(color, 1);
        finalLine.fillCircle(fromX, fromY, 12);
        finalLine.fillCircle(toX, toY, 12);

        // Fade in nhẹ để trông mượt
        finalLine.setAlpha(0);
        this.tweens.add({
            targets: finalLine,
            alpha: 1,
            duration: 300,
            ease: 'Cubic.easeOut',
        });
    }

    /**
     * Vẽ viền vàng sáng quanh ảnh đáp án đúng sau khi trả lời đúng.
     */
    private highlightCorrectAnswer(img: Phaser.GameObjects.Image) {
        const gfx = this.add.graphics();
        gfx.setDepth(img.depth + 1);

        const pad = 12;
        const w = img.displayWidth + pad * 2;
        const h = img.displayHeight + pad * 2;

        gfx.strokeRect(img.x - w / 2, img.y - h / 2, w, h);

        // Nhấp nháy viền vàng
        this.tweens.add({
            targets: gfx,
            alpha: { from: 1, to: 0.3 },
            duration: 400,
            yoyo: true,
            repeat: -1,
        });
    }

    /**
     * Vô hiệu hóa toàn bộ tương tác sau khi game kết thúc.
     */
    private disableAllInteraction() {
        this.input.off('pointermove');
        this.input.off('pointerup');
        this.answerImages.forEach(img => img.disableInteractive());
        this.isDragging = false;
    }

    // ==================================================================
    // PHẦN 7: Tutorial và Hint
    // ==================================================================

    private runHandTutorial() {
        if (!this.isIntroActive) return;

        const correctImage = this.answerImages.find(img => img.texture.key === this.correctAnswerKey);
        if (!correctImage) return;

        const handHint = this.uiScene.handHint;
        if (!handHint) return;

        handHint.setVisible(true);
        handHint.setAlpha(1);
        handHint.setPosition(this.ellipseAnchorX, this.ellipseAnchorY);
        // Ngón tay hướng vào điểm móc x=0.1 y=0.1
        handHint.setOrigin(0.1, 0.1); 

        // Kéo dây từ ellipse tới đáp án đúng
        this.activeHandTween = this.tweens.add({
            targets: handHint,
            x: correctImage.x,
            y: correctImage.y,
            duration: 2000,
            ease: 'Sine.easeInOut',
            repeat: -1,
            repeatDelay: 500,
            onRepeat: () => {
                handHint.setPosition(this.ellipseAnchorX, this.ellipseAnchorY);
                handHint.setAlpha(1);
            }
        });
    }

    private showHint() {
        this.stopActiveHint();

        const correctImage = this.answerImages.find(img => img.texture.key === this.correctAnswerKey);
        if (!correctImage) return;

        game.addHint();
        AudioManager.play('hint2');

        // 1. Nhấp nháy nhẹ đáp án đúng
        this.activeHintTarget = correctImage;
        this.activeHintTween = this.tweens.add({
            targets: correctImage,
            scale: { from: correctImage.scale, to: correctImage.scale * 1.1 },
            duration: 500,
            yoyo: true,
            repeat: 2,
            onComplete: () => {
                this.activeHintTarget = null;
                this.activeHintTween = null;
                this.idleManager.reset();
            }
        });

        // 2. Chạy animation hand hint
        const handHint = this.uiScene.handHint;
        if (!handHint) return;

        handHint.setVisible(true).setAlpha(0).setScale(0.7).setOrigin(0.1, 0.1);
        handHint.setPosition(this.ellipseAnchorX, this.ellipseAnchorY);

        this.tweens.add({
            targets: handHint,
            alpha: 1,
            scale: 1,
            duration: 400,
            ease: 'Cubic.easeOut',
            onComplete: () => {
                this.activeHandTween = this.tweens.add({
                    targets: handHint,
                    x: correctImage.x,
                    y: correctImage.y,
                    duration: 1500,
                    ease: 'Sine.easeInOut',
                    onComplete: () => {
                        this.stopActiveHint();
                        this.idleManager.start();
                    }
                });
            }
        });
    }

    private stopActiveHint() {
        this.isIntroActive = false;

        if (this.activeHintTween) {
            this.activeHintTween.stop();
            this.activeHintTween = null;
        }
        if (this.activeHandTween) {
            this.activeHandTween.stop();
            this.activeHandTween = null;
        }

        if (this.activeHintTarget) {
            // reset scale cho an toàn (assuming baseScale = 0.7 theo config)
            this.activeHintTarget.setScale(0.7);
            this.activeHintTarget = null;
        }

        if (this.uiScene && this.uiScene.handHint) {
            this.uiScene.handHint.setVisible(false);
            this.uiScene.handHint.setAlpha(1);
            this.uiScene.handHint.setScale(1);
        }
    }


}
