import Phaser from 'phaser';

import { SceneKeys, TextureKeys, DataKeys, AudioKeys } from '../consts/Keys';
import { GameConstants } from '../consts/GameConstants';
import { GameUtils } from '../utils/GameUtils';
import { IdleManager } from '../utils/IdleManager';

import { changeBackground } from '../utils/BackgroundManager';
import { PaintManager } from '../utils/PaintManager';

import {
    playVoiceLocked,
    setGameSceneReference,
    resetVoiceState,
} from '../utils/rotateOrientation';
import AudioManager from '../audio/AudioManager';
import { showGameButtons, sdk } from '../main';
import { game } from "@iruka-edu/mini-game-sdk";

import FPSCounter from '../utils/FPSCounter';

export default class Scene2 extends Phaser.Scene {
    // Đối tượng âm thanh nền (Background Music)
    private bgm!: Phaser.Sound.BaseSound;

    // --- QUẢN LÝ LOGIC (MANAGERS) ---
    private paintManager!: PaintManager; // Quản lý việc tô màu, cọ vẽ, canvas
    private idleManager!: IdleManager; // Quản lý thời gian rảnh để hiện gợi ý
    private fpsCounter!: FPSCounter; // ✅ FPS Counter

    // --- QUẢN LÝ TRẠNG THÁI GAME (GAME STATE) ---
    // Map lưu các bộ phận chưa tô xong (Key: ID, Value: Image Object) -> Dùng để random gợi ý
    private unfinishedPartsMap: Map<string, Phaser.GameObjects.Image> =
        new Map();
    // Set lưu ID các bộ phận đã hoàn thành -> Dùng để check thắng (Win condition)
    private finishedParts: Set<string> = new Set();
    private totalParts: number = 0; // Tổng số bộ phận cần tô
    private score: number = 0; // Điểm số hiện tại
    private isIntroActive: boolean = false; // Cờ chặn tương tác khi đang chạy intro

    private currentLevelIndex: number = 0;

    // --- UI COMPONENTS ---
    
    private get handHint(): Phaser.GameObjects.Image | undefined {
         const uiScene = this.scene.get(SceneKeys.UI) as any;
         return uiScene?.handHint;
    }

    // Tween đang chạy cho gợi ý (lưu lại để stop khi cần)
    private activeHintTween: Phaser.Tweens.Tween | null = null;
    private activeHintTarget: Phaser.GameObjects.Image | null = null;

    constructor() {
        super(SceneKeys.Scene2);
    }

    /**
     * Khởi tạo lại dữ liệu khi Scene bắt đầu (hoặc Restart)
     * QUAN TRỌNG: Phải clear các Map/Set để tránh lỗi "Zombie Object" (tham chiếu đến object cũ đã bị destroy)
     */
    init(data?: { isRestart: boolean; score?: number; levelIndex?: number }) {
        this.unfinishedPartsMap.clear();
        this.finishedParts.clear();
        this.totalParts = 0;
        
        // Restore state from Scene 1
        this.score = data?.score ?? 0;
        this.currentLevelIndex = data?.levelIndex ?? 1; // Default to 1 if coming directly or Scene 1 finished 0

        if (data?.isRestart) {
            game.retryFromStart();
        }
    }

    create() {
        showGameButtons();

        this.setupSystem(); // Cài đặt hệ thống (Paint, Idle)
        this.setupBackgroundAndAudio(); // Cài đặt hình nền và nhạc nền
        this.createUI(); // Tạo giao diện (Bảng màu, Banner)
        
        // Chạy UI Scene hoặc Update nếu đang chạy
        if (!this.scene.isActive(SceneKeys.UI)) {
             this.scene.launch(SceneKeys.UI, { 
                paintManager: this.paintManager,
                sceneKey: SceneKeys.Scene2 
            });
        } else {
             const ui = this.scene.get(SceneKeys.UI) as any;
             if (ui.setPaintManager) ui.setPaintManager(this.paintManager);
             if (ui.resetPaletteSelection) ui.resetPaletteSelection(); // ✅ Reset về màu đỏ
             if (ui.updateBanner) ui.updateBanner(SceneKeys.Scene2);
        }

        this.createLevel(); // Tạo nhân vật và các vùng tô màu
        
        // SDK Integration
        game.setTotal(5);
        (window as any).irukaGameState = {
            startTime: Date.now(),
            currentScore: this.score,
        };
        sdk.score(this.score, 0);
        sdk.progress({ levelIndex: this.currentLevelIndex, total: 5 });
        game.startQuestionTimer();

        this.setupInput(); // Cài đặt sự kiện chạm/vuốt

        // Events
        this.events.on('wake', () => {
            this.idleManager.reset();
            if (this.input.keyboard) this.input.keyboard.enabled = true;
        });

        // Tự động chạy Intro (Scene 2 không cần click start)
        const soundManager = this.sound as Phaser.Sound.WebAudioSoundManager;
        if (soundManager.context && soundManager.context.state === 'suspended') {
            soundManager.context.resume();
        }
        
        this.time.delayedCall(500, () => {
             this.playIntroSequence();
        });
    }

    update(time: number, delta: number) {
        // Chỉ đếm thời gian Idle khi:
        // 1. Không đang tô màu
        // 2. Không đang chạy Intro
        // 3. Chưa thắng game
        if (
            !this.paintManager.isPainting() &&
            !this.isIntroActive &&
            this.finishedParts.size < this.totalParts
        ) {
            this.idleManager.update(delta);
        }

        // Cập nhật FPS
        if (this.fpsCounter) {
            this.fpsCounter.update();
        }
    }

    shutdown() {
        this.stopIntro();

        this.paintManager = null as any; // Giải phóng bộ nhớ
        
        if (this.bgm) {
            this.bgm.stop();
        }

        // 4. Dừng Idle Manager
        if (this.idleManager) {
            this.idleManager.stop();
        }
    }

    // =================================================================
    // PHẦN 1: CÀI ĐẶT HỆ THỐNG (SYSTEM SETUP)
    // =================================================================

    private setupSystem() {
        resetVoiceState();
        (window as any).gameScene = this;
        setGameSceneReference(this);

        // Khởi tạo PaintManager
        // Callback nhận về: id, renderTexture, và DANH SÁCH MÀU ĐÃ DÙNG (Set<number>)
        this.paintManager = new PaintManager(this, (id, rt, usedColors) => {
            this.handlePartComplete(id, rt, usedColors);
        });

        // Cài đặt Idle Manager: Khi rảnh quá lâu thì gọi showHint()
        this.idleManager = new IdleManager(GameConstants.IDLE.THRESHOLD, () =>
            this.showHint()
        );
    }

    private setupInput() {
        // Chuyển tiếp các sự kiện input sang cho PaintManager xử lý vẽ
        this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
            this.paintManager.handlePointerMove(p);
            if(this.paintManager.isPainting()) {
                this.idleManager.reset();
                this.stopIntro();
                this.stopActiveHint();
            }
        });
        this.input.on('pointerup', () => this.paintManager.handlePointerUp());
        
        // Reset Idle khi click
        this.input.on('pointerdown', () => {
             this.idleManager.reset();
             this.stopIntro();
             this.stopActiveHint();
        });
    }

    /**
     * Cài đặt hình nền và nhạc nền
     */
    private setupBackgroundAndAudio() {
        changeBackground('assets/images/bg/background.jpg');

        // Dừng nhạc nền cũ nếu có (tránh chồng nhạc)
        if (this.sound.get(AudioKeys.BgmNen)) {
            this.sound.stopByKey(AudioKeys.BgmNen);
        }
        // Khởi tạo và phát nhạc nền mới
        this.bgm = this.sound.add(AudioKeys.BgmNen, { loop: true, volume: 0.25 });
        this.bgm.play();
    }
    // =================================================================
    // PHẦN 2: TẠO GIAO DIỆN & LEVEL (UI & LEVEL CREATION)
    // =================================================================

    private createUI() {
        const UI = GameConstants.SCENE1.UI;
        const cx = GameUtils.pctX(this, 0.5);
        const scl = [1, 0.72];

        // Tính toán vị trí Board dựa trên Banner
        const bannerHeight = this.textures.get(TextureKeys.S1_Banner).getSourceImage().height * 0.7; // Scale 0.7

        const boardY = bannerHeight + GameUtils.pctY(this, UI.BOARD_OFFSET);

        const board = this.add
            .image(cx, boardY, TextureKeys.S1_Board)
            .setOrigin(0.5, 0)
            .setScale(scl[0], scl[1])
            .setDepth(0);

        board.displayWidth = GameUtils.getW(this) * 0.8;
    }

    // --- LOGIC TẠO LEVEL THEO STAGE ---
    private createLevel() {
        // Load cấu hình level từ JSON - SCENE 2
        const data = this.cache.json.get(DataKeys.LevelS2Config);
        if (data) {
            this.spawnCharacter(data.teacher);
        }
    }

    private spawnCharacter(config: any) {
        const cx = GameUtils.pctX(this, config.baseX_pct);
        const cy = GameUtils.pctY(this, config.baseY_pct);

        config.parts.forEach((part: any, index: number) => {
            const id = `${part.key}_${index}`;
            const layerX = cx + part.offsetX;
            const layerY = cy + part.offsetY;

            // Tạo vùng tô màu thông qua PaintManager
            const hitArea = this.paintManager.createPaintableLayer(
                layerX,
                layerY,
                part.key,
                part.scale,
                id
            );

            // --- BEST PRACTICE: LƯU DỮ LIỆU TĨNH & TÍNH TOÁN TỰ ĐỘNG ---
            const centerOffset = GameUtils.calculateCenteredOffset(this, part.key);
            let hX = centerOffset.x;
            let hY = centerOffset.y;

            // Lưu các thông số cấu hình vào Data Manager của Game Object.
            hitArea.setData('hintX', hX);
            hitArea.setData('hintY', hY);
            hitArea.setData('originScale', part.scale); // Scale gốc (không đổi)
            
            // --- CẬP NHẬT: LƯU HINT POINTS (NẾU CÓ) ---
            if (part.hintPoints && Array.isArray(part.hintPoints)) {
                hitArea.setData('hintPoints', part.hintPoints);
            }

            // --- CẬP NHẬT: LƯU MÀU ĐÚNG (VALIDATION) ---
            if (part.correctColor !== undefined) {
                hitArea.setData('correctColor', part.correctColor);

                // this.drawHintDebug(hitArea, part.hintPoints);
            }

            this.unfinishedPartsMap.set(id, hitArea);
            this.totalParts++;
        });

        // Vẽ viền (Outline) lên trên cùng
        const outline = this.add
            .image(cx, cy, config.outlineKey)
            .setScale(config.baseScale)
            .setDepth(900)
            .setInteractive({ pixelPerfect: true });

        //  this.drawDebugAxes(outline);
    }

    // =================================================================
    // PHẦN 3: LOGIC GAMEPLAY (GAMEPLAY LOGIC)
    // =================================================================

    /**
     * Xử lý khi một bộ phận được tô xong
     * @param usedColors Set chứa danh sách các màu đã tô lên bộ phận này
     */
    private handlePartComplete(
        id: string,
        rt: Phaser.GameObjects.RenderTexture,
        usedColors: Set<number>
    ) {
        this.finishedParts.add(id);

        game.recordCorrect({ scoreDelta: 1 });
        this.score += 1;
        (window as any).irukaGameState.currentScore = this.score;
        sdk.score(this.score, 1);
        
        // --- LOGIC AUTO-FILL THÔNG MINH ---
        if (usedColors.size === 1) {
            const singleColor = usedColors.values().next().value || 0;

            rt.setBlendMode(Phaser.BlendModes.NORMAL);
            rt.fill(singleColor);
        } else {
            console.log('Multi-color artwork preserved!');
        }

        // Xóa khỏi danh sách chưa tô -> Để gợi ý không chỉ vào cái này nữa
        this.unfinishedPartsMap.delete(id);

        AudioManager.play('sfx-ting');
        
        // Increment Level Index for each part completed
        this.currentLevelIndex++;

        // Hiệu ứng nhấp nháy báo hiệu hoàn thành
        this.tweens.add({
            targets: rt,
            alpha: 0.8,
            yoyo: true,
            duration: GameConstants.SCENE1.TIMING.AUTO_FILL,
            repeat: 2,
        });

        // Kiểm tra điều kiện thắng
        if (this.finishedParts.size >= this.totalParts) {
            console.log('SCENE 2 WIN!');

            // --- GAME HUB COMPLETE ---
            game.finalizeAttempt();
            
            sdk.progress({
                levelIndex: this.currentLevelIndex, 
                total: 5,
                score: this.score,
            });

            AudioManager.play('sfx-correct_s2');
            
            // Xóa UI (Nút màu & Banner) -> Scene 2 Xong thì có thể xóa hoặc sang EndGame
            const uiScene = this.scene.get(SceneKeys.UI) as any;
            if (uiScene) {
                if (uiScene.hidePalette) uiScene.hidePalette();
                if (uiScene.hideBanners) uiScene.hideBanners();
            }

            this.time.delayedCall(GameConstants.SCENE1.TIMING.WIN_DELAY, () => {
                this.scene.start(SceneKeys.EndGame);
            });
        } else {
             // If not complete, just update progress
             sdk.progress({
                levelIndex: this.currentLevelIndex,
                score: this.score,
                total: 5
            });
        }
    }

    // =================================================================
    // PHẦN 4: HƯỚNG DẪN & GỢI Ý (TUTORIAL & HINT)
    // =================================================================

    public restartIntro() {
        this.stopIntro();
        this.time.delayedCall(GameConstants.SCENE1.TIMING.RESTART_INTRO, () =>
            this.playIntroSequence()
        );
    }

    private playIntroSequence() {
        this.isIntroActive = true;
        playVoiceLocked(null, 'voice_intro_s2');
        // Đợi 1 chút rồi chạy animation tay hướng dẫn
        this.time.delayedCall(GameConstants.SCENE1.TIMING.INTRO_DELAY, () => {
            if (this.isIntroActive) this.runHandTutorial();
        });
    }

    private stopIntro() {
        this.isIntroActive = false;
        this.idleManager.start();

        if (this.handHint) {
            this.handHint.setAlpha(0).setPosition(-200, -200);
        }
    }

    /**
     * Tutorial đầu game: Tay cầm màu đỏ tô mẫu
     */
    private runHandTutorial() {
        if (!this.isIntroActive) return;

        // 1. Tìm bộ phận mục tiêu (Lấy bộ phận đầu tiên chưa tô)
        const items = Array.from(this.unfinishedPartsMap.values());
        let target: Phaser.GameObjects.Image | undefined;
        let destX = 0;
        let destY = 0;

        if (items.length > 0) {
            target = items[0]; // Lấy cái đầu tiên
            const hX = target.getData('hintX') || 0;
            const hY = target.getData('hintY') || 0;
            const originScale = target.getData('originScale') || 1; 

            // Tính tọa độ đích chính xác
            destX = target.x + (hX * originScale);
            destY = target.y + (hY * originScale);
        } else {
            // Fallback
            const UI = GameConstants.SCENE1.UI;
            destX = GameUtils.pctX(this, UI.HAND_INTRO_END_X);
            destY = GameUtils.pctY(this, UI.HAND_INTRO_END_Y);
        }

        const UI = GameConstants.SCENE1.UI;
        const INTRO = GameConstants.SCENE1.INTRO_HAND;

        // --- UPDATE LOGIC VỊ TRÍ NÚT MÀU (HORIZONTAL) ---
        const spacingX = GameUtils.pctX(this, UI.PALETTE_SPACING_X);
        const paletteY = GameUtils.pctY(this, UI.PALETTE_Y);
        const paletteData = GameConstants.PALETTE_DATA;
        
        const totalItems = paletteData.length + 1; // +1 cho Eraser
        const totalWidth = (totalItems - 1) * spacingX;
        const startX = (GameUtils.getW(this) - totalWidth) / 2;

        // Nút màu đầu tiên (Red) nằm ở vị trí đầu
        const firstBtnX = startX;
        const firstBtnY = paletteY - 30;

        const dragY = destY + 10; 

        if (!this.handHint) return;

        this.handHint.setOrigin(0, 0);
        this.handHint.setPosition(firstBtnX, firstBtnY).setAlpha(0).setScale(0.7);

        // --- CẬP NHẬT LOGIC HINT POINTS ---
        const hintPoints = target?.getData('hintPoints'); 
        
        const tweensChain: any[] = [
            {
                alpha: 1,
                x: firstBtnX,
                y: firstBtnY,
                duration: INTRO.MOVE,
                ease: 'Power2',
            },
            { scale: 0.5, duration: INTRO.TAP, yoyo: true, repeat: 0.7 },
        ];

        if (hintPoints && hintPoints.length > 0) {
            const originScale = target?.getData('originScale') || 1;
            const baseX = target?.x || 0;
            const baseY = target?.y || 0;

            const firstP = hintPoints[0];
            const firstDestX = baseX + (firstP.x * originScale);
            const firstDestY = baseY + (firstP.y * originScale);

            tweensChain.push({ x: firstDestX, y: firstDestY, duration: INTRO.DRAG, delay: 100 });

            tweensChain.push({
                x: '-=30',
                y: '-=10',
                duration: INTRO.RUB,
                yoyo: true,
                repeat: 3,
            });

            for (let i = 1; i < hintPoints.length; i++) {
                const p = hintPoints[i];
                const destX = baseX + (p.x * originScale);
                const destY = baseY + (p.y * originScale);
                tweensChain.push({ x: destX, y: destY, duration: INTRO.DRAG });
            
             tweensChain.push({
                x: '-=30',
                y: '-=10',
                duration: INTRO.RUB,
                yoyo: true,
                repeat: 3,
            });
            }

        } else {
             tweensChain.push({ x: destX, y: dragY, duration: INTRO.DRAG, delay: 100 });
             tweensChain.push({
                x: '-=30',
                y: '-=10',
                duration: INTRO.RUB,
                yoyo: true,
                repeat: 3,
            });
        }

        tweensChain.push({
            alpha: 0,
            duration: 500,
            onComplete: () => {
                this.handHint?.setPosition(-200, -200);
                if (this.isIntroActive)
                    this.time.delayedCall(1000, () =>
                        this.runHandTutorial()
                            );
                    },
        });

        this.tweens.chain({
            targets: this.handHint,
            tweens: tweensChain,
        });
    }

    /**
     * Gợi ý khi rảnh (Idle Hint): Chọn ngẫu nhiên 1 phần chưa tô để chỉ vào
     */
    private showHint() {
        game.addHint();
        const items = Array.from(this.unfinishedPartsMap.values());
        if (items.length === 0) return;
        
        // Random 1 bộ phận
        const target = items[Math.floor(Math.random() * items.length)];

        AudioManager.play('hint');
        
        const IDLE_CFG = GameConstants.IDLE;

        // Visual 1: Nhấp nháy bộ phận đó
        this.activeHintTarget = target;
        this.activeHintTween = this.tweens.add({
            targets: target, 
            alpha: { from: 0.01, to: 0.8 },
            scale: { from: target.getData('originScale'), to: target.getData('originScale') * 1.005 },
            duration: IDLE_CFG.FADE_IN, 
            yoyo: true, 
            repeat: 2,
            onComplete: () => { 
                this.activeHintTween = null; 
                this.activeHintTarget = null;
                this.idleManager.reset();
            }
        });

        // Visual 2: Bàn tay chỉ vào
        const hX = target.getData('hintX') || 0;
        const hY = target.getData('hintY') || 0;
        const originScale = target.getData('originScale') || 1; 

        // Tính tọa độ đích dựa trên scale gốc
        let destX = target.x + (hX * originScale);
        let destY = target.y + (hY * originScale);

        if (!this.handHint) return;

        this.handHint.setOrigin(0, 0);
        
        const hintPoints = target?.getData('hintPoints'); 
        
        let startHintX = destX;
        let startHintY = destY;

        const tweensChain: any[] = [];
        
        if (hintPoints && hintPoints.length > 0) {
            const baseX = target?.x || 0;
            const baseY = target?.y || 0;
            
            const firstP = hintPoints[0];
            startHintX = baseX + (firstP.x * originScale);
            startHintY = baseY + (firstP.y * originScale);
        }

        this.handHint
            .setPosition(startHintX + 50, startHintY + 50)
            .setAlpha(0)
            .setScale(0.7);

        tweensChain.push({
            targets: this.handHint,
            alpha: 1,
            x: startHintX, 
            y: startHintY,
            duration: 800,
            ease: 'Power2',
        });
        
        tweensChain.push({
            targets: this.handHint,
            scale: 0.5,
            duration: 300,
            yoyo: true,
            repeat: 2,
        });

        tweensChain.push({
            targets: this.handHint,
            alpha: 0,
            duration: 300,
            onComplete: () => {
                this.handHint?.setPosition(-200, -200);
            }
        });

        this.tweens.chain({ tweens: tweensChain });
    }

    private stopActiveHint() {
        if (this.activeHintTween) {
            this.activeHintTween.stop();
            this.activeHintTween = null;
        }

        if (this.activeHintTarget) {
            this.tweens.killTweensOf(this.activeHintTarget);
            this.activeHintTarget.setAlpha(0.01); // Reset about PaintManager default alpha
            this.activeHintTarget.setScale(this.activeHintTarget.getData('originScale'));
            this.activeHintTarget = null;
        }

        if (this.handHint) {
            this.tweens.killTweensOf(this.handHint);
            this.handHint.setAlpha(0).setPosition(-200, -200);
        }
    }
}
