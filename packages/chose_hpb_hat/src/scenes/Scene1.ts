
import Phaser from 'phaser';
import { SceneKeys, TextureKeys, AudioKeys, DataKeys } from '../consts/Keys';
import { GameConstants } from '../consts/GameConstants';
import { GameUtils } from '../utils/GameUtils';
import { changeBackground } from '../utils/BackgroundManager';
import AudioManager from '../audio/AudioManager';
import { showGameButtons } from '../main';
import { setGameSceneReference, resetVoiceState } from '../utils/rotateOrientation';
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
    private idleManager!: IdleManager;
    private handHint!: Phaser.GameObjects.Image;

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
            this.showHint();
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

        

        // Bắt đầu đếm Idle ngay khi vào game (hoặc sau intro)
        this.idleManager.start();

        // Tạo nút đáp án
        this.createAnswerButtons();
    }

    private createAnswerButtons() {
        const y = GameUtils.pctY(this, 0.85); // Vị trí dưới bảng (ước lượng)
        const x1 = GameUtils.pctX(this, 0.35);
        const x2 = GameUtils.pctX(this, 0.65);

        // Ans1 (Sai)
        const ans1 = this.add.image(x1, y, TextureKeys.Ans1).setScale(1); // Scale tùy chỉnh nếu cần
        this.setupButtonInteraction(ans1, false);

        // Ans2 (Đúng)
        const ans2 = this.add.image(x2, y, TextureKeys.Ans2).setScale(1);
        this.setupButtonInteraction(ans2, true);
    }

    private setupButtonInteraction(btn: Phaser.GameObjects.Image, isCorrect: boolean) {
        btn.setInteractive({ useHandCursor: true });
        
        btn.on('pointerdown', () => {
            if (isCorrect) {
                // Đúng -> Qua EndGame
                 this.scene.start(SceneKeys.EndGame);
            } else {
                // Sai -> Không làm gì (hoặc có thể thêm feedback lắc/âm thanh sai nếu muốn sau này)
                console.log("Wrong answer");
            }
        });
    }

    // =================================================================
    // PHẦN 4: HƯỚNG DẪN & GỢI Ý (TUTORIAL & HINT)
    // =================================================================

    /**
     * Hiển thị gợi ý bàn tay xoay vòng tròn
     * (Callback của IdleManager)
     */
    private showHint() {
       
        
        // 3. Tạo bàn tay (nếu chưa có)
        // Dùng ảnh hand.png từ TextureKeys.HandHint (đã khai báo trong Keys.ts)
        if (!this.handHint) {
            this.handHint = this.add.image(0, 0, TextureKeys.HandHint)
                .setDepth(100) // Cao hơn vật thể
                .setOrigin(0.15, 0.15) // Góc trên bên trái
                .setVisible(false);
        }

        // Hiện bàn tay
        this.handHint.setVisible(true);
        this.handHint.setAlpha(1);

        // 4. Tạo hiệu ứng xoay tròn
        // Ta dùng 1 object tạm để tween góc từ 0 -> 360 (2*PI)
        const circleData = { angle: 0 };
        
        // Dừng tween cũ nếu đang chạy
        this.tweens.killTweensOf(circleData);
        // Dừng luôn cả tween trên handHint nếu có
        this.tweens.killTweensOf(this.handHint);

        // Tween thay đổi góc
        this.tweens.add({
            targets: circleData,
            angle: Phaser.Math.PI2, // 360 độ (radians)
            duration: 2000,
            repeat: 1, // Chạy chính + Lặp 1 lần = 2 vòng
            onUpdate: () => {
                
            },
            onComplete: () => {
                this.hideHint();
                // Bắt đầu đếm lại Idle để hiện tiếp nếu người chơi vẫn không tương tác
                this.idleManager.start();
            }
        });
    }

    private hideHint() {
        if (this.handHint) {
            this.handHint.setVisible(false);
            this.handHint.setAlpha(0);
            this.tweens.killTweensOf(this.handHint);
        }
    }
}
