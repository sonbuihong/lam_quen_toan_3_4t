// src/audio/AudioManager.ts

import { Howl, Howler } from 'howler';

// 1. Định nghĩa Interface cho cấu hình âm thanh
interface SoundConfig {
    src: string;
    loop?: boolean;
    volume?: number;
}

// 2. Đường dẫn gốc (Đảm bảo đường dẫn này đúng trong public folder của Vite)
const BASE_PATH = 'assets/audio/'; // Sử dụng '/' cho Vite public folder

// 3. Ánh xạ ID âm thanh (key) và cấu hình chi tiết
const SOUND_MAP: Record<string, SoundConfig> = {
    // ---- SFX Chung ----
    'sfx-correct': { src: `${BASE_PATH}sfx_correct.mp3`, volume: 1.0 },
    'sfx-wrong': { src: `${BASE_PATH}sfx_wrong.mp3`, volume: 0.8 },
    'sfx-click': { src: `${BASE_PATH}sfx_click.mp3`, volume: 0.8 },
    'sfx-pop': { src: `${BASE_PATH}sfx_pop.mp3`, volume: 0.7 },
    'voice-rotate': { src: `${BASE_PATH}rotate.mp3`, volume: 0.8 },
    // ---- Correct Answers Voice Prompts ----
    correct_answer_1: {
        src: `${BASE_PATH}correct_answer_1.mp3`,
        volume: 1.0,
    },
    correct_answer_2: {
        src: `${BASE_PATH}correct_answer_2.mp3`,
        volume: 1.0,
    },
    correct_answer_3: {
        src: `${BASE_PATH}correct_answer_3.mp3`,
        volume: 1.0,
    },
    correct_answer_4: {
        src: `${BASE_PATH}correct_answer_4.mp3`,
        volume: 1.0,
    },

    vo_prompt_1: { src: `${BASE_PATH}vo_prompt_1.mp3` },
    vo_prompt_2: { src: `${BASE_PATH}vo_prompt_2.mp3` },
    vo_prompt_3: { src: `${BASE_PATH}vo_prompt_3.mp3` },
    vo_prompt_4: { src: `${BASE_PATH}vo_prompt_4.mp3` },

    vo_count_1: { src: `${BASE_PATH}vo_count_1.mp3` },
    vo_count_2: { src: `${BASE_PATH}vo_count_2.mp3` },
    vo_count_3: { src: `${BASE_PATH}vo_count_3.mp3` },
    vo_count_4: { src: `${BASE_PATH}vo_count_4.mp3` },

    complete: { src: `${BASE_PATH}complete.mp3`, volume: 1.0 },
    fireworks: { src: `${BASE_PATH}fireworks.mp3`, volume: 1.0 },
    applause: { src: `${BASE_PATH}applause.mp3`, volume: 1.0 },
};

class AudioManager {
    private sounds: Record<string, Howl> = {};
    isLoaded: boolean = false;

    // trạng thái gesture + danh sách play bị hoãn
    private hasUserInteracted = false;
    private pendingPlays: Array<() => void> = [];

    constructor() {
        // Cấu hình quan trọng cho iOS
        Howler.autoUnlock = true;
        Howler.volume(1.0);
        (Howler as any).html5PoolSize = 32; // cho nhiều HTML5 audio hơn

        this.setupFirstInteractionListener();
    }

    private setupFirstInteractionListener() {
        const unlock = () => {
            if (this.hasUserInteracted) return;

            this.hasUserInteracted = true;

            // chạy tất cả play đã xếp hàng, NGAY trong callback của gesture
            const plays = [...this.pendingPlays];
            this.pendingPlays = [];
            plays.forEach((fn) => {
                try {
                    fn();
                } catch (e) {
                    console.warn('[AudioManager] pending play error', e);
                }
            });

            window.removeEventListener('pointerdown', unlock, true);
            window.removeEventListener('touchstart', unlock, true);
            window.removeEventListener('click', unlock, true);
        };

        window.addEventListener('pointerdown', unlock, true);
        window.addEventListener('touchstart', unlock, true);
        window.addEventListener('click', unlock, true);
    }

    /**
     * Tải tất cả âm thanh
     */
    loadAll(): Promise<void> {
        return new Promise((resolve) => {
            const keys = Object.keys(SOUND_MAP);
            let loadedCount = 0;
            const total = keys.length;

            if (total === 0) {
                this.isLoaded = true;
                return resolve();
            }

            keys.forEach((key) => {
                const config = SOUND_MAP[key];

                this.sounds[key] = new Howl({
                    src: [config.src],
                    loop: config.loop || false,
                    volume: config.volume ?? 1.0,
                    html5: true, // vẫn giữ cho iOS như bạn muốn

                    onload: () => {
                        loadedCount++;
                        if (loadedCount === total) {
                            this.isLoaded = true;
                            resolve();
                        }
                    },
                    onloaderror: (id: number, error: unknown) => {
                        const errorMessage =
                            error instanceof Error
                                ? error.message
                                : String(error);

                        console.error(
                            `[Howler Load Error] Key: ${key}, ID: ${id}, Msg: ${errorMessage}. Check file path: ${config.src}`
                        );

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
     * Phát một âm thanh
     */
    play(id: string): number | undefined {
        if (!this.sounds[id]) {
            console.warn(
                `[AudioManager] Sound ID not found (maybe not loaded yet): ${id}`
            );
            return;
        }

        const doPlay = () => this.sounds[id].play();

        // Nếu user CHƯA chạm lần nào → hoãn lại, chờ gesture đầu
        if (!this.hasUserInteracted) {
            this.pendingPlays.push(doPlay);
            console.log(
                '[AudioManager] Queue play until first interaction:',
                id
            );
            return;
        }

        // Nếu đã có gesture rồi → play bình thường
        return doPlay();
    }

    /**
     * Dừng một âm thanh
     * @param {string} id - ID âm thanh
     */
    stop(id: string): void {
        if (!this.isLoaded || !this.sounds[id]) return;
        this.sounds[id].stop();
    }

    stopSound(id: string): void {
        if (this.sounds[id]) {
            this.sounds[id].stop();
        }
    }

    stopAll(): void {
        Howler.stop();
    }

    /**
     * Dừng TẤT CẢ các Prompt và Feedback để tránh chồng chéo giọng nói.
     */
    stopAllVoicePrompts(): void {
        // Cần liệt kê tất cả các ID giọng nói/prompt có thể chạy cùng lúc
        const voiceKeys = Object.keys(SOUND_MAP).filter((key) =>
            key.startsWith('correct_answer_')
        );

        voiceKeys.forEach((key) => {
            this.stopSound(key);
        });

        // Hoặc bạn có thể dùng: Howler.stop(); để dừng TẤT CẢ âm thanh (thận trọng khi dùng)
    }

    // Hàm tiện ích: Dùng để lấy ngẫu nhiên một trong 4 câu trả lời đúng
    playCorrectAnswer(): void {
        // Phaser.Math.Between(min, max) -> thay thế bằng hàm Math.random thuần túy hoặc import từ Phaser
        const randomIndex = Math.floor(Math.random() * 4) + 1;
        this.play(`correct_answer_${randomIndex}`);
    }

    // Hàm tiện ích: Dùng để phát lời nhắc (ví dụ: 'prompt_more_cat')
    playPrompt(type: 'less' | 'more', animal: string): void {
        const id = `prompt_${type}_${animal}`;
        this.play(id);
    }
}

// Xuất phiên bản duy nhất (Singleton)
export default new AudioManager();
