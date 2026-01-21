import Phaser from 'phaser';
import { SceneKeys, TextureKeys, AudioKeys, DataKeys } from '../consts/Keys';
import { GameConstants } from '../consts/GameConstants';
import { GameUtils } from '../utils/GameUtils';
import { changeBackground } from '../utils/BackgroundManager';
import { VoiceRecorder } from '../utils/VoiceRecorder';
import AudioManager from '../audio/AudioManager';
import { showGameButtons, hideGameButtons } from '../main';
import { useVoiceEvaluation } from '../hooks/useVoiceEvaluation';
import { playVoiceLocked, setGameSceneReference, resetVoiceState } from '../utils/rotateOrientation';
import { IdleManager } from '../utils/IdleManager';
import { ExerciseType } from '../lib/voice-session-client';

export default class Scene1 extends Phaser.Scene {
    // --- PROPERTIES ---
    private bgm!: Phaser.Sound.BaseSound;
    private voiceRecorder!: VoiceRecorder;
    private objectsToCount: Phaser.GameObjects.Image[] = [];
    private currentQuota: number = 0;
    
    // Level Management
    private LEVEL_KEYS = [DataKeys.LevelS1Config];
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
    // Explicitly using COUNTING for clarity, though hook defaults to it.
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
    
    // Idle
    private idleManager!: IdleManager;
    private handCursor!: Phaser.GameObjects.Image;
    private handTween!: Phaser.Tweens.Tween;

    constructor() {
        super(SceneKeys.Scene1);
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

        // 3. Init Logic (Load Level 1 but don't play yet)
        this.loadLevel(0);

        // 4. Intro & Start Flow
        if (!this.scene.get(SceneKeys.UI).scene.isActive()) {
            this.scene.launch(SceneKeys.UI, { sceneKey: SceneKeys.Scene1 });
            this.scene.bringToTop(SceneKeys.UI);
        }

        this.handleIntroLogic();


    }

    private handleIntroLogic() {
         if (Scene1.hasInteracted || this.isRestart) {
             this.resumeAudioContext();
             setTimeout(() => {
                this.playIntroSequence();
                this.runGameFlow(); 
             }, 500);

        } else {
             this.input.once('pointerdown', () => {
                Scene1.hasInteracted = true;
                this.resumeAudioContext();
                this.playIntroSequence();
                this.runGameFlow();
             });
        }
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
                // Stop idle timer while recording
                if (this.idleManager) this.idleManager.stop();
            },
            onRecordingStop: (audioBlob, duration) => {
                if (this.bgm && this.bgm.isPaused) this.bgm.resume();
                this.isRecording = false;
                this.btnMic.setScale(1); 
                this.tweens.killTweensOf(this.btnMic);

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
            .setOrigin(0.5, 0).setScale(scl[0], scl[1]).setDepth(0);
        board.displayWidth = GameUtils.getW(this) * 0.93;
            
        // 2. Nút Loa
        // this.add.image(cx * 1.77, boardY * 6.5, TextureKeys.Loa).setOrigin(0.5).setScale(1);

        // 3. Nút Mic
        this.btnMic = this.add.image(cx, GameUtils.pctY(this, 0.85), TextureKeys.Mic) 
             .setScale(1).setInteractive().setVisible(false);

        this.btnMic.on('pointerdown', () => {
             // Block interaction if processing result
             if (this.isProcessing) return;

             this.resetIdle(); 
             if (this.isRecording) {
                 this.voiceRecorder.stop(); 
             } else {
                 this.voiceRecorder.start();
             }
        });

        // 4. Nút nghe lại
        this.btnPlayback = this.add.image(cx + 100, GameUtils.pctY(this, 0.85), TextureKeys.Mic)
             .setScale(0.7).setInteractive().setVisible(false);
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

        // 1. Check Permission
        const hasMicPermission = await this.voiceRecorder.checkPermission();
        if (!hasMicPermission) {
            console.log("Cần quyền Mic!");
            this.isStartingSession = false;
            return;
        }

        // 2. Start Session (Counting Game)
        console.log("Starting Session...");
        try {
            let sessionRes;
            // Always call startEvaluation regardless of testMode. 
            // The hook handles passing the testmode flag to the backend.
            sessionRes = await this.voiceHelper.startEvaluation();

            if (!sessionRes.allowPlay) {
                console.log("[Voice] Session Start Failed:", sessionRes.message);
                console.log("[Voice] FULL SESSION DATA:", sessionRes);
                this.isStartingSession = false;
                return;
            }

            console.log("[Voice] FULL SESSION DATA:", sessionRes);

            this.currentQuota = sessionRes.quotaRemaining;
            this.currentQuestionIndex = sessionRes.index; // Resume index
            
            // Check boundary
            if (this.currentQuestionIndex >= this.LEVEL_KEYS.length) {
                this.currentQuestionIndex = 0; // Reset logic?
            }

            this.isSessionActive = true;
            this.btnMic.setVisible(true);
            
            console.log("========================================");
            console.log("SCENE 1 SESSION ID:", this.voiceHelper.sessionId);
            console.log("========================================");

            // Sync visual level with session index
            this.loadLevel(this.currentQuestionIndex);

        } catch (err) {
            console.error("Session Start Error:", err);
        } finally {
            this.isStartingSession = false;
        }
    }

    private async sendAudioToBackend(audioBlob: Blob, inputTarget: string | object) {
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

            // Show Popup
            const uiScene = this.scene.get(SceneKeys.UI) as any; 
            if (uiScene && uiScene.showScorePopup) {
                uiScene.showScorePopup(result.score, result.feedback);
            }

            // Transition Logic (Dynamic)
            GameUtils.handleSceneTransition(
                this, 
                this.voiceHelper.sessionId, 
                this.currentQuota,
                () => this.finishGameSession() // Callback cho màn cuối (nếu Scene 1 là màn cuối)
            );

        } catch (e: any) {
            console.error("Submit Error:", e);
            this.isProcessing = false;
            // Error occurred, restart idle timer
            if (this.idleManager) this.idleManager.start();
        }
    }

    private async finishGameSession(isUnload: boolean = false) {
        try {
            const endRes = await this.voiceHelper.finishEvaluation(
                this.LEVEL_KEYS.length,
                isUnload
            );

            console.log("[Voice] FULL END SESSION DATA:", endRes);

            if (!endRes || isUnload) return;
            
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
        if (result.score >= 60){
            AudioManager.play("sfx-ting");
            setTimeout(() => {
                AudioManager.play("sfx-correct");
            }, 1200);
        } else {
            AudioManager.play("sfx-wrong");
            setTimeout(() => {
                AudioManager.play("voice_wrong");
            }, 1200);
        }
        AudioManager.play("voice_1");
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

        AudioManager.play('hint');
        const targetX = this.btnMic.x;
        const targetY = this.btnMic.y;

        this.handCursor.setPosition(targetX + 100, targetY + 100).setVisible(true).setScale(1);

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

        playVoiceLocked(null, 'voice_intro_s2');
        this.time.delayedCall(GameConstants.SCENE1.TIMING.INTRO_DELAY, () => {
            if (this.isIntroActive) this.runHandTutorial();
        });
    }

    private runHandTutorial(){}
}
