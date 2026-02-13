import Phaser from 'phaser';
import UIScene from './UIScene';
import { SceneKeys, TextureKeys, AudioKeys, DataKeys } from '../consts/Keys';
import { GameConstants } from '../consts/GameConstants';
import { GameUtils } from '../utils/GameUtils';
import { changeBackground } from '../utils/BackgroundManager';
import AudioManager from '../audio/AudioManager';
import { showGameButtons } from '../main';
import { setGameSceneReference, resetVoiceState, playVoiceLocked } from '../utils/rotateOrientation';
import { IdleManager } from '../utils/IdleManager';

// Managers
import { LassoManager } from '../managers/LassoManager';
import { ObjectManager } from '../managers/ObjectManager';
import { LassoValidation } from '../utils/LassoValidation';
import { game } from "@iruka-edu/mini-game-sdk";
import { sdk } from '../main';

export default class Scene1 extends Phaser.Scene {
    private bgm!: Phaser.Sound.BaseSound;
    private lassoManager!: LassoManager;
    private objectManager!: ObjectManager;

    // Trạng thái Logic
    private isIntroductionPlayed: boolean = false;
    private idleManager!: IdleManager;
    private isWaitingForIntroStart: boolean = true;
    
    // SDK theo dõi trạng thái
    private runSeq = 1;
    private itemSeq = 0;
    private circleTracker: any = null;

    
    // Getter tiện ích cho UIScene
    private get uiScene(): UIScene {
        return this.scene.get(SceneKeys.UI) as UIScene;
    }
    
    // Trạng thái Hướng dẫn & Gợi ý (Tutorial & Hint)
    private isIntroActive: boolean = false;
    private activeHintTween: Phaser.Tweens.Tween | null = null;
    private activeHintTarget: Phaser.GameObjects.Image | null = null;
    private activeCircleTween: Phaser.Tweens.Tween | null = null; // Track tween xoay tròn để cleanup đúng
    // Lưu ý: handHint giờ đây được quản lý bởi UIScene

    // Graphics vòng tròn xanh khi khoanh đúng
    private correctCircleGraphics: Phaser.GameObjects.Graphics | null = null;

    // Logic Multi-Level
    private levelConfigs: any[] = []; // Toàn bộ config của 3 level
    private currentLevelConfig: any = null; // Config của level hiện tại
    private currentLevelIndex: number = 0; // Level hiện tại (0 = Level 1)
    private totalLevels: number = 0; // Tổng số level = 3 

    constructor() {
        super(SceneKeys.Scene1);
    }

    init(data?: { isRestart: boolean; fromEndGame?: boolean }) {
        resetVoiceState();
        
        // Reset các trạng thái logic
        this.isIntroActive = false;
        this.activeHintTween = null;
        this.activeHintTarget = null;
        
        // Reset multi-level state
        this.levelConfigs = [];
        this.currentLevelConfig = null;
        this.currentLevelIndex = 0;
        this.totalLevels = 0;

        if (data?.isRestart) {
            this.__sdkFinalizeAsQuit();
            this.runSeq += 1;
            this.itemSeq = 0;

            this.isWaitingForIntroStart = false;
            // Nếu không phải restart từ màn hình kết thúc (mà là nút replay trong game), gọi SDK retry
            if (!data.fromEndGame) {
                game.retryFromStart(); 
            }
        } else {
            this.isWaitingForIntroStart = true;
        }
    }

    create() {
        showGameButtons();
        
        this.setupSystem();
        this.setupBackgroundAndAudio();
        this.createUI();

        // 4. Load All Level Configs
        this.levelConfigs = this.cache.json.get(DataKeys.LevelS1Config);
        this.totalLevels = this.levelConfigs.length; // = 3
        console.log(`[Scene1] Tổng số level: ${this.totalLevels}`);

        // Tích hợp SDK
        game.setTotal(this.totalLevels);
        (window as any).irukaGameState = {
            startTime: Date.now(),
            currentScore: 0,
        };
        sdk.score(0, this.totalLevels);
        sdk.progress({ levelIndex: 0, total: this.totalLevels });
        game.startQuestionTimer();
        
        // Load level đầu tiên (Level 1)
        this.loadLevel(0);

        // create() sau spawn -> init item
        // Lưu ý: loadLevel đã gọi spawnObjectsFromConfig và __sdkInitCircleSelectItem rồi
        // Nhưng nếu loadLevel(0) được gọi TRƯỚC khi setupInput thì ok.

        this.setupInput();

        // Nếu là restart (không cần chờ tap), chạy intro luôn
        if (!this.isWaitingForIntroStart) {
            const soundManager = this.sound as Phaser.Sound.WebAudioSoundManager;
            if (soundManager.context && soundManager.context.state === 'suspended') {
                soundManager.context.resume();
            }
            this.playIntroSequence();
        }

        // 6. Khởi chạy UI Overlay
        if (!this.scene.get(SceneKeys.UI).scene.isActive()) {
            this.scene.launch(SceneKeys.UI, { sceneKey: SceneKeys.Scene1 });
            this.scene.bringToTop(SceneKeys.UI);
        }
    }

    update(time: number, delta: number) {
        if (this.idleManager) {
            this.idleManager.update(delta);
        }
    }

    shutdown() {
        // 1. Dọn dẹp Âm thanh
        if (this.bgm) {
            this.bgm.stop();
        }
        // Dừng tất cả âm thanh SFX khác đang chạy qua Howler
        AudioManager.stopAll();

        // 2. Dọn dẹp Managers
        if (this.lassoManager) {
            this.lassoManager.disable();
             // Nếu có hàm destroy thì gọi luôn tại đây để chắc chắn
        }
        if (this.idleManager) {
            this.idleManager.stop();
        }
        
        // Reset tham chiếu
        this.activeHintTarget = null;
        this.activeHintTween = null;

        // 3. Dọn dẹp hệ thống
        this.tweens.killAll(); // Dừng mọi animation đang chạy
        this.input.off('pointerdown'); // Gỡ bỏ sự kiện ở Scene context
        
        // 4. Xóa tham chiếu global
        if (window.gameScene === this) {
            window.gameScene = undefined;
        }

        // 5. Dọn dẹp SDK
        this.__sdkFinalizeAsQuit();

        console.log("Scene1: Đã dọn dẹp tài nguyên.");
    }

    // =================================================================
    // PHẦN 1: CÀI ĐẶT HỆ THỐNG (SYSTEM SETUP)
    // =================================================================

    private setupSystem() {
        resetVoiceState();
        (window as any).gameScene = this;
        setGameSceneReference(this);

        this.lassoManager = new LassoManager(this);
        this.lassoManager.onLassoComplete = (polygon: Phaser.Geom.Polygon) => {
            this.handleLassoSelection(polygon);
        };

        this.objectManager = new ObjectManager(this);

        this.idleManager = new IdleManager(GameConstants.IDLE.THRESHOLD, () => {
            this.showHint();
        });
    }

    private setupInput() {
        this.input.on('pointerdown', () => {
            if (this.isWaitingForIntroStart) {
                this.isWaitingForIntroStart = false;
                
                const soundManager = this.sound as Phaser.Sound.WebAudioSoundManager;
                if (soundManager.context && soundManager.context.state === 'suspended') {
                    soundManager.context.resume();
                }

                this.playIntroSequence();
                return;
            }

            this.idleManager.reset();
            this.stopIntro();
            this.stopActiveHint();

            // SDK Stroke Start
            console.log(`[SDK Stroke] ⏱️ START at ${Date.now()}`);
            this.circleTracker?.onStrokeStart?.(Date.now());
        });
    }

    private setupBackgroundAndAudio() {
        // 1. Đổi Background
        changeBackground('assets/images/bg/background.jpg');

        // 2. Phát nhạc nền (BGM)
        if (this.sound.get(AudioKeys.BgmNen)) {
            this.sound.stopByKey(AudioKeys.BgmNen);
        }
        this.bgm = this.sound.add(AudioKeys.BgmNen, {
            loop: true,
            volume: 0.25,
        });
        this.bgm.play();
    }

    public restartIntro() {
        this.stopIntro();
        this.time.delayedCall(GameConstants.SCENE1.TIMING.RESTART_INTRO, () =>
            this.playIntroSequence()
        );
    }

    private playIntroSequence() {
        this.isIntroActive = true;
        
        // Sử dụng hàm playVoiceLocked nếu có (từ utils/rotateOrientation), hoặc fallback
        playVoiceLocked(this.sound, AudioKeys.VoiceIntro);

        // Nếu là restart, không cần delay intro quá lâu (hoặc 0)
        const delay = this.isWaitingForIntroStart ? GameConstants.SCENE1.TIMING.INTRO_DELAY : 500;

        // Đợi 1 chút rồi chạy animation tay hướng dẫn
        this.time.delayedCall(delay, () => {
            if (this.isIntroActive) {
               this.setupGameplay(); // Kích hoạt gameplay (enable lasso)
               this.runHandTutorial();
            }
        });
    }

    private stopIntro() {
        this.isIntroActive = false;
        this.idleManager.start();

        if (this.uiScene && this.uiScene.handHint) {
            this.uiScene.handHint.setAlpha(0).setPosition(-200, -200);
            this.tweens.killTweensOf(this.uiScene.handHint);
        }
    }

    // =================================================================
    // PHẦN 2: TẠO GIAO DIỆN & LEVEL (UI & LEVEL CREATION)
    // =================================================================

    private createUI() {
        const UI = GameConstants.SCENE1.UI;
        const cx = GameUtils.pctX(this, 0.5);
        
        // Banner Config
        const bannerTexture = this.textures.get(TextureKeys.S1_Banner);
        let bannerHeight = 100;
        if (bannerTexture && bannerTexture.key !== '__MISSING') {
            bannerHeight = bannerTexture.getSourceImage().height * 0.7;
        }
        const boardY = bannerHeight + GameUtils.pctY(this, UI.BOARD_OFFSET);

        // bảng
        const board = this.add.image(cx, boardY, TextureKeys.S1_Board)
            .setOrigin(0.5, 0).setScale(0.7).setDepth(0);
    
        // ảnh topic
        this.add.image(cx, boardY + 10, TextureKeys.imgTopic)
            .setOrigin(0.5, 0).setScale(0.7).setDepth(0);
        
        // frame đáp án
        this.add.image(cx + 95, boardY * 5.85, TextureKeys.frameAns)
            .setOrigin(0.5, 0).setScale(0.6).setDepth(0);
        
        // Tính toán bounds của board (giới hạn vẽ lasso)
        const boardWidth = board.displayWidth;
        const boardHeight = board.displayHeight;
        const boardX = board.x - boardWidth / 2;  // origin(0.5, 0) -> tâm ngang, đỉnh trên
        const boardY_start = board.y;             // Vị trí y bắt đầu từ đỉnh
        const boardBounds = new Phaser.Geom.Rectangle(boardX, boardY_start, boardWidth, boardHeight);
        
        // Truyền bounds vào LassoManager
        this.lassoManager.setBoardBounds(boardBounds);
        
        console.log(`Board Bounds: x=${boardX}, y=${boardY_start}, w=${boardWidth}, h=${boardHeight}`);
    }

    // =================================================================
    // PHẦN 3: LOGIC GAMEPLAY (GAMEPLAY LOGIC)
    // =================================================================
    
    private setupGameplay() {
        // Đợi một chút rồi mới cho phép chơi (để nghe intro hoặc chuẩn bị)
        // Nếu restart thì delay ngắn hơn hoặc 0
        const delay = this.isWaitingForIntroStart ? GameConstants.SCENE1.TIMING.GAME_START_DELAY : 0;
        
        this.time.delayedCall(delay, () => {
            // Kích hoạt tính năng vẽ Lasso
            this.lassoManager.enable();
            
            // Nếu đang intro, stopIntro() sẽ start IdleManager sau khi user chạm
            if (!this.isIntroActive) {
                this.idleManager.start();
                console.log("IdleManager started (no intro).");
            } else {
                console.log("IdleManager NOT started (intro active, will start on stopIntro).");
            }
            
            console.log("Gameplay enabled after delay.");
        });

        // Khi người chơi chạm vào màn hình -> Reset Idle + Ẩn gợi ý
        this.input.on('pointerdown', () => {
            // Chỉ reset khi game đã bắt đầu (IdleManager đã chạy)
            this.idleManager.reset();
            this.stopActiveHint();
        });
    }

    private handleLassoSelection(polygon: Phaser.Geom.Polygon) {
        // 1. Kiểm tra vùng chọn bằng Utility Class
        const result = LassoValidation.validateSelection(polygon, this.objectManager);
        
        const selectedObjects = result.selectedObjects;
        const isSuccess = result.success;
        const failureReason = result.failureReason;

        const path_length_px = this.lassoManager.getPathLengthPx();
        const ts = Date.now();

        // 1. Lấy ID các vật đã khoanh trúng
        // Filter bỏ question object nếu có
        const enclosed_ids = (result.selectedObjects ?? [])
            .filter((obj: any) => obj.getData('type') !== 'question')
            .map((obj: any, idx: number) => {
                const id = obj.getData('id');
                return id ? id : `obj_${idx}`;
            });

        // 2. Giả lập ratio
        const enclosure_ratio: Record<string, number> = {};
        for (const id of enclosed_ids) enclosure_ratio[id] = 1;

        // 3. Gửi kết quả cho SDK (LUÔN GỌI dù đúng hay sai)
        console.log(`[SDK Stroke] 🛑 END with:`, { enclosed_ids, isSuccess, ts });
        this.circleTracker?.onStrokeEnd?.(
            { 
                path_length_px: path_length_px,
                enclosed_ids, 
                enclosure_ratio 
            },
            ts,
            isSuccess ? { isCorrect: true, errorCode: null } : { isCorrect: false, errorCode: "WRONG_TARGET" as any }
        );
        console.log(`[SDK Stroke] ✅ onStrokeEnd called`);

        // Phải chọn đúng 1 object
        if (!isSuccess || selectedObjects.length !== 1) {
            console.log(`❌ Khoanh SAI: ${failureReason}`);
            this.onWrongAnswer();
            return;
        }

        const target = selectedObjects[0] as Phaser.GameObjects.Image;
        
        // LOGIC MỚI: Kiểm tra trực tiếp trên object
        const objectId = this.objectManager.getObjectId(target);
        const objectType = target.getData('type');

        // Bỏ qua nếu lasso vào question (đề bài)
        if (objectType === 'question') {
            console.log("⚠️ Lasso vào question, bỏ qua.");
            return;
        }

        if (this.objectManager.isCorrectAnswer(target)) {
            // ✅ ĐÚNG
            this.onCorrectAnswer(target);
            const randomSFX = Phaser.Math.Between(1, 4);
            AudioManager.play(`sfx-${randomSFX}`);
        } else {
            // ❌ SAI
            console.log(`❌ Khoanh SAI: Chọn ${objectId} nhưng không phải đáp án đúng`);
            this.onWrongAnswer();
        }
    }

    /**
     * Xử lý khi người chơi khoanh ĐÚNG
     */
    private onCorrectAnswer(target: Phaser.GameObjects.Image) {
        console.log("✅ Khoanh ĐÚNG!");
        
        // Xóa nét vẽ lasso
        this.lassoManager.clear();

        // Xóa vòng tròn cũ (nếu có)
        if (this.correctCircleGraphics) {
            this.correctCircleGraphics.destroy();
            this.correctCircleGraphics = null;
        }

        // Vẽ vòng tròn xanh mới
        this.correctCircleGraphics = this.add.graphics();
        this.correctCircleGraphics.setDepth(100);
        this.correctCircleGraphics.lineStyle(10, 0x00ff00);
        const radius = (Math.max(target.displayWidth, target.displayHeight) / 2) * 1.3;
        this.correctCircleGraphics.strokeCircle(target.x, target.y, radius);

        // SFX
        AudioManager.stopAll();
        AudioManager.play("sfx-ting");
        
        // Visual feedback
        this.objectManager.highlightObjects([target], true);
        this.stopActiveHint();
        
        // SDK tracking
        game.recordCorrect({ scoreDelta: 1 });
        sdk.score(this.currentLevelIndex + 1, this.totalLevels);

        // Disable input
        this.lassoManager.disable();

        // Delay rồi chuyển level hoặc kết thúc
        this.time.delayedCall(1500, () => {
            const nextLevelIndex = this.currentLevelIndex + 1;
            
            if (nextLevelIndex >= this.totalLevels) {
                // ✅ Hoàn thành tất cả level - Finalize sẽ gọi trong onGameComplete()
                console.log(`[SDK Finalize] 🎉 All levels complete, moving to onGameComplete...`);
                this.onGameComplete();
            } else {
                // ✅ Chuyển level tiếp theo - Finalize item hiện tại trước
                console.log(`[SDK Finalize] ➡️ Level ${nextLevelIndex + 1}, finalizing current item...`);
                this.circleTracker?.finalize?.();
                this.circleTracker = null;

                // Chuyển level tiếp theo
                this.loadLevel(nextLevelIndex);
                this.lassoManager.enable();
            }
        });
    }

    /**
     * Xử lý khi người chơi khoanh SAI
     */
    private onWrongAnswer() {
        // Shake tất cả objects
        const allObjects = this.objectManager.getAllObjects();
        allObjects.forEach(obj => {
            this.tweens.add({
                targets: obj,
                x: obj.x + 10,
                duration: 50,
                yoyo: true,
                repeat: 3,
                ease: 'Linear'
            });
        });
        
        // SFX
        AudioManager.play("sfx-wrong");
        game.recordWrong();
        
        // Cooldown
        this.lassoManager.disable();
        this.time.delayedCall(500, () => {
            this.lassoManager.enable();
        });
    }

    /**
     * Xử lý khi hoàn thành game (3 level)
     */
    private onGameComplete() {
        console.log(`[SDK Finalize] 🎉 Final level complete, finalizing...`);
        console.log("🎉 HOÀN THÀNH TẤT CẢ LEVEL!");
        AudioManager.stopAll();
        // AudioManager.play("sfx-correct");

        // SDK finalize
        this.circleTracker?.finalize?.();
        this.circleTracker = null;
        game.finalizeAttempt();
        game.finishQuestionTimer();

        // Chuyển màn EndGame
        this.time.delayedCall(GameConstants.SCENE1.TIMING.WIN_DELAY, () => {
            this.scene.stop(SceneKeys.UI);
            this.scene.start(SceneKeys.EndGame);
        });
    }

    /**
     * Load level mới
     * @param levelIndex Index của level (0-based)
     */
    private loadLevel(levelIndex: number) {
        if (levelIndex >= this.totalLevels) {
            console.warn(`[loadLevel] Index ${levelIndex} vượt quá total ${this.totalLevels}`);
            return;
        }

        // Dừng mọi audio cũ và reset voice state để voice intro không bị chặn
        AudioManager.stopAll();
        resetVoiceState();
        
        // Phát voice intro cho level mới
        playVoiceLocked(this.sound, AudioKeys.VoiceIntro);

        // Xóa vòng tròn xanh từ level trước (nếu có)
        if (this.correctCircleGraphics) {
            this.correctCircleGraphics.destroy();
            this.correctCircleGraphics = null;
        }

        // Xóa objects cũ
        this.objectManager.clearAllObjects();

        // Load config level mới
        this.currentLevelIndex = levelIndex;
        this.currentLevelConfig = this.levelConfigs[levelIndex];

        console.log(`📌 Load Level ${levelIndex + 1}/${this.totalLevels}`, this.currentLevelConfig);

        // Spawn 2 objects (left/right)
        this.objectManager.spawnObjectsFromConfig([this.currentLevelConfig]);

        // SDK Tạo tracker mới cho mỗi level
        this.__sdkInitCircleSelectItem();

        // Cập nhật SDK progress
        sdk.progress({ 
            levelIndex: this.currentLevelIndex, 
            total: this.totalLevels 
        });

        // Reset idle + hint
        this.idleManager.reset();
        this.stopActiveHint();
    }

    // =================================================================
    // PHẦN 4: HƯỚNG DẪN & GỢI Ý (TUTORIAL & HINT)
    // =================================================================
    /**
     * Tutorial đầu game: Hiển thị gợi ý bàn tay xoay vòng tròn
     * tay khoanh tròn mẫu quanh đáp án đúng
     */
    private runHandTutorial() {
        if (!this.isIntroActive) return;

        // 1. Tìm object đúng bất kỳ để hướng dẫn
        const correctTarget = this.objectManager.getAllObjects().find(obj => this.objectManager.isCorrectAnswer(obj));
        if (!correctTarget) return;

        const image = correctTarget as Phaser.GameObjects.Image;
        const radius = (Math.max(image.displayWidth, image.displayHeight) / 2) * 0.8;

        // 2. Lấy bàn tay từ UIScene
        const handHint = this.uiScene.handHint;
        if (!handHint) return;

        handHint.setVisible(true);
        handHint.setAlpha(0);
        handHint.setOrigin(0.1, 0.1);

        const circleData = { angle: 0 };
        const startX = image.x + radius * Math.cos(-Phaser.Math.PI2 / 4);
        const startY = image.y + radius * Math.sin(-Phaser.Math.PI2 / 4);
        
        // Vì UIScene nằm đè lên Scene1 và toạ độ màn hình tương đương
        handHint.setPosition(startX, startY);

        // Tween hiện và xoay
        handHint.setAlpha(1);
        
        // ⭐ Lưu reference để stopIntro có thể cleanup đúng (fix giật hình)
        this.activeCircleTween = this.tweens.add({
            targets: circleData,
            angle: Phaser.Math.PI2,
            duration: 2000,
            repeat: -1, // Lặp vô hạn cho đến khi dừng Intro
            onUpdate: () => {
                const a = circleData.angle - Phaser.Math.PI2 / 4; 
                handHint.x = image.x + radius * Math.cos(a);
                handHint.y = image.y + radius * Math.sin(a);
            },
        });
    }

    /**
     * Gợi ý khi rảnh (Idle Hint)
     */
    private showHint() {
        // Cleanup animation cũ TRƯỚC KHI tạo hint mới (fix giật hình)
        this.stopActiveHint();
        
        game.addHint();
        console.log(`[SDK Hint] 💡 Hint shown`);
        this.circleTracker?.hint?.(1);
        console.log(`[SDK Hint] ✅ Tracker.hint(1) called`);
        
        // Tìm object đúng của level hiện tại
        const correctTarget = this.objectManager.getAllObjects().find(obj => 
            this.objectManager.isCorrectAnswer(obj)
        );

        if (!correctTarget) {
            console.warn("[showHint] Không tìm thấy object đúng!");
            return;
        }

        AudioManager.play('hint');

        // Visual 1: Nhấp nháy đối tượng đó
        this.activeHintTarget = correctTarget as Phaser.GameObjects.Image;
        this.activeHintTween = this.tweens.add({
            targets: this.activeHintTarget,
            scale: { from: this.activeHintTarget.scale, to: this.activeHintTarget.scale * 1.1 },
            duration: 500,
            yoyo: true,
            repeat: 2,
            onComplete: () => {
                this.activeHintTween = null;
                this.activeHintTarget = null;
                this.idleManager.reset();
            }
        });

        // Visual 2: Bàn tay chỉ vào (xoay tròn)
        const image = correctTarget as Phaser.GameObjects.Image;
        const radius = (Math.max(image.displayWidth, image.displayHeight) / 2) * 0.8;
        
        const handHint = this.uiScene.handHint;
        if (!handHint) return;

        // Tính vị trí bắt đầu
        const startX = image.x + radius * Math.cos(-Phaser.Math.PI2 / 4);
        const startY = image.y + radius * Math.sin(-Phaser.Math.PI2 / 4);

        // Đặt vị trí ban đầu với alpha = 0 và scale nhỏ để tạo hiệu ứng fade-in mượt mà
        handHint.setPosition(startX, startY)
            .setVisible(true)
            .setAlpha(0)
            .setScale(0.7)
            .setOrigin(0.1, 0.1);

        // Tween fade-in + scale-in để bàn tay xuất hiện mượt mà
        this.tweens.add({
            targets: handHint,
            alpha: 1,
            scale: 1,
            duration: 400,
            ease: 'Cubic.easeOut',
            onComplete: () => {
                // Sau khi fade-in xong, bắt đầu animation xoay tròn
                const circleData = { angle: 0 };
                // ⭐ Lưu reference để có thể cleanup sau (fix giật hình)
                this.activeCircleTween = this.tweens.add({
                    targets: circleData,
                    angle: Phaser.Math.PI2,
                    duration: 2000,
                    repeat: 1, 
                    onUpdate: () => {
                        const a = circleData.angle - Phaser.Math.PI2 / 4;
                        handHint.x = image.x + radius * Math.cos(a);
                        handHint.y = image.y + radius * Math.sin(a);
                    },
                    onComplete: () => {
                        this.activeCircleTween = null;
                        this.stopActiveHint();
                        this.idleManager.start();
                    }
                });
            }
        });
    }

    private stopActiveHint() {
        // 1. Dừng tween scale của target object
        if (this.activeHintTween) {
            this.activeHintTween.stop();
            this.activeHintTween = null;
        }

        // 2. Reset scale của target
        if (this.activeHintTarget) {
            this.tweens.killTweensOf(this.activeHintTarget);
            this.activeHintTarget.setScale(this.activeHintTarget.scale);
            this.activeHintTarget = null;
        }

        // 3. ⭐ QUAN TRỌNG: Dừng tween xoay tròn (fix giật hình)
        if (this.activeCircleTween) {
            this.activeCircleTween.stop();
            this.activeCircleTween = null;
        }

        // 4. Cleanup handHint UI
        if (this.uiScene && this.uiScene.handHint) {
            this.tweens.killTweensOf(this.uiScene.handHint); // Dừng fade-in/scale-in
            this.uiScene.handHint.setVisible(false);
            this.uiScene.handHint.setAlpha(0);
        }
    }

    // =============================================
    // Phần 5: SDK
    // =============================================

    // Hàm khởi tạo 1 câu hỏi
    private __sdkInitCircleSelectItem() {
        this.__sdkFinalizeAsQuit();
        this.itemSeq += 1;

        const allObjects = this.objectManager.getAllObjects();
        
        // Lấy danh sách selectables (bỏ qua question, dùng id)
        const selectables = allObjects
            .filter(obj => obj.getData('type') !== 'question')
            .map((obj, idx) => {
                const id = obj.getData('id');
                return id ? id : `obj_${idx}`;
            });

        // Tìm các object đúng
        const correctObjs = allObjects.filter(obj => 
            this.objectManager.isCorrectAnswer(obj)
        );
        
        const correct_targets = correctObjs.map(obj => obj.getData('id'));

        console.log(`[SDK Init] Level ${this.currentLevelIndex + 1}`);
        console.log(`  ✅ Selectables:`, selectables);
        console.log(`  🎯 Correct Targets:`, correct_targets);

        // Cast game to any to avoid type error with version mismatch or missing type def
        this.circleTracker = (game as any).createCircleSelectTracker({
            meta: {
                item_id: `CIRCLE_SELECT_L${this.currentLevelIndex + 1}_${this.itemSeq}`,
                item_type: "circle_select",
                seq: this.itemSeq,
                run_seq: this.runSeq,
                difficulty: 1,
                scene_id: "SCN_CIRCLE_01",
                scene_seq: 1,
                scene_type: "circle_select",
                skill_ids: ["khoanh_chon_34_math_004"],
            },
            expected: {
                selectables,
                correct_targets,
                min_enclosure_ratio: 0.8,
            },
        });
        console.log(`[SDK Init] Tracker created: itemSeq=${this.itemSeq}, runSeq=${this.runSeq}`);
    }

    // Hàm đóng tracker khi người chơi quit hoặc restart
    private __sdkFinalizeAsQuit() {
        const ts = Date.now();
        if (this.circleTracker) {
            console.log(`[SDK Finalize] 🚪 Quitting item...`);
            this.circleTracker.onQuit?.(ts);
            const result = this.circleTracker.finalize?.();
            console.log(`[SDK Output] 📊 Item Result:`, JSON.stringify(result, null, 2));
        }
        this.circleTracker = null;
    }
}
