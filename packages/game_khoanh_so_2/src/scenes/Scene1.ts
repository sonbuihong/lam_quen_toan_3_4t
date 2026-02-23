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

    // Logic States
    private idleManager!: IdleManager;
    // private handHint!: Phaser.GameObjects.Image; // Removed local reference
    private isWaitingForIntroStart: boolean = true;
    private isGameplayStarted: boolean = false;

    // SDK theo dõi trạng thái
    private runSeq = 1;
    private itemSeq = 0;
    private circleTracker: any = null;

    
    // List lưu các mục tiêu chưa được khoanh (để random hint)
    private unfinishedTargets: Phaser.GameObjects.Image[] = [];
    
    // Lưu trữ graphics objects của vòng tròn xanh để xóa khi restart
    private greenCircleGraphics: Phaser.GameObjects.Graphics[] = [];

    private get uiScene(): UIScene {
        return this.scene.get(SceneKeys.UI) as UIScene;
    }
    
    // New Logic for "Find All"
    private foundTargets: number[] = [];
    private totalTargets: number = 0;
    private currentLevelIndex: number = 0;

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
        this.isGameplayStarted = false;
        this.activeHintTween = null;
        this.activeHintTarget = null;
        // this.handHint = undefined as any; // Force reset reference
        
        this.foundTargets = [];
        this.totalTargets = 0;
        this.currentLevelIndex = 0;
        this.unfinishedTargets = [];
        
        // Xóa tất cả vòng tròn xanh cũ
        this.greenCircleGraphics.forEach(g => g.destroy());
        this.greenCircleGraphics = [];

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

        this.events.once('shutdown', this.shutdown, this);
        
        this.setupSystem();
        this.setupBackgroundAndAudio();
        this.createUI();

        // 4. Load Level Data & Spawn Objects
        const levelConfig = this.cache.json.get(DataKeys.LevelS1Config);
        this.objectManager.spawnObjectsFromConfig(levelConfig);
        
        // Count total correct targets
        this.totalTargets = this.objectManager.getAllObjects().filter(obj => this.objectManager.isCorrectAnswer(obj)).length;
        console.log(`[Scene1] Total Targets to find: ${this.totalTargets}`);

        // SDK Integration
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

        // Khởi tạo danh sách chưa khoanh
        this.initUnfinishedTargets();

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
        // Audio KHÔNG dừng ở đây

        if (this.lassoManager) {
            this.lassoManager.disable();
        }
        if (this.objectManager) {
            this.objectManager.clearObjects();
        }
        if (this.idleManager) {
            this.idleManager.stop();
        }
        
        this.activeHintTarget = null;
        this.activeHintTween = null;
        
        this.greenCircleGraphics.forEach(g => g.destroy());
        this.greenCircleGraphics = [];

        this.tweens.killAll();
        this.input.off('pointerdown');
        
        if (window.gameScene === this) {
            window.gameScene = undefined;
        }

        this.__sdkFinalizeAsQuit();
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

    // Khởi tạo danh sách chưa khoanh
    private initUnfinishedTargets() {
        this.unfinishedTargets = this.objectManager.getAllObjects().filter(obj => 
            this.objectManager.isCorrectAnswer(obj)
        );
        Phaser.Utils.Array.Shuffle(this.unfinishedTargets); // Shuffle để random ngay từ đầu
        console.log(`[Scene1] Initialized unfinishedTargets: ${this.unfinishedTargets.length}`);
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
        this.enableGameplay();

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
        const delay = this.isWaitingForIntroStart ? GameConstants.SCENE1.TIMING.GAME_START_DELAY : 0;
        
        this.time.delayedCall(delay, () => {
            this.enableGameplay();
        });
    }

    private enableGameplay() {
        if (this.isGameplayStarted) return;
        this.isGameplayStarted = true;

        this.lassoManager.enable();
        this.idleManager.start();
    }

    private handleLassoSelection(polygon: Phaser.Geom.Polygon) {
        const path_length_px = this.lassoManager.getPathLengthPx();
        const pointCount = this.lassoManager.getPointCount();
        const ts = Date.now();

        // Guard: Path quá ngắn = bé thả tay quá sớm, chưa khoanh đủ vòng
        const { MIN_PATH_LENGTH_PX, MIN_POINTS } = GameConstants.LASSO;
        if (path_length_px < MIN_PATH_LENGTH_PX || pointCount < MIN_POINTS) {
            this.circleTracker?.onStrokeEnd?.(
                { path_length_px, enclosed_ids: [], enclosure_ratio: {} },
                ts,
                { isCorrect: false, errorCode: GameConstants.ERROR_CODES.RELEASE_TOO_EARLY as any }
            );
            AudioManager.play("sfx-wrong");
            return;
        }

        // 1. Validate Selection using Utility Class
        const result = LassoValidation.validateSelection(polygon, this.objectManager);
        
        const selectedObjects = result.selectedObjects;
        const isSuccess = result.success;
        const failureReason = result.failureReason;

        const enclosed_ids = (result.selectedObjects ?? [])
            .map((obj: any, idx: number) => {
                const id = obj.getData('id');
                return id !== undefined ? id : `obj_${idx}`;
            });

        const enclosure_ratio: Record<string, number> = {};
        for (const id of enclosed_ids) enclosure_ratio[id] = 1;
        
        this.circleTracker?.onStrokeEnd?.(
            { 
                path_length_px: path_length_px,
                enclosed_ids, 
                enclosure_ratio 
            },
            ts,
            isSuccess 
                ? { isCorrect: true, errorCode: null } 
                : { isCorrect: false, errorCode: GameConstants.ERROR_CODES.WRONG_TARGET as any }
        );

        if (isSuccess && selectedObjects.length === 1) {
            const target = selectedObjects[0] as Phaser.GameObjects.Image;
            const targetId = target.getData('id');
            console.log(`Checking Target ID: ${targetId} (Type: ${typeof targetId}) vs Found: ${this.foundTargets}`);

            // Check if already found
            if (this.foundTargets.includes(targetId)) {
                console.log("⚠️ Hình này đã khoanh rồi!");
                // Có thể play sound nhắc nhở nhẹ hoặc ignore
                return;
            }

            // --- SUCCESS CASE ---
            
            // Xóa nét vẽ lasso của user trước khi hiện vòng tròn đúng
            this.lassoManager.clear();

            // Vẽ vòng tròn bao quanh hình đúng
            const graphics = this.add.graphics();
            graphics.setDepth(100); 
            graphics.lineStyle(10, 0x00ff00); // Nét, dày 10px
            const radius = (Math.max(target.displayWidth, target.displayHeight) / 2);
            graphics.strokeCircle(target.x, target.y, radius);
            
            // Lưu graphics để xóa khi restart
            this.greenCircleGraphics.push(graphics);

            console.log("✅ Khoanh ĐÚNG!");
            AudioManager.play("sfx-ting");
            
            this.objectManager.highlightObjects([target], true);
            this.foundTargets.push(targetId);
            
            // Xóa khỏi danh sách chưa khoanh để không gợi ý lại (dùng ID để so sánh chắc chắn)
            this.unfinishedTargets = this.unfinishedTargets.filter(obj => {
                const objId = obj.getData('id');
                return objId !== targetId;
            });
            console.log(`[Scene1] Removed target ${targetId} from unfinishedTargets. Remaining: ${this.unfinishedTargets.length}`);

            // Ẩn gợi ý nếu đang hiện
            this.stopActiveHint();

            // SDK: Record Intermediate Score
            // Mỗi lần khoanh đúng 1 hình, ghi nhận điểm
            this.currentLevelIndex += 1;
            game.finishQuestionTimer(); 
            game.recordCorrect({ scoreDelta: 1 });
            sdk.score(this.foundTargets.length, this.totalTargets);
            sdk.progress({ levelIndex: this.currentLevelIndex, total: this.totalTargets, score: this.foundTargets.length });

            // Check Win Condition
            if (this.foundTargets.length >= this.totalTargets) {
                console.log("🎉 VICTORY! Found all targets.");
                AudioManager.play("sfx-correct"); // Final success sound

                // Input disable
                this.lassoManager.disable();

                // --- GAME HUB COMPLETE ---
                console.log(`[SDK Finalize] 🎉 All targets found, finalizing...`);
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
                console.log(`👍 Found ${this.foundTargets.length}/${this.totalTargets}. Keep going!`);
                AudioManager.play("sfx-correct"); // Intermediate success sound
                game.startQuestionTimer(); // Start timer for next target
                // Không disable lasso manager, để người chơi khoanh tiếp
            }

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

        // 1. Tìm target đúng chưa được khoanh (filter theo foundTargets)
        const unfinishedCorrectTargets = this.objectManager.getAllObjects().filter(obj => {
            if (!this.objectManager.isCorrectAnswer(obj)) return false;
            const objId = obj.getData('id');
            return !this.foundTargets.includes(objId);
        });
        
        if (unfinishedCorrectTargets.length === 0) {
            console.log('[Scene1] No unfinished targets for tutorial!');
            return;
        }
        
        // Lấy target đầu tiên chưa khoanh (Tutorial nên cố định, không random)
        const target = unfinishedCorrectTargets[0];
        
        const targetId = target.getData('id');
        console.log(`[Scene1] Tutorial hinting target ID: ${targetId}`);

        const image = target as Phaser.GameObjects.Image;
        const radius = (Math.max(image.displayWidth, image.displayHeight) / 2);

        // Lấy bàn tay từ UIScene
        const handHint = this.uiScene.handHint;
        if (!handHint) return;

        // Set origin (0.1,0.1) để ngón tay chỉ chính xác
        handHint.setOrigin(0.1, 0.1);
        handHint.setVisible(true);
        handHint.setAlpha(0);
        handHint.setScale(0.7);

        // Lấy hintPoints nếu có (danh sách các điểm cần hint)
        const hintPoints = target.getData('hintPoints');
        const originScale = target.getData('originScale') || 1;

        const tweensChain: any[] = [];
        
        if (hintPoints && hintPoints.length > 0) {
            // Logic mới: Di chuyển qua các điểm hint
            const baseX = image.x;
            const baseY = image.y;

            // Điểm bắt đầu
            const firstP = hintPoints[0];
            const startX = baseX + (firstP.x * originScale);
            const startY = baseY + (firstP.y * originScale);

            handHint.setPosition(startX, startY);

            // 1. Hiện ra tại điểm đầu tiên
            tweensChain.push({ alpha: 1, duration: 500 });

            // 2. Vẽ vòng tròn tại điểm đầu tiên (3 vòng nhỏ)
            for (let loop = 0; loop < 3; loop++) {
                const circleRadius = radius * 0.8;
                const steps = 8; // Số bước để tạo vòng tròn mượt
                
                for (let step = 0; step < steps; step++) {
                    const angle = (step / steps) * Phaser.Math.PI2 - Phaser.Math.PI2 / 4;
                    const offsetX = circleRadius * Math.cos(angle);
                    const offsetY = circleRadius * Math.sin(angle);
                    
                    tweensChain.push({
                        x: startX + offsetX,
                        y: startY + offsetY,
                        duration: 2000 / steps / 3, // 2s cho 3 vòng
                        ease: 'Linear'
                    });
                }
            }

            // 3. Di chuyển đến các điểm còn lại và vẽ vòng tròn
            for (let i = 1; i < hintPoints.length; i++) {
                const p = hintPoints[i];
                const destX = baseX + (p.x * originScale);
                const destY = baseY + (p.y * originScale);
                
                // Di chuyển đến điểm mới
                tweensChain.push({ x: destX, y: destY, duration: 300 });
                
                // Vẽ vòng tròn tại điểm mới (2 vòng)
                for (let loop = 0; loop < 2; loop++) {
                    const circleRadius = radius * 0.8;
                    const steps = 8;
                    
                    for (let step = 0; step < steps; step++) {
                        const angle = (step / steps) * Phaser.Math.PI2 - Phaser.Math.PI2 / 4;
                        const offsetX = circleRadius * Math.cos(angle);
                        const offsetY = circleRadius * Math.sin(angle);
                        
                        tweensChain.push({
                            x: destX + offsetX,
                            y: destY + offsetY,
                            duration: 1500 / steps / 2,
                            ease: 'Linear'
                        });
                    }
                }
            }

        } else {
            // Logic cũ: Vẽ vòng tròn xung quanh target
            const startX = image.x + radius * Math.cos(-Phaser.Math.PI2 / 4);
            const startY = image.y + radius * Math.sin(-Phaser.Math.PI2 / 4);
            
            handHint.setPosition(startX, startY);

            // 1. Hiện ra
            tweensChain.push({ alpha: 1, duration: 500 });

            // 2. Xoay 2 vòng tròn - Dùng onUpdate để mượt mà hơn
            const circleData = { angle: 0 };
            tweensChain.push({
                targets: circleData,
                angle: Phaser.Math.PI2 * 2, // 2 vòng tròn
                duration: 4000, // 4 giây cho 2 vòng (2s mỗi vòng)
                ease: 'Linear',
                onUpdate: () => {
                    const currentAngle = circleData.angle - Phaser.Math.PI2 / 4;
                    handHint.x = image.x + radius * Math.cos(currentAngle);
                    handHint.y = image.y + radius * Math.sin(currentAngle);
                }
            });
        }

        // 4. Biến mất và lặp lại
        tweensChain.push({
            alpha: 0,
            duration: 500,
            onComplete: () => {
                handHint.setPosition(-200, -200);
                // Lặp lại nếu Intro chưa kết thúc
                if (this.isIntroActive) {
                    this.time.delayedCall(1000, () => this.runHandTutorial());
                }
            },
        });

        // Chạy chuỗi animation
        this.tweens.chain({
            targets: handHint,
            tweens: tweensChain,
        });
    }

    /**
     * Gợi ý khi rảnh (Idle Hint)
     */
    private showHint() {
        if (this.lassoManager.isCurrentlyDrawing) return;

        // Lấy tất cả target đúng (role=correct) từ objectManager
        const allCorrectTargets = this.objectManager.getAllObjects().filter(obj => 
            this.objectManager.isCorrectAnswer(obj)
        );
        
        // Lọc ra những target chưa được khoanh
        const remainingTargets = allCorrectTargets.filter(obj => {
            const objId = obj.getData('id');
            return !this.foundTargets.includes(objId);
        });
        
        if (remainingTargets.length === 0) {
            return;
        }

        // Random chọn 1 target từ danh sách chưa khoanh
        const randomIndex = Phaser.Math.Between(0, remainingTargets.length - 1);
        const target = remainingTargets[randomIndex] as Phaser.GameObjects.Image;

        // SDK Hint
        game.addHint();
        this.circleTracker?.hint?.(1);
        AudioManager.play('hint');

        const IDLE_CFG = GameConstants.IDLE;

        // Hiệu ứng 1: Nhấp nháy đối tượng đó

        // Hiệu ứng 2: Bàn tay khoanh tròn
        const handHint = this.uiScene.handHint;
        if (!handHint) return;

        // Set origin (0.1,0.1) để ngón tay chỉ chính xác
        handHint.setOrigin(0.1, 0.1);
        handHint.setScale(0.7);

        const radius = (Math.max(target.displayWidth, target.displayHeight) / 2);
        const startX = target.x + radius * Math.cos(-Phaser.Math.PI2 / 4);
        const startY = target.y + radius * Math.sin(-Phaser.Math.PI2 / 4);
        
        handHint.setPosition(startX, startY).setAlpha(0);

        const tweensChain: any[] = [];

        // 1. Hiện ra
        tweensChain.push({ alpha: 1, duration: IDLE_CFG.FADE_IN });

        // 2. Vẽ 2 vòng tròn xung quanh target - Dùng onUpdate để mượt mà hơn
        const circleData = { angle: 0 };
        tweensChain.push({
            targets: circleData,
            angle: Phaser.Math.PI2 * 2, // 2 vòng tròn
            duration: 3000, // 3 giây cho 2 vòng (1.5s mỗi vòng)
            ease: 'Linear',
            onUpdate: () => {
                const currentAngle = circleData.angle - Phaser.Math.PI2 / 4;
                handHint.x = target.x + radius * Math.cos(currentAngle);
                handHint.y = target.y + radius * Math.sin(currentAngle);
            }
        });

        // 3. Biến mất
        tweensChain.push({ alpha: 0, duration: IDLE_CFG.FADE_OUT });

        this.tweens.chain({
            targets: handHint,
            tweens: tweensChain
        });
    }

    private stopActiveHint() {
        if (this.activeHintTween) {
            this.activeHintTween.stop();
            this.activeHintTween = null;
        }

        if (this.activeHintTarget) {
            this.tweens.killTweensOf(this.activeHintTarget);
            const originScale = this.activeHintTarget.getData('originScale') || this.activeHintTarget.scale;
            this.activeHintTarget.setScale(originScale);
            this.activeHintTarget.setAlpha(1);
            this.activeHintTarget = null;
        }

        const handHint = this.uiScene?.handHint;
        if (handHint) {
            this.tweens.killTweensOf(handHint);
            handHint.setAlpha(0).setPosition(-200, -200);
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
            const id = obj.getData('id');
            return id !== undefined ? id : `obj_${idx}`;
        });

        // Correct targets (Find All - Lấy tất cả các correct items)
        const correctObjs = allObjects.filter(obj => 
            this.objectManager.isCorrectAnswer(obj)
        );
        
        const correct_targets = correctObjs.map(obj => {
            const id = obj.getData('id');
            return id !== undefined ? id : `unknown`;
        });

        console.log(`[SDK Init] Item Seq: ${this.itemSeq}`);
        console.log(`  ✅ Selectables:`, selectables);
        console.log(`  🎯 Correct Targets:`, correct_targets);

        // Cast game to any to avoid type error
        this.circleTracker = (game as any).createCircleSelectTracker({
            meta: {
                item_id: `CIRCLE_SELECT_SO_2_${this.itemSeq}`,
                item_type: "circle_select",
                seq: this.itemSeq,
                run_seq: this.runSeq,
                difficulty: 1,
                scene_id: "SCN_CIRCLE_SO_2",
                scene_seq: 1,
                scene_type: "circle_select",
                skill_ids: ["khoanh_so_2_math_001"],
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
