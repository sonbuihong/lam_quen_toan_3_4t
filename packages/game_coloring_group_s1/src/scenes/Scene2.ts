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

export default class Scene2 extends Phaser.Scene {
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
    private isWaitingForIntroStart: boolean = false; // Cờ chờ người dùng chạm lần đầu - AUTO START cho Scene 2

    // --- UI COMPONENTS ---
    
    private get handHint(): Phaser.GameObjects.Image | undefined {
         const uiScene = this.scene.get(SceneKeys.UI) as any;
         return uiScene?.handHint;
    }

    // Tween đang chạy cho gợi ý (lưu lại để stop khi cần)
    private activeHintTween: Phaser.Tweens.Tween | null = null;
    private activeHintTarget: Phaser.GameObjects.Image | null = null;

    constructor() {
        super(SceneKeys.Scene2);
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

        // Scene 2 auto starts, no need to wait for tap unless it's a specific requirement overrides.
        // As per request: "Từ scene2 3 4 không cần putdown để bắt đầu game"
        this.isWaitingForIntroStart = false; 

        if (data?.isRestart) {
            game.retryFromStart();
        }
    }

    create() {
        showGameButtons();

        this.setupSystem(); // Cài đặt hệ thống (Paint, Idle)
        this.setupBackgroundAndAudio(); // Cài đặt hình nền và nhạc nền
        this.createUI(); // Tạo giao diện (Bảng màu, Banner)
        
        // Check if UI Scene is already active
        const uiScene = this.scene.get(SceneKeys.UI);
        if (uiScene.scene.isActive()) {
             (uiScene as any).paintManager = this.paintManager;
             (uiScene as any).updateSceneKey(SceneKeys.Scene2);
        } else {
            this.scene.launch(SceneKeys.UI, { 
                paintManager: this.paintManager,
                sceneKey: SceneKeys.Scene2 
            });
        }

        this.createLevel(); // Tạo nhân vật và các vùng tô màu
        
        // SDK Integration
        game.setTotal(1);
        (window as any).irukaGameState = {
            startTime: Date.now(),
            currentScore: 0,
        };
        sdk.score(this.score, 0);
        sdk.progress({ levelIndex: 1, total: 1 }); // Scene 2 index 1? Or just progress.
        game.startQuestionTimer();

        this.setupInput(); // Cài đặt sự kiện chạm/vuốt

        // Sự kiện khi quay lại tab game (Wake up)
        this.events.on('wake', () => {
            this.idleManager.reset();
            if (this.input.keyboard) this.input.keyboard.enabled = true;
        });

        // BẮT ĐẦU LUÔN VÌ KHÔNG CẦN CHỜ TAP
        const soundManager = this.sound as Phaser.Sound.WebAudioSoundManager;
        if (soundManager.context && soundManager.context.state === 'suspended') {
             soundManager.context.resume();
        }
        this.time.delayedCall(500, () => {
             this.playIntroSequence();
        });
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

        AudioManager.stopAllVoicePrompts(); // Prevent audio overlap on scene change
        
        this.paintManager = null as any; // Giải phóng bộ nhớ
        // REMOVED: this.scene.stop(SceneKeys.UI); // Keep UI alive
        // REMOVED: this.bgm.stop(); // Keep BGM alive
        if (this.bgm && !this.sound.get(AudioKeys.BgmNen)?.isPlaying) {
             // Optional
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
             // Scene 2 logic: Just reset idle, no "Start Intro" logic because it started automatically
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
            // Check if playing, if so keep it? Or restart? Use global bgm manager preference.
            // For now, simple logic: Ensure BGM is playing
            if (!this.sound.get(AudioKeys.BgmNen).isPlaying) {
                 this.bgm = this.sound.add(AudioKeys.BgmNen, {
                    loop: true,
                    volume: 0.25,
                });
                this.bgm.play();
            } else {
                 this.bgm = this.sound.get(AudioKeys.BgmNen) as Phaser.Sound.BaseSound;
            }
        } else {
             this.bgm = this.sound.add(AudioKeys.BgmNen, {
                loop: true,
                volume: 0.25,
            });
            this.bgm.play();
        }
    }
    // =================================================================
    // PHẦN 2: TẠO GIAO DIỆN & LEVEL (UI & LEVEL CREATION)
    // =================================================================

    private createUI() {
        const UI = GameConstants.SCENE1.UI; // Reuse Scene 1 UI constants or Create S2 specific if needed
        const cx = GameUtils.pctX(this, 0.5);
        const scl = [1, 0.72];

        // Tính toán vị trí Board dựa trên Banner
        // const bannerY = GameUtils.pctY(this, UI.BANNER_Y);
        const bannerHeight = this.textures.get(TextureKeys.S2_Banner).getSourceImage().height * 0.7; // Scale 0.7

        const boardY = bannerHeight + GameUtils.pctY(this, UI.BOARD_OFFSET);
        const board = this.add
            .image(cx, boardY, TextureKeys.S1_Board) // Reuse S1_Board or S2_Board if different? Assuming shared board bg
            .setOrigin(0.5, 0)
            .setScale(scl[0], scl[1])
            .setDepth(0);

        board.displayWidth = GameUtils.getW(this) * 0.8;
    }

    // --- LOGIC TẠO LEVEL THEO STAGE ---
    private createLevel() {
        // Load cấu hình level từ JSON SCENE 2
        const data = this.cache.json.get(DataKeys.LevelS2Config);
        if (data) {
            this.spawnCharacter(data.teacher);
            this.createDecorativeObject(data.flower);
        }
    }

    private createDecorativeObject(config: any) {
        if (!config) return;
        const cx = GameUtils.pctX(this, config.baseX_pct);
        const cy = GameUtils.pctY(this, config.baseY_pct);
        
        // Vẽ Frame (Khung) nếu có
        if (config.frameKey && config.frameKey !== "") {
            this.add.image(cx, cy, config.frameKey)
                .setOrigin(0.5)
                .setScale(config.baseScale)
                .setDepth(5);
        }

        // Chỉ hiện outline (hình ảnh chính)
        if (config.outlineKey) {
            this.add.image(cx, cy, config.outlineKey)
                .setScale(config.baseScale)
                .setDepth(5); // ✅ Đặt depth thấp để nằm dưới layer tô màu (910) và Outline (900)
        }
    }

    private spawnCharacter(config: any) {
        const cx = GameUtils.pctX(this, config.baseX_pct);
        const cy = GameUtils.pctY(this, config.baseY_pct);

        config.parts.forEach((part: any, index: number) => {
            const id = `${part.key}_${index}`;
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

            // --- OVERRIDE DEPTH: Đặt lớp tô màu lên trên viền (Outline = 900) ---
            const rt = hitArea.getData('layer');
            if (rt) {
                rt.setDepth(910);
            }

            // --- BEST PRACTICE: LƯU DỮ LIỆU TĨNH & TÍNH TOÁN TỰ ĐỘNG ---
            const centerOffset = GameUtils.calculateCenteredOffset(this, part.key);
            let hX = centerOffset.x;
            let hY = centerOffset.y;

            // Lưu các thông số cấu hình vào Data Manager của Game Object.
            hitArea.setData('hintX', hX);
            hitArea.setData('hintY', hY);
            hitArea.setData('originScale', part.scale); // Scale gốc (không đổi)
            
            // --- CẬP NHẬT: LƯU HINT POINTS (NẾU CÓ) ---
            if (part.hintPoints && Array.isArray(part.hintPoints)) {
                hitArea.setData('hintPoints', part.hintPoints);

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

        // this.drawDebugAxes(outline);
    }

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
            graphics.fillStyle(0x539BD7, 1);
            graphics.fillCircle(wx, wy, 10);

            // Draw Text (Coordinates)
            this.add.text(wx + 5, wy + 5, `(${p.x}, ${p.y})`, {
                fontSize: '15px',
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
        this.finishedParts.add(id);

        game.recordCorrect({ scoreDelta: 1 });
        this.score += 1;
        (window as any).irukaGameState.currentScore = this.score;
        sdk.score(this.score, 1);
        sdk.progress({
            levelIndex: 1, // Scene 2
            score: this.score,
        });
        game.finishQuestionTimer();
        if (this.finishedParts.size < this.totalParts) {
            game.startQuestionTimer();
        }

        // --- LOGIC AUTO-FILL THÔNG MINH ---
        if (usedColors.size === 1) {
            const singleColor = usedColors.values().next().value || 0;

            rt.setBlendMode(Phaser.BlendModes.NORMAL);
            rt.fill(singleColor);
        } else {
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

        // Kiểm tra điều kiện thắng
        if (this.finishedParts.size >= this.totalParts) {
            console.log('WIN SCENE 2!');

            AudioManager.play('sfx-correct_s2');

            // --- Scene 2 Complete -> Next is Scene 3 ---
            
            // Xóa UI (Nút màu & Banner) -> REMOVED for transition
            // const uiScene = this.scene.get(SceneKeys.UI) as any;
            // if (uiScene) {
            //     if (uiScene.hidePalette) uiScene.hidePalette();
            //     if (uiScene.hideBanners) uiScene.hideBanners();
            // }

            this.time.delayedCall(GameConstants.SCENE1.TIMING.WIN_DELAY, () => {
                this.scene.start(SceneKeys.Scene3);
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
        playVoiceLocked(null, 'voice_intro_s2'); // Maybe use a different intro voice if available? preserving s2 voice check
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

        // 1. Tìm bộ phận mục tiêu (Lấy bộ phận đầu tiên chưa tô)
        const items = Array.from(this.unfinishedPartsMap.values());
        let target: Phaser.GameObjects.Image | undefined;
        let destX = 0;
        let destY = 0;

        if (items.length > 0) {
            target = items[0]; // Lấy cái đầu tiên
            const hX = target.getData('hintX') || 0;
            const hY = target.getData('hintY') || 0;
            const originScale = target.getData('originScale') || 1; 

            // Tính tọa độ đích chính xác
            destX = target.x + (hX * originScale);
            destY = target.y + (hY * originScale);
        } else {
            // Fallback nếu không có part nào (hiếm gặp)
            const UI = GameConstants.SCENE1.UI;
            destX = GameUtils.pctX(this, UI.HAND_INTRO_END_X);
            destY = GameUtils.pctY(this, UI.HAND_INTRO_END_Y);
        }

        const UI = GameConstants.SCENE1.UI;
        const INTRO = GameConstants.SCENE1.INTRO_HAND;

        // Tính toán tọa độ nút màu đầu tiên (Horizontal Layout)
        const spacingX = GameUtils.pctX(this, UI.PALETTE_SPACING_X);
        const paletteData = GameConstants.PALETTE_DATA;
        const totalItems = paletteData.length + 1;
        const totalWidth = (totalItems - 1) * spacingX;
        const startX = (GameUtils.getW(this) - totalWidth) / 2;
        
        const paletteY = GameUtils.pctY(this, UI.PALETTE_Y);

        const dragY = destY + 30; // Kéo tay xuống thấp hơn điểm đích một chút để không che mất

        if (!this.handHint) return;

        this.handHint.setOrigin(0, 0);
        // Start from the first color button position
        this.handHint.setPosition(startX, paletteY).setAlpha(0).setScale(0.7);

        // --- CẬP NHẬT LOGIC HINT POINTS ---
        const hintPoints = target?.getData('hintPoints'); // Lấy danh sách điểm gợi ý
        
        const tweensChain: any[] = [
            {
                alpha: 1,
                x: startX,
                y: paletteY,
                duration: INTRO.MOVE,
                ease: 'Power2',
            },
            { scale: 0.5, duration: INTRO.TAP, yoyo: true, repeat: 0.7 },
        ];

        if (hintPoints && hintPoints.length > 0) {
            // Nếu có danh sách điểm, di chuyển lần lượt qua các điểm
            const originScale = target?.getData('originScale') || 1;
            const baseX = target?.x || 0;
            const baseY = target?.y || 0;

            // Di chuyển đến điểm đầu tiên
            const firstP = hintPoints[0];
            const firstDestX = baseX + (firstP.x * originScale);
            const firstDestY = baseY + (firstP.y * originScale);

            tweensChain.push({ x: firstDestX, y: firstDestY, duration: INTRO.DRAG, delay: 100 });

            // Rub tại điểm đầu tiên
            tweensChain.push({
                x: '-=30',
                y: '-=10',
                duration: INTRO.RUB,
                yoyo: true,
                repeat: 3,
            });

            // Di chuyển qua các điểm còn lại
            for (let i = 1; i < hintPoints.length; i++) {
                const p = hintPoints[i];
                const destX = baseX + (p.x * originScale);
                const destY = baseY + (p.y * originScale);
                tweensChain.push({ x: destX, y: destY, duration: INTRO.DRAG });
            
                // Rub tại các điểm tiếp theo
             tweensChain.push({
                x: '-=30',
                y: '-=10',
                duration: INTRO.RUB,
                yoyo: true,
                repeat: 3,
            });
            }

        } else {
             // Logic cũ: Drag đến center rồi Rub
             tweensChain.push({ x: destX, y: dragY, duration: INTRO.DRAG, delay: 100 });
             tweensChain.push({
                x: '-=30',
                y: '-=10',
                duration: INTRO.RUB,
                yoyo: true,
                repeat: 3,
            });
        }

        tweensChain.push({
            alpha: 0,
            duration: 500,
            onComplete: () => {
                this.handHint?.setPosition(-200, -200);
                // Lặp lại nếu Intro chưa kết thúc
                if (this.isIntroActive)
                    this.time.delayedCall(1000, () =>
                        this.runHandTutorial()
                            );
                    },
        });

        // Chuỗi Animation: Hiện -> Ấn chọn màu -> Kéo ra -> Di đi di lại (tô) tại đúng vị trí -> Biến mất
        this.tweens.chain({
            targets: this.handHint,
            tweens: tweensChain,
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
        const hX = target.getData('hintX') || 0;
        const hY = target.getData('hintY') || 0;
        const originScale = target.getData('originScale') || 1; 

        // Tính tọa độ đích dựa trên scale gốc
        let destX = target.x + (hX * originScale);
        let destY = target.y + (hY * originScale);

        if (!this.handHint) return;

        // --- CẬP NHẬT: SET ORIGIN (0,0) ĐỂ NGÓN TAY (GÓC TRÁI TRÊN) CHỈ ĐÚNG VÀO ĐIỂM ---
        this.handHint.setOrigin(0, 0);

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
            
        } else {
             // Logic cũ
            tweensChain.push({ alpha: 1, x: destX, y: destY, duration: IDLE_CFG.FADE_IN });
            tweensChain.push({ scale: 0.5, duration: IDLE_CFG.SCALE, yoyo: true, repeat: 3 });
        }

        tweensChain.push({ alpha: 0, duration: IDLE_CFG.FADE_OUT });

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
            this.activeHintTarget.setAlpha(0.01);
            // Reset scale if needed, but handled in createLevel reuse of originScale
            const os = this.activeHintTarget.getData('originScale');
            if (os) this.activeHintTarget.setScale(os);
            this.activeHintTarget = null;
        }
        if (this.handHint) {
            this.handHint.setAlpha(0).setPosition(-200, -200);
            this.tweens.killTweensOf(this.handHint);
        }
    }
}
