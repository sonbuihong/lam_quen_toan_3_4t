import { Howl, Howler } from 'howler';

interface SoundConfig {
    src: string;
    loop?: boolean;
    volume?: number;
}

const BASE_PATH = 'assets/audio/';

// Anh xa ID am thanh va cau hinh chi tiet
const SOUND_MAP: Record<string, SoundConfig> = {
    // SFX Chung
    'sfx-correct': { src: `${BASE_PATH}sfx/correct_answer.mp3`, volume: 1.0 },
    'sfx-correct_s2': { src: `${BASE_PATH}sfx/correct_color.mp3`, volume: 1.0 },
    'sfx-wrong': { src: `${BASE_PATH}sfx/wrong.mp3`, volume: 0.5 },
    'sfx-click': { src: `${BASE_PATH}sfx/click.mp3`, volume: 0.5 },
    'sfx-ting': { src: `${BASE_PATH}sfx/correct.mp3`, volume: 0.6 },

    // Prompt Voice
    'voice-rotate': { src: `${BASE_PATH}prompt/rotate.mp3`, volume: 0.8 },
    'voice_intro_s2': { src: `${BASE_PATH}prompt/instruction.mp3`, volume: 1 },
    'hint': { src: `${BASE_PATH}prompt/hint.mp3`, volume: 1.0 },

    // EndGame SFX
    'complete': { src: `${BASE_PATH}sfx/complete.mp3`, volume: 1.0 },
    'fireworks': { src: `${BASE_PATH}sfx/fireworks.mp3`, volume: 1.0 },
    'applause': { src: `${BASE_PATH}sfx/applause.mp3`, volume: 1.0 },
};

class AudioManager {
    private sounds: Record<string, Howl> = {};
    private isLoaded: boolean = false;

    constructor() {
        Howler.autoUnlock = true;
        Howler.volume(1.0);
    }

    /** Tai tat ca am thanh trong SOUND_MAP */
    loadAll(): Promise<void> {
        if (this.isLoaded) {
            return Promise.resolve();
        }

        return new Promise((resolve) => {
            const keys = Object.keys(SOUND_MAP);
            let loadedCount = 0;
            const total = keys.length;

            if (total === 0) return resolve();

            keys.forEach((key) => {
                const config = SOUND_MAP[key];

                this.sounds[key] = new Howl({
                    src: [config.src],
                    loop: config.loop || false,
                    volume: config.volume || 1.0,
                    html5: true,
                    onload: () => {
                        loadedCount++;
                        if (loadedCount === total) {
                            this.isLoaded = true;
                            resolve();
                        }
                    },
                    onloaderror: () => {
                        // Van tiep tuc load cac file khac neu 1 file loi
                        loadedCount++;
                        if (loadedCount === total) {
                            this.isLoaded = true;
                            resolve();
                        }
                    },
                });
            });
        });
    }

    /**
     * Phat am thanh theo ID.
     * Su dung Lazy Load: neu chua co instance thi tao moi.
     */
    play(id: string): number | undefined {
        if (!this.sounds[id]) {
            const config = SOUND_MAP[id];
            if (!config) return;

            this.sounds[id] = new Howl({
                src: [config.src],
                loop: config.loop || false,
                volume: config.volume || 1.0,
                html5: true,
            });
        }

        return this.sounds[id].play();
    }

    /** Dung 1 am thanh cu the */
    stop(id: string): void {
        if (!this.sounds[id]) return;
        this.sounds[id].stop();
    }

    /** Dung tat ca am thanh */
    stopAll(): void {
        Howler.stop();
    }

    /** Dung tat ca voice prompts */
    stopAllVoicePrompts(): void {
        const voiceKeys = Object.keys(SOUND_MAP).filter(
            (key) => key.startsWith('voice') || key === 'hint'
        );
        voiceKeys.forEach((key) => this.stop(key));
    }

    /** Kiem tra audio da duoc unlock chua */
    get isUnlocked(): boolean {
        return Howler.ctx && Howler.ctx.state === 'running';
    }

    /** Unlock audio (can thiet cho iOS) */
    unlockAudio(): void {
        if (!Howler.usingWebAudio) return;

        const dummySound = new Howl({
            src: ['data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAAABkYXRhAAAAAA=='],
            volume: 0,
            html5: true
        });
        dummySound.once('play', () => dummySound.stop());

        if (Howler.ctx && Howler.ctx.state !== 'running') {
            dummySound.play();
        }
    }

    /** Lay do dai am thanh (giay) */
    public getDuration(key: string): number {
        const sound = this.sounds[key];
        if (sound) return sound.duration();
        return 0;
    }
}

// Singleton
export default new AudioManager();
