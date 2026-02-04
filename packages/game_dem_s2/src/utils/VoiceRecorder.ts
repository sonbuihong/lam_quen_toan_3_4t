import { GameConstants } from '../consts/GameConstants';

export interface VoiceRecorderEvents {
    onRecordingStart?: () => void;
    onRecordingStop?: (blob: Blob, duration: number) => void;
    onVolumeChange?: (volume: number) => void;
    onSilenceDetected?: () => void;
    onError?: (error: string) => void;
}

export class VoiceRecorder {
    private mediaRecorder: MediaRecorder | null = null;
    private audioChunks: Blob[] = [];
    private audioContext: AudioContext | null = null;
    private analyser: AnalyserNode | null = null;
    private microphoneStreamSource: MediaStreamAudioSourceNode | null = null;
    private silenceCheckInterval: number | null = null;
    
    private recordingStartTime: number = 0;
    private lastSpeechTime: number = 0;
    private isRecording: boolean = false;

    constructor(private events: VoiceRecorderEvents) {}

    public async checkPermission(): Promise<boolean> {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            return false;
        }
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            stream.getTracks().forEach(track => track.stop());
            return true;
        } catch (err) {
            return false;
        }
    }

    public async start() {
        if (this.isRecording) return;

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.setupMediaRecorder(stream);
            this.setupSilenceDetection(stream);
            
            this.isRecording = true;
            this.recordingStartTime = Date.now();
            this.lastSpeechTime = Date.now();
            
            if (this.events.onRecordingStart) {
                this.events.onRecordingStart();
            }
        } catch (err: any) {
            if (this.events.onError) {
                this.events.onError(err.message || "Microphone access denied");
            }
        }
    }

    public stop() {
        if (!this.isRecording) return;
        
        this.cleanupAudioContext();
        
        try {
            if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
                this.mediaRecorder.stop();
                if (this.mediaRecorder.stream) {
                    this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
                }
            }
        } catch (error) {
            console.warn("Error stopping MediaRecorder:", error);
        }
        
        this.isRecording = false;
    }

    private setupMediaRecorder(stream: MediaStream) {
        this.mediaRecorder = new MediaRecorder(stream);
        this.audioChunks = [];

        this.mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                this.audioChunks.push(event.data);
            }
        };

        this.mediaRecorder.onstop = () => {
             const audioBlob = new Blob(this.audioChunks, { type: 'audio/wav' });
             const duration = Date.now() - this.recordingStartTime;
             if (this.events.onRecordingStop) {
                 this.events.onRecordingStop(audioBlob, duration);
             }
        };

        this.mediaRecorder.start();
    }

    private setupSilenceDetection(stream: MediaStream) {
        try {
             const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
             this.audioContext = new AudioContextClass();
             this.analyser = this.audioContext.createAnalyser();
             this.analyser.fftSize = 256;
             this.microphoneStreamSource = this.audioContext.createMediaStreamSource(stream);
             this.microphoneStreamSource.connect(this.analyser);
             
             this.silenceCheckInterval = window.setInterval(() => this.checkSilence(), 100);
        } catch (e) {
             console.warn("AudioContext setup failed", e);
        }
    }

    private checkSilence() {
        if (!this.isRecording || !this.analyser) return;

        // Xử lý AudioContext state (safeguard cho browser)
        if (this.audioContext && this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }

        const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
        this.analyser.getByteFrequencyData(dataArray);

        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
        const average = sum / dataArray.length;
        const normalizedVol = average / 255;

        // Callback volume logic
        if (this.events.onVolumeChange) {
            this.events.onVolumeChange(normalizedVol);
        }

        const now = Date.now();
        if (normalizedVol > GameConstants.VOICE.SILENCE_THRESHOLD) {
            this.lastSpeechTime = now;
        }

        const silenceDuration = now - this.lastSpeechTime;
        const totalDuration = now - this.recordingStartTime;

        if (silenceDuration > GameConstants.VOICE.SILENCE_DURATION) {
            this.stop();
            if (this.events.onSilenceDetected) {
                this.events.onSilenceDetected();
            }
            return;
        }

        if (totalDuration > GameConstants.VOICE.MAX_RECORD_DURATION) {
            this.stop();
        }
    }

    private cleanupAudioContext() {
        if (this.silenceCheckInterval) {
            clearInterval(this.silenceCheckInterval);
            this.silenceCheckInterval = null;
        }
        if (this.audioContext) {
            this.audioContext.close().catch(() => {});
            this.audioContext = null;
        }
        this.analyser = null;
        this.microphoneStreamSource = null;
    }
}
