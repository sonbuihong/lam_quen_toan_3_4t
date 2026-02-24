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

// ===============================================================
// Kiểu dữ liệu nhận từ Scene1
// ===============================================================
interface Scene1Ellipse {
    centerX: number;
    centerY: number;
    radiusX: number;
    radiusY: number;
    targetKey: string;
    angle?: number;
}

interface Scene1Data {
    ellipses: Scene1Ellipse[];
    levelIndex?: number;
}


export default class Scene2 extends Phaser.Scene {
    private bgm!: Phaser.Sound.BaseSound;

    // Dữ liệu ellipse nhận từ Scene1
    private ellipsesData: Scene1Ellipse[] = [];
    
    // Lưu trạng thái nối điểm đã thành công
    private matchedTargets: string[] = [];

    // Điểm neo đang được người chơi bắt đầu kéo
    private activeDragAnchor: { x: number, y: number, targetKey: string } | null = null;
    
    // Đồ họa đường kéo (line) từ ellipse đến con trỏ
    private dragLine!: Phaser.GameObjects.Graphics;

    // Trạng thái kéo
    private isDragging: boolean = false;

    // Danh sách ảnh đáp án được spawn ra
    private answerImages: Phaser.GameObjects.Image[] = [];

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

    init(data: Scene1Data) {
        this.currentLevelIndex = data?.levelIndex ?? 0;
        this.isDragging = false;
        this.isIntroActive = true;
        this.answerImages = [];
        this.matchedTargets = [];
        this.activeDragAnchor = null;
        console.log(`[Scene2] init - levelIndex = ${this.currentLevelIndex}`);

        if (data && data.ellipses) {
            this.ellipsesData = data.ellipses;
        } else {
            console.warn("Scene2 received no ellipses data");
            this.ellipsesData = [];
        }
    }

    create() {
        showGameButtons();
        
        this.events.once('shutdown', this.shutdown, this);

        this.loadConfigAndSetup();
        this.createEllipseDisplays();
        this.createDragLine();
        this.setupDragInput();

        this.scene.bringToTop(SceneKeys.Scene2);

        const uiSceneTemp = this.scene.get(SceneKeys.UI) as UIScene;
        if (uiSceneTemp.scene.isActive()) {
            uiSceneTemp.updateLevel(this.currentLevelIndex);
            this.scene.bringToTop(SceneKeys.UI);
        } else {
            this.scene.launch(SceneKeys.UI, { sceneKey: SceneKeys.Scene2, levelIndex: this.currentLevelIndex });
            this.scene.bringToTop(SceneKeys.UI);
        }
        this.uiScene = this.scene.get(SceneKeys.UI) as UIScene;

        this.idleManager = new IdleManager(GameConstants.IDLE.THRESHOLD, () => {
            if (!this.isDragging && !this.isIntroActive) {
                this.showHint();
            }
        });

        this.playIntroSequence();
    }

    shutdown() {
        this.events.off('shutdown', this.shutdown, this);
        if (this.bgm) this.bgm.stop();
        this.tweens.killAll();
        this.input.off('pointermove');
        this.input.off('pointerup');
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
        
        let playIntro = "voice_intro2";
        AudioManager.play(playIntro);

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

        const rawLevelConfig = fullConfig.levels
            ? fullConfig.levels[this.currentLevelIndex]
            : fullConfig;

        this.totalLevels = fullConfig.levels ? fullConfig.levels.length : 1;

        if (!rawLevelConfig) {
            console.error(`[Scene2] Không tìm thấy config cho levelIndex=${this.currentLevelIndex}`);
            return;
        }

        const scene1 = this.scene.get(SceneKeys.Scene1) as Scene1;
        this.answerImages = scene1?.getAnswerObjects() ?? [];

        this.answerImages.forEach(img => {
            this.addAnswerDecoration(img);
        });

        console.log(`[Scene2] Số đáp án từ Scene1: ${this.answerImages.length}`);
    }

    private addAnswerDecoration(img: Phaser.GameObjects.Image) {
        const gfx = this.add.graphics();
        gfx.setDepth(9);
        const w = img.displayWidth + 16;
        const h = img.displayHeight + 16;
        gfx.lineStyle(3, 0xffffff, 0.3);
        gfx.strokeRect(img.x - w / 2, img.y - h / 2, w, h);
    }

    // ==================================================================
    // PHẦN 3: VẼ ELLIPSE ĐÃ KHOANH TỪ SCENE1
    // ==================================================================

    private createEllipseDisplays() {
        this.ellipsesData.forEach(ellipse => {
            const { centerX, centerY, radiusX, radiusY, targetKey, angle = 0 } = ellipse;

            // Truy tìm ảnh đáp án đích
            const targetImage = this.answerImages.find(img => img.texture.key === targetKey);
            
            // Nếu tìm thấy, tính điểm trên viền ellipse gần với tâm của targetImage nhất
            let anchorX = centerX;
            let anchorY = centerY;
            if (targetImage) {
                const edgePt = this.getEllipseEdgePoint(ellipse, targetImage.x, targetImage.y);
                anchorX = edgePt.x;
                anchorY = edgePt.y;
            } else {
                // Fallback: Lấy điểm đáy nếu không tìm thấy targetImage
                const angleRad = Phaser.Math.DegToRad(angle);
                anchorX = centerX - radiusY * Math.sin(angleRad);
                anchorY = centerY + radiusY * Math.cos(angleRad);
            }

            // Vẽ lại ellipse xanh
            const gfx = this.add.graphics();
            gfx.setDepth(50);
            gfx.setPosition(centerX, centerY);
            gfx.setAngle(angle);
            gfx.lineStyle(10, 0x00ff00, 1);
            gfx.strokeEllipse(0, 0, radiusX * 2, radiusY * 2);

            this.tweens.add({
                targets: gfx,
                alpha: { from: 1, to: 0.4 },
                duration: 700,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut',
            });

            // Hit zone để bắt đầu kéo
            const hitZoneRadius = Math.max(radiusX, radiusY) * 0.9 + 30;
            const hitZone = this.add.circle(centerX, centerY, hitZoneRadius, 0xffffff, 0)
                .setDepth(60)
                .setInteractive({ useHandCursor: true });

            hitZone.on('pointerdown', (_pointer: Phaser.Input.Pointer) => {
                // Nếu điểm nối này đã kéo thành công thì ko cho kéo lại
                if(this.matchedTargets.includes(targetKey)) return;
                
                this.startDrag(anchorX, anchorY, targetKey);
            });
        });
    }

    // ==================================================================
    // PHẦN 4: LOGIC DRAG (KÉO NỐI)
    // ==================================================================

    private createDragLine() {
        this.dragLine = this.add.graphics();
        this.dragLine.setDepth(200);
        this.dragLine.setAlpha(0); 
    }

    private startDrag(anchorX: number, anchorY: number, targetKey: string) {
        if (this.isDragging) return;
        this.stopActiveHint();
        this.idleManager.reset();
        this.isDragging = true;
        this.activeDragAnchor = { x: anchorX, y: anchorY, targetKey: targetKey };
        this.dragLine.setAlpha(1);
    }

    private setupDragInput() {
        this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
            if (!this.isDragging || !this.activeDragAnchor) return;
            this.idleManager.reset();
            this.drawDragLine(pointer.x, pointer.y);
        });

        this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
            if (!this.isDragging) return;
            this.isDragging = false;
            this.dragLine.clear();
            this.dragLine.setAlpha(0);

            this.evaluateDrop(pointer.x, pointer.y);
            this.idleManager.start();
        });
    }

    private getCircleEdgePoint(img: Phaser.GameObjects.Image, fromX: number, fromY: number): { x: number; y: number } {
        const cx = img.x;
        const cy = img.y;
        const radius = Math.min(img.displayWidth, img.displayHeight) / 2;
        const angle = Math.atan2(fromY - cy, fromX - cx);

        return {
            x: cx + radius * Math.cos(angle),
            y: cy + radius * Math.sin(angle),
        };
    }

    /**
     * Tính điểm trên viền ellipse (đã tính góc xoay) giao cắt với tia đi từ tâm ellipse tới đích (toX, toY).
     * Đây là cách xấp xỉ điểm gần nhất để chốt dây neo.
     */
    private getEllipseEdgePoint(ellipse: Scene1Ellipse, toX: number, toY: number): { x: number, y: number } {
        const cx = ellipse.centerX;
        const cy = ellipse.centerY;
        const rx = ellipse.radiusX;
        const ry = ellipse.radiusY;
        const angleRad = Phaser.Math.DegToRad(ellipse.angle || 0);

        // Đưa đích về hệ tọa độ tâm (0,0) và xoay ngược Elip về dạng thẳng đứng
        const dx = toX - cx;
        const dy = toY - cy;
        const unrotatedDX = dx * Math.cos(-angleRad) - dy * Math.sin(-angleRad);
        const unrotatedDY = dx * Math.sin(-angleRad) + dy * Math.cos(-angleRad);

        // Tính góc của điểm đó trên Elipse mẫu
        const theta = Math.atan2(unrotatedDY * rx, unrotatedDX * ry);

        // Tìm điểm cắt X, Y trên elipse đứng
        const localX = rx * Math.cos(theta);
        const localY = ry * Math.sin(theta);

        // Xoay thuận lại + dời về tâm cũ
        const finalX = localX * Math.cos(angleRad) - localY * Math.sin(angleRad) + cx;
        const finalY = localX * Math.sin(angleRad) + localY * Math.cos(angleRad) + cy;

        return { x: finalX, y: finalY };
    }

    private drawDragLine(toX: number, toY: number) {
        if (!this.activeDragAnchor) return;
        this.dragLine.clear();

        const startX = this.activeDragAnchor.x;
        const startY = this.activeDragAnchor.y;

        this.dragLine.lineStyle(6, 0x00dd44, 0.9);
        this.dragLine.beginPath();
        this.dragLine.moveTo(startX, startY);
        this.dragLine.lineTo(toX, toY);
        this.dragLine.strokePath();

        this.dragLine.lineStyle(2, 0xffff00, 0.5);
        this.dragLine.beginPath();
        this.dragLine.moveTo(startX, startY);
        this.dragLine.lineTo(toX, toY);
        this.dragLine.strokePath();

        this.dragLine.fillStyle(0x00dd44, 1);
        this.dragLine.fillCircle(toX, toY, 10);
    }

    private evaluateDrop(dropX: number, dropY: number) {
        let hitAnswer: Phaser.GameObjects.Image | null = null;
        if (!this.activeDragAnchor) return;

        for (const img of this.answerImages) {
            const bounds = img.getBounds();
            if (bounds.contains(dropX, dropY)) {
                hitAnswer = img;
                break;
            }
        }

        if (hitAnswer === null) {
            this.handleWrongDrop(null);
            this.activeDragAnchor = null;
            return;
        }

        const hitKey = hitAnswer.texture.key;
        if (hitKey === this.activeDragAnchor.targetKey) {
            this.handleCorrectDrop(hitAnswer);
        } else {
            this.handleWrongDrop(hitAnswer);
        }
        
        this.activeDragAnchor = null;
    }

    // ==================================================================
    // PHẦN 5: XỬ LÝ KẾT QUẢ
    // ==================================================================

    private handleCorrectDrop(targetImage: Phaser.GameObjects.Image) {
        if (!this.activeDragAnchor) return;
        
        AudioManager.stopAll();
        AudioManager.play('sfx-correct');

        const edgeEnd = this.getCircleEdgePoint(targetImage, this.activeDragAnchor.x, this.activeDragAnchor.y);
        this.drawFinalConnectionLine(
            this.activeDragAnchor.x, this.activeDragAnchor.y,
            edgeEnd.x, edgeEnd.y,
            0x00ff00
        );

        this.tweens.add({
            targets: targetImage,
            scale: targetImage.scale * 1.25,
            duration: 250,
            yoyo: true,
            repeat: 2,
            ease: 'Sine.easeInOut',
        });

        this.highlightCorrectAnswer(targetImage);

        // Lưu vết lại
        this.matchedTargets.push(this.activeDragAnchor.targetKey);
        
        // Kiểm tra xem đã nối được hết mọi mảnh chưa
        if (this.matchedTargets.length >= this.ellipsesData.length) {
            console.log(`[Scene2] ĐÚNG TẤT CẢ! Màn ${this.currentLevelIndex + 1}/${this.totalLevels}`);
            
            game.recordCorrect({ scoreDelta: 1 });
            sdk.score(this.currentLevelIndex + 1, this.totalLevels);
            sdk.progress({ levelIndex: this.currentLevelIndex + 1, total: this.totalLevels, score: this.currentLevelIndex + 1 });

            // Vô hiệu hóa tương tác
            this.disableAllInteraction();

            const nextLevelIndex = this.currentLevelIndex + 1;
            const isLastLevel = nextLevelIndex >= this.totalLevels;

            this.time.delayedCall(GameConstants.SCENE1.TIMING.WIN_DELAY, () => {
                if (isLastLevel) {
                    console.log('[Scene2] Hoàn thành tất cả màn! Chuyển EndGame.');
                    game.finalizeAttempt();
                    game.finishQuestionTimer();
                    this.scene.stop(SceneKeys.Scene1);
                    this.scene.stop(SceneKeys.UI);
                    this.scene.start(SceneKeys.EndGame);
                } else {
                    console.log(`[Scene2] Chuyển sang màn ${nextLevelIndex + 1}.`);
                    this.scene.start(SceneKeys.Scene1, { levelIndex: nextLevelIndex });
                }
            });
        } else {
             console.log(`[Scene2] Mới nối được ${this.matchedTargets.length}/${this.ellipsesData.length}`);
        }
    }

    private handleWrongDrop(targetImage: Phaser.GameObjects.Image | null) {
        console.log('[Scene2] SAI! Kéo ra ngoài hoặc vào đáp án sai.');

        AudioManager.play('sfx-wrong');
        game.recordWrong();

        if (targetImage) {
            this.tweens.add({
                targets: targetImage,
                x: targetImage.x + 12,
                duration: 50,
                yoyo: true,
                repeat: 4,
                ease: 'Linear',
                onComplete: () => {
                    targetImage.setX(targetImage.x);
                },
            });
        }
    }

    // ==================================================================
    // PHẦN 6: HIỆU ỨNG TRỰC QUAN
    // ==================================================================

    private drawFinalConnectionLine(
        fromX: number, fromY: number,
        toX: number, toY: number,
        color: number
    ) {
        const finalLine = this.add.graphics();
        finalLine.setDepth(150);

        finalLine.lineStyle(8, color, 1);
        finalLine.beginPath();
        finalLine.moveTo(fromX, fromY);
        finalLine.lineTo(toX, toY);
        finalLine.strokePath();

        finalLine.fillStyle(color, 1);
        finalLine.fillCircle(fromX, fromY, 12);
        finalLine.fillCircle(toX, toY, 12);

        finalLine.setAlpha(0);
        this.tweens.add({
            targets: finalLine,
            alpha: 1,
            duration: 300,
            ease: 'Cubic.easeOut',
        });
    }

    private highlightCorrectAnswer(img: Phaser.GameObjects.Image) {
        const gfx = this.add.graphics();
        gfx.setDepth(img.depth + 1);

        const pad = 12;
        const w = img.displayWidth + pad * 2;
        const h = img.displayHeight + pad * 2;

        gfx.strokeRect(img.x - w / 2, img.y - h / 2, w, h);

        this.tweens.add({
            targets: gfx,
            alpha: { from: 1, to: 0.3 },
            duration: 400,
            yoyo: true,
            repeat: -1,
        });
    }

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
        if (!this.isIntroActive || this.ellipsesData.length === 0) return;

        // Bốc đại 1 ellipse chưa được kéo để làm mẫu
        const pendingEllipse = this.ellipsesData.find(e => !this.matchedTargets.includes(e.targetKey)) || this.ellipsesData[0];
        const correctImage = this.answerImages.find(img => img.texture.key === pendingEllipse.targetKey);
        if (!correctImage) return;

        const handHint = this.uiScene.handHint;
        if (!handHint) return;
        
        const edgePt = this.getEllipseEdgePoint(pendingEllipse, correctImage.x, correctImage.y);
        const anchorX = edgePt.x;
        const anchorY = edgePt.y;

        handHint.setVisible(true);
        handHint.setAlpha(1);
        handHint.setPosition(anchorX, anchorY);
        handHint.setOrigin(0.1, 0.1); 

        this.activeHandTween = this.tweens.add({
            targets: handHint,
            x: correctImage.x,
            y: correctImage.y,
            duration: 2000,
            ease: 'Sine.easeInOut',
            repeat: -1,
            repeatDelay: 500,
            onRepeat: () => {
                handHint.setPosition(anchorX, anchorY);
                handHint.setAlpha(1);
            }
        });
    }

    private showHint() {
        this.stopActiveHint();

        const pendingEllipse = this.ellipsesData.find(e => !this.matchedTargets.includes(e.targetKey));
        if (!pendingEllipse) return;
        
        const correctImage = this.answerImages.find(img => img.texture.key === pendingEllipse.targetKey);
        if (!correctImage) return;

        game.addHint();
        AudioManager.play('hint2');

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

        const handHint = this.uiScene.handHint;
        if (!handHint) return;

        const edgePt = this.getEllipseEdgePoint(pendingEllipse, correctImage.x, correctImage.y);
        const anchorX = edgePt.x;
        const anchorY = edgePt.y;

        handHint.setVisible(true).setAlpha(0).setScale(0.7).setOrigin(0.1, 0.1);
        handHint.setPosition(anchorX, anchorY);

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
