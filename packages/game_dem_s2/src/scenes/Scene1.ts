import Phaser from 'phaser';
import { SceneKeys, TextureKeys, AudioKeys, DataKeys } from '../consts/Keys';
import { GameConstants } from '../consts/GameConstants';
import { GameUtils } from '../utils/GameUtils';
import { changeBackground } from '../utils/BackgroundManager';
import AudioManager from '../audio/AudioManager';
import { showGameButtons, hideGameButtons, sdk } from '../main';
import { useVoiceEvaluation, ExerciseType } from '../hooks/useVoiceEvaluation';
import { playVoiceLocked, setGameSceneReference, resetVoiceState } from '../utils/rotateOrientation';
import { IdleManager } from '../utils/IdleManager';
import { game } from "@iruka-edu/mini-game-sdk";
import { playRecordedAudio } from '../utils/AudioUtils';
import { VoiceManager } from '../managers/VoiceManager';

export default class Scene1 extends Phaser.Scene {
    // Core Systems
    private bgm!: Phaser.Sound.BaseSound;
    private voiceManager!: VoiceManager;
    private voiceHelper = useVoiceEvaluation({
        childId: 'sonbui_8386',
        gameId: 'game_dem_so_1',
        gameVersion: '1.0.0',
        gameType: ExerciseType.COUNTING,
        ageLevel: '3-4',
        testmode: true
    });
    
    // Game State
    private objectsToCount: Phaser.GameObjects.Image[] = [];
    private currentQuota: number = 0;
    private readonly LEVEL_KEYS = [DataKeys.LevelS1Config];
    private currentQuestionIndex: number = 0;
    private currentLevelId: number = 1;
    private levelTarget: any = null;
    private circleOverlay: Phaser.GameObjects.Graphics | null = null;

    // Flags
    private isIntroActive = false;
    private isProcessing = false;
    private isRestart = false;
    private static hasInteracted = false;
    
    // UI Elements
    private btnMic!: Phaser.GameObjects.Image;
    private idleManager!: IdleManager;
    private handCursor!: Phaser.GameObjects.Image;
    private tutorialTimer?: Phaser.Time.TimerEvent;
    private introTimer?: Phaser.Time.TimerEvent;
    private radiatingCircles: Phaser.GameObjects.Arc[] = [];
    private hero!: Phaser.GameObjects.Sprite;

    constructor() {
        super(SceneKeys.Scene1);
    }

    // ================= LIFECYCLE =================

    init(data?: any): void {
        // Reset state
        this.objectsToCount = [];
        this.currentQuestionIndex = 0;
        this.currentLevelId = 1;
        this.circleOverlay = null;
        this.isProcessing = false;
        this.isRestart = data?.isRestart || false;
        resetVoiceState();
        
        // SDK initialization - 2 levels
        game.setTotal(2);
        (window as any).irukaGameState = { startTime: Date.now(), currentScore: 0 };
        sdk.score(0, 0);
        sdk.progress({ levelIndex: 0, total: 2 });
    }

    create(): void {
        window.gameScene = this;
        setGameSceneReference(this);
        this.resumeAudioContext();
        showGameButtons();

        // Setup systems
        this.setupBackgroundAndAudio();
        this.setupLifecycle();
        this.setupIdleManager();

        // Create UI (MUST be before setupVoiceManager vì cần btnMic, hero, radiatingCircles)
        this.createUI();
        this.loadLevel(1); // Load level đầu tiên với id = 1
        
        // Setup VoiceManager sau khi UI elements đã được tạo
        this.setupVoiceManager();

        // Launch UI Scene
        const uiScene = this.scene.get(SceneKeys.UI);
        if (!uiScene.scene.isActive()) {
            this.scene.launch(SceneKeys.UI, { sceneKey: SceneKeys.Scene1 });
            this.scene.bringToTop(SceneKeys.UI);
        }

        this.handleIntro();
    }

    update(time: number, delta: number): void {
        if (this.idleManager) this.idleManager.update(delta);
    }

    // ================= SETUP =================

    private handleIntro(): void {
        if (Scene1.hasInteracted || this.isRestart) {
            this.resumeAudioContext();
            setTimeout(() => {
                this.playIntroSequence();
                this.runGameFlow(); 
            }, GameConstants.SCENE1.DELAYS.RESTART_AUDIO_DELAY);
        } else {
            this.input.once('pointerdown', () => {
                Scene1.hasInteracted = true;
                this.resumeAudioContext();
                this.playIntroSequence();
                this.runGameFlow();
            });
        }
    }

    private resumeAudioContext(): void {
        const soundManager = this.sound as Phaser.Sound.WebAudioSoundManager;
        if (soundManager.context?.state === 'suspended') {
            soundManager.context.resume();
        }
    }

    private setupLifecycle(): void {
        const handleUnload = async () => { 
            if (this.voiceManager?.isSessionActive) {
                await this.voiceManager.finishSession(1, true);
            }
        };
        const handleOffline = () => {
            console.log("Mất kết nối mạng!");
            if (this.voiceManager?.isSessionActive) {
                this.voiceManager.finishSession(1, true);
            }
        };

        window.addEventListener('beforeunload', handleUnload);
        window.addEventListener('offline', handleOffline);
        
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            window.removeEventListener('beforeunload', handleUnload);
            window.removeEventListener('offline', handleOffline);
        });
    }

    private setupBackgroundAndAudio(): void {
        changeBackground('assets/images/bg/background.jpg');
        
        try {
            if (this.sound.get(AudioKeys.BgmNen)) this.sound.stopByKey(AudioKeys.BgmNen);
            this.bgm = this.sound.add(AudioKeys.BgmNen, { loop: true, volume: 0.25 });
            this.bgm.play();
        } catch (e) {
            console.warn("Audio Context issue:", e);
        }
    }

    private setupVoiceManager(): void {
        this.voiceManager = new VoiceManager({
            scene: this,
            voiceHelper: this.voiceHelper,
            bgm: this.bgm,
            btnMic: this.btnMic,
            hero: this.hero,
            radiatingCircles: this.radiatingCircles,
            
            // Callbacks
            onRecordingStart: () => {
                if (this.idleManager) this.idleManager.stop();
            },
            onRecordingStop: () => {
                if (this.idleManager) this.idleManager.start();
            },
            onProcessingStart: () => {
                // Stop IdleManager khi đang chờ backend
                if (this.idleManager) this.idleManager.stop();
                
                const uiScene = this.scene.get(SceneKeys.UI) as any;
                if (uiScene?.showProcessingPopup) uiScene.showProcessingPopup();
            },
            onProcessingEnd: () => {
                // Start lại IdleManager sau khi nhận kết quả từ backend
                if (this.idleManager) this.idleManager.start();
            },
            onResultReceived: (result: any) => {
                this.handleResult(result);
            },
            onSessionFinish: (endData: any) => {
                const uiScene = this.scene.get(SceneKeys.UI) as any;
                if (uiScene?.showFinalScorePopup) uiScene.showFinalScorePopup(endData.finalScore);
                
                // Transition to End Game scene
                this.time.delayedCall(GameConstants.SCENE1.DELAYS.ENDGAME_TRANSITION, () => {
                    this.scene.stop(SceneKeys.UI);
                    this.scene.start(SceneKeys.EndGame);
                });
            }
        });
    }

    private setupIdleManager(): void {
        this.idleManager = new IdleManager(GameConstants.IDLE.THRESHOLD, () => this.showHint());
        this.handCursor = this.add.image(0, 0, TextureKeys.HandHint).setVisible(false).setDepth(100);
    }

    // ================= UI CREATION =================

    private createUI(): void {
        const centerX = GameUtils.pctX(this, 0.5);
        const bannerTexture = this.textures.get(TextureKeys.S1_Banner);
        const bannerHeight = (bannerTexture?.key !== '__MISSING') 
            ? bannerTexture.getSourceImage().height * GameConstants.SCENE1.SCALES.BANNER 
            : 100;
        const boardY = bannerHeight + GameUtils.pctY(this, GameConstants.SCENE1.UI.BOARD_OFFSET);
        
        // Board
        const board = this.add.image(centerX, boardY, TextureKeys.S1_Board)
            .setOrigin(0.5, 0).setScale(GameConstants.SCENE1.SCALES.BOARD).setDepth(0);
            
        // Mic button
        this.btnMic = this.add.image(centerX, GameUtils.pctY(this, 0.85), TextureKeys.Mic) 
            .setScale(GameConstants.SCENE1.SCALES.MIC).setInteractive().setVisible(false).setDepth(10);

        this.btnMic.on('pointerdown', async () => {
            if (this.voiceManager.isProcessing) return;

            this.resetIdle(); 
            
            if (this.voiceManager.isRecording) {
                // Dừng recording
                this.voiceManager.stopRecording(); 
            } else {
                // Bắt đầu record và auto-submit
                const targetText = this.levelTarget || { start: 1, end: 1 };
                const flow = GameConstants.FLOW;
                const globalIndex = flow.indexOf(this.scene.key as any) + 1;
                
                // Gọi recordAndSubmitAudio - nó sẽ tự động submit sau khi recording xong
                await this.voiceManager.recordAndSubmitAudio(targetText, globalIndex, 0);
            }
        });

        // Hero sprite animation
        if (!this.anims.exists('listen_anim')) {
            this.anims.create({
                key: 'listen_anim',
                frames: this.anims.generateFrameNumbers(TextureKeys.Sprite1, { start: 0, end: 6 }),
                frameRate: 7,
                repeat: -1 
            });
        }

        const bRight = board.x + (board.displayWidth * 0.5);
        const bLeft = board.x - (board.displayWidth * 0.5);
        const bBottom = board.y + board.displayHeight;
        const bTop = board.y;

        // Icons on board
        const numberIcon = this.add.image(bLeft + GameConstants.SCENE1.OFFSETS.ICON_PADDING, bTop + GameConstants.SCENE1.OFFSETS.ICON_PADDING, TextureKeys.Number).setOrigin(0, 0);
        this.add.image(numberIcon.x + numberIcon.width + GameConstants.SCENE1.OFFSETS.ICON_SPACING, bTop + GameConstants.SCENE1.OFFSETS.ICON_PADDING, TextureKeys.Dice).setOrigin(0, 0);
        
        this.hero = this.add.sprite(bRight - 20, bBottom - 20, TextureKeys.Sprite1)
            .setOrigin(1, 1).setScale(GameConstants.SCENE1.SCALES.HERO).setVisible(false);
    }

    // ================= GAME FLOW =================

    private loadLevel(levelId: number): void {
        this.isProcessing = false;
        
        // Load config data
        const configData = this.cache.json.get(this.LEVEL_KEYS[0]);
        if (!configData?.levels || !configData?.sharedImages) {
            console.error("Invalid config structure - missing levels or sharedImages");
            return;
        }

        // Find level by id
        const levelData = configData.levels.find((lvl: any) => lvl.id === levelId);
        if (!levelData) {
            console.error(`Level with id ${levelId} not found`);
            return;
        }

        this.currentLevelId = levelId;
        
        // Load shared images (dùng chung cho tất cả levels)
        const sharedImageDefs = configData.sharedImages;
        
        // Clear previous circle overlay
        if (this.circleOverlay) {
            this.circleOverlay.destroy();
            this.circleOverlay = null;
        }
        
        // Object pooling: Reuse hoặc tạo mới từ sharedImages
        for (let i = 0; i < sharedImageDefs.length; i++) {
            const def = sharedImageDefs[i];
            const x = GameUtils.pctX(this, def.baseX_pct);
            const y = GameUtils.pctY(this, def.baseY_pct);
            
            if (i < this.objectsToCount.length) {
                // Reuse
                const img = this.objectsToCount[i];
                img.setTexture(def.textureKey).setPosition(x, y).setScale(def.baseScale || 0.5).setVisible(true).setActive(true);
            } else {
                // Create new
                const img = this.add.image(x, y, def.textureKey).setScale(def.baseScale || 0.5);
                this.objectsToCount.push(img);
            }
        }

        // Hide unused objects
        for (let i = sharedImageDefs.length; i < this.objectsToCount.length; i++) {
            this.objectsToCount[i].setVisible(false).setActive(false);
        }

        // Draw circle overlay nếu có trong config
        if (levelData.circle) {
            this.drawCircleOverlay(levelData.circle);
        }

        this.levelTarget = levelData.targetText;
    }

    /**
     * Vẽ vòng tròn xanh lá overlay lên tấm hình
     */
    private drawCircleOverlay(circleConfig: any): void {
        const x = GameUtils.pctX(this, circleConfig.x_pct);
        const y = GameUtils.pctY(this, circleConfig.y_pct);
        const radius = circleConfig.radius || 80;
        const color = parseInt(circleConfig.color.replace('0x', ''), 16);
        const alpha = circleConfig.alpha || 0;
        const strokeColor = parseInt(circleConfig.strokeColor.replace('0x', ''), 16);
        const strokeWidth = circleConfig.strokeWidth || 3;

        // Create graphics object
        this.circleOverlay = this.add.graphics();
        this.circleOverlay.setDepth(5); // Nằm trên objects nhưng dưới UI

        // Fill circle
        this.circleOverlay.fillStyle(color, alpha);
        this.circleOverlay.fillCircle(x, y, radius);

        // Stroke circle
        this.circleOverlay.lineStyle(strokeWidth, strokeColor, 1);
        this.circleOverlay.strokeCircle(x, y, radius);
    }

    private async runGameFlow(): Promise<void> {
        const sessionRes = await this.voiceManager.startSession();
        
        if (!sessionRes) {
            console.log("[Voice] Session start failed");
            return;
        }
        
        this.currentQuota = sessionRes.quotaRemaining;
        this.currentQuestionIndex = sessionRes.index >= this.LEVEL_KEYS.length ? 0 : sessionRes.index;
        
        // Show Mic sau delay
        this.time.delayedCall(GameConstants.SCENE1.DELAYS.MIC_SHOW_DELAY, () => {
            if (!this.scene.isActive()) return;
            this.btnMic.setVisible(true);
            this.runHandTutorial();
        });

        console.log("Session ID:", this.voiceManager.sessionId);
        game.startQuestionTimer();
        
        // Load level dựa trên currentLevelId (default = 1)
        this.loadLevel(this.currentLevelId);
    }

    private handleResult(result: any): void {
        // Process feedback qua VoiceManager
        this.voiceManager.processFeedback(result);
        
        // SDK tracking
        const isPassed = result.score >= GameConstants.SCENE1.PASS_SCORE;
        isPassed ? game.recordCorrect({ scoreDelta: 1 }) : game.recordWrong();
        game.finishQuestionTimer();

        const levelIndex = this.currentLevelId - 1; // Level ID 1 -> index 0
        sdk.score(result.score, result.score); 
        sdk.progress({ levelIndex, total: 2, score: result.score });

        // Show popup
        const uiScene = this.scene.get(SceneKeys.UI) as any; 
        if (uiScene?.showScorePopup) uiScene.showScorePopup(result.score, result.feedback);

        // Level progression logic
        if (isPassed) {
            this.handleLevelPass();
        } else {
            this.handleLevelFail();
        }
    }

    /**
     * Xử lý khi user pass level
     * Level 1 pass -> Load Level 2
     * Level 2 pass -> End Game
     * Fail → Retry level hiện tại
     */
    private handleLevelPass(): void {
        const DELAY = GameConstants.SCENE1.DELAYS.ENDGAME_TRANSITION;
        
        if (this.currentLevelId === 1) {
            // Level 1 pass → Chuyển sang Level 2
            this.time.delayedCall(DELAY, () => {
                // Hide popup trước khi chuyển level
                const uiScene = this.scene.get(SceneKeys.UI) as any;
                if (uiScene?.hideScorePopup) uiScene.hideScorePopup();
                
                this.currentLevelId = 2;
                this.loadLevel(2);
                game.startQuestionTimer();
            });
        } else if (this.currentLevelId === 2) {
            // Level 2 pass → End Game
            this.time.delayedCall(DELAY, () => {
                this.voiceManager.finishSession(2);
                // Session finish callback sẽ tự động chuyển sang EndGame
            });
        }
    }

    /**
     * Xử lý khi user fail level
     * Retry lại level hiện tại
     */
    private handleLevelFail(): void {
        const DELAY = GameConstants.SCENE1.DELAYS.ENDGAME_TRANSITION;
        
        this.time.delayedCall(DELAY, () => {
            // Hide popup trước khi retry
            const uiScene = this.scene.get(SceneKeys.UI) as any;
            if (uiScene?.hideScorePopup) uiScene.hideScorePopup();
            
            // Reload level hiện tại
            this.loadLevel(this.currentLevelId);
            game.startQuestionTimer();
        });
    }

    // =================================================================
    // TUTORIAL & HINTS - Hướng dẫn và gợi ý
    // =================================================================

    /**
     * Tutorial đầu game: Bàn tay hướng dẫn tap vào Mic button
     * - Chạy lặp lại liên tục khi intro active
     * - Dừng khi user tap vào Mic
     */
    private runHandTutorial(): void {
        // Guard: Chỉ chạy khi intro đang active
        if (!this.isIntroActive) return;

        // Guard: Đảm bảo hand cursor và mic button tồn tại
        if (!this.handCursor || !this.btnMic?.visible) return;

        // Setup: Đặt origin về góc trên-trái để tính toán dễ hơn
        this.handCursor.setOrigin(0, 0);

        // Kill existing tweens để tránh conflict
        this.tweens.killTweensOf(this.handCursor);

        // Xác định vị trí đích (target position)
        const targetX = this.btnMic.x + GameConstants.SCENE1.OFFSETS.HAND_CURSOR_X;
        const targetY = this.btnMic.y + GameConstants.SCENE1.OFFSETS.HAND_CURSOR_Y;

        // Setup initial state: Set position, visible, alpha
        this.handCursor
            .setPosition(targetX, targetY)
            .setVisible(true)
            .setAlpha(0)
            .setScale(1)
            .setDepth(100);

        // Khởi tạo tween chain
        const tweensChain: any[] = [];
        const INTRO = GameConstants.SCENE1.INTRO_HAND; // Config timing

        // 1. Fade In (hiện bàn tay)
        tweensChain.push({
            targets: this.handCursor,
            alpha: 1,
            duration: INTRO.MOVE,
            ease: 'Power2',
        });

        // 2. Tap Tap effect (nhấn nhấn)
        tweensChain.push({
            targets: this.handCursor,
            scale: 0.8,
            duration: INTRO.TAP,
            yoyo: true,
            repeat: 2, // Tap 3 lần
        });

        // 3. Fade out
        tweensChain.push({
            targets: this.handCursor,
            alpha: 0,
            duration: 500,
            onComplete: () => {
                this.handCursor?.setPosition(-200, -200).setVisible(false);

                // Loop: Lặp lại tutorial nếu intro vẫn active
                if (this.isIntroActive) {
                    this.tutorialTimer = this.time.delayedCall(
                        GameConstants.SCENE1.DELAYS.TUTORIAL_LOOP, 
                        () => this.runHandTutorial()
                    );
                }
            }
        });

        // Kích hoạt tween chain
        this.tweens.chain({
            tweens: tweensChain
        });

        // Listen: Dừng tutorial khi user tap vào Mic
        this.btnMic.off('pointerdown', this.stopTutorial, this);
        this.btnMic.once('pointerdown', this.stopTutorial, this);
    }

    /**
     * Idle Hint: Hiện gợi ý khi user không tương tác
     * - Chỉ chạy 1 lần (không loop)
     * - Bàn tay tap vào Mic button
     */
    private showHint(): void {
        // Guard: Kiểm tra mic button có visible không
        if (!this.btnMic?.visible) return;

        // Reset idle timer
        this.idleManager.reset();

        // SDK tracking
        game.addHint();

        // Config
        const IDLE_CFG = GameConstants.IDLE;

        // Guard: Đảm bảo hand cursor tồn tại
        if (!this.handCursor) return;

        // Setup origin
        this.handCursor.setOrigin(0, 0);

        // Play hint audio
        AudioManager.play('hint');

        // Xác định vị trí đích
        const targetX = this.btnMic.x + GameConstants.SCENE1.OFFSETS.HAND_CURSOR_X;
        const targetY = this.btnMic.y + GameConstants.SCENE1.OFFSETS.HAND_CURSOR_Y;

        // Tween chain
        const tweensChain: any[] = [];

        // 1. Teleport đến vị trí (không bay vào)
        tweensChain.push({
            targets: this.handCursor,
            x: targetX,
            y: targetY,
            duration: 0
        });

        // 2. Fade In
        tweensChain.push({
            targets: this.handCursor,
            alpha: 1,
            duration: IDLE_CFG.FADE_IN,
            ease: 'Linear',
        });

        // 3. Tap Tap effect
        tweensChain.push({
            targets: this.handCursor,
            scale: 1.2,
            duration: IDLE_CFG.SCALE,
            yoyo: true,
            repeat: 2,
            ease: 'Sine.easeInOut',
        });

        // 4. Fade Out
        tweensChain.push({
            targets: this.handCursor,
            alpha: 0,
            duration: IDLE_CFG.FADE_OUT,
        });

        // 5. Hide và restart idle manager
        tweensChain.push({
            targets: this.handCursor,
            alpha: 0,
            duration: 100,
            onComplete: () => {
                this.handCursor?.setPosition(-200, -200).setScale(1);
                this.idleManager.start();
            }
        });

        // Kích hoạt tween chain
        this.tweens.chain({
            tweens: tweensChain
        });
    }

    /**
     * Dừng tất cả hint/tutorial đang chạy
     * - Clear timers
     * - Kill tweens
     * - Reset states
     */
    private stopActiveHint(): void {
        // Stop intro audio nếu đang chạy
        if (this.isIntroActive) {
            AudioManager.stopSound('voice_intro_s2');
            this.isIntroActive = false;
        }

        // Clear intro timer
        if (this.introTimer) {
            this.introTimer.remove();
            this.introTimer = undefined;
        }

        // Clear tutorial timer
        if (this.tutorialTimer) {
            this.tutorialTimer.remove();
            this.tutorialTimer = undefined;
        }

        // Kill hand cursor tweens và reset
        if (this.handCursor) {
            this.tweens.killTweensOf(this.handCursor);
            this.handCursor.setAlpha(0).setPosition(-200, -200).setScale(1);
        }

        // Stop hint audio
        AudioManager.stopSound('hint');
    }

    /**
     * Dừng tutorial (alias cho stopActiveHint, giữ tên cũ cho compatibility)
     */
    private stopTutorial(): void {
        this.stopActiveHint();
        
        // Start idle manager khi tutorial bị stop
        if (this.idleManager) {
            this.idleManager.start();
        }
    }

    /**
     * Reset idle timer
     */
    private resetIdle(): void {
        if (this.idleManager) this.idleManager.reset();
        
        // Nếu đang show hint thì stop
        if (this.handCursor?.visible) {
            this.stopActiveHint();
        }
    }

    /**
     * Play intro sequence: Voice intro + delay -> run tutorial
     */
    private playIntroSequence(): void {
        this.isIntroActive = true;
        
        // Dừng idle manager trong lúc intro
        if (this.idleManager) this.idleManager.stop();

        // Play intro voice
        playVoiceLocked(null, 'voice_intro_s2');
        
        // Đợi một chút rồi chạy animation tay hướng dẫn
        this.time.delayedCall(GameConstants.SCENE1.TIMING.INTRO_DELAY, () => {
            if (this.isIntroActive) this.runHandTutorial();
        });
    }
}
