import { Howl, Howler } from 'howler';

// 1. Định nghĩa Interface cho cấu hình âm thanh
interface SoundConfig {
    src: string;
    loop?: boolean;
    volume?: number;
    html5?: boolean; // Tùy chọn chế độ phát: True (Stream/Stable) - False (WebAudio/Fast)
}

//Đường dẫn gốc 
const BASE_PATH = 'assets/audio/';

// Ánh xạ ID âm thanh và cấu hình chi tiết
const SOUND_MAP: Record<string, SoundConfig> = {

    // ---- SFX Chung (WebAudio - Mặc định) ----
    'sfx-correct': { src: `${BASE_PATH}sfx/correct_answer.mp3`, volume: 1.0 },
    'sfx-correct_s2': { src: `${BASE_PATH}sfx/correct_color.mp3`, volume: 1.0 },
    'sfx-wrong': { src: `${BASE_PATH}sfx/wrong.mp3`, volume: 0.5 },
    'sfx-click': { src: `${BASE_PATH}sfx/click.mp3`, volume: 0.5 },
    'sfx-ting': { src: `${BASE_PATH}sfx/correct.mp3`, volume: 0.6 },

    // ---- Prompt Voice (HTML5 - Ổn định cho file dài) ----
    'voice-rotate': { src: `${BASE_PATH}prompt/rotate.mp3`, volume: 0.8, html5: true },
    'voice_intro1': { src: `${BASE_PATH}prompt/instruction1.mp3`, volume: 1, html5: true },
    'voice_intro2': { src: `${BASE_PATH}prompt/instruction2.mp3`, volume: 1, html5: true },
    'voice_intro3': { src: `${BASE_PATH}prompt/instruction3.mp3`, volume: 1, html5: true },
    'hint': { src: `${BASE_PATH}prompt/hint.mp3`, volume: 1.0, html5: true },
    'hint2': { src: `${BASE_PATH}prompt/hint2.mp3`, volume: 1.0, html5: true },
    'hint3': { src: `${BASE_PATH}prompt/hint3.mp3`, volume: 1.0, html5: true },

    // ---- Correct Answer Variations ----
    'complete': { src: `${BASE_PATH}sfx/complete.mp3`, volume: 1.0 },
    'fireworks': { src: `${BASE_PATH}sfx/fireworks.mp3`, volume: 1.0 },
    'applause': { src: `${BASE_PATH}sfx/applause.mp3`, volume: 1.0 },


};



class AudioManager {
    // Khai báo kiểu dữ liệu cho Map chứa các đối tượng Howl
    private sounds: Record<string, Howl> = {};
    private isLoaded: boolean = false;

    constructor() {
        // Cấu hình quan trọng cho iOS
        Howler.autoUnlock = true;
        Howler.volume(1.0);
    }

    /**
     * Tải tất cả âm thanh
     * @returns {Promise<void>}
     */
    /**
     * Tải các âm thanh thiết yếu (cần dùng ngay khi vào game).
     * @param keys Danh sách key cần đợi (VD: ['voice_intro', 'sfx-click'])
     */
    loadEssentials(keys: string[]): Promise<void> {
        const promises = keys.map(key => {
            const config = SOUND_MAP[key];
            if (!config) return Promise.resolve();

            // Nếu đã load rồi thì bỏ qua
            if (this.sounds[key] && this.sounds[key].state() === 'loaded') {
                return Promise.resolve();
            }

            return new Promise<void>((resolve) => {
                this.sounds[key] = new Howl({
                    src: [config.src],
                    loop: config.loop || false,
                    volume: config.volume || 1.0,
                    html5: config.html5 ?? false,
                    onload: () => resolve(),
                    onloaderror: (id, err) => {
                        console.warn(`[AudioManager] Failed to load essential: ${key}`, err);
                        resolve(); // Vẫn resolve để không chặn game
                    }
                });
            });
        });

        return Promise.all(promises).then(() => {
            console.log('[AudioManager] Essentials loaded:', keys);
        });
    }

    /**
     * Tải tất cả các âm thanh CÒN LẠI (chạy ngầm).
     */
    loadRest(): void {
        const allKeys = Object.keys(SOUND_MAP);
        allKeys.forEach(key => {
            // Nếu chưa có trong danh sách sounds (chưa được load)
            if (!this.sounds[key]) {
                const config = SOUND_MAP[key];
                 this.sounds[key] = new Howl({
                    src: [config.src],
                    loop: config.loop || false,
                    volume: config.volume || 1.0,
                    html5: config.html5 ?? false,
                });
            }
        });
        this.isLoaded = true;
        console.log('[AudioManager] Background loading started for remaining assets.');
    }

    /**
     * @deprecated Dùng loadRest() hoặc loadEssentials() thay thế để tối ưu.
     */
    loadAll(): Promise<void> {
        this.loadRest();
        return Promise.resolve();
    }

    /**
     * Phát một âm thanh
     * @param {string} id - ID âm thanh
     * @returns {number | undefined} - Sound ID của Howler
     */
    play(id: string): number | undefined {
        // --- LAZY LOAD IMPLEMENTATION ---
        
        // 0. Stop all previous sounds (Exclusive Mode) -> REMOVED to allow simple overlap
        // this.stopAll();

        // 1. Nếu chưa có instance -> Tạo mới (Lazy Load)
        if (!this.sounds[id]) {
            const config = SOUND_MAP[id];
            if (!config) {
                 console.warn(`[AudioManager] Sound ID not found in config: ${id}`);
                 return;
            }

            // console.log(`[AudioManager] Lazy loading sound: ${id}`);
            this.sounds[id] = new Howl({
                src: [config.src],
                loop: config.loop || false,
                volume: config.volume || 1.0,
                html5: config.html5 ?? false, 
                onloaderror: (_sndId, error) => {
                     console.error(`[Howler Error] Load failed for ${id}:`, error);
                }
            });
        }

        // 2. Play
        return this.sounds[id].play();
    }

    /**
     * Dừng một âm thanh
     * @param {string} id - ID âm thanh
     */
    stop(id: string): void {
        if (!this.sounds[id]) return;
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

    
    // Dừng TẤT CẢ các Prompt và Feedback 
    
    stopAllVoicePrompts(): void {
        const voiceKeys = Object.keys(SOUND_MAP).filter(
            (key) =>
                key.startsWith('prompt_') || key.startsWith('correct_answer_')
        );

        voiceKeys.forEach((key) => {
            this.stopSound(key);
        });

        // Hoặc dùng: Howler.stop(); để dừng TẤT CẢ âm thanh (thận trọng khi dùng)
    }

    // Kiểm tra nếu audio đã được unlock
    get isUnlocked(): boolean {
        return Howler.ctx && Howler.ctx.state === 'running';
    }

    unlockAudio(): void {
        if (!Howler.usingWebAudio) return; 
        
        // Tạo một âm thanh dummy và play/stop ngay lập tức
        const dummySound = new Howl({
            src: ['data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAAABkYXRhAAAAAA=='], // 1-frame silent WAV
            volume: 0,
            html5: true 
        });
        dummySound.once('play', () => {
            dummySound.stop();
            console.log('[Howler] Audio context unlocked manually.');
        });

        // Chỉ play nếu context đang ở trạng thái suspended/locked
        if (Howler.ctx && Howler.ctx.state !== 'running') {
            dummySound.play();
        }
    }

    public getDuration(key: string): number {
        const sound = this.sounds[key];
        
        if (sound) {
            // Howler trả về duration (giây). 
            // Cần đảm bảo file đã load xong (state 'loaded'), nếu không nó trả về 0.
            return sound.duration();
        }
        
        console.warn(`[AudioManager] Không tìm thấy duration cho key: "${key}"`);
        return 0; // Trả về 0 để an toàn
    }
}

// Xuất phiên bản duy nhất (Singleton)
export default new AudioManager();
