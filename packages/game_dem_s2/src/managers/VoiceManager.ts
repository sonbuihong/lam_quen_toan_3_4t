import Phaser from 'phaser';
import { VoiceRecorder } from '../utils/VoiceRecorder';
import { useVoiceEvaluation } from '../hooks/useVoiceEvaluation';
import AudioManager from '../audio/AudioManager';
import { GameConstants } from '../consts/GameConstants';
import { GameUtils } from '../utils/GameUtils';
import { AudioKeys } from '../consts/Keys';
import { game } from "@iruka-edu/mini-game-sdk";

/**
 * Configuration cho VoiceManager
 * Chứa tất cả dependencies và callbacks cần thiết
 */
export interface VoiceManagerConfig {
    scene: Phaser.Scene;
    voiceHelper: ReturnType<typeof useVoiceEvaluation>;
    bgm?: Phaser.Sound.BaseSound;
    
    // UI References
    btnMic: Phaser.GameObjects.Image;
    hero?: Phaser.GameObjects.Sprite;
    radiatingCircles: Phaser.GameObjects.Arc[];
    
    // Callbacks
    onSessionStart?: (sessionData: any) => void;
    onRecordingStart?: () => void;
    onRecordingStop?: () => void;
    onResultReceived?: (result: any) => void;
    onSessionFinish?: (endData: any) => void;
    onProcessingStart?: () => void;
    onProcessingEnd?: () => void;
}

/**
 * Voice State - Quản lý trạng thái của voice session
 */
interface VoiceState {
    isRecording: boolean;
    isProcessing: boolean;
    isSessionActive: boolean;
    isStartingSession: boolean;
    submissionCount: number;
    currentQuota: number;
    sessionId: string | null;
}

/**
 * VoiceManager - Quản lý toàn bộ voice logic
 * 
 * Trách nhiệm chính:
 * - Khởi tạo và quản lý VoiceRecorder
 * - Quản lý voice evaluation session lifecycle
 * - Xử lý recording callbacks và visual feedback
 * - Submit audio và xử lý kết quả
 */
export class VoiceManager {
    // Core systems
    private scene: Phaser.Scene;
    private voiceRecorder!: VoiceRecorder;
    private voiceHelper: ReturnType<typeof useVoiceEvaluation>;
    private bgm?: Phaser.Sound.BaseSound;
    
    // State management (private - encapsulated)
    private state: VoiceState = {
        isRecording: false,
        isProcessing: false,
        isSessionActive: false,
        isStartingSession: false,
        submissionCount: 0,
        currentQuota: 0,
        sessionId: null
    };
    
    // Track audio blob cho record+submit flow
    private pendingAudioBlob: Blob | null = null;
    private pendingSubmitInfo: { targetText: string | object, globalIndex: number, localIndex: number } | null = null;
    
    // UI Elements
    private btnMic: Phaser.GameObjects.Image;
    private hero?: Phaser.GameObjects.Sprite;
    private radiatingCircles: Phaser.GameObjects.Arc[];
    
    // Callbacks
    private callbacks: {
        onSessionStart?: (sessionData: any) => void;
        onRecordingStart?: () => void;
        onRecordingStop?: () => void;
        onResultReceived?: (result: any) => void;
        onSessionFinish?: (endData: any) => void;
        onProcessingStart?: () => void;
        onProcessingEnd?: () => void;
    };
    
    // ================= CONSTRUCTOR & INITIALIZATION =================
    
    /**
     * Constructor - Inject dependencies và setup
     */
    constructor(config: VoiceManagerConfig) {
        this.scene = config.scene;
        this.voiceHelper = config.voiceHelper;
        this.bgm = config.bgm;
        this.btnMic = config.btnMic;
        this.hero = config.hero;
        this.radiatingCircles = config.radiatingCircles;
        
        this.callbacks = {
            onSessionStart: config.onSessionStart,
            onRecordingStart: config.onRecordingStart,
            onRecordingStop: config.onRecordingStop,
            onResultReceived: config.onResultReceived,
            onSessionFinish: config.onSessionFinish,
            onProcessingStart: config.onProcessingStart,
            onProcessingEnd: config.onProcessingEnd,
        };
        
        this.setupRecorder();
    }
    
    /**
     * Setup VoiceRecorder với callbacks
     */
    private setupRecorder(): void {
        this.voiceRecorder = new VoiceRecorder({
            onRecordingStart: () => this.handleRecordingStart(),
            onRecordingStop: (audioBlob, duration) => {
                // Store audioBlob để có thể access sau này
                this.pendingAudioBlob = audioBlob;
                this.handleRecordingStop(audioBlob, duration);
            },
            onVolumeChange: () => {},
            onError: (err) => console.error("[VoiceManager] Mic Error:", err)
        });
    }
    
    // ================= PUBLIC API =================
    
    /**
     * Getter: Check if đang recording
     */
    get isRecording(): boolean {
        return this.state.isRecording;
    }
    
    /**
     * Getter: Check if đang processing
     */
    get isProcessing(): boolean {
        return this.state.isProcessing;
    }
    
    /**
     * Getter: Check if session đang active
     */
    get isSessionActive(): boolean {
        return this.state.isSessionActive;
    }
    
    /**
     * Getter: Lấy session ID hiện tại
     */
    get sessionId(): string | null {
        return this.voiceHelper.sessionId;
    }
    
    /**
     * Getter: Lấy quota còn lại
     */
    get currentQuota(): number {
        return this.state.currentQuota;
    }
    
    /**
     * Start voice evaluation session
     * @returns Session data hoặc null nếu failed
     */
    async startSession(): Promise<any | null> {
        // Guard: Tránh start multiple sessions
        if (this.state.isSessionActive || this.state.isStartingSession) {
            console.warn("[VoiceManager] Session already starting/active");
            return null;
        }
        
        this.state.isStartingSession = true;
        
        try {
            console.log("[VoiceManager] Starting evaluation session...");
            const sessionRes = await this.voiceHelper.startEvaluation();
            
            if (!sessionRes.allowPlay) {
                console.log("[VoiceManager] Session denied:", sessionRes.message);
                this.state.isStartingSession = false;
                return null;
            }
            
            console.log("[VoiceManager] Session created:", sessionRes);
            
            // Update state
            this.state.currentQuota = sessionRes.quotaRemaining;
            this.state.isSessionActive = true;
            this.state.sessionId = this.voiceHelper.sessionId;
            
            // Notify callback
            if (this.callbacks.onSessionStart) {
                this.callbacks.onSessionStart(sessionRes);
            }
            
            return sessionRes;
            
        } catch (err) {
            console.error("[VoiceManager] Session start error:", err);
            return null;
        } finally {
            this.state.isStartingSession = false;
        }
    }
    
    /**
     * Start recording (check permission trước)
     */
    async startRecording(): Promise<boolean> {
        // Guard: Không cho phép record khi đang processing
        if (this.state.isProcessing) {
            console.warn("[VoiceManager] Cannot record while processing");
            return false;
        }
        
        const hasPermission = await this.voiceRecorder.checkPermission();
        if (!hasPermission) {
            console.log("[VoiceManager] Mic permission denied");
            alert("Quyền Mic bị từ chối");
            return false;
        }
        
        this.voiceRecorder.start();
        return true;
    }
    
    /**
     * Stop recording
     */
    stopRecording(): void {
        if (this.state.isRecording) {
            this.voiceRecorder.stop();
        }
    }
    
    /**
     * Submit audio để xử lý
     * @param audioBlob Audio blob từ recorder
     * @param targetText Target text để evaluate (string hoặc object)
     * @param globalIndex Index của câu hỏi trong toàn bộ game flow
     * @param localIndex Index của câu hỏi trong scene hiện tại
     */
    async submitAudio(
        audioBlob: Blob, 
        targetText: string | object,
        globalIndex: number = 1,
        localIndex: number = 0
    ): Promise<any | null> {
        if (!this.voiceHelper.sessionId) {
            console.error("[VoiceManager] No session ID - cannot submit");
            return null;
        }
        
        this.state.isProcessing = true;
        
        // Notify processing start
        if (this.callbacks.onProcessingStart) {
            this.callbacks.onProcessingStart();
        }
        
        try {
            console.log("[VoiceManager] Submitting audio...");
            
            const finalTargetText = (typeof targetText === 'string') 
                ? { text: targetText } 
                : targetText;
            
            const result = await this.voiceHelper.submitAudio(
                audioBlob, 
                finalTargetText, 
                globalIndex, 
                localIndex
            );
            
            console.log("[VoiceManager] Result:", result);
            
            if (!result) {
                console.error("[VoiceManager] No result returned");
                return null;
            }
            
            this.state.submissionCount++;
            
            // Notify result received
            if (this.callbacks.onResultReceived) {
                this.callbacks.onResultReceived(result);
            }
            
            return result;
            
        } catch (e) {
            console.error("[VoiceManager] Submit error:", e);
            return null;
        } finally {
            this.state.isProcessing = false;
            
            // Notify processing end
            if (this.callbacks.onProcessingEnd) {
                this.callbacks.onProcessingEnd();
            }
        }
    }
    
    /**
     * Finish evaluation session
     * @param totalLevels Tổng số levels trong game
     * @param isUnload Có phải đang unload không
     */
    async finishSession(totalLevels: number = 1, isUnload: boolean = false): Promise<any | null> {
        if (!this.state.isSessionActive) {
            console.warn("[VoiceManager] No active session to finish");
            return null;
        }
        
        try {
            console.log("[VoiceManager] Finishing session...");
            const endRes = await this.voiceHelper.finishEvaluation(totalLevels, isUnload);
            console.log("[VoiceManager] Session ended:", endRes);
            
            // Reset state
            this.state.isSessionActive = false;
            this.state.sessionId = null;
            
            if (!endRes || isUnload) {
                return null;
            }
            
            // Notify callback
            if (this.callbacks.onSessionFinish) {
                this.callbacks.onSessionFinish(endRes);
            }
            
            return endRes;
            
        } catch (e) {
            console.error("[VoiceManager] Finish session error:", e);
            return null;
        }
    }
    
    /**
     * Process feedback - Play audio và visual feedback
     * @param result Result object với score, feedback, etc.
     */
    processFeedback(result: any): void {
        const isPassed = result.score >= GameConstants.SCENE1.PASS_SCORE;
        const contentVoice = "voice_1";
        
        AudioManager.play(contentVoice);
        const duration = AudioManager.getDuration(contentVoice) || 1.5;
        
        if (isPassed) {
            AudioManager.play("sfx-ting");
            this.scene.time.delayedCall(duration * 1000, () => {
                AudioManager.play("sfx-correct");
            });
        } else {
            AudioManager.play("sfx-wrong");
            this.scene.time.delayedCall(duration * 1000, () => {
                AudioManager.play("voice_wrong");
            });
        }
    }
    
    /**
     * Cleanup - Gọi khi scene shutdown
     */
    cleanup(): void {
        // Stop recorder nếu đang chạy
        if (this.state.isRecording) {
            this.voiceRecorder.stop();
        }
        
        // Finish session nếu đang active
        if (this.state.isSessionActive) {
            this.finishSession(1, true);
        }
        
        console.log("[VoiceManager] Cleanup completed");
    }
    
    /**
     * Record and submit audio - Method tích hợp để record và tự động submit
     * Đây là method tiện lợi để gọi từ UI, handle toàn bộ flow
     * 
     * @param targetText Target text để evaluate
     * @param globalIndex Global index trong toàn bộ game flow
     * @param localIndex Local index trong scene hiện tại
     */
    async recordAndSubmitAudio(
        targetText: string | object,
        globalIndex: number = 1,
        localIndex: number = 0
    ): Promise<void> {
        // Store submit info để sử dụng sau khi recording xong
        this.pendingSubmitInfo = { targetText, globalIndex, localIndex };
        
        // Store original callback
        const originalOnStop = this.callbacks.onRecordingStop;
        
        // Override callback để auto-submit
        this.callbacks.onRecordingStop = async () => {
            // Call original callback
            if (originalOnStop) originalOnStop();
            
            // Submit audio nếu có blob
            if (this.pendingAudioBlob && this.pendingSubmitInfo) {
                await this.submitAudio(
                    this.pendingAudioBlob,
                    this.pendingSubmitInfo.targetText,
                    this.pendingSubmitInfo.globalIndex,
                    this.pendingSubmitInfo.localIndex
                );
                
                // Clear pending state
                this.pendingAudioBlob = null;
                this.pendingSubmitInfo = null;
            }
            
            // Restore original callback
            this.callbacks.onRecordingStop = originalOnStop;
        };
        
        // Start recording
        await this.startRecording();
    }
    
    // ================= PRIVATE METHODS =================
    
    /**
     * Handle khi recording bắt đầu
     * - Pause BGM
     * - Show visual feedback (mic animation, hero, radiating circles)
     */
    private handleRecordingStart(): void {
        // Pause audio
        if (this.bgm?.isPlaying) {
            this.bgm.pause();
        }
        AudioManager.stopAll();
        
        this.state.isRecording = true;
        
        // Visual feedback: Mic animation
        this.showRecordingFeedback();
        
        // Notify callback
        if (this.callbacks.onRecordingStart) {
            this.callbacks.onRecordingStart();
        }
    }
    
    /**
     * Handle khi recording dừng
     * - Resume BGM
     * - Hide visual feedback
     * - Validate duration
     * - Submit audio nếu valid
     */
    private handleRecordingStop(audioBlob: Blob, duration: number): void {
        AudioManager.restoreAudioAfterRecording();
        
        // Resume BGM
        if (this.bgm?.isPaused) {
            this.bgm.resume();
        }
        
        this.state.isRecording = false;
        
        // Hide visual feedback
        this.hideRecordingFeedback();
        
        console.log(`[VoiceManager] Recording duration: ${duration}ms (Min: ${GameConstants.VOICE.MIN_DURATION}ms)`);
        
        // Validate duration
        if (duration < GameConstants.VOICE.MIN_DURATION) {
            console.log(`%c[VoiceManager] Recording too short - ignored`, "color: orange");
            AudioManager.play('sfx-wrong');
            
            // Notify callback
            if (this.callbacks.onRecordingStop) {
                this.callbacks.onRecordingStop();
            }
            return;
        }
        
        // Valid recording - will be handled by caller
        // Notify callback
        if (this.callbacks.onRecordingStop) {
            this.callbacks.onRecordingStop();
        }
    }
    
    /**
     * Show recording visual feedback
     * - Mic scale animation
     * - Radiating circles
     * - Hero sprite animation
     */
    private showRecordingFeedback(): void {
        // Mic animation
        this.scene.tweens.add({
            targets: this.btnMic,
            scale: GameConstants.SCENE1.SCALES.MIC_RECORDING,
            duration: 200,
            yoyo: true,
            repeat: -1
        });
        
        // Radiating circles
        GameUtils.startRadiatingEffect(this.scene, this.btnMic, this.radiatingCircles);
        
        // Hero sprite
        if (this.hero) {
            this.hero.setVisible(true);
            this.hero.play('listen_anim');
        }
    }
    
    /**
     * Hide recording visual feedback
     */
    private hideRecordingFeedback(): void {
        // Stop mic animation
        this.btnMic.setScale(GameConstants.SCENE1.SCALES.MIC);
        this.scene.tweens.killTweensOf(this.btnMic);
        
        // Stop radiating circles
        GameUtils.stopRadiatingEffect(this.scene, this.radiatingCircles);
        
        // Hide hero sprite
        if (this.hero) {
            this.hero.setVisible(false);
            this.hero.stop();
        }
    }
}
