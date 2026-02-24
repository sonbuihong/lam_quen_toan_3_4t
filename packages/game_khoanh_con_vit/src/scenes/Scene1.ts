import Phaser from 'phaser';
import UIScene from './UIScene';
import { SceneKeys, TextureKeys, AudioKeys, DataKeys } from '../consts/Keys';
import { GameConstants } from '../consts/GameConstants';
import { GameUtils } from '../utils/GameUtils';
import { changeBackground } from '../utils/BackgroundManager';
import AudioManager from '../audio/AudioManager';
import { showGameButtons } from '../main';
import { setGameSceneReference, resetVoiceState, playVoiceLocked } from '../utils/rotateOrientation';
import { IdleManager } from '../utils/IdleManager';

// Managers
import { LassoManager } from '../managers/LassoManager';
import { ObjectManager } from '../managers/ObjectManager';
import { LassoValidation } from '../utils/LassoValidation';
import { game } from "@iruka-edu/mini-game-sdk";
import { sdk } from '../main';

export default class Scene1 extends Phaser.Scene {
    private bgm!: Phaser.Sound.BaseSound;
    private lassoManager!: LassoManager;
    private objectManager!: ObjectManager;

    // Trạng thái Logic
    private isIntroductionPlayed: boolean = false;
    private idleManager!: IdleManager;
    private isWaitingForIntroStart: boolean = true;
    
    // Getter tiện ích cho UIScene
    private get uiScene(): UIScene {
        return this.scene.get(SceneKeys.UI) as UIScene;
    }
    
    // Trạng thái Hướng dẫn & Gợi ý (Tutorial & Hint)
    private isIntroActive: boolean = false;
    private activeHintTween: Phaser.Tweens.Tween | null = null;
    private activeHintTargets: Phaser.GameObjects.Image[] = [];
    private activeCircleTween: Phaser.Tweens.Tween | null = null; // Track tween xoay tròn để cleanup đúng
    // Lưu ý: handHint giờ đây được quản lý bởi UIScene

    // Logic mới cho "Tìm tất cả" (Find All)
    private foundTargets: number[] = [];
    private totalTargets: number = 0;
    private currentLevelIndex: number = 0; 

    constructor() {
        super(SceneKeys.Scene1);
    }

    /** Cho phép Scene2 lấy references ảnh đáp án từ Scene1 đang pause - tránh spawn lại */
    public getAnswerObjects(): Phaser.GameObjects.Image[] {
        return this.objectManager?.getAnswerObjects() ?? [];
    }

    init(data?: { isRestart?: boolean; fromEndGame?: boolean; levelIndex?: number }) {
        resetVoiceState();
        
        // Reset các trạng thái logic
        this.isIntroActive = false;
        this.activeHintTween = null;
        this.activeHintTargets = [];
        
        this.foundTargets = [];
        this.totalTargets = 0;

        // Nhận levelIndex từ caller (Scene2 truyền sang khi qua màn).
        // Nếu không có (lần đầu vào game) thì mặc định = 0.
        this.currentLevelIndex = data?.levelIndex ?? 0;
        console.log(`[Scene1] init - levelIndex = ${this.currentLevelIndex}`);

        if (data?.isRestart) {
            // Restart từ nút replay: về màn 0
            this.currentLevelIndex = 0;
            this.isWaitingForIntroStart = false;
            if (!data.fromEndGame) {
                game.retryFromStart(); 
            }
        } else {
            // Vào game lần đầu hoặc chuyển từ Scene2 sang
            // Chỉ show intro màn hình chờ tap ở màn đầu tiên
            this.isWaitingForIntroStart = this.currentLevelIndex === 0;
        }
    }

    create() {
        showGameButtons();
        
        // Phaser KHÔNG tự gọi method shutdown() khi scene.stop()
        // Phải đăng ký thủ công vào event system để dọn dẹp tài nguyên đúng cách
        this.events.once('shutdown', this.shutdown, this);
        
        this.setupSystem();
        this.setupBackgroundAndAudio();
        this.createUI();

        // 4. Tải dữ liệu Level & Spawn Objects theo levelIndex
        const fullConfig = this.cache.json.get(DataKeys.LevelS1Config);
        // Hỗ trợ cả cấu trúc mảng levels[] mới và flat object cũ (backward compatibility)
        const rawLevelConfig = fullConfig.levels
            ? fullConfig.levels[this.currentLevelIndex]
            : fullConfig;

        if (!rawLevelConfig) {
            console.error(`[Scene1] Không tìm thấy config cho levelIndex=${this.currentLevelIndex}`);
            return;
        }

        // Merge answers từ top-level vào level config.
        // answers đặt ở top-level để tránh lặp lại trong từng level.
        const levelConfig = {
            ...rawLevelConfig,
            answers: rawLevelConfig.answers ?? fullConfig.answers ?? [],
        };

        this.objectManager.spawnObjectsFromConfig(levelConfig);
        
        // Đếm tổng số mục tiêu đúng cần tìm (chỉ hình trong images[], không tính answers)
        this.totalTargets = this.objectManager.getImageObjects().filter(
            obj => this.objectManager.isCorrectAnswer(obj)
        ).length;
        console.log(`[Scene1] Màn ${this.currentLevelIndex + 1} - Tổng mục tiêu: ${this.totalTargets}`);

        // Tích hợp SDK: chỉ khởi tạo game state ở màn đầu tiên
        const totalLevels = fullConfig.levels ? fullConfig.levels.length : 1;
        if (this.currentLevelIndex === 0) {
            // Tổng câu = tổng số màn (mỗi màn = 1 câu hỏi)
            game.setTotal(totalLevels);
            (window as any).irukaGameState = {
                startTime: Date.now(),
                currentScore: 0,
            };
            sdk.score(0, totalLevels);
        }
        sdk.progress({ levelIndex: this.currentLevelIndex, total: totalLevels });
        game.startQuestionTimer();

        this.setupInput();

        // Nếu là restart (không cần chờ tap), chạy intro luôn
        if (!this.isWaitingForIntroStart) {
            const soundManager = this.sound as Phaser.Sound.WebAudioSoundManager;
            if (soundManager.context && soundManager.context.state === 'suspended') {
                soundManager.context.resume();
            }
            this.playIntroSequence();
        }

        // 6. Khởi chạy UI Overlay
        if (!this.scene.get(SceneKeys.UI).scene.isActive()) {
            this.scene.launch(SceneKeys.UI, { sceneKey: SceneKeys.Scene1, levelIndex: this.currentLevelIndex });
            this.scene.bringToTop(SceneKeys.UI);
        } else {
            const ui = this.scene.get(SceneKeys.UI) as UIScene;
            ui.updateLevel(this.currentLevelIndex);
            this.scene.bringToTop(SceneKeys.UI);
        }
    }

    update(time: number, delta: number) {
        if (this.idleManager) {
            this.idleManager.update(delta);
        }
    }

    shutdown() {
        // Gỡ event để tránh gọi shutdown trùng lặp
        this.events.off('shutdown', this.shutdown, this);
        // 1. Dọn dẹp Âm thanh
        if (this.bgm) {
            this.bgm.stop();
        }
        // Dừng tất cả âm thanh SFX khác đang chạy qua Howler
        AudioManager.stopAll();

        // 2. Dọn dẹp Managers
        if (this.lassoManager) {
            this.lassoManager.destroyAll();
        }
        if (this.idleManager) {
            this.idleManager.stop();
        }
        
        // Reset tham chiếu
        this.activeHintTargets = [];
        this.activeHintTween = null;

        // 3. Dọn dẹp hệ thống
        this.tweens.killAll(); // Dừng mọi animation đang chạy
        this.time.removeAllEvents(); // NGỪNG TOÀN BỘ delayedCall (quan trọng để tránh setupGameplay() của mảng cũ nổ)
        this.input.off('pointerdown', this.onScenePointerDown, this); // Gỡ bỏ sự kiện ở Scene context
        this.isPointerDownBound = false;
        
        // 4. Xóa tham chiếu global
        if (window.gameScene === this) {
            window.gameScene = undefined;
        }

        console.log("Scene1: Đã dọn dẹp tài nguyên.");
    }

    // =================================================================
    // PHẦN 1: CÀI ĐẶT HỆ THỐNG (SYSTEM SETUP)
    // =================================================================

    private setupSystem() {
        resetVoiceState();
        (window as any).gameScene = this;
        setGameSceneReference(this);

        this.lassoManager = new LassoManager(this);
        this.lassoManager.onLassoComplete = (polygon: Phaser.Geom.Polygon) => {
            this.handleLassoSelection(polygon);
        };

        this.objectManager = new ObjectManager(this);

        this.idleManager = new IdleManager(GameConstants.IDLE.THRESHOLD, () => {
            this.showHint();
        });
    }

    private isPointerDownBound: boolean = false;

    private setupInput() {
        if (!this.isPointerDownBound) {
            this.isPointerDownBound = true;
            this.input.on('pointerdown', this.onScenePointerDown, this);
        }
    }

    private onScenePointerDown = () => {
            if (this.isWaitingForIntroStart) {
                this.isWaitingForIntroStart = false;
                
                const soundManager = this.sound as Phaser.Sound.WebAudioSoundManager;
                if (soundManager.context && soundManager.context.state === 'suspended') {
                    soundManager.context.resume();
                }

                this.playIntroSequence();
                return;
            }

            this.idleManager.reset();
            this.stopIntro();
            this.stopActiveHint();
    };

    private setupBackgroundAndAudio() {
        // 1. Đổi Background
        changeBackground('assets/images/bg/background.jpg');

        // 2. Phát nhạc nền (BGM)
        if (this.sound.get(AudioKeys.BgmNen)) {
            this.sound.stopByKey(AudioKeys.BgmNen);
        }
        this.bgm = this.sound.add(AudioKeys.BgmNen, {
            loop: true,
            volume: 0.25,
        });
        this.bgm.play();
    }

    public restartIntro() {
        this.stopIntro();
        this.time.delayedCall(GameConstants.SCENE1.TIMING.RESTART_INTRO, () =>
            this.playIntroSequence()
        );
    }

    private playIntroSequence() {
        this.isIntroActive = true;
        
        // Sử dụng hàm playVoiceLocked nếu có (từ utils/rotateOrientation), hoặc fallback
        let playIntro = this.currentLevelIndex === 0 ? AudioKeys.VoiceIntro : AudioKeys.VoiceIntro3;
        playVoiceLocked(this.sound, playIntro);

        // Enable gameplay (lasso) NGAY LẬP TỨC - không chờ delay
        // Lý do: nếu để trong delayed callback bị guard bởi isIntroActive,
        // khi user tap sớm hoặc transition scene, stopIntro() set isIntroActive = false
        // => setupGameplay() không bao giờ chạy => lasso bị khóa vĩnh viễn
        this.setupGameplay();

        // Chỉ animation tay hướng dẫn mới cần delay
        const delay = this.isWaitingForIntroStart ? GameConstants.SCENE1.TIMING.INTRO_DELAY : 500;
        this.time.delayedCall(delay, () => {
            if (this.isIntroActive) {
               this.runHandTutorial();
            }
        });
    }

    private stopIntro() {
        this.isIntroActive = false;
        this.idleManager.start();

        if (this.uiScene && this.uiScene.handHint) {
            this.uiScene.handHint.setAlpha(0).setPosition(-200, -200);
            this.tweens.killTweensOf(this.uiScene.handHint);
        }
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
        
        // Bảng (Board)
        const board = this.add.image(cx, boardY, TextureKeys.S1_Board)
            .setOrigin(0.5, 0).setScale(0.7).setDepth(0);
        
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
        // Kích hoạt tính năng vẽ Lasso ngay lập tức
        this.lassoManager.enable();
        
        // Nếu đang intro, stopIntro() sẽ start IdleManager sau khi user chạm
        if (!this.isIntroActive) {
            this.idleManager.start();
            console.log("IdleManager started (no intro).");
        } else {
            console.log("IdleManager NOT started (intro active, will start on stopIntro).");
        }
        
        console.log("Gameplay enabled.");

        // Khi người chơi chạm vào màn hình -> Reset Idle + Ẩn gợi ý
        // Hàm này đã lắng nghe pointerdown chung ở setupInput()
    }

    private handleLassoSelection(polygon: Phaser.Geom.Polygon) {
        // 1. Kiểm tra vùng chọn bằng Utility Class
        const result = LassoValidation.validateSelection(polygon, this.objectManager);
        
        const selectedObjects = result.selectedObjects;
        const isSuccess = result.success;
        const failureReason = result.failureReason;

        if (isSuccess) {
            this.lassoManager.clear();

            // Lọc ra các hình đúng trong vùng khoanh
            const correctObjects = selectedObjects.filter(obj =>
                this.objectManager.isCorrectAnswer(obj as Phaser.GameObjects.Image)
            ) as Phaser.GameObjects.Image[];

            // Lọc ra những mục tiêu mới chưa được khoanh
            const newCorrectObjects = correctObjects.filter(obj => {
                const index = this.objectManager.getImageObjects().indexOf(obj);
                return !this.foundTargets.includes(index);
            });

            if (newCorrectObjects.length === 0) {
                 this.handleWrongLasso("Bạn đã khoanh vùng này rồi!");
                 return;
            }

            // Tính hitbox cho khối mới khoanh để vẽ ellipse xanh
            const minCenterX = Math.min(...newCorrectObjects.map(o => o.x));
            const maxCenterX = Math.max(...newCorrectObjects.map(o => o.x));
            const minCenterY = Math.min(...newCorrectObjects.map(o => o.y));
            const maxCenterY = Math.max(...newCorrectObjects.map(o => o.y));

            const ellipseCenterX = (minCenterX + maxCenterX) / 2;
            const ellipseCenterY = (minCenterY + maxCenterY) / 2;
            
            let ellipseRadiusX = 0;
            let ellipseRadiusY = 0;

            if (newCorrectObjects.length === 1) {
                // Nếu khoanh 1 hitbox, bo sát hitbox (áp dụng displayWidth/displayHeight đã tính scaleX/Y)
                const obj = newCorrectObjects[0];
                const padding = 20;
                ellipseRadiusX = obj.displayWidth / 2 + padding;
                ellipseRadiusY = obj.displayHeight / 2 + padding;
            } else {
                const basePadding = 160; 
                ellipseRadiusX = (maxCenterX - minCenterX) / 2 + basePadding;
                ellipseRadiusY = (maxCenterY - minCenterY) / 2 + basePadding - 20;
            }

            const graphics = this.add.graphics();
            graphics.setDepth(100);
            graphics.setPosition(ellipseCenterX, ellipseCenterY);
            if (newCorrectObjects.length === 1) {
                graphics.setAngle(newCorrectObjects[0].angle);
            }
            graphics.lineStyle(10, 0x00ff00);
            graphics.strokeEllipse(0, 0, ellipseRadiusX * 2, ellipseRadiusY * 2);

            AudioManager.stopAll();
            console.log(`Khoanh ĐÚNG nửa hình! Đã khoanh thêm ${newCorrectObjects.length} hitbox.`);
            AudioManager.play("sfx-correct");

            // Đánh dấu vào foundTargets
            newCorrectObjects.forEach(obj => {
                const index = this.objectManager.getImageObjects().indexOf(obj);
                this.foundTargets.push(index);
            });

            this.stopActiveHint();

            if (this.foundTargets.length < this.totalTargets) {
                // Nếu chưa đủ, ngưng 1 lúc rồi cho khoanh tiếp phần còn lại
                this.lassoManager.disable();
                this.time.delayedCall(500, () => {
                    this.lassoManager.enable();
                });
            } else {
                // Nếu đã đủ trọn vẹn TẤT CẢ mục tiêu trong màn -> WIN
                console.log("Đã khoanh xong mọi nửa hình! Qua cảnh.");
                this.objectManager.highlightObjects(correctObjects, true);
                this.lassoManager.disable();

                // Sinh ra mảng các ellipse thay vì 1 center tổng để map line bên Scene2 
                const ellipsesPayload: any[] = [];
                const allCorrectObjects = this.objectManager.getImageObjects().filter(obj => this.objectManager.isCorrectAnswer(obj));
                
                allCorrectObjects.forEach(obj => {
                    const padding = 20;
                    const rx = obj.displayWidth / 2 + padding;
                    const ry = obj.displayHeight / 2 + padding;

                    // key="ans1" => Dùng để matching đáp án ở Scene2
                    const targetKey = obj.getData('textureKey'); 

                    ellipsesPayload.push({
                        centerX: obj.x,
                        centerY: obj.y,
                        radiusX: rx,
                        radiusY: ry,
                        targetKey: targetKey,
                        angle: obj.angle
                    });
                });

                const t = GameConstants.SCENE1.TIMING.WIN_DELAY;
                this.time.delayedCall(t, () => {
                    this.scene.pause(SceneKeys.Scene1);
                    this.scene.launch(SceneKeys.Scene2, {
                        ellipses: ellipsesPayload,
                        levelIndex: this.currentLevelIndex,
                    });
                });
            }
        } else {
            this.handleWrongLasso(failureReason!);
        }
    }

    private handleWrongLasso(failureReason: string) {
        console.log(`Khoanh SAI / TRÙNG: ${failureReason}`);
        
        // Rung hình chính (isDecorative) hoặc tất cả
        const imageObjs = this.objectManager.getAllObjects().filter(v => v.getData('isDecorative'));
        const targetToShake = imageObjs.length > 0 ? imageObjs : this.objectManager.getImageObjects();
        
        targetToShake.forEach(obj => {
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
        game.recordWrong();
        
        // Cooldown: Phạt người chơi đợi một chút
        this.lassoManager.disable();
        this.lassoManager.clear();
        this.time.delayedCall(500, () => {
            this.lassoManager.enable();
        });
    }

    // =================================================================
    // PHẦN 4: HƯỚNG DẪN & GỢI Ý (TUTORIAL & HINT)
    // =================================================================
    /**
     * Tutorial đầu game: Hiển thị gợi ý bàn tay xoay vòng tròn
     * tay khoanh tròn mẫu quanh đáp án đúng
     */
    /**
     * Tính tọa độ ellipse (dùng chung cho tutorial + hint, tránh lặp code).
     */
    private getEllipseParams() {
        // Tìm các hình cần khoanh ĐÚNG mà CHƯA ĐƯỢC KHOANH
        const correctObjects = this.objectManager.getImageObjects().filter(obj => 
            this.objectManager.isCorrectAnswer(obj) && 
            !this.foundTargets.includes(this.objectManager.getImageObjects().indexOf(obj))
        );
        if (correctObjects.length === 0) return null;

        // Bốc mục tiêu đầu tiên còn thiếu để vẽ gợi ý bo tròn
        const focusObj = correctObjects[0];
        const padding = 20;

        return {
            cx: focusObj.x,
            cy: focusObj.y,
            rx: focusObj.displayWidth / 2 + padding,
            ry: focusObj.displayHeight / 2 + padding,
            angle: focusObj.angle
        };
    }

    /**
     * Tạo mảng điểm trên ellipse (precompute) để tween theo path mượt.
     * Số lượng điểm càng nhiều thì path càng mượt.
     */
    private createEllipsePath(cx: number, cy: number, rx: number, ry: number, angleDeg: number = 0, numPoints = 64): Phaser.Math.Vector2[] {
        const points: Phaser.Math.Vector2[] = [];
        const angleRad = Phaser.Math.DegToRad(angleDeg); // Chuyển độ sang radian
        const cosA = Math.cos(angleRad);
        const sinA = Math.sin(angleRad);

        for (let i = 0; i <= numPoints; i++) {
            // Bắt đầu từ đỉnh ellipse (-PI/2) và xoay theo chiều kim đồng hồ
            const t = -Math.PI / 2 + (i / numPoints) * Math.PI * 2;
            
            // Tính tọa độ điểm trên ellipse CHƯA XOAY (tâm 0,0)
            const x0 = rx * Math.cos(t);
            const y0 = ry * Math.sin(t);

            // Xoay điểm đó và cộng dồn tọa độ tâm cx, cy
            const rotatedX = cx + (x0 * cosA - y0 * sinA);
            const rotatedY = cy + (x0 * sinA + y0 * cosA);

            points.push(new Phaser.Math.Vector2(rotatedX, rotatedY));
        }
        return points;
    }

    /**
     * Animate bàn tay theo mảng điểm trên ellipse.
     * Dùng Phaser.Curves.Spline (smooth path) thay vì onUpdate callback.
     */
    private animateHandAlongPath(
        handHint: Phaser.GameObjects.Image,
        points: Phaser.Math.Vector2[],
        duration: number,
        repeatCount: number,
        onComplete?: () => void
    ): Phaser.Tweens.Tween {
        const path = new Phaser.Curves.Spline(points);
        const progress = { t: 0 };

        return this.tweens.add({
            targets: progress,
            t: 1,
            duration,
            repeat: repeatCount,
            ease: 'Linear',
            onUpdate: () => {
                // Phaser Spline.getPoint nội suy mượt giữa các điểm,
                // ít tính toán hơn sin/cos mỗi frame vì đã precompute
                const point = path.getPoint(progress.t);
                handHint.x = point.x;
                handHint.y = point.y;
            },
            onRepeat: () => {
                progress.t = 0;
            },
            onComplete: onComplete
        });
    }

    private runHandTutorial() {
        if (!this.isIntroActive) return;

        const params = this.getEllipseParams();
        if (!params) return;

        const handHint = this.uiScene.handHint;
        if (!handHint) return;

        // Precompute path mượt trên ellipse đã xoay
        const pathPoints = this.createEllipsePath(params.cx, params.cy, params.rx, params.ry, params.angle);

        // Đặt vị trí ban đầu (đỉnh ellipse)
        handHint.setVisible(true)
            .setAlpha(1)
            .setOrigin(0.1, 0.1)
            .setPosition(pathPoints[0].x, pathPoints[0].y);

        // Animate theo path - repeat vô hạn cho đến khi stopIntro()
        this.activeCircleTween = this.animateHandAlongPath(
            handHint, pathPoints, 2500, -1
        );
    }

    /**
     * Gợi ý khi rảnh (Idle Hint)
     */
    private showHint() {
        // Cleanup animation cũ TRƯỚC KHI tạo hint mới (fix giật hình)
        this.stopActiveHint();
        
        game.addHint();
        // Tìm các hình cần khoanh đúng mà chưa được khoanh
        const allCorrectAndUnfound = this.objectManager.getImageObjects().filter(obj => 
            this.objectManager.isCorrectAnswer(obj) && 
            !this.foundTargets.includes(this.objectManager.getImageObjects().indexOf(obj))
        );

        if (allCorrectAndUnfound.length === 0) return;

        let hint = this.currentLevelIndex === 0? 'hint' : 'hint3';
        AudioManager.play(hint);

        // Visual 1: Nhấp nháy TẤT CẢ đối tượng đúng
        this.activeHintTargets = allCorrectAndUnfound as Phaser.GameObjects.Image[];
        // Tính toán các thuộc tính tween, vì các obj có thể có scale ban đầu khác nhau,
        // Phaser tweens hỗ trợ property function để lấy value tương ứng với từng target.
        this.activeHintTween = this.tweens.add({
            targets: this.activeHintTargets,
            scale: {
                getEnd: function (target: any, key: any, value: any) { return value * 1.1; },
                getStart: function (target: any, key: any, value: any) { return value; }
            },
            duration: 500,
            yoyo: true,
            repeat: 2,
            onComplete: () => {
                this.activeHintTween = null;
                this.activeHintTargets = [];
                this.idleManager.reset();
            }
        });

        // Visual 2: Bàn tay khoanh vòng ellipse bao trọn TẤT CẢ các ảnh đúng
        const params = this.getEllipseParams();
        if (!params) return;

        const handHint = this.uiScene.handHint;
        if (!handHint) return;

        // Precompute path mượt trên ellipse
        const pathPoints = this.createEllipsePath(params.cx, params.cy, params.rx, params.ry);

        // Đặt vị trí ban đầu với alpha = 0 và scale nhỏ để tạo hiệu ứng fade-in mượt mà
        handHint.setPosition(pathPoints[0].x, pathPoints[0].y)
            .setVisible(true)
            .setAlpha(0)
            .setScale(0.7)
            .setOrigin(0.1, 0.1);

        // Tween fade-in + scale-in để bàn tay xuất hiện mượt mà
        this.tweens.add({
            targets: handHint,
            alpha: 1,
            scale: 1,
            duration: 400,
            ease: 'Cubic.easeOut',
            onComplete: () => {
                // Sau khi fade-in xong, animate theo ellipse path (1 vòng)
                this.activeCircleTween = this.animateHandAlongPath(
                    handHint, pathPoints, 2500, 1,
                    () => {
                        this.activeCircleTween = null;
                        this.stopActiveHint();
                        this.idleManager.start();
                    }
                );
            }
        });
    }

    private stopActiveHint() {
        // 1. Dừng tween scale của target object
        if (this.activeHintTween) {
            this.activeHintTween.stop();
            this.activeHintTween = null;
        }

        // 2. Reset scale của các target
        if (this.activeHintTargets.length > 0) {
            this.activeHintTargets.forEach(target => {
                this.tweens.killTweensOf(target);
                // Cần 1 cách an toàn để lấy lại scale ban đầu, 
                // do obj có getData('baseScale') được set ở ObjectManager,
                // ta sẽ lấy từ đó dể đưa về mặc định (hoặc lấy property scale hiện tại nếu không có).
                const baseScale = target.getData('baseScale') || target.scale;
                target.setScale(baseScale);
            });
            this.activeHintTargets = [];
        }

        // 3. QUAN TRỌNG: Dừng tween xoay tròn (fix giật hình)
        if (this.activeCircleTween) {
            this.activeCircleTween.stop();
            this.activeCircleTween = null;
        }

        // 4. Cleanup handHint UI
        if (this.uiScene && this.uiScene.handHint) {
            this.tweens.killTweensOf(this.uiScene.handHint); // Dừng fade-in/scale-in
            this.uiScene.handHint.setVisible(false);
            this.uiScene.handHint.setAlpha(0);
        }
    }
}
