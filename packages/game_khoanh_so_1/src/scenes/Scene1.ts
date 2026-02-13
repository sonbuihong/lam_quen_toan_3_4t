import Phaser from 'phaser';
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

    // Logic States
    private isIntroductionPlayed: boolean = false;
    private idleManager!: IdleManager;
    private handHint!: Phaser.GameObjects.Image;
    private isWaitingForIntroStart: boolean = true;
    
    // SDK theo dõi trạng thái
    private runSeq = 1;
    private itemSeq = 0;
    private circleTracker: any = null;

    
    // Tutorial & Hint States
    private isIntroActive: boolean = false;
    private activeHintTween: Phaser.Tweens.Tween | null = null;
    private activeHintTarget: Phaser.GameObjects.Image | null = null;

    constructor() {
        super(SceneKeys.Scene1);
    }

    init(data?: { isRestart: boolean; fromEndGame?: boolean }) {
        resetVoiceState();
        
        // Reset Logic States
        this.isIntroActive = false;
        this.activeHintTween = null;
        this.activeHintTarget = null;
        this.handHint = undefined as any; // Force reset reference

        if (data?.isRestart) {
            this.__sdkFinalizeAsQuit();
            this.runSeq += 1;
            this.itemSeq = 0;

            this.isWaitingForIntroStart = false;
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

        // 4. Load Level Data & Spawn Objects
        const levelConfig = this.cache.json.get(DataKeys.LevelS1Config);
        this.objectManager.spawnObjectsFromConfig(levelConfig);

        this.objectManager.spawnObjectsFromConfig(levelConfig);

        // SDK Init
        this.__sdkInitCircleSelectItem();
        
        game.setTotal(1);
        (window as any).irukaGameState = {
            startTime: Date.now(),
            currentScore: 0,
        };
        sdk.score(0, 1);
        sdk.progress({ levelIndex: 0, total: 1 });
        game.startQuestionTimer();

        this.setupInput();

        // Nếu là restart (không cần chờ tap), chạy intro luôn
        if (!this.isWaitingForIntroStart) {
            const soundManager = this.sound as Phaser.Sound.WebAudioSoundManager;
            if (soundManager.context && soundManager.context.state === 'suspended') {
                soundManager.context.resume();
            }
            this.playIntroSequence();
        }

        // 6. Launch UI Overlay
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
        // 1. Dọn dẹp Âm thanh (Audio Cleanup)
        if (this.bgm) {
            this.bgm.stop();
        }
        // Dừng tất cả âm thanh SFX khác đang chạy qua Howler
        AudioManager.stopAll();

        // 2. Dọn dẹp Managers (Managers Cleanup)
        if (this.lassoManager) {
            this.lassoManager.disable();
             // Nếu có hàm destroy thì gọi luôn tại đây để chắc chắn
        }
        if (this.idleManager) {
            this.idleManager.stop();
        }
        
        // Reset references to destroyed objects
        this.handHint = undefined as any;
        this.activeHintTarget = null;
        this.activeHintTween = null;

        // 3. Dọn dẹp hệ thống (System Cleanup)
        this.tweens.killAll(); // Dừng mọi animation đang chạy
        this.input.off('pointerdown'); // Gỡ bỏ sự kiện ở Scene context
        
        // 4. Xóa tham chiếu global (Global References Cleanup)
        if (window.gameScene === this) {
            window.gameScene = undefined;
        }

        // 5. Dọn dẹp SDK
        this.__sdkFinalizeAsQuit();

        console.log("Scene1: Shutdown completed. Resources cleaned up.");
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

        // Đợi 1 chút rồi chạy animation tay hướng dẫn
        this.time.delayedCall(GameConstants.SCENE1.TIMING.INTRO_DELAY, () => {
            if (this.isIntroActive) {
               this.setupGameplay(); // Kích hoạt gameplay (enable lasso)
               this.runHandTutorial();
            }
        });
    }

    private stopIntro() {
        this.isIntroActive = false;
        this.idleManager.start();

        if (this.handHint) {
            this.handHint.setAlpha(0).setPosition(-200, -200);
            this.tweens.killTweensOf(this.handHint);
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
        
        const scl = [1, 0.72];
        
        // Board
        const board = this.add.image(cx, boardY, TextureKeys.S1_Board)
            .setOrigin(0.5, 0)
            .setScale(scl[0], scl[1])
            .setDepth(0);
            
        board.displayWidth = GameUtils.getW(this) * 0.93;
        // Giữ tỉ lệ đơn giản, có thể chỉnh lại scale sau
        
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
        const delay = GameConstants.SCENE1.TIMING.GAME_START_DELAY;
        
        this.time.delayedCall(delay, () => {
            // Kích hoạt tính năng vẽ Lasso
            this.lassoManager.enable();
            
            // Bắt đầu đếm Idle ngay khi vào game (hoặc sau intro)
            this.idleManager.start();
            
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
        // 1. Validate Selection using Utility Class
        const result = LassoValidation.validateSelection(polygon, this.objectManager);
        
        const selectedObjects = result.selectedObjects;
        const isSuccess = result.success;
        const failureReason = result.failureReason;

        const path_length_px = this.lassoManager.getPathLengthPx();
        const ts = Date.now();

        // 1. Lấy ID các vật đã khoanh trúng
        const enclosed_ids = (result.selectedObjects ?? [])
            .map((obj: any, idx: number) => {
                const id = obj.getData('textureKey'); // Dùng textureKey làm ID cho game này
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

        if (isSuccess) {
            // --- SUCCESS CASE ---
            // Vẽ vòng tròn bao quanh hình đúng
            const graphics = this.add.graphics();
            graphics.lineStyle(10, 0x00ff00); // Nét, dày 10px

            selectedObjects.forEach(obj => {
                const image = obj as Phaser.GameObjects.Image;
                const radius = (Math.max(image.displayWidth, image.displayHeight) / 2) * 1.5;
                graphics.strokeCircle(image.x, image.y, radius);
            });

            console.log("✅ Khoanh ĐÚNG!");
            AudioManager.play("sfx-correct");
            AudioManager.play("sfx-ting");
            this.objectManager.highlightObjects(selectedObjects as Phaser.GameObjects.Image[], true);
            
            // SDK: Record Score
            game.recordCorrect({ scoreDelta: 1 });
            sdk.score(1, 1);
            sdk.progress({ levelIndex: 0, total: 1, score: 1 });

            // Ẩn gợi ý nếu đang hiện
            this.stopActiveHint();
            
            // Vô hiệu hóa input để tránh spam
            this.lassoManager.disable();

            // --- GAME HUB COMPLETE ---
            // --- GAME HUB COMPLETE ---
            console.log(`[SDK Finalize] 🎉 Final level complete, finalizing...`);
            this.circleTracker?.finalize?.();
            this.circleTracker = null;
            game.finalizeAttempt();

            // Đợi WIN_DELAY rồi chuyển cảnh
            const t = GameConstants.SCENE1.TIMING.WIN_DELAY;
            this.time.delayedCall(t, () => {
                this.scene.stop(SceneKeys.UI);
                this.scene.start(SceneKeys.EndGame);
            });

        } else {
            // --- FAILURE CASE ---
            console.log(`❌ Khoanh SAI: ${failureReason}`);
            
            // Rung các hình ảnh
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
            
            AudioManager.play("sfx-wrong");
            game.recordWrong();
            // Cooldown: Phạt người chơi đợi 
            this.lassoManager.disable();
            
            this.time.delayedCall(500, () => {
                this.lassoManager.enable();
            });
        }
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

        // 1. Tìm quả bóng đúng
        const ball = this.objectManager.getAllObjects().find(obj => obj.texture.key === TextureKeys.S1_Ball);
        if (!ball) return;

        const image = ball as Phaser.GameObjects.Image;
        const radius = (Math.max(image.displayWidth, image.displayHeight) / 2) * 1.3;

        // 2. Tạo bàn tay (nếu chưa có)
        if (!this.handHint) {
            this.handHint = this.add.image(0, 0, TextureKeys.HandHint)
                .setDepth(100)
                .setOrigin(0.15, 0.15)
                .setVisible(false);
        }

        this.handHint.setVisible(true);
        this.handHint.setAlpha(0);

        const circleData = { angle: 0 };
        const startX = image.x + radius * Math.cos(-Phaser.Math.PI2 / 4);
        const startY = image.y + radius * Math.sin(-Phaser.Math.PI2 / 4);
        
        this.handHint.setPosition(startX, startY);

        const tweensChain: any[] = [];
        
        // 1. Hiện ra
        tweensChain.push({
            targets: this.handHint,
            alpha: 1,
            duration: 500
        });

        // 2. Xoay 2 vòng
        // REWRITE: Dùng logic đơn giản hơn cho Tutorial:
        // Move to start -> Fade In -> Circle Tween -> Fade Out -> Loop
        
        this.handHint.setAlpha(1);
        
        // Tween thay đổi góc
        this.tweens.add({
            targets: circleData,
            angle: Phaser.Math.PI2,
            duration: 2000,
            repeat: 1, 
            onUpdate: () => {
                const a = circleData.angle - Phaser.Math.PI2 / 4; 
                this.handHint.x = image.x + radius * Math.cos(a);
                this.handHint.y = image.y + radius * Math.sin(a);
            },
            onComplete: () => {
                // Sau khi xoay xong 2 vòng
                this.tweens.add({
                    targets: this.handHint,
                    alpha: 0,
                    duration: 500,
                    onComplete: () => {
                        this.handHint.setPosition(-200, -200);
                        // Lặp lại nếu Intro chưa kết thúc
                        if (this.isIntroActive) {
                            this.time.delayedCall(1000, () => {
                                circleData.angle = 0; // Reset angle
                                this.runHandTutorial();
                            });
                        }
                    }
                });
            }
        });
    }

    /**
     * Gợi ý khi rảnh (Idle Hint)
     */
    private showHint() {
        game.addHint();
        console.log(`[SDK Hint] 💡 Hint shown`);
        this.circleTracker?.hint?.(1);

        const ball = this.objectManager.getAllObjects().find(obj => obj.texture.key === TextureKeys.S1_Ball);
        if (!ball) return; 

        AudioManager.play('hint');

        // Visual 1: Nhấp nháy bộ phận đó
        this.activeHintTarget = ball as Phaser.GameObjects.Image;
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
        
        const image = ball as Phaser.GameObjects.Image;
        const radius = (Math.max(image.displayWidth, image.displayHeight) / 2) * 1.3;
        
        if (!this.handHint) {
            this.handHint = this.add.image(0, 0, TextureKeys.HandHint)
                .setDepth(100)
                .setOrigin(0.15, 0.15)
                .setVisible(false);
        }

        this.handHint.setVisible(true);
        this.handHint.setAlpha(1);

        const circleData = { angle: 0 };
        this.tweens.add({
            targets: circleData,
            angle: Phaser.Math.PI2,
            duration: 2000,
            repeat: 1, 
            onUpdate: () => {
                const a = circleData.angle - Phaser.Math.PI2 / 4; 
                this.handHint.x = image.x + radius * Math.cos(a);
                this.handHint.y = image.y + radius * Math.sin(a);
            },
            onComplete: () => {
                this.stopActiveHint();
                this.idleManager.start();
            }
        });
    }

    private stopActiveHint() {
        if (this.activeHintTween) {
            this.activeHintTween.stop();
            this.activeHintTween = null;
        }

        if (this.activeHintTarget) {
            this.tweens.killTweensOf(this.activeHintTarget);
            this.activeHintTarget.setScale(this.activeHintTarget.scale);
            this.activeHintTarget = null;
        }

        if (this.handHint) {
            this.handHint.setVisible(false);
            this.handHint.setAlpha(0);
            this.tweens.killTweensOf(this.handHint);
        }
    }


    // =============================================
    // Phần 5: SDK
    // =============================================

    private __sdkInitCircleSelectItem() {
        this.__sdkFinalizeAsQuit();
        this.itemSeq += 1;

        const allObjects = this.objectManager.getAllObjects();
        
        // Selectables: Tất cả các object
        const selectables = allObjects.map((obj, idx) => {
            const id = obj.getData('textureKey');
            return id ? id : `obj_${idx}`;
        });

        // Correct targets
        const correctObjs = allObjects.filter(obj => 
            this.objectManager.isCorrectAnswer(obj)
        );
        
        const correct_targets = correctObjs.map(obj => obj.getData('textureKey'));

        console.log(`[SDK Init] Item Seq: ${this.itemSeq}`);
        console.log(`  ✅ Selectables:`, selectables);
        console.log(`  🎯 Correct Targets:`, correct_targets);

        // Cast game to any to avoid type error
        this.circleTracker = (game as any).createCircleSelectTracker({
            meta: {
                item_id: `CIRCLE_SELECT_SO_1_${this.itemSeq}`,
                item_type: "circle_select",
                seq: this.itemSeq,
                run_seq: this.runSeq,
                difficulty: 1,
                scene_id: "SCN_CIRCLE_SO_1",
                scene_seq: 1,
                scene_type: "circle_select",
                skill_ids: ["khoanh_so_1_math_001"],
            },
            expected: {
                selectables,
                correct_targets,
                min_enclosure_ratio: 0.8,
            },
        });
        console.log(`[SDK Init] Tracker created: itemSeq=${this.itemSeq}, runSeq=${this.runSeq}`);
    }

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
