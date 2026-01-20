
import Phaser from 'phaser';
import { SceneKeys, TextureKeys, AudioKeys, DataKeys } from '../consts/Keys';
import { GameConstants } from '../consts/GameConstants';
import { GameUtils } from '../utils/GameUtils';
import { changeBackground } from '../utils/BackgroundManager';
import AudioManager from '../audio/AudioManager';
import { showGameButtons } from '../main';
import { setGameSceneReference, resetVoiceState } from '../utils/rotateOrientation';
import { IdleManager } from '../utils/IdleManager';

// Managers
import { LassoManager } from '../managers/LassoManager';
import { ObjectManager } from '../managers/ObjectManager';

export default class Scene1 extends Phaser.Scene {
    private bgm!: Phaser.Sound.BaseSound;
    private lassoManager!: LassoManager;
    private objectManager!: ObjectManager;

    // UI Elements
    private btnMic!: Phaser.GameObjects.Image; // Giữ lại reference UI nếu cần
    
    // Logic States
    private isIntroductionPlayed: boolean = false;
    private idleManager!: IdleManager;
    private handHint!: Phaser.GameObjects.Image;
    private static hasInteracted: boolean = false; // Cờ kiểm tra lần đầu vào game

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
        
        // 2. Setup Managers
        this.lassoManager = new LassoManager(this);
        this.objectManager = new ObjectManager(this);
        
        this.idleManager = new IdleManager(GameConstants.IDLE.THRESHOLD, () => {
            this.showHint();
        });
        
        // 3. Create UI (Static elements)
        this.createUI();

        // 4. Load Level Data & Spawn Objects
        const levelConfig = this.cache.json.get(DataKeys.LevelS1Config);
        this.objectManager.spawnObjectsFromConfig(levelConfig);

        // 5. Start Logic (Conditional)
        this.setupBackgroundAndAudio();

        // B. Game logic + Voice Intro (Cần touch để browser không chặn AudioContext của voice/sfx)
        if (!Scene1.hasInteracted) {
            // Lần đầu vào game: Cần Tap để unlock Audio
            console.log("First time entry: Waiting for interaction...");
            
            this.input.once('pointerdown', () => {
                console.log("User interacted. Starting game flow...");
                Scene1.hasInteracted = true;
                
                // Resume Audio Context (cho chắc chắn với browser chặn)
                const soundManager = this.sound as Phaser.Sound.WebAudioSoundManager;
                if (soundManager.context && soundManager.context.state === 'suspended') {
                    soundManager.context.resume();
                }
                
                this.startIntroAndGameplay();
            });
        } else {
            // Các lần sau (Replay): Vào thẳng
            this.startIntroAndGameplay();
        }

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
        // 1. Dọn dẹp Âm thanh (Audio Cleanup)
        if (this.bgm) {
            this.bgm.stop();
        }
        // Dừng tất cả âm thanh SFX khác đang chạy qua Howler
        AudioManager.stopAll();

        // 2. Dọn dẹp Managers (Managers Cleanup)
        if (this.lassoManager) {
            this.lassoManager.disable();
             // Nếu có hàm destroy thì gọi luôn tại đây để chắc chắn
        }
        if (this.idleManager) {
            this.idleManager.stop();
        }

        // 3. Dọn dẹp hệ thống (System Cleanup)
        this.tweens.killAll(); // Dừng mọi animation đang chạy
        this.input.off('pointerdown'); // Gỡ bỏ sự kiện ở Scene context
        
        // 4. Xóa tham chiếu global (Global References Cleanup)
        if (window.gameScene === this) {
            window.gameScene = undefined;
        }

        console.log("Scene1: Shutdown completed. Resources cleaned up.");
    }

    // =================================================================
    // PHẦN 1: CÀI ĐẶT HỆ THỐNG (SYSTEM SETUP)
    // =================================================================

    private setupBackgroundAndAudio() {
        // 1. Đổi Background
        changeBackground('assets/images/bg/background.jpg');

        // 2. Phát nhạc nền (BGM)
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

    private startIntroAndGameplay() {
        // Đọc hướng dẫn
        AudioManager.play(AudioKeys.VoiceIntro);
        this.setupGameplay();
    }

    // =================================================================
    // PHẦN 2: TẠO GIAO DIỆN & LEVEL (UI & LEVEL CREATION)
    // =================================================================

    private createUI() {
        const UI = GameConstants.SCENE1.UI;
        const cx = GameUtils.pctX(this, 0.5);
        
        // Banner Config
        const bannerTexture = this.textures.get(TextureKeys.S1_Banner);
        let bannerHeight = 100;
        if (bannerTexture && bannerTexture.key !== '__MISSING') {
            bannerHeight = bannerTexture.getSourceImage().height * 0.7;
        }
        const boardY = bannerHeight + GameUtils.pctY(this, UI.BOARD_OFFSET);
        
        const scl = [1, 0.72];
        
        // Board
        const board = this.add.image(cx, boardY, TextureKeys.S1_Board)
            .setOrigin(0.5, 0)
            .setScale(scl[0], scl[1])
            .setDepth(0);
            
        board.displayWidth = GameUtils.getW(this) * 0.93;
        // Giữ tỉ lệ đơn giản, có thể chỉnh lại scale sau
        
        // Tính toán bounds của board (giới hạn vẽ lasso)
        const boardWidth = board.displayWidth;
        const boardHeight = board.displayHeight;
        const boardX = board.x - boardWidth / 2;  // origin(0.5, 0) -> tâm ngang, đỉnh trên
        const boardY_start = board.y;             // Vị trí y bắt đầu từ đỉnh
        const boardBounds = new Phaser.Geom.Rectangle(boardX, boardY_start, boardWidth, boardHeight);
        
        // Truyền bounds vào LassoManager
        this.lassoManager.setBoardBounds(boardBounds);
        
        console.log(`Board Bounds: x=${boardX}, y=${boardY_start}, w=${boardWidth}, h=${boardHeight}`);
    }

    // =================================================================
    // PHẦN 3: LOGIC GAMEPLAY (GAMEPLAY LOGIC)
    // =================================================================
    
    private setupGameplay() {
        // Đợi một chút rồi mới cho phép chơi (để nghe intro hoặc chuẩn bị)
        const delay = GameConstants.SCENE1.TIMING.GAME_START_DELAY;
        
        this.time.delayedCall(delay, () => {
            // Kích hoạt tính năng vẽ Lasso
            this.lassoManager.enable();
            
            // Bắt đầu đếm Idle ngay khi vào game (hoặc sau intro)
            this.idleManager.start();
            
            console.log("Gameplay enabled after delay.");
        });

        // Khi người chơi chạm vào màn hình -> Reset Idle + Ẩn gợi ý
        this.input.on('pointerdown', () => {
            // Chỉ reset khi game đã bắt đầu (IdleManager đã chạy)
            this.idleManager.reset();
            this.hideHint();
        });

        // Lắng nghe sự kiện khi khoanh xong
        this.lassoManager.onLassoComplete = (polygon: Phaser.Geom.Polygon) => {
            this.handleLassoSelection(polygon);
        };
    }

    private handleLassoSelection(polygon: Phaser.Geom.Polygon) {
        // 1. Lấy danh sách đối tượng trong vùng chọn
        const selectedObjects = this.objectManager.getObjectsInPolygon(polygon);
        
        console.log(`Đã khoanh trúng: ${selectedObjects.length} đối tượng.`);

        // 2. Kiểm tra điều kiện Đúng/Sai
        const correctObject = this.objectManager.getCorrectObject();
        const wrongObject = this.objectManager.getWrongObject();

        let isSuccess = false;
        let failureReason = "";

        // Điều kiện thành công:
        // - Khoanh đúng 1 hình
        // - Hình đó phải là đáp án đúng
        // - Lấn qua hình sai không quá 1/5
        if (selectedObjects.length === 1) {
            const selectedObj = selectedObjects[0];
            
            if (this.objectManager.isCorrectAnswer(selectedObj)) {
                // Kiểm tra lấn qua hình sai
                if (wrongObject) {
                    const overlapWithWrong = this.objectManager.getOverlapPercentage(polygon, wrongObject);
                    
                    console.log(`Overlap với hình sai: ${(overlapWithWrong * 100).toFixed(1)}%`);
                    
                    if (overlapWithWrong > 0.2) { // 1/5 = 0.2
                        failureReason = `Vẽ lấn quá hình sai (${(overlapWithWrong * 100).toFixed(1)}% > 20%)`;
                    } else {
                        isSuccess = true;
                    }
                } else {
                    isSuccess = true;
                }
            } else {
                failureReason = "Khoanh sai đáp án!";
            }
        } else if (selectedObjects.length > 1) {
            failureReason = "Khoanh quá nhiều hình! Chỉ khoanh 1 hình thôi!";
        } else {
            failureReason = "Khoanh sai hoặc không trúng!";
        }

        if (isSuccess) {
            // --- SUCCESS CASE ---
            // Vẽ vòng tròn bao quanh hình đúng
            const graphics = this.add.graphics();
            graphics.lineStyle(10, 0x00ff00); // Nét, dày 10px

            selectedObjects.forEach(obj => {
                const image = obj as Phaser.GameObjects.Image;
                const radius = (Math.max(image.displayWidth, image.displayHeight) / 2) * 1.5;
                graphics.strokeCircle(image.x, image.y, radius);
            });

            console.log("✅ Khoanh ĐÚNG!");
            AudioManager.play("sfx-correct");
            AudioManager.play("sfx-ting");
            this.objectManager.highlightObjects(selectedObjects, true);
            
            // Ẩn gợi ý nếu đang hiện
            this.hideHint();
            
            // Vô hiệu hóa input để tránh spam
            this.lassoManager.disable();

            // Đợi WIN_DELAY rồi chuyển cảnh
            const t = GameConstants.SCENE1.TIMING.WIN_DELAY;
            this.time.delayedCall(t, () => {
                this.scene.stop(SceneKeys.UI);
                this.scene.start(SceneKeys.EndGame);
            });

        } else {
            // --- FAILURE CASE ---
            console.log(`❌ Khoanh SAI: ${failureReason}`);
            
            // Rung các hình ảnh
            const allObjects = this.objectManager.getAllObjects();
            allObjects.forEach(obj => {
                this.tweens.add({
                    targets: obj,
                    x: obj.x + 10,
                    duration: 50,
                    yoyo: true,
                    repeat: 3,
                    ease: 'Linear'
                });
            });
            
            AudioManager.play("sfx-wrong");
            
            // Cooldown: Phạt người chơi đợi 1s
            this.lassoManager.disable();
            
            this.time.delayedCall(1000, () => {
                this.lassoManager.enable();
            });
        }
    }

    // =================================================================
    // PHẦN 4: HƯỚNG DẪN & GỢI Ý (TUTORIAL & HINT)
    // =================================================================

    /**
     * Hiển thị gợi ý bàn tay xoay vòng tròn
     * (Callback của IdleManager)
     */
    private showHint() {
        // 1. Tìm quả bóng đúng
        const ball = this.objectManager.getAllObjects().find(obj => obj.texture.key === TextureKeys.S1_Ball);
        if (!ball) return; // Không tìm thấy bóng thì thôi

        // 2. Tính bán kính vòng tròn (giống logic khoanh đúng)
        // Lấy cạnh lớn nhất / 2 * 1.3
        const image = ball as Phaser.GameObjects.Image;
        const radius = (Math.max(image.displayWidth, image.displayHeight) / 2) * 1.3;
        
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
                // Tính tọa độ mới dựa trên góc
                // x = cx + r * cos(a)
                // y = cy + r * sin(a)
                // Lưu ý: -PI/2 để bắt đầu từ đỉnh trên cùng (12h) nếu muốn
                const a = circleData.angle - Phaser.Math.PI2 / 4; 
                
                this.handHint.x = image.x + radius * Math.cos(a);
                this.handHint.y = image.y + radius * Math.sin(a);
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
