import Phaser from 'phaser';

import { SceneKeys, TextureKeys, DataKeys, AudioKeys } from '../consts/Keys';
import { GameConstants } from '../consts/GameConstants';
import { GameUtils } from '../utils/GameUtils';
import { IdleManager } from '../utils/IdleManager';

import { changeBackground } from '../utils/BackgroundManager';
import { PaintManager } from '../utils/PaintManager';

import {
    playVoiceLocked,
    setGameSceneReference,
    resetVoiceState,
} from '../utils/rotateOrientation';
import AudioManager from '../audio/AudioManager';
import { showGameButtons, sdk } from '../main';
import { game } from "@iruka-edu/mini-game-sdk";

import FPSCounter from '../utils/FPSCounter';

export default class Scene3 extends Phaser.Scene {
    // Đối tượng âm thanh nền (Background Music)
    private bgm!: Phaser.Sound.BaseSound;

    // --- QUẢN LÝ LOGIC (MANAGERS) ---
    private paintManager!: PaintManager; // Quản lý việc tô màu, cọ vẽ, canvas
    private idleManager!: IdleManager; // Quản lý thời gian rảnh để hiện gợi ý
    private fpsCounter!: FPSCounter; // ✅ FPS Counter

    // --- QUẢN LÝ TRẠNG THÁI GAME (GAME STATE) ---
    // Map lưu các bộ phận chưa tô xong (Key: ID, Value: Image Object) -> Dùng để random gợi ý
    private unfinishedPartsMap: Map<string, Phaser.GameObjects.Image> =
        new Map();
    // Set lưu ID các bộ phận đã hoàn thành -> Dùng để check thắng (Win condition)
    private finishedParts: Set<string> = new Set();
    private totalParts: number = 0; // Tổng số bộ phận cần tô
    private score: number = 0; // Điểm số hiện tại
    private isIntroActive: boolean = false; // Cờ chặn tương tác khi đang chạy intro
    private isWaitingForIntroStart: boolean = true; // Cờ chờ người dùng chạm lần đầu

    // --- UI COMPONENTS ---
    
    private get handHint(): Phaser.GameObjects.Image | undefined {
         const uiScene = this.scene.get(SceneKeys.UI) as any;
         return uiScene?.handHint;
    }

    // Tween đang chạy cho gợi ý (lưu lại để stop khi cần)
    private activeHintTween: Phaser.Tweens.Tween | null = null;
    private activeHintTarget: Phaser.GameObjects.Image | null = null;

    constructor() {
        super(SceneKeys.Scene3);
    }

    /**
     * Khởi tạo lại dữ liệu khi Scene bắt đầu (hoặc Restart)
     * QUAN TRỌNG: Phải clear các Map/Set để tránh lỗi "Zombie Object" (tham chiếu đến object cũ đã bị destroy)
     */
    init(data?: { isRestart: boolean }) {
        this.unfinishedPartsMap.clear();
        this.finishedParts.clear();
        this.totalParts = 0;
        this.score = 0;

        if (data?.isRestart) {
            game.retryFromStart();
        }
        // Scene 3 luôn tự chạy vì đã tương tác ở Scene 1/2
        this.isWaitingForIntroStart = false;
    }

    create() {
        showGameButtons();

        this.setupSystem(); // Cài đặt hệ thống (Paint, Idle)
        this.setupBackgroundAndAudio(); // Cài đặt hình nền và nhạc nền
        this.createUI(); // Tạo giao diện (Bảng màu, Banner)
        
        // Chạy UI Scene
        this.scene.launch(SceneKeys.UI, { 
            paintManager: this.paintManager,
            sceneKey: SceneKeys.Scene3 
        });

        this.createLevel(); // Tạo nhân vật và các vùng tô màu
        
        // SDK Integration
        game.setTotal(1);
        (window as any).irukaGameState = {
            startTime: Date.now(),
            currentScore: 0,
        };
        sdk.score(this.score, 0);
        sdk.progress({ levelIndex: 2, total: 1 });
        game.startQuestionTimer();

        this.setupInput(); // Cài đặt sự kiện chạm/vuốt

        // this.playIntroSequence(); // Chạy hướng dẫn đầu game (Đã chuyển sang click-to-start)

        // Sự kiện khi quay lại tab game (Wake up)
        this.events.on('wake', () => {
            this.idleManager.reset();
            if (this.input.keyboard) this.input.keyboard.enabled = true;
        });

        // ✅ HIỂN THỊ FPS
        // this.fpsCounter = new FPSCounter(this);

        // Nếu là restart (không cần chờ tap), chạy intro luôn
        if (!this.isWaitingForIntroStart) {
            const soundManager = this.sound as Phaser.Sound.WebAudioSoundManager;
            if (soundManager.context && soundManager.context.state === 'suspended') {
                soundManager.context.resume();
            }
            setTimeout(() => {
                this.playIntroSequence();
            }, 500);
        }
    }

    update(time: number, delta: number) {
        // Chỉ đếm thời gian Idle khi:
        // 1. Không đang tô màu
        // 2. Không đang chạy Intro
        // 3. Chưa thắng game
        if (
            !this.paintManager.isPainting() &&
            !this.isIntroActive &&
            this.finishedParts.size < this.totalParts
        ) {
            this.idleManager.update(delta);
        }

        // Cập nhật FPS
        if (this.fpsCounter) {
            this.fpsCounter.update();
        }
    }

    shutdown() {
        this.stopIntro();

        this.paintManager = null as any; // Giải phóng bộ nhớ
        this.scene.stop(SceneKeys.UI);
        if (this.bgm) {
            this.bgm.stop();
        }
    }

    // =================================================================
    // PHẦN 1: CÀI ĐẶT HỆ THỐNG (SYSTEM SETUP)
    // =================================================================

    private setupSystem() {
        resetVoiceState();
        (window as any).gameScene = this;
        setGameSceneReference(this);

        // Khởi tạo PaintManager
        // Callback nhận về: id, renderTexture, và DANH SÁCH MÀU ĐÃ DÙNG (Set<number>)
        this.paintManager = new PaintManager(this, (id, rt, usedColors) => {
            this.handlePartComplete(id, rt, usedColors);
        });

        // Cài đặt Idle Manager: Khi rảnh quá lâu thì gọi showHint()
        this.idleManager = new IdleManager(GameConstants.IDLE.THRESHOLD, () =>
            this.showHint()
        );
    }

    private setupInput() {
        // Chuyển tiếp các sự kiện input sang cho PaintManager xử lý vẽ
        this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
            this.paintManager.handlePointerMove(p);
            if(this.paintManager.isPainting()) {
                this.idleManager.reset();
                this.stopIntro();
                this.stopActiveHint();
            }
        });
        this.input.on('pointerup', () => this.paintManager.handlePointerUp());

        // Khi chạm vào màn hình -> Reset bộ đếm Idle
        this.input.on('pointerdown', () => {
            // Nếu là lần chạm đầu tiên -> Bắt đầu Intro (và unlock Audio)
            if (this.isWaitingForIntroStart) {
                this.isWaitingForIntroStart = false;
                
                // Unlock audio context nếu bị chặn
                const soundManager = this.sound as Phaser.Sound.WebAudioSoundManager;
                if (soundManager.context && soundManager.context.state === 'suspended') {
                    soundManager.context.resume();
                }
                // AudioManager.unlockAudio(); // ✅ Unlock Howler Audio

                this.playIntroSequence();
                return;
            }

            this.idleManager.reset();
            this.stopIntro();
            this.stopActiveHint();
        });
    }

    /**
     * Cài đặt hình nền và nhạc nền
     */
    private setupBackgroundAndAudio() {
        changeBackground('assets/images/bg/background.jpg');

        // Dừng nhạc nền cũ nếu có (tránh chồng nhạc)
        if (this.sound.get(AudioKeys.BgmNen)) {
            this.sound.stopByKey(AudioKeys.BgmNen);
        }
        // Khởi tạo và phát nhạc nền mới
        this.bgm = this.sound.add(AudioKeys.BgmNen, {
            loop: true,
            volume: 0.25,
        });
        this.bgm.play();
    }
    // =================================================================
    // PHẦN 2: TẠO GIAO DIỆN & LEVEL (UI & LEVEL CREATION)
    // =================================================================

    private createUI() {
        const UI = GameConstants.SCENE1.UI;
        const cx = GameUtils.pctX(this, 0.5);
        const scl = [1, 0.72];

        // Tính toán vị trí Board dựa trên Banner
        // const bannerY = GameUtils.pctY(this, UI.BANNER_Y);
        const bannerHeight = this.textures.get(TextureKeys.S1_Banner).getSourceImage().height * 0.7; // Scale 0.7

        const boardY = bannerHeight + GameUtils.pctY(this, UI.BOARD_OFFSET);
        
        const board = this.add.image(cx, boardY, TextureKeys.S1_Board)
                    .setOrigin(0.5, 0).setScale(0.7).setDepth(0);
                    
        // --- DIVIDER LINE ---
        const dividerHeight = board.displayHeight * 0.5;
        this.add.rectangle(board.x, board.y + board.displayHeight / 2, 4, dividerHeight, 0x000000)
            .setOrigin(0.5, 0.5)
            .setDepth(1);

        const boardRightX = board.x + board.displayWidth / 2;
        const boardCenterY = board.y + board.displayHeight / 2;
    }

    // --- LOGIC TẠO LEVEL THEO STAGE ---
    private createLevel() {
        // Load cấu hình level từ JSON
        const data = this.cache.json.get(DataKeys.LevelS3Config);
        
        if (data && data.items && Array.isArray(data.items)) {
            data.items.forEach((item: any, index: number) => {
                // If item has a type, merge with definition
                let config = { ...item };
                if (item.type && data.definitions && data.definitions[item.type]) {
                    config = { ...data.definitions[item.type], ...item };
                }
                this.spawnCharacter(config, index);
            });
        } else if (data) {
             // Fallback for direct object structure
             if (data.parts) {
                this.spawnCharacter(data, 0);
             } else {
                 Object.values(data).forEach((config: any, index: number) => {
                     // Check if it looks like a config object (has parts)
                     if (config && config.parts) {
                        this.spawnCharacter(config, index);
                     }
                 });
             }
        }
    }

    private spawnCharacter(config: any, objectIndex: number = 0) {
        const cx = GameUtils.pctX(this, config.baseX_pct);
        const cy = GameUtils.pctY(this, config.baseY_pct);

        // Nếu là item tĩnh (isStatic = true), chỉ vẽ outline mà không tạo vùng tô màu
        if (config.isStatic) {
            this.add.image(cx, cy, config.outlineKey)
                .setScale(config.baseScale)
                .setDepth(900);
            return; // Dừng, không tạo hitArea
        }

        config.parts.forEach((part: any, index: number) => {
            const id = `${objectIndex}_${part.key}_${index}`;
            const layerX = cx + part.offsetX;
            const layerY = cy + part.offsetY;

            // Tạo vùng tô màu thông qua PaintManager
            const hitArea = this.paintManager.createPaintableLayer(
                layerX,
                layerY,
                part.key,
                part.scale,
                id
            );

            // --- BEST PRACTICE: LƯU DỮ LIỆU TĨNH & TÍNH TOÁN TỰ ĐỘNG ---
            const centerOffset = GameUtils.calculateCenteredOffset(this, part.key);
            let hX = centerOffset.x;
            let hY = centerOffset.y;

            // Lưu các thông số cấu hình vào Data Manager của Game Object.
            hitArea.setData('hintX', hX);
            hitArea.setData('hintY', hY);
            hitArea.setData('originScale', part.scale); // Scale gốc (không đổi)
            
            // --- LƯU TRẠNG THÁI ĐÁP ÁN ĐÚNG/SAI ---
            // Nếu config có 'ans', lưu lại để kiểm tra sau này
            if (typeof config.ans !== 'undefined') {
                hitArea.setData('isCorrectAnswer', config.ans);
            }
            
            // --- CẬP NHẬT: LƯU HINT POINTS (NẾU CÓ) ---
            if (part.hintPoints && Array.isArray(part.hintPoints)) {
                hitArea.setData('hintPoints', part.hintPoints);
                // --- DEBUG: Show Hint Points Coordinates ---
                // this.drawHintDebug(hitArea, part.hintPoints);
            }

            this.unfinishedPartsMap.set(id, hitArea);
            this.totalParts++;
        });


        // Vẽ viền (Outline) lên trên cùng
        const outline = this.add
            .image(cx, cy, config.outlineKey)
            .setScale(config.baseScale)
            .setDepth(900)
            .setInteractive({ pixelPerfect: true });
        
        // --- DEBUG: VẼ TRỤC TỌA ĐỘ ---
        // this.drawDebugAxes(outline);
    }
    
    // ... (Keep drawDebugAxes and drawHintDebug as is) ...

    /**
     * Vẽ trục tọa độ (Debug) cho ảnh
     * Trục X: Màu đỏ, kèm số đo
     * Trục Y: Màu xanh lá, kèm số đo
     */
    private drawDebugAxes(image: Phaser.GameObjects.Image) {
        const graphics = this.add.graphics();
        graphics.setDepth(1000); // Vẽ đè lên mọi thứ

        const x = image.x;
        const y = image.y;
        
        // Lấy kích thước hiển thị thực tế (đã nhân scale)
        const w = image.displayWidth;
        const h = image.displayHeight;

        // Trục X (Red)
        graphics.lineStyle(2, 0xff0000, 1);
        graphics.beginPath();
        graphics.moveTo(x - w / 2, y);
        graphics.lineTo(x + w / 2, y);
        graphics.strokePath();

         // Trục Y (Green)
        graphics.lineStyle(2, 0x00ff00, 1);
        graphics.beginPath();
        graphics.moveTo(x, y - h / 2);
        graphics.lineTo(x, y + h / 2);
        graphics.strokePath();
        
        // Tâm (Blue Dot)
        graphics.fillStyle(0x0000ff, 1);
        graphics.fillCircle(x, y, 4);

        // --- DRAW TICKS & LABELS ---
        const step = 50; 
        const tickSize = 5;

        // X-Axis Ticks
        for (let i = step; i <= w / 2; i += step) {
             // Positive X (Right)
             this.drawTick(graphics, x + i, y, tickSize, 0xff0000, i.toString());
             // Negative X (Left)
             this.drawTick(graphics, x - i, y, tickSize, 0xff0000, (-i).toString());
        }

        // Y-Axis Ticks
        for (let i = step; i <= h / 2; i += step) {
             // Positive Y (Down)
             this.drawTick(graphics, x, y + i, tickSize, 0x00ff00, i.toString());
             // Negative Y (Up)
             this.drawTick(graphics, x, y - i, tickSize, 0x00ff00, (-i).toString());
        }
    }

    private drawTick(graphics: Phaser.GameObjects.Graphics, cx: number, cy: number, size: number, color: number, text: string) {
        // Draw tick line (vertical for X-axis usage, horizontal for Y-axis usage - simplified to cross for visibility)
        graphics.lineStyle(1, color, 1);
        graphics.beginPath();
        graphics.moveTo(cx - 2, cy - 2);
        graphics.lineTo(cx + 2, cy + 2);
        graphics.moveTo(cx + 2, cy - 2);
        graphics.lineTo(cx - 2, cy + 2);
        graphics.strokePath();
        
        // Draw text
        this.add.text(cx, cy, text, { 
            fontSize: '9px', 
            color: '#ffffff',
            backgroundColor: '#000000AA'
        }).setOrigin(0.5).setDepth(1001);
    }

    private drawHintDebug(image: Phaser.GameObjects.Image, hintPoints: any[]) {
        const graphics = this.add.graphics();
        graphics.setDepth(1001); // On top of axes

        const baseX = image.x;
        const baseY = image.y;
        const scale = image.getData('originScale') || 1;

        hintPoints.forEach((p) => {
            const wx = baseX + p.x * scale;
            const wy = baseY + p.y * scale;

            // Draw Point (Yellow)
            graphics.fillStyle(0xffff00, 1);
            graphics.fillCircle(wx, wy, 5);

            // Draw Text (Coordinates)
            this.add.text(wx + 5, wy + 5, `(${p.x}, ${p.y})`, {
                fontSize: '10px',
                color: '#ffff00',
                backgroundColor: '#000000'
            }).setDepth(1002);
        });
    }

    // =================================================================
    // PHẦN 3: LOGIC GAMEPLAY (GAMEPLAY LOGIC)
    // =================================================================

    /**
     * Xử lý khi một bộ phận được tô xong
     * @param usedColors Set chứa danh sách các màu đã tô lên bộ phận này
     */
    private handlePartComplete(
        id: string,
        rt: Phaser.GameObjects.RenderTexture,
        usedColors: Set<number>
    ) {
        // --- LOGIC KIỂM TRA ĐÁP ÁN (NEW) ---
        // Lấy hitArea tương ứng từ map (hoặc tìm cách truy xuất data)
        const hitArea = this.unfinishedPartsMap.get(id);
        const isCorrect = hitArea?.getData('isCorrectAnswer');

        // Note: Nếu không có cấu hình ans (undefined) thì mặc định coi như là bài tô màu thường (true)
        // Nhưng ở đây ta đang làm bài kiểm tra đúng/sai nên xử lý chặt chẽ hơn.
        
        if (isCorrect === false) {
             // ĐÁP ÁN SAI
             console.log('WRONG ANSWER!');
             AudioManager.play('sfx-wrong'); // Cần đảm bảo có file âm thanh này, hoặc dùng âm thanh tương tự
             
             // Reset màu về trắng/trong suốt (Clear texture)
             rt.clear();
             rt.setData('isFinished', false); // Cần reset flag để cho phép tô lại và kiểm tra lại
             
             // Có thể thêm hiệu ứng lắc hoặc hiện dấu X đỏ để báo sai
             this.tweens.add({
                 targets: rt,
                 x: '+=10',
                 duration: 50,
                 yoyo: true,
                 repeat: 3
             });

             return; // Dừng lại, không tính điểm
        }

        // ĐÁP ÁN ĐÚNG
        this.finishedParts.add(id);

        game.recordCorrect({ scoreDelta: 1 });
        this.score += 1;
        (window as any).irukaGameState.currentScore = this.score;
        sdk.score(this.score, 1);
        sdk.progress({
            levelIndex: 2,
            score: this.score,
        });
        game.finishQuestionTimer();
        if (this.finishedParts.size < this.totalParts) {
            game.startQuestionTimer();
        }

        // --- LOGIC AUTO-FILL THÔNG MINH ---
        // Nếu bé chỉ dùng ĐÚNG 1 MÀU -> Game tự động fill màu đó cho đẹp (khen thưởng)
        if (usedColors.size === 1) {
            const singleColor = usedColors.values().next().value || 0;

            rt.setBlendMode(Phaser.BlendModes.NORMAL);
            rt.fill(singleColor);
        } else {
            // Nếu bé dùng >= 2 màu (tô sặc sỡ) -> Giữ nguyên nét vẽ nghệ thuật của bé
            console.log('Multi-color artwork preserved!');
        }

        // Xóa khỏi danh sách chưa tô -> Để gợi ý không chỉ vào cái này nữa
        this.unfinishedPartsMap.delete(id);

        AudioManager.play('sfx-ting');

        // Hiệu ứng nhấp nháy báo hiệu hoàn thành
        this.tweens.add({
            targets: rt,
            alpha: 0.8,
            yoyo: true,
            duration: GameConstants.SCENE1.TIMING.AUTO_FILL,
            repeat: 2,
        });
        
        // Đếm số lượng câu đúng còn lại trong map
        let remainingCorrectAnswers = 0;
        this.unfinishedPartsMap.forEach((part) => {
            if (part.getData('isCorrectAnswer') === true) {
                remainingCorrectAnswers++;
            }
        });

        if (remainingCorrectAnswers === 0) {
            console.log('WIN SCENE 3!');

            // --- GAME HUB COMPLETE ---
            game.finalizeAttempt();
            sdk.requestSave({
                score: this.score,
                levelIndex: 2,
            });
            sdk.progress({
                levelIndex: 2, // Level complete -> set index + 1 if multi-level, here just complete
                total: 1,
                score: this.score,
            });

            AudioManager.play('sfx-correct_s2');
            
            // Xóa UI (Nút màu & Banner)
            const uiScene = this.scene.get(SceneKeys.UI) as any;
            if (uiScene) {
                if (uiScene.hidePalette) uiScene.hidePalette();
                if (uiScene.hideBanners) uiScene.hideBanners();
            }

            this.time.delayedCall(GameConstants.SCENE1.TIMING.WIN_DELAY, () => {
                // Transition to EndGame
                this.scene.start(SceneKeys.EndGame);
            });
        }
    }

    // =================================================================
    // PHẦN 4: HƯỚNG DẪN & GỢI Ý (TUTORIAL & HINT)
    // =================================================================

    public restartIntro() {
        this.stopIntro();
        this.time.delayedCall(GameConstants.SCENE1.TIMING.RESTART_INTRO, () =>
            this.playIntroSequence()
        );
    }

    private playIntroSequence() {
        this.isIntroActive = true;
        // playVoiceLocked(null, 'voice_intro_s2');
        // Đợi 1 chút rồi chạy animation tay hướng dẫn
        this.time.delayedCall(GameConstants.SCENE1.TIMING.INTRO_DELAY, () => {
            if (this.isIntroActive) this.runHandTutorial();
        });
    }

    private stopIntro() {
        this.isIntroActive = false;
        this.idleManager.start();

        if (this.handHint) {
            this.handHint.setAlpha(0).setPosition(-200, -200);
        }
    }

    /**
     * Tutorial đầu game: Tay cầm màu đỏ tô mẫu
     */
    private runHandTutorial() {
        if (!this.isIntroActive) return;

        // 1. Lấy tất cả các bộ phận tương tác (Interactive parts)
        const parts = Array.from(this.unfinishedPartsMap.values());

        // Sắp xếp theo vị trí x để tay di chuyển từ trái sang phải cho tự nhiên
        parts.sort((a, b) => a.x - b.x);

        if (parts.length === 0 || !this.handHint) return;

        // 2. Thiết lập vị trí bắt đầu (Ngoài màn hình)
        const startX = GameUtils.getW(this) + 200;
        const startY = GameUtils.getH(this) + 200;

        this.handHint.setDepth(2000).setAlpha(1).setScale(0.7);
        this.handHint.setPosition(startX, startY);
        this.handHint.setOrigin(0, 0); // Đầu ngón tay

        const tweensChain: any[] = [];

        // Duyệt qua từng đáp án để tạo chuỗi animation
        parts.forEach((part, index) => {
            const hX = part.getData('hintX') || 0;
            const hY = part.getData('hintY') || 0;
            const originScale = part.getData('originScale') || 1;

            // Tính vị trí đích
            const destX = part.x + (hX * originScale);
            const destY = part.y + (hY * originScale);

            // Bước 1: Di chuyển tay đến đáp án
            tweensChain.push({
                x: destX,
                y: destY,
                duration: index === 0 ? 800 : 500,
                ease: 'Power2',
            });

            // Bước 2: Động tác tô màu (Rubbing/Coloring)
            tweensChain.push({
                x: destX + 40, // Di chuyển chéo
                y: destY + 20,
                duration: 200,
                yoyo: true, // Quay lại
                repeat: 3, // Lặp lại 3 lần
                ease: 'Sine.easeInOut'
            });
        });

        // Bước 3: Biến mất sau khi hướng dẫn xong
        tweensChain.push({
            alpha: 0,
            duration: 500,
            delay: 200,
            onComplete: () => {
                this.handHint?.setPosition(startX, startY);
            }
        });

        // Loop logic
        this.tweens.chain({
            targets: this.handHint,
            tweens: tweensChain,
            onComplete: () => {
                if (this.isIntroActive) {
                    this.time.delayedCall(1500, () => this.runHandTutorial());
                }
            }
        });
    }

    /**
     * Gợi ý khi rảnh (Idle Hint): Chọn ngẫu nhiên 1 phần chưa tô để chỉ vào
     */
    private showHint() {
        game.addHint();
        const items = Array.from(this.unfinishedPartsMap.values());
        if (items.length === 0) return;
        
        // Random 1 bộ phận
        const target = items[Math.floor(Math.random() * items.length)];

        AudioManager.play('hint');
        
        const IDLE_CFG = GameConstants.IDLE;

        // Visual 1: Nhấp nháy bộ phận đó
        this.activeHintTarget = target;
        this.activeHintTween = this.tweens.add({
            targets: target, 
            alpha: { from: 0.01, to: 0.8 },
            scale: { from: target.getData('originScale'), to: target.getData('originScale') * 1.005 },
            duration: IDLE_CFG.FADE_IN, 
            yoyo: true, 
            repeat: 2,
            onComplete: () => { 
                this.activeHintTween = null; 
                this.activeHintTarget = null;
                this.idleManager.reset();
            }
        });

        // Visual 2: Bàn tay chỉ vào
        // --- FIX BUG LỆCH VỊ TRÍ (BEST PRACTICE) ---
        // Không dùng target.scaleX vì nó biến thiên khi tween.
        // Dùng originScale (lấy từ Data) để đảm bảo tính toán vị trí luôn chính xác tuyệt đối.
        const hX = target.getData('hintX') || 0;
        const hY = target.getData('hintY') || 0;
        const originScale = target.getData('originScale') || 1; 

        // Tính tọa độ đích dựa trên scale gốc
        let destX = target.x + (hX * originScale);
        let destY = target.y + (hY * originScale);

        if (!this.handHint) return;

        // --- CẬP NHẬT: SET ORIGIN (0,0) ĐỂ NGÓN TAY (GÓC TRÁI TRÊN) CHỈ ĐÚNG VÀO ĐIỂM ---
        this.handHint.setOrigin(0, 0);

        // Set vị trí ban đầu (nếu có hint points thì set ở điểm đầu, ko thì destX)
        // Tuy nhiên logic hint là fade in tại chỗ, nên cần xác định chỗ nào
        
        const hintPoints = target?.getData('hintPoints'); // Lấy danh sách điểm gợi ý
        
        // Mặc định dùng destX, destY cũ làm điểm xuất phát
        let startHintX = destX;
        let startHintY = destY;

        const tweensChain: any[] = [];
        
        if (hintPoints && hintPoints.length > 0) {
            const baseX = target?.x || 0;
            const baseY = target?.y || 0;
            
             // Tính điểm đầu tiên
            const firstP = hintPoints[0];
            startHintX = baseX + (firstP.x * originScale);
            startHintY = baseY + (firstP.y * originScale);
            
            // 1. Hiện ra tại điểm đầu tiên
            tweensChain.push({ alpha: 1, x: startHintX, y: startHintY, duration: IDLE_CFG.FADE_IN });
            // 2. Tap tại điểm đầu tiên
            tweensChain.push({ scale: 0.5, duration: IDLE_CFG.SCALE, yoyo: true, repeat: 3 });

            // 3. Di chuyển và Tap ở các điểm tiếp theo
            for (let i = 1; i < hintPoints.length; i++) {
                const p = hintPoints[i];
                const dX = baseX + (p.x * originScale);
                const dY = baseY + (p.y * originScale);
                
                // Di chuyển đến
                tweensChain.push({ x: dX, y: dY, duration: IDLE_CFG.SCALE * 2 });
                // Tap
                tweensChain.push({ scale: 0.5, duration: IDLE_CFG.SCALE, yoyo: true, repeat: 3 });
            }

            // 4. Biến mất
             tweensChain.push({ alpha: 0, duration: IDLE_CFG.FADE_OUT });

        } else {
             // Logic cũ
             startHintX = destX;
             startHintY = destY;

              tweensChain.push({ alpha: 1, x: destX, y: destY, duration: IDLE_CFG.FADE_IN });
              tweensChain.push({ scale: 0.5, duration: IDLE_CFG.SCALE, yoyo: true, repeat: 3 });
              tweensChain.push({ alpha: 0, duration: IDLE_CFG.FADE_OUT });
        }

        // Không dùng OFFSET nữa vì muốn chỉ chính xác
        this.handHint.setPosition(startHintX, startHintY)
            .setAlpha(0).setScale(0.7);
        
        this.tweens.chain({
            targets: this.handHint,
            tweens: tweensChain
        });
    }

    private stopActiveHint() {
        if (this.activeHintTween) {
            this.activeHintTween.stop();
            this.activeHintTween = null;
        }

        if (this.activeHintTarget) {
            this.tweens.killTweensOf(this.activeHintTarget);
            this.activeHintTarget.setAlpha(0.01); // Reset about PaintManager default alpha
            this.activeHintTarget.setScale(this.activeHintTarget.getData('originScale'));
            this.activeHintTarget = null;
        }

        if (this.handHint) {
            this.tweens.killTweensOf(this.handHint);
            this.handHint.setAlpha(0).setPosition(-200, -200);
        }
    }
}
