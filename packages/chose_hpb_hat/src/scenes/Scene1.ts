
import Phaser from 'phaser';
import { SceneKeys, TextureKeys, AudioKeys, DataKeys } from '../consts/Keys';
import { GameConstants } from '../consts/GameConstants';
import { GameUtils } from '../utils/GameUtils';
import { changeBackground } from '../utils/BackgroundManager';
import AudioManager from '../audio/AudioManager';
import { showGameButtons } from '../main';
import { setGameSceneReference, resetVoiceState, playVoiceLocked } from '../utils/rotateOrientation';
import { IdleManager } from '../utils/IdleManager';

interface ImageConfig {
    textureKey: string;
    baseX_pct: number;
    baseY_pct: number;
    baseScale: number;
}

interface TargetText {
    start: number;
    end: number;
}

interface LevelConfig {
    targetText: TargetText;
    images: ImageConfig[];
}

export default class Scene1 extends Phaser.Scene {
    private bgm!: Phaser.Sound.BaseSound;

    // UI Elements
    private btnMic!: Phaser.GameObjects.Image; // Giữ lại reference UI nếu cần
    
    // Logic States
    private isIntroductionPlayed: boolean = false;
    private isGameActive: boolean = false;
    private isHintActive: boolean = false;
    private idleManager!: IdleManager;
    private handHint!: Phaser.GameObjects.Image;
    private puzzleItems: Phaser.GameObjects.Image[] = [];
    private instructionTimer?: Phaser.Time.TimerEvent;

    constructor() {
        super(SceneKeys.Scene1);
    }

    init() {
        resetVoiceState();
    }

    create() {
        window.gameScene = this;
        setGameSceneReference(this);
        showGameButtons();

        // 1. Setup Environment
        this.setupBackgroundAndAudio();
        
        
        this.idleManager = new IdleManager(GameConstants.IDLE.THRESHOLD, () => {
            this.showIdleHint();
        });
        
        // 3. Create UI (Static elements)
        this.createUI();

        // 4. Load Level Data & Spawn Objects
        this.createLevel();

        // 5. Setup Gameplay Interactions
        this.setupGameplay();

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
        
    }

    // =================================================================
    // PHẦN 1: CÀI ĐẶT HỆ THỐNG (SYSTEM SETUP)
    // =================================================================

    /**
     * Cài đặt các tham chiếu hệ thống, input và trình quản lý Idle
     */
    private setupSystem() {
        resetVoiceState();
        (window as any).gameScene = this; // Gán reference vào window để debug hoặc truy cập từ ngoài
        setGameSceneReference(this);

        // Khởi tạo IdleManager với thời gian ngưỡng (THRESHOLD) từ config
        // Khi hết thời gian này mà không thao tác, hàm showIdleHint sẽ được gọi
        this.idleManager = new IdleManager(GameConstants.IDLE.THRESHOLD, () => {
            this.showIdleHint();
        });

        // Bất cứ khi nào người chơi click, reset lại trạng thái Idle
        this.input.on('pointerdown', () => {
            this.resetIdleState();
        });
    }

    /**
     * Cài đặt hình nền và nhạc nền
     */
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

            // Đọc hướng dẫn
            AudioManager.play(AudioKeys.VoiceIntro);
            
        } catch (e) {
            console.warn("Audio Context issue:", e);
        }
    }

    // =================================================================
    // PHẦN 2: TẠO GIAO DIỆN & LEVEL (UI & LEVEL CREATION)
    // =================================================================

    private createUI() {
        const UI1 = GameConstants.SCENE1.UI;
        const cx = GameUtils.pctX(this, 0.5);
        
        // Banner Config
        const bannerTexture = this.textures.get(TextureKeys.S1_Banner);
        let bannerHeight = 100;
        if (bannerTexture && bannerTexture.key !== '__MISSING') {
            bannerHeight = bannerTexture.getSourceImage().height * 0.7;
        }
        const boardY = bannerHeight + GameUtils.pctY(this, UI1.BOARD_OFFSET);
        
        const scl = [1, 0.72];
        
        // Board
        const board = this.add.image(cx, boardY, TextureKeys.S1_Board)
            .setOrigin(0.5, 0)
            .setScale(scl[0], scl[1])
            .setDepth(0); // Background level
            
        board.displayWidth = GameUtils.getW(this) * 0.93;
        // Giữ tỉ lệ đơn giản, có thể chỉnh lại scale sau
        
        // Các phần tử UI khác (Số, Xúc xắc - giữ như cũ để làm mẫu)
        this.add.image(GameUtils.pctX(this, 0.07), boardY + 100, TextureKeys.Number).setOrigin(0.5);
        this.add.image(GameUtils.pctX(this, 0.15), boardY + 100, TextureKeys.Dice).setOrigin(0.5);
    }

    private createLevel() {
        const levelConfig = this.cache.json.get(DataKeys.LevelS1Config) as LevelConfig;
        
        if (levelConfig && levelConfig.images) {
            levelConfig.images.forEach((imgConfig) => {
                const x = GameUtils.pctX(this, imgConfig.baseX_pct);
                const y = GameUtils.pctY(this, imgConfig.baseY_pct);
                
                this.add.image(x, y, imgConfig.textureKey)
                    .setScale(imgConfig.baseScale)
                    .setOrigin(0.5);
            });
        }
    }

    // =================================================================
    // PHẦN 3: LOGIC GAMEPLAY (GAMEPLAY LOGIC)
    // =================================================================
    
    private setupGameplay() {
        // Tạo nút đáp án
        this.createAnswerButtons();
        
        // Khởi tạo luồng trò chơi
        this.initGameFlow();
    }

    private createAnswerButtons() {
        const y = GameUtils.pctY(this, 0.85); // Vị trí dưới bảng (ước lượng)
        const x1 = GameUtils.pctX(this, 0.40);
        const x2 = GameUtils.pctX(this, 0.60);

        // Ans1 (Sai)
        const ans1 = this.add.image(x1, y, TextureKeys.Ans1).setScale(0.7);
        this.puzzleItems.push(ans1);
        this.setupButtonInteraction(ans1, false);

        // Ans2 (Đúng)
        const ans2 = this.add.image(x2, y, TextureKeys.Ans2).setScale(0.7);
        this.puzzleItems.push(ans2);
        this.setupButtonInteraction(ans2, true);
    }

    private setupButtonInteraction(btn: Phaser.GameObjects.Image, isCorrect: boolean) {
        btn.setInteractive({ useHandCursor: true });
        
        btn.on('pointerdown', () => {
            if (!this.isGameActive) return; // Không cho click khi game chưa active
            
            if (isCorrect) {
                this.handleCorrect(btn);
            } else {
                this.handleWrong(btn);
            }
        });
    }

    // =================================================================
    // PHẦN 4: HƯỚNG DẪN & GỢI Ý (TUTORIAL & HINT)
    // =================================================================

    
    /**
     * Reset lại trạng thái Idle (khi người chơi có tương tác)
     */
    private resetIdleState() {
        this.idleManager.reset();
        // Nếu đang hiện gợi ý thì ẩn đi ngay lập tức
        if (this.isHintActive && this.handHint) {
            this.isHintActive = false;
            this.tweens.killTweensOf(this.handHint);
            this.handHint.setAlpha(0).setPosition(-200, -200);
        }
    }

    /**
     * Hiển thị bàn tay gợi ý (Được gọi từ IdleManager khi user không làm gì)
     */
    private showIdleHint() {
        if (!this.isGameActive || this.isHintActive) return;

        // Tìm vật thể nào là đáp án đúng
        const correctItem = this.puzzleItems.find(i => i.getData('isCorrect') === true);
        if (!correctItem) return;

        this.isHintActive = true;

        // Đặt vị trí xuất phát cho bàn tay (từ ngoài màn hình bay vào)
        this.handHint.setPosition(GameUtils.getW(this) + 100, GameUtils.getH(this));
        this.handHint.setAlpha(0);

        const IDLE = GameConstants.IDLE;

        // Chuỗi hiệu ứng: Hiện ra -> Chỉ vào đáp án -> Ấn ấn -> Biến mất
        this.tweens.chain({
            targets: this.handHint,
            tweens: [
                { alpha: 1, x: correctItem.x + IDLE.OFFSET_X, y: correctItem.y + IDLE.OFFSET_Y, duration: IDLE.FADE_IN, ease: 'Power2' },
                { scale: 0.5, duration: IDLE.SCALE, yoyo: true, repeat: 2 }, // Ấn 2 lần
                {
                    alpha: 0, duration: IDLE.FADE_OUT, onComplete: () => {
                        // Kết thúc gợi ý -> Reset lại vòng lặp idle
                        this.isHintActive = false;
                        this.idleManager.reset();
                        this.handHint.setPosition(-200, -200);
                    }
                }
            ]
        });
    }

    /**
     * Public method: Gọi từ bên ngoài (ví dụ nút Replay) để nghe lại hướng dẫn
     */
    public restartIntro() {
        if (this.instructionTimer) { this.instructionTimer.remove(false); this.instructionTimer = undefined; }
        this.resetIdleState();
        this.idleManager.stop();
        this.initGameFlow(); // Chạy lại từ đầu luồng game
    }

    // =================================================================
    // PHẦN 5: LUỒNG TRÒ CHƠI CHÍNH (GAME FLOW)
    // =================================================================

    /**
     * Khởi tạo luồng trò chơi (Intro -> Voice -> Unlock Input)
     */
    private initGameFlow() {
        if (this.input.keyboard) this.input.keyboard.enabled = false;

        // Hàm nội bộ: Bắt đầu thực sự sau khi đã load xong âm thanh
        const startAction = () => {
            if (!this.bgm.isPlaying) this.bgm.play();

            this.isGameActive = true;

            // 1. Phát giọng đọc hướng dẫn ("instruction")
            playVoiceLocked(null, 'instruction');
            const instructionTime = AudioManager.getDuration('instruction') + 0.5;

            // 2. Đợi giọng hướng dẫn xong -> Phát câu đố ("cau_do")
            this.instructionTimer = this.time.delayedCall(instructionTime * 1000, () => {
                if (this.isGameActive) {
                    playVoiceLocked(null, 'cau_do');
                    const riddleDuration = AudioManager.getDuration('cau_do');

                    // 3. Đợi đọc xong câu đố -> Bắt đầu đếm ngược Idle (gợi ý)
                    this.time.delayedCall((riddleDuration * 1000) + GameConstants.SCENE1.TIMING.DELAY_IDLE, () => {
                        if (this.isGameActive) {
                            this.idleManager.start();
                        }
                    });
                }
            });

            if (this.input.keyboard) this.input.keyboard.enabled = true;
            showGameButtons(); // Hiện nút Back/Home
        };

        // Load toàn bộ âm thanh, đảm bảo đã "Unlock" Audio Context của trình duyệt
        AudioManager.loadAll().then(() => {
            if (AudioManager.isUnlocked) {
                startAction();
            } else {
                // Nếu chưa unlock (thường gặp trên Chrome/Safari), yêu cầu click 1 lần để start
                this.input.once('pointerdown', () => {
                    AudioManager.unlockAudio();
                    startAction();
                });
            }
        });
    }

    /**
     * Xử lý khi chọn SAI
     */
    private handleWrong(item: Phaser.GameObjects.Image) {
        AudioManager.play('sfx-wrong');
        // Hiệu ứng rung lắc (shake) báo hiệu sai
        this.tweens.add({
            targets: item,
            angle: { from: -10, to: 10 },
            duration: GameConstants.SCENE1.ANIM.WRONG_SHAKE,
            yoyo: true,
            repeat: 3,
            onComplete: () => { item.angle = 0; } // Trả về góc 0 sau khi lắc xong
        });
    }

    /**
     * Xử lý khi chọn ĐÚNG
     */
    private handleCorrect(winnerItem: Phaser.GameObjects.Image) {
        this.isGameActive = false; // Khóa game, không cho click nữa

        // Hủy timer hướng dẫn nếu đang chạy (tránh việc voice chồng voice)
        if (this.instructionTimer) {
            this.instructionTimer.remove(false);
            this.instructionTimer = undefined;
        }
        this.idleManager.stop();

        // Vô hiệu hóa tương tác tất cả vật thể
        this.puzzleItems.forEach(i => i.disableInteractive());
        this.tweens.killTweensOf(winnerItem); // Dừng hiệu ứng trôi nổi

        // Dừng voice cũ, phát tiếng ting ting
        AudioManager.stop('instruction');
        AudioManager.stop('cau_do');
        AudioManager.play('sfx-ting');

        // Ẩn các vật thể không phải đáp án đúng với hiệu ứng
        this.puzzleItems.forEach(i => {
            if (i !== winnerItem) this.tweens.add({ targets: i, alpha: 0, scale: 0, duration: 300 });
        });

        // Phát âm thanh đúng / khen ngợi
        this.time.delayedCall(GameConstants.SCENE1.TIMING.DELAY_CORRECT_SFX, () => {
            AudioManager.play('sfx-correct');
            const correctDuration = AudioManager.getDuration('sfx-correct');

            // Chuyển sang Scene tiếp theo
            this.time.delayedCall(correctDuration * 1000, () => {
                this.scene.start(SceneKeys.Scene2);
            });
        });
    }

}