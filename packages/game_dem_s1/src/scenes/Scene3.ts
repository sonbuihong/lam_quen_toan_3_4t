import Phaser from 'phaser';
import { SceneKeys, TextureKeys, AudioKeys, DataKeys } from '../consts/Keys';
import { GameConstants } from '../consts/GameConstants';
import { GameUtils } from '../utils/GameUtils';
import { changeBackground } from '../utils/BackgroundManager';
import { VoiceRecorder } from '../utils/VoiceRecorder';
import AudioManager from '../audio/AudioManager';
import { showGameButtons, hideGameButtons, sdk } from '../main';
import { useVoiceEvaluation, ExerciseType } from '../hooks/useVoiceEvaluation';
import { game } from "@iruka-edu/mini-game-sdk";
import { playVoiceLocked, setGameSceneReference, resetVoiceState } from '../utils/rotateOrientation';
import { IdleManager } from '../utils/IdleManager';
import { playRecordedAudio } from '../utils/AudioUtils';

export default class Scene3 extends Phaser.Scene {
    // --- PROPERTIES ---
    private bgm!: Phaser.Sound.BaseSound;
    private voiceRecorder!: VoiceRecorder;
    private objectsToCount: Phaser.GameObjects.Image[] = [];
    private currentQuota: number = 0;
    
    // Level Management
    private LEVEL_KEYS = [DataKeys.LevelS3Config];
    private currentQuestionIndex: number = 0; // Maps to Level Index (0, 1, 2)
    private levelTarget: any = null;

    private isIntroActive: boolean = false;

    private static hasInteracted: boolean = false;

    // Logic States
    private isProcessing: boolean = false; // Chặn spam request
    private isSessionActive: boolean = false; // Check session status
    private isStartingSession: boolean = false; // Guard for async start
    private submissionCount: number = 0; // Check valid submissions
    private isRecording: boolean = false;
    private testMode: boolean = true; // Bật Test Mode để debug
    private isRestart: boolean = false;

    // Voice Hook
    private voiceHelper = useVoiceEvaluation({
        childId: 'sonbui_8386',
        gameId: 'game_dem_so_1',
        gameVersion: '1.0.0',
        gameType: ExerciseType.COUNTING,
        ageLevel: '3-4',
        testmode: true
    });
    
    // UI Elements
    private btnMic!: Phaser.GameObjects.Image;
    private btnPlayback!: Phaser.GameObjects.Image;
    private hero!: Phaser.GameObjects.Sprite;
    
    // Idle
    private idleManager!: IdleManager;
    private handCursor!: Phaser.GameObjects.Image;
    private handTween!: Phaser.Tweens.Tween;
    private radiatingCircles: Phaser.GameObjects.Arc[] = [];

    constructor() {
        super(SceneKeys.Scene3);
    }

    init(data?: any) {
        this.objectsToCount = [];
        this.currentQuestionIndex = 0;
        this.isProcessing = false;
        this.submissionCount = 0;
        this.isSessionActive = false;
        this.isStartingSession = false;
        this.isRecording = false;
        this.isRestart = data?.isRestart || false;
        this.isRestart = data?.isRestart || false;
        
        // --- 1. Resume Session Logic ---
        if (data && data.sessionId) {
            console.log("[Scene3] Received Session ID: ", data.sessionId);
            this.voiceHelper.setSessionId(data.sessionId);
            
            if (data.quota !== undefined) {
                this.currentQuota = data.quota;
            }
        }
        
        resetVoiceState();
    }

    create() {
        window.gameScene = this;
        setGameSceneReference(this);

        // Attempt to resume audio immediately (works if restart or previously interacted)
        this.resumeAudioContext();

        showGameButtons();

        // 1. Setup System
        this.setupBackgroundAndAudio();
        this.setupLifecycleListeners();
        this.setupVoiceRecorder();
        this.setupIdleManager();

        // 2. Setup UI
        this.createUI();

        // 3. Init Logic
        this.loadLevel(0);

        // 4. Intro & Start Flow
        if (!this.scene.get(SceneKeys.UI).scene.isActive()) {
            this.scene.launch(SceneKeys.UI, { sceneKey: SceneKeys.Scene3 });
            this.scene.bringToTop(SceneKeys.UI);
        }

        this.handleIntroLogic();
    }

    private handleIntroLogic() {
        // Tự động bắt đầu vì người dùng đã tương tác ở Scene 1/2
        this.resumeAudioContext();

        console.log("========================================");
        console.log("SCENE 3 SESSION ID:", this.voiceHelper.sessionId);
        console.log("========================================");

        this.time.delayedCall(500, () => {
            this.playIntroSequence();
            this.runGameFlow(); 
        });
    }

    private resumeAudioContext() {
        const soundManager = this.sound as Phaser.Sound.WebAudioSoundManager;
        if (soundManager.context && soundManager.context.state === 'suspended') {
            soundManager.context.resume();
        }
    }

    // =================================================================
    // PHẦN 1: CÀI ĐẶT HỆ THỐNG (SYSTEM SETUP)
    // =================================================================

    private setupLifecycleListeners() {
        window.addEventListener('beforeunload', this.handleUnload);
        window.addEventListener('offline', this.handleOffline);
        
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
             window.removeEventListener('beforeunload', this.handleUnload);
             window.removeEventListener('offline', this.handleOffline);
        });
    }

    private handleUnload = async (e: BeforeUnloadEvent) => {
        if (this.isSessionActive) {
             await this.finishGameSession(true); 
        } 
    }

    private handleOffline = () => {
        console.log("Mất kết nối mạng!");
        if (!this.isSessionActive) return;
        this.finishGameSession();
        this.isSessionActive = false;
    }

    private setupBackgroundAndAudio() {
        changeBackground('assets/images/bg/background.jpg');
        try {
             if (this.sound.get(AudioKeys.BgmNen)) {
                this.sound.stopByKey(AudioKeys.BgmNen);
            }
            this.bgm = this.sound.add(AudioKeys.BgmNen, {
                loop: true,
                volume: 0.25,
            });
            this.bgm.play();
        } catch (e) {
            console.warn("Audio Context issue:", e);
        }
    }

    private setupVoiceRecorder() {
        this.voiceRecorder = new VoiceRecorder({
            onRecordingStart: () => {
                if (this.bgm && this.bgm.isPlaying) this.bgm.pause();
                AudioManager.stopAll();
                this.isRecording = true;
                this.tweens.add({ targets: this.btnMic, scale: 1.2, duration: 200, yoyo: true, repeat: -1 });
                GameUtils.startRadiatingEffect(this, this.btnMic, this.radiatingCircles);

                // Show Hero
                if (this.hero) {
                    this.hero.setVisible(true);
                    this.hero.play('listen_anim');
                }

                // Stop idle timer while recording
                if (this.idleManager) this.idleManager.stop();
            },
            onRecordingStop: (audioBlob, duration) => {
                // Fix Safari Volume Ducking
                AudioManager.restoreAudioAfterRecording();
                
                if (this.bgm && this.bgm.isPaused) this.bgm.resume();
                this.isRecording = false;
                this.btnMic.setScale(1); 
                this.tweens.killTweensOf(this.btnMic);
                GameUtils.stopRadiatingEffect(this, this.radiatingCircles);

                // Hide Hero
                if (this.hero) {
                    this.hero.setVisible(false);
                    this.hero.stop();
                }

                console.log(`[Voice] Recorded Duration: ${duration}ms (Threshold: ${GameConstants.VOICE.MIN_DURATION}ms)`);
                
                if (duration < GameConstants.VOICE.MIN_DURATION) {
                    console.log(`%c[Voice] Noise ignored (Too short: ${duration}ms < ${GameConstants.VOICE.MIN_DURATION}ms)`, "color: orange");
                    
                    // Feedback: Bấm lại để nói lại
                    AudioManager.play('sfx-wrong');
                    console.log("[Voice] Vui lòng bấm mic và nói lại!");

                    // Noise: Restart idle timer immediately
                    if (this.idleManager) this.idleManager.start();
                    return;
                }
                
                // Valid recording: LOCK INTERACTION IMMEDIATELY
                this.isProcessing = true;

                // Show Processing Popup
                const uiScene = this.scene.get(SceneKeys.UI) as any;
                if (uiScene && uiScene.showProcessingPopup) {
                    uiScene.showProcessingPopup();
                }
                
                // Auto Submit
                const targetText = this.levelTarget || { start: 1, end: 1 };
                this.sendAudioToBackend(audioBlob, targetText);
            },
            onVolumeChange: (vol) => {},
            onError: (err) => console.error("Mic Error:", err)
        });
    }

    // =================================================================
    // PHẦN 2: TẠO GIAO DIỆN & LEVEL (UI & LEVEL CREATION)
    // =================================================================

    private createUI() {
        const UI = GameConstants.SCENE1.UI;
        const cx = GameUtils.pctX(this, 0.5);
        const scl = [1, 0.72];

        // 1. Logic BANNER & BOARD
        const bannerTexture = this.textures.get(TextureKeys.S1_Banner);
        let bannerHeight = 100; 
        if (bannerTexture && bannerTexture.key !== '__MISSING') {
            bannerHeight = bannerTexture.getSourceImage().height * 0.7;
        }
        const boardY = bannerHeight + GameUtils.pctY(this, UI.BOARD_OFFSET);
        
        const board = this.add.image(cx, boardY, TextureKeys.S1_Board)
            .setOrigin(0.5, 0).setScale(0.7).setDepth(0);
        // board.displayWidth = GameUtils.getW(this) * 0.93;
            
        // 2. Nút Loa
        // this.add.image(cx * 1.77, boardY * 6.5, TextureKeys.Loa).setOrigin(0.5).setScale(1);

        // 3. Nút Mic
        this.btnMic = this.add.image(cx, GameUtils.pctY(this, 0.85), TextureKeys.Mic) 
             .setScale(1).setInteractive().setVisible(false).setDepth(10);

        this.btnMic.on('pointerdown', async () => {
             // Block interaction if processing result
             if (this.isProcessing) return;

             this.resetIdle(); 
             if (this.isRecording) {
                 this.voiceRecorder.stop(); 
             } else {
                 // Check permission explicitly
                 const hasPermission = await this.voiceRecorder.checkPermission();
                 if (hasPermission) {
                    this.voiceRecorder.start();
                 } else {
                     console.log("Quyền Mic bị từ chối/chưa cấp.");
                     alert("Quyền Mic bị từ chối/chưa cấp.");
                 }
             }
        });

        // 4. Nút nghe lại
        // this.btnPlayback = this.add.image(cx + 100, GameUtils.pctY(this, 0.85), TextureKeys.Loa)
        //      .setScale(0.7).setInteractive().setVisible(false);

        // 5. Sprite nghe voice
        // Tạo animation (thường làm 1 lần trong create)
        if (!this.anims.exists('listen_anim')) {
            this.anims.create({
                key: 'listen_anim',
                frames: this.anims.generateFrameNumbers(TextureKeys.Sprite1, { start: 0, end: 6 }),
                frameRate: 7,
                repeat: -1 
            });
        }
        // Gán animation cho sprite
        const bRight = board.x + (board.displayWidth * 0.5);
        const bLeft = board.x - (board.displayWidth * 0.5);
        const bBottom = board.y + board.displayHeight;
        const bTop = board.y; 

        // Decor: Góc trên bên phải (Top-Right) -> Neo vào góc trên phải (1, 0)
        this.add.image(bRight - 20, bTop + 20, TextureKeys.Decor)
            .setOrigin(1, 0);

        // Number: Góc trên bên trái (Top-Left) -> Neo vào góc trên trái (0, 0)
        const numberIcon = this.add.image(bLeft + 20, bTop + 20, TextureKeys.Number)
            .setOrigin(0, 0);

        // Dice: Cách Number 10px về phía sau (bên phải)
        // Neo góc trên trái (0, 0) để dễ tính từ mép phải của Number
        this.add.image(numberIcon.x + numberIcon.width + 30, bTop + 20, TextureKeys.Dice)
            .setOrigin(0, 0);
        
        
        // DebugHero
        this.hero = this.add.sprite(bRight - 20, bBottom - 20, TextureKeys.Sprite1);
        this.hero.setOrigin(1, 1).setScale(0.7).setVisible(false); 
        this.hero.play('listen_anim');
    }

    // =================================================================
    // PHẦN 3: LOGIC GAMEPLAY (GAMEPLAY LOGIC)
    // =================================================================

    private loadLevel(index: number) {
        if (index < 0 || index >= this.LEVEL_KEYS.length) {
            console.error("Invalid Level Index:", index);
            return;
        }

        const configKey = this.LEVEL_KEYS[index];
        this.isProcessing = false;

        // Load Config
        const data = this.cache.json.get(configKey);
        if (!data || !data.images) return;

        const newImageDefs = data.images;
        
        // 1. Reuse existing objects
        for (let i = 0; i < newImageDefs.length; i++) {
            const def = newImageDefs[i];
            const x = GameUtils.pctX(this, def.baseX_pct);
            const y = GameUtils.pctY(this, def.baseY_pct);
            
            let img: Phaser.GameObjects.Image;

            if (i < this.objectsToCount.length) {
                // Reuse existing
                img = this.objectsToCount[i];
                img.setTexture(def.textureKey);
                img.setPosition(x, y);
                img.setScale(def.baseScale || 0.5);
                img.setVisible(true);
                img.setActive(true);
            } else {
                // Create new if not enough
                img = this.add.image(x, y, def.textureKey).setScale(def.baseScale || 0.5);
                this.objectsToCount.push(img);
            }
        }

        // 2. Hide unused objects (Pool)
        for (let i = newImageDefs.length; i < this.objectsToCount.length; i++) {
            const unusedImg = this.objectsToCount[i];
            unusedImg.setVisible(false);
            unusedImg.setActive(false);
        }

        this.levelTarget = data.targetText;
    }

    private async runGameFlow() {
        if (this.isSessionActive || this.isStartingSession) return;
        this.isStartingSession = true;

        // 1. Check Permission (REMOVED)
        // const hasMicPermission = await this.voiceRecorder.checkPermission();
        // if (!hasMicPermission) {
        //     console.log("Cần quyền Mic!");
        //     this.isStartingSession = false;
        //     return;
        // }

        // 2. Resume Session (Counting Game)
        try {
            let sessionRes;

            // --- CHECK RESUME ---
            if (this.voiceHelper.sessionId) {
                console.log("[Scene3] Resuming Session:", this.voiceHelper.sessionId);
                // Fake response for local logic
                sessionRes = {
                    allowPlay: true,
                    quotaRemaining: this.currentQuota,
                    index: this.currentQuestionIndex,
                    message: "Resumed" 
                };
            } else {
                 console.error("[Scene3] Missing Session ID! Cannot resume.");
                 this.isStartingSession = false;
                 return;
            }

            if (!sessionRes.allowPlay) {
                console.log(sessionRes.message);
                this.isStartingSession = false;
                return;
            }

            this.currentQuota = sessionRes.quotaRemaining;
            
            // For Scene 3, index should be 3 globally if using sequential
            // But locally we likely map to 0 for level loading (DataKeys index 0 inside Scene3 context)
            
            this.isSessionActive = true;
            this.btnMic.setVisible(true);

            // Sync visual level with session index
            this.loadLevel(this.currentQuestionIndex);
            
            // Mark start question
            game.startQuestionTimer();

        } catch (err) {
            console.error("Session Start Error:", err);
        } finally {
            this.isStartingSession = false;
        }
    }

    private async sendAudioToBackend(audioBlob: Blob, inputTarget: string | object) {
        // --- DEBUG PLAYBACK ---
        // playRecordedAudio(audioBlob);
        // ----------------------

        if (!this.voiceHelper.sessionId) {
            console.error("[Voice] Submission failed: No Session ID.");
            return;
        }

        this.isProcessing = true;
        
        try {
            console.log("[Voice] Đang gửi Audio lên Server... (Vui lòng đợi kết quả)");
            const finalTargetText = (typeof inputTarget === 'string') ? { text: inputTarget } : inputTarget;
            
            // Dynamic Index based on Flow
            const flow = GameConstants.FLOW;
            const currentIndex = flow.indexOf(this.scene.key as any);
            const globalIndex = currentIndex + 1; // 1-based for API

            const result = await this.voiceHelper.submitAudio(
                audioBlob,
                finalTargetText,
                globalIndex, 
                0 
            );
            
            console.log("[Voice] Backend Result:", result);

            if (!result) {
                console.error("[Voice] No result from backend!");
                this.isProcessing = false;
                // Restart idle if no result
                if (this.idleManager) this.idleManager.start();
                return;
            }

            this.processResult(result);
            this.submissionCount++;

            if (result.score >= 60) {
                 game.recordCorrect({ scoreDelta: 1 });
                 game.finishQuestionTimer();
            } else {
                 game.recordWrong();
                 game.finishQuestionTimer();
            }

            // Show Popup
            const uiScene = this.scene.get(SceneKeys.UI) as any; 
            if (uiScene && uiScene.showScorePopup) {
                uiScene.showScorePopup(result.score, result.feedback);
            }

            // SDK: Report Progress
            sdk.score(result.score, result.score); 
            sdk.progress({
                 levelIndex: 2, // Scene 3 -> 2
                 total: 3,
                 score: result.score
            });

            // Transition Logic (Dynamic)
            GameUtils.handleSceneTransition(
                this, 
                this.voiceHelper.sessionId, 
                this.currentQuota,
                () => this.finishGameSession()
            );

        } catch (e: any) {
            console.error("Submit Error:", e);
            this.isProcessing = false;
            // Error occurred, restart idle timer
            if (this.idleManager) this.idleManager.start();
        }
    }

    public async finishGameSession(isUnload: boolean = false) {
        try {
            // Tính tổng số màn chơi động từ Config
            const TOTAL_QUESTIONS = GameConstants.FLOW.length;
             
            const endRes = await this.voiceHelper.finishEvaluation(
                TOTAL_QUESTIONS,
                isUnload
            );

            if (!endRes || isUnload) return;
            
            console.log("[Voice] FULL END SESSION DATA:", endRes);
            
            const uiScene = this.scene.get(SceneKeys.UI) as any;
            if (uiScene?.showFinalScorePopup) {
                uiScene.showFinalScorePopup(endRes.finalScore);
            }

            this.time.delayedCall(4000, () => {
                 this.scene.stop(SceneKeys.UI);
                 this.scene.start(SceneKeys.EndGame);
            });

        } catch (e) {
            console.error("End Session Error", e);
        }
    }

    private processResult(result: any) {
        // 1. Luôn phát voice nội dung (ví dụ: "Một ô tô")
        const contentVoice = "voice_3";
        AudioManager.play(contentVoice);

        const duration = AudioManager.getDuration(contentVoice) || 1.5;

        // 2. Chạy song song
        if (result.score >= 60){
            AudioManager.play("sfx-ting");
            this.time.delayedCall(duration * 1000, () => {
                AudioManager.play("sfx-correct");
            });
        } else {
            AudioManager.play("sfx-wrong");
            this.time.delayedCall(duration * 1000, () => {
                AudioManager.play("voice_wrong");
            });
        }
    }

    update(time: number, delta: number) {
        if (this.idleManager) this.idleManager.update(delta);
    }

    // =================================================================
    // PHẦN 4: HƯỚNG DẪN & GỢI Ý (TUTORIAL & HINT)
    // =================================================================

    private setupIdleManager() {
        this.idleManager = new IdleManager(GameConstants.IDLE.THRESHOLD, () => this.handleIdle());
        this.handCursor = this.add.image(0, 0, TextureKeys.HandHint).setVisible(false).setDepth(100);
    }

    private handleIdle() {
        if (!this.btnMic || !this.btnMic.visible) return;
        
        // PAUSE idle timer while showing hint
        if (this.idleManager) this.idleManager.stop();
        
        game.addHint(); // Track hint
        AudioManager.play('hint');
        const targetX = this.btnMic.x;
        const targetY = this.btnMic.y;

        this.handCursor.setPosition(targetX + 65, targetY + 50).setVisible(true).setScale(1);

        if (this.handTween) this.handTween.stop();
        this.handTween = this.tweens.add({
            targets: this.handCursor,
            scale: 1.2,
            duration: 800, 
            yoyo: true, 
            repeat: 2, 
            ease: 'Sine.easeInOut',
            onComplete: () => {
                this.handCursor.setVisible(false);
                this.handCursor.setScale(1);

                // RESUME idle timer after hint finishes
                if (this.idleManager) this.idleManager.start();
            }
        });
    }

    private resetIdle() {
        if (this.idleManager) this.idleManager.reset();
        this.hideIdleHint();
    }

    private hideIdleHint() {
        if (this.handCursor) this.handCursor.setVisible(false);
        if (this.handTween) this.handTween.stop();
        AudioManager.stopSound('hint'); 
    }

    private playIntroSequence() {
        this.isIntroActive = true;
        if (this.idleManager) this.idleManager.start();
        
        playVoiceLocked(null, 'voice_intro_s3');
        this.time.delayedCall(GameConstants.SCENE1.TIMING.INTRO_DELAY, () => {
             // Intro animation or logic if needed (Currently empty)
        });
    }

    private runHandTutorial(){}
}
