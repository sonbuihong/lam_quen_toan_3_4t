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
    private LEVEL_KEYS = [DataKeys.LevelS1Config, DataKeys.LevelS2Config, DataKeys.LevelS3Config];
    private currentQuestionIndex: number = 0; // Maps to Level Index (0, 1, 2)
    private levelTarget: any = null;

    private isIntroActive: boolean = false;
    private isWaitingForIntroStart: boolean = true;
    private static hasInteracted: boolean = false;

    // Logic States
    private isProcessing: boolean = false; // Chặn spam request
    private isSessionActive: boolean = false; // Check session status
    private isStartingSession: boolean = false; // Guard for async start
    private submissionCount: number = 0; // Check valid submissions
    private isRecording: boolean = false;
    private testMode: boolean = true; // Bật Test Mode để debug

    // Voice Hook
    // Explicitly using COUNTING for clarity, though hook defaults to it.
    private voiceHelper = useVoiceEvaluation({
        childId: 'sonbui_8386',
        gameId: 'game_dem_so_1',
        gameVersion: '1.0.0',
        gameType: ExerciseType.COUNTING, 
        ageLevel: '3-4'
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

    init() {
        this.objectsToCount = [];
        this.currentQuestionIndex = 0;
        this.isProcessing = false;
        this.submissionCount = 0;
        this.isSessionActive = false;
        this.isStartingSession = false;
        this.isRecording = false;
        resetVoiceState();
    }

    create() {
        window.gameScene = this;
        setGameSceneReference(this);
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

        this.input.on('pointerdown', () => {
             if (!this.isSessionActive && !this.isWaitingForIntroStart) {
                 this.runGameFlow();
             }
        });
    }

    private handleIntroLogic() {
         if (Scene1.hasInteracted) {
             this.isWaitingForIntroStart = false;
             this.resumeAudioContext();
             setTimeout(() => {
                this.playIntroSequence();
                this.runGameFlow(); 
             }, 500);

        } else {
             this.isWaitingForIntroStart = true;
             this.input.once('pointerdown', () => {
                Scene1.hasInteracted = true;
                this.isWaitingForIntroStart = false;
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
            },
            onRecordingStop: (audioBlob, duration) => {
                if (this.bgm && this.bgm.isPaused) this.bgm.resume();
                this.isRecording = false;
                this.btnMic.setScale(1); 
                this.tweens.killTweensOf(this.btnMic);

                if (duration < 500) {
                    console.log("Noise ignored.");
                    return;
                }
                
                // Auto Submit
                const targetText = this.levelTarget || { start: 1, end: 1 };
                this.sendAudioToBackend(audioBlob, targetText);
            },
            onVolumeChange: (vol) => {},
            onError: (err) => console.error("Mic Error:", err)
        });
        
        // Button Logic will be bound in createUI or here? 
        // btnMic created in createUI. Need to bind event there or ensuring it exists.
        // It's safer to bind in createUI or create.
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
        this.add.image(cx * 1.77, boardY * 6.5, TextureKeys.Loa).setOrigin(0.5).setScale(1);

        // 3. Nút Mic
        this.btnMic = this.add.image(cx, GameUtils.pctY(this, 0.85), TextureKeys.Mic) 
             .setScale(1).setInteractive().setVisible(false);

        this.btnMic.on('pointerdown', () => {
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

        // Cleanup
        this.objectsToCount.forEach(obj => obj.destroy());
        this.objectsToCount = [];

        // Load Config
        const data = this.cache.json.get(configKey);
        if (!data || !data.images) return;

        // Create objects
        data.images.forEach((def: any) => {
             const x = GameUtils.pctX(this, def.baseX_pct);
             const y = GameUtils.pctY(this, def.baseY_pct);
             const img = this.add.image(x, y, def.textureKey).setScale(def.baseScale || 0.5);
             this.objectsToCount.push(img);
        });

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
            if (this.testMode) {
                 sessionRes = { allowPlay: true, quotaRemaining: 999, index: 0 };
            } else {
                 sessionRes = await this.voiceHelper.startEvaluation();
            }

            if (!sessionRes.allowPlay) {
                console.log(sessionRes.message);
                this.isStartingSession = false;
                return;
            }

            this.currentQuota = sessionRes.quotaRemaining;
            this.currentQuestionIndex = sessionRes.index; // Resume index
            
            // Check boundary
            if (this.currentQuestionIndex >= this.LEVEL_KEYS.length) {
                this.currentQuestionIndex = 0; // Reset logic?
            }

            this.isSessionActive = true;
            this.btnMic.setVisible(true);

            // Sync visual level with session index
            this.loadLevel(this.currentQuestionIndex);

        } catch (err) {
            console.error("Session Start Error:", err);
        } finally {
            this.isStartingSession = false;
        }
    }

    private async sendAudioToBackend(audioBlob: Blob, inputTarget: string | object) {
        if (this.isProcessing || !this.voiceHelper.sessionId) return;
        
        this.isProcessing = true;
        
        try {
            const finalTargetText = (typeof inputTarget === 'string') ? { text: inputTarget } : inputTarget;
            
            // Submit (Index is 1-based for API)
            const result = await this.voiceHelper.submitAudio(
                audioBlob,
                finalTargetText,
                this.currentQuestionIndex + 1,
                0 
            );
            
            this.processResult(result);
            this.submissionCount++;

            // Show Popup
            const uiScene = this.scene.get(SceneKeys.UI) as any; 
            if (uiScene && uiScene.showScorePopup) {
                uiScene.showScorePopup(result.score, result.feedback);
            }

            // Transition Logic
            const nextIndex = this.currentQuestionIndex + 1;
            this.time.delayedCall(3000, () => {
                if (uiScene?.hideScorePopup) uiScene.hideScorePopup();

                if (nextIndex < this.LEVEL_KEYS.length) {
                    this.currentQuestionIndex = nextIndex;
                    this.loadLevel(this.currentQuestionIndex);
                } else {
                    this.finishGameSession();
                }
            });

        } catch (e: any) {
            console.error("Submit Error:", e);
            this.isProcessing = false;
        }
    }

    private async finishGameSession(isUnload: boolean = false) {
        try {
            const endRes = await this.voiceHelper.finishEvaluation(
                this.LEVEL_KEYS.length,
                isUnload
            );

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
        if (result.score >= 60) AudioManager.play("sfx-correct"); 
        else AudioManager.play("sfx-wrong");
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
