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

    // Logic mới cho "Tìm tất cả" (Find All)
    private foundTargets: number[] = [];
    private totalTargets: number = 0;
    private currentLevelIndex: number = 0; 

    constructor() {
        super(SceneKeys.Scene1);
    }

    init(data?: { isRestart: boolean; fromEndGame?: boolean }) {
        resetVoiceState();
        
        // Reset các trạng thái logic
        this.isIntroActive = false;
        this.activeHintTween = null;
        this.activeHintTarget = null;
        
        this.foundTargets = [];
        this.totalTargets = 0;
        this.currentLevelIndex = 0;

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

        // 4. Tải dữ liệu Level & Spawn Objects
        const levelConfig = this.cache.json.get(DataKeys.LevelS1Config);
        this.objectManager.spawnObjectsFromConfig(levelConfig);
        
        // Đếm tổng số mục tiêu đúng cần tìm
        this.totalTargets = this.objectManager.getAllObjects().filter(obj => this.objectManager.isCorrectAnswer(obj)).length;
        console.log(`[Scene1] Tổng số mục tiêu cần tìm: ${this.totalTargets}`);

        // Tích hợp SDK
        // SDK Init
        this.__sdkInitCircleSelectItem();

        game.setTotal(this.totalTargets);
        (window as any).irukaGameState = {
            startTime: Date.now(),
            currentScore: 0,
        };
        sdk.score(0, this.totalTargets);
        sdk.progress({ levelIndex: 0, total: this.totalTargets });
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

            // SDK Stroke Start
            console.log(`[SDK Stroke] ⏱️ START at ${Date.now()}`);
            this.circleTracker?.onStrokeStart?.(Date.now());

            this.idleManager.reset();
            this.stopIntro();
            this.stopActiveHint();
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
        
        const scl = [1, 0.72];
        
        // Bảng (Board)
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

        // 1. Lấy ID các vật đã khoanh trúng (dùng index làm ID vì game logic dùng index)
        const allObjects = this.objectManager.getAllObjects();
        const enclosed_ids = (result.selectedObjects ?? [])
            .map((obj: any) => {
                const idx = allObjects.indexOf(obj);
                return `obj_${idx}`;
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

        if (isSuccess && selectedObjects.length === 1) {
            const target = selectedObjects[0] as Phaser.GameObjects.Image;
            
            // Xử lý ID: dùng index trong mảng objects để làm ID vì ObjectManager không set ID
            const idx = this.objectManager.getAllObjects().indexOf(target);
            
             // Kiểm tra nếu đã khoanh rồi
            if (this.foundTargets.includes(idx)) {
                console.log("⚠️ Hình này đã khoanh rồi!");
                return;
            }

            // --- TRƯỜNG HỢP ĐÚNG (SUCCESS) ---
            
            // Xóa nét vẽ lasso của user trước khi hiện vòng tròn đúng
            this.lassoManager.clear();

            // Vẽ vòng tròn bao quanh hình đúng
            const graphics = this.add.graphics();
            graphics.setDepth(100); 
            graphics.lineStyle(10, 0x00ff00); // Nét, dày 10px
            const radius = (Math.max(target.displayWidth, target.displayHeight) / 2) * 1;
            graphics.strokeCircle(target.x, target.y, radius);

            AudioManager.stopAll();
            console.log("✅ Khoanh ĐÚNG!");
            AudioManager.play("sfx-ting");
            
            this.objectManager.highlightObjects([target], true);
            this.foundTargets.push(idx);
            
            // Ẩn gợi ý nếu đang hiện
            this.stopActiveHint();
            
            // Ghi nhận điểm SDK
            this.currentLevelIndex += 1;
            game.recordCorrect({ scoreDelta: 1 });
            sdk.score(this.foundTargets.length, this.totalTargets);
            sdk.progress({ levelIndex: this.currentLevelIndex, total: this.totalTargets, score: this.foundTargets.length });

            // Kiểm tra điều kiện thắng (Tìm hết)
            if (this.foundTargets.length >= this.totalTargets) {
                console.log("🎉 VICTORY! Found all targets.");
                AudioManager.play("sfx-correct"); // Âm thanh thắng chung cuộc

                // Vô hiệu hóa input
                this.lassoManager.disable();

                // --- GAME HUB COMPLETE ---
                console.log(`[SDK Finalize] 🎉 All targets found, finalizing...`);
                this.circleTracker?.finalize?.();
                this.circleTracker = null;

                game.finalizeAttempt();
                game.finishQuestionTimer(); 

                // Đợi WIN_DELAY rồi chuyển cảnh
                const t = GameConstants.SCENE1.TIMING.WIN_DELAY;
                this.time.delayedCall(t, () => {
                    this.scene.stop(SceneKeys.UI);
                    this.scene.start(SceneKeys.EndGame);
                });
            } else {
                console.log(`👍 Found ${this.foundTargets.length}/${this.totalTargets}. Keep going!`);
            }

        } else {
            // --- TRƯỜNG HỢP SAI (FAILURE) ---
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
            
            // Cooldown: Phạt người chơi đợi một chút
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
        // ⭐ Cleanup animation cũ TRƯỚC KHI tạo hint mới (fix giật hình)
        this.stopActiveHint();
        
        this.stopActiveHint();
        
        game.addHint();
        console.log(`[SDK Hint] 💡 Hint shown`);
        this.circleTracker?.hint?.(1);
        // Tìm các object đúng mà chưa được khoanh
        const allCorrectAndUnfound = this.objectManager.getAllObjects().filter(obj => 
            this.objectManager.isCorrectAnswer(obj) && 
            !this.foundTargets.includes(this.objectManager.getAllObjects().indexOf(obj))
        );

        if (allCorrectAndUnfound.length === 0) return;

        // Chọn ngẫu nhiên 1 cái
        const correctTarget = Phaser.Utils.Array.GetRandom(allCorrectAndUnfound); 

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

    private __sdkInitCircleSelectItem() {
        this.__sdkFinalizeAsQuit();
        this.itemSeq += 1;

        const allObjects = this.objectManager.getAllObjects();
        
        // Selectables: Map to "obj_i"
        const selectables = allObjects.map((_, idx) => `obj_${idx}`);

        // Correct targets (Find All)
        // Filter objects that are correct, then map to their index IDs
        const correct_targets = allObjects
            .map((obj, idx) => ({ obj, idx }))
            .filter(({ obj }) => this.objectManager.isCorrectAnswer(obj))
            .map(({ idx }) => `obj_${idx}`);

        console.log(`[SDK Init] Item Seq: ${this.itemSeq}`);
        console.log(`  ✅ Selectables:`, selectables);
        console.log(`  🎯 Correct Targets:`, correct_targets);

        // Cast game to any to avoid type error
        this.circleTracker = (game as any).createCircleSelectTracker({
            meta: {
                item_id: `CIRCLE_SELECT_SO_4_${this.itemSeq}`,
                item_type: "circle_select",
                seq: this.itemSeq,
                run_seq: this.runSeq,
                difficulty: 1,
                scene_id: "SCN_CIRCLE_SO_4",
                scene_seq: 1,
                scene_type: "circle_select",
                skill_ids: ["khoanh_so_4_math_001"],
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
