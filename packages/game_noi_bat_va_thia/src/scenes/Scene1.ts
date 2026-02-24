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
import { ConnectionLineManager } from '../utils/ConnectionLineManager';

import { ObjectManager } from '../managers/ObjectManager';
import { game } from "@iruka-edu/mini-game-sdk";
import { sdk } from '../main';

const createMatchTracker = game.createMatchTracker;

export default class Scene1 extends Phaser.Scene {
    // Managers
    private objectManager!: ObjectManager;
    private idleManager!: IdleManager;
    private connectionManager!: ConnectionLineManager;
    private bgm!: Phaser.Sound.BaseSound;

    // Trạng thái Level
    private currentLevelIndex: number = 0;
    private totalTargets: number = 0;
    private matchedTargets: number = 0;

    // Trạng thái Drag
    private isDragging: boolean = false;
    private currentDragSource: Phaser.GameObjects.Image | null = null;
    private isPointerDownBound: boolean = false;

    // Trạng thái Intro & Hint
    private isWaitingForIntroStart: boolean = true;
    private isIntroActive: boolean = false;
    private activeHintTween: Phaser.Tweens.Tween | null = null;
    private activeHintTargets: Phaser.GameObjects.Image[] = [];
    private activeCircleTween: Phaser.Tweens.Tween | null = null;

    // ===== SDK Match Tracker =====
    private runSeq = 1;
    private itemSeq = 0;
    private matchTracker: ReturnType<typeof createMatchTracker> | null = null;
    // hint chờ gắn vào attempt kế tiếp
    private pendingHint = 0;

    private get uiScene(): UIScene {
        return this.scene.get(SceneKeys.UI) as UIScene;
    }

    constructor() {
        super(SceneKeys.Scene1);
    }

    public getAnswerObjects(): Phaser.GameObjects.Image[] {
        return this.objectManager?.getAnswerObjects() ?? [];
    }

    init(data?: { isRestart?: boolean; fromEndGame?: boolean; levelIndex?: number }) {
        resetVoiceState();
        
        // Reset các trạng thái logic
        this.isIntroActive = false;
        this.activeHintTween = null;
        this.activeHintTargets = [];
        
        this.matchedTargets = 0;
        this.totalTargets = 0;
        this.isDragging = false;
        this.currentDragSource = null;
        if (this.connectionManager) {
            this.connectionManager.clearAll();
        }

        // Nhận levelIndex từ caller (Scene2 truyền sang khi qua màn).
        // Nếu không có (lần đầu vào game) thì mặc định = 0.
        this.currentLevelIndex = data?.levelIndex ?? 0;
        console.log(`[Scene1] init - levelIndex = ${this.currentLevelIndex}`);

        if (data?.isRestart) {
            // Restart từ nút replay: về màn 0
            this.currentLevelIndex = 0;
            this.isWaitingForIntroStart = false;
            this.runSeq += 1;
            this.itemSeq = 0;
            this.matchTracker = null;
            this.pendingHint = 0;
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

        // Tải dữ liệu Level & Spawn Objects theo levelIndex
        const fullConfig = this.cache.json.get(DataKeys.LevelS1Config);
        // Hỗ trợ cả cấu trúc mảng levels[] mới và flat object cũ (backward compatibility)
        const rawLevelConfig = fullConfig.levels
            ? fullConfig.levels[this.currentLevelIndex]
            : fullConfig;

        if (!rawLevelConfig) {
            console.error(`[Scene1] Không tìm thấy config cho levelIndex=${this.currentLevelIndex}`);
            return;
        }

        // Merge answers từ top-level vào level config (tránh lặp lại trong từng level)
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

        // SDK: khởi tạo game state ở màn đầu tiên
        const totalLevels = fullConfig.levels ? fullConfig.levels.length : 1;
        if (this.currentLevelIndex === 0) {
            game.setTotal(totalLevels);
            (window as any).irukaGameState = {
                startTime: Date.now(),
                currentScore: 0,
            };
            sdk.score(0, totalLevels);
        }
        sdk.progress({ levelIndex: this.currentLevelIndex, total: totalLevels });
        game.startQuestionTimer();

        // ===== SDK: Tạo matchTracker cho level hiện tại =====
        this.itemSeq += 1;
        const imageIds = this.objectManager.getImageObjects().map(img => img.texture.key);
        const answerIds = this.objectManager.getAnswerObjects().map(ans => ans.texture.key);
        const nodes = [...imageIds, ...answerIds];

        let correctPairs: { from: string; to: string }[];
        if (levelConfig.pairs) {
            correctPairs = levelConfig.pairs.map((p: any) => ({ from: p.image, to: p.answer }));
        } else {
            // matchMode 'any': mỗi image -> answer tương ứng theo thứ tự
            correctPairs = imageIds.map((id, i) => ({ from: id, to: answerIds[i % answerIds.length] }));
        }

        this.matchTracker = createMatchTracker({
            meta: {
                item_id: `CONNECT_PAIRS_${this.itemSeq}`,
                item_type: "match",
                seq: this.itemSeq,
                run_seq: this.runSeq,
                difficulty: 1,
                scene_id: "SCN_MATCH_01",
                scene_seq: this.itemSeq,
                scene_type: "match",
                skill_ids: ["noi_cap_34_tv_001"],
            },
            expected: { nodes, correct_pairs: correctPairs },
            errorOnWrong: "WRONG_PAIR",
        });
        this.pendingHint = 0;

        this.setupDragInput();

        // Nếu là restart, chạy intro luôn (không cần chờ tap)
        if (!this.isWaitingForIntroStart) {
            const soundManager = this.sound as Phaser.Sound.WebAudioSoundManager;
            if (soundManager.context && soundManager.context.state === 'suspended') {
                soundManager.context.resume();
            }
            this.playIntroSequence();
        }

        // Khởi chạy UI Overlay
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
        // Dọn dẹp Âm thanh
        if (this.bgm) {
            this.bgm.stop();
        }
        AudioManager.stopAll();

        // Dọn dẹp Managers
        if (this.idleManager) {
            this.idleManager.stop();
        }
        this.activeHintTargets = [];
        this.activeHintTween = null;

        // Dọn dẹp hệ thống
        this.tweens.killAll();
        this.time.removeAllEvents();
        
        this.input.off('pointerdown', this.onScenePointerDown, this);
        this.input.off('pointermove');
        this.input.off('pointerup');
        this.isPointerDownBound = false;
        
        if (window.gameScene === this) {
            window.gameScene = undefined;
        }

        console.log('[Scene1] shutdown hoàn tất.');
    }

    // =================================================================
    // PHẦN 1: CÀI ĐẶT HỆ THỐNG (SYSTEM SETUP)
    // =================================================================

    private setupSystem() {
        resetVoiceState();
        (window as any).gameScene = this;
        setGameSceneReference(this);

        this.objectManager = new ObjectManager(this);

        this.idleManager = new IdleManager(GameConstants.IDLE.THRESHOLD, () => {
            this.showHint();
        });
        
        this.connectionManager = new ConnectionLineManager(this);
    }

    private setupDragInput() {
        if (!this.isPointerDownBound) {
            this.isPointerDownBound = true;
            this.input.on('pointerdown', this.onScenePointerDown, this);
        }

        // Cập nhật đường kéo khi di chuyển con trỏ
        this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
            if (!this.isDragging || !this.currentDragSource) return;
            this.idleManager.reset();
            this.connectionManager.updateDragLine(this.currentDragSource, pointer.x, pointer.y);
        });

        // Khi nhả tay - kiểm tra xem rơi vào ảnh đáp án nào (bên dưới)
        this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
            if (!this.isDragging) return;
            this.isDragging = false;
            this.connectionManager.stopDragLine();

            this.evaluateDrop(pointer.x, pointer.y);
            this.idleManager.start();
        });
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
        changeBackground('assets/images/bg/background.jpg');

        if (this.sound.get(AudioKeys.BgmNen)) {
            this.sound.stopByKey(AudioKeys.BgmNen);
        }
        this.bgm = this.sound.add(AudioKeys.BgmNen, { loop: true, volume: 0.25 });
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
        
        const introAudioKey = this.currentLevelIndex === 0 ? AudioKeys.VoiceIntro : AudioKeys.VoiceIntro2;
        playVoiceLocked(this.sound, introAudioKey);
        this.setupGameplay();

        const handTutorialDelay = this.isWaitingForIntroStart ? GameConstants.SCENE1.TIMING.INTRO_DELAY : 500;
        this.time.delayedCall(handTutorialDelay, () => {
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
    }

    // =================================================================
    // PHẦN 3: LOGIC GAMEPLAY (GAMEPLAY LOGIC)
    // =================================================================
    
    private setupGameplay() {
        const images = this.objectManager.getImageObjects();
        images.forEach(img => {
            // Vùng click mở rộng hơn ảnh 20px để dễ tương tác
            const radius = Math.max(img.displayWidth, img.displayHeight) * 0.5 + 20;
            const hitArea = new Phaser.Geom.Circle(img.width/2, img.height/2, radius);
            img.setInteractive({
                hitArea: hitArea,
                hitAreaCallback: Phaser.Geom.Circle.Contains,
                useHandCursor: true
            });

            img.on('pointerdown', () => {
                if (img.getData('isMatched')) return;
                this.startDrag(img);
            });
        });

        if (!this.isIntroActive) {
            this.idleManager.start();
        }
    }

    private startDrag(sourceImage: Phaser.GameObjects.Image) {
        if (this.isDragging) return;
        this.stopActiveHint();
        this.idleManager.reset();
        
        this.isDragging = true;
        this.currentDragSource = sourceImage;
        this.connectionManager.startDragLine();

        // SDK: mở attempt khi bắt đầu kéo
        const objectId = sourceImage.texture.key;
        this.matchTracker?.onMatchStart?.(objectId, Date.now());

        // Apply hint đã xuất hiện trước đó vào attempt này
        if (this.pendingHint > 0) {
            this.matchTracker?.hint?.(this.pendingHint);
            this.pendingHint = 0;
        }
    }

    /**
     * Tìm tất cả các ảnh đích (answers) hợp lệ mà ảnh nguồn (sourceImage) có thể nối vào, dựa trên cấu hình Level.
     */
    private getValidTargetAnswersForSource(sourceImage: Phaser.GameObjects.Image): Phaser.GameObjects.Image[] {
        const fullConfig = this.cache.json.get(DataKeys.LevelS1Config);
        const rawLevelConfig = fullConfig.levels ? fullConfig.levels[this.currentLevelIndex] : fullConfig;
        
        const expectedAnswerKey = rawLevelConfig.correctAnswer ?? 'ans2';
        const possibleAnswers: Phaser.GameObjects.Image[] = [];

        if (rawLevelConfig.matchMode === 'any' && rawLevelConfig.answers) {
            const validAnswerKeys = rawLevelConfig.answers.map((ans: any) => ans.textureKey);
            possibleAnswers.push(...this.objectManager.getAnswerObjects().filter(obj => validAnswerKeys.includes(obj.texture.key)));
        } else if (rawLevelConfig.pairs) {
            const validPairs = rawLevelConfig.pairs.filter((p: any) => p.image === sourceImage.texture.key);
            for (const p of validPairs) {
                const ans = this.objectManager.getAnswerObjects().find(obj => obj.texture.key === p.answer);
                if (ans) possibleAnswers.push(ans);
            }
        } else {
            const ans = this.objectManager.getAnswerObjects().find(obj => obj.texture.key === expectedAnswerKey);
            if (ans) possibleAnswers.push(ans);
        }

        return possibleAnswers;
    }

    /**
     * Tìm một cặp Nguồn - Đích đúng chưa được nối để phục vụ cho Tutorial và Hint.
     */
    private getHintTargetPair(): { source: Phaser.GameObjects.Image, target: Phaser.GameObjects.Image } | null {
        const source = this.objectManager.getImageObjects().find(obj => 
            this.objectManager.isCorrectAnswer(obj) && !obj.getData('isMatched')
        );
        if (!source) return null;

        const validAnswers = this.getValidTargetAnswersForSource(source);
        const target = validAnswers.find(ans => !ans.getData('isMatched'));
        
        if (!target) return null;
        
        return { source, target };
    }

    private evaluateDrop(dropX: number, dropY: number) {
        if (!this.currentDragSource) return;

        const answers = this.objectManager.getAnswerObjects();

        // Kiểm tra drop có trúng ảnh đáp án nào không (mở rộng 20px cho dễ nhắm)
        const hitAnswer = answers.find(ans => {
            const bounds = ans.getBounds();
            const expandedBounds = new Phaser.Geom.Rectangle(bounds.x - 20, bounds.y - 20, bounds.width + 40, bounds.height + 40);
            return expandedBounds.contains(dropX, dropY);
        });

        if (!hitAnswer) {
            // Thả ra ngoài: USER_ABANDONED
            this.handleWrongDrop(null);
            return;
        }

        // Đích đã được nối rồi thì từ chối (không cho kéo chồng lên)
        if (hitAnswer.getData('isMatched')) {
            this.handleWrongDrop(null);
            return;
        }

        // Kiểm tra: ảnh nguồn có đúng không + ảnh đích có khớp cặp không
        const isSourceCorrect = this.objectManager.isCorrectAnswer(this.currentDragSource);
        let isValidHit = false;

        if (isSourceCorrect) {
            const validAnswers = this.getValidTargetAnswersForSource(this.currentDragSource);
            isValidHit = validAnswers.includes(hitAnswer);
        }

        if (isValidHit) {
            this.handleCorrectDrop(hitAnswer);
        } else {
            // Thả vào answer sai: WRONG_PAIR
            this.handleWrongDrop(hitAnswer);
        }
    }

    private handleCorrectDrop(targetAnswerImage: Phaser.GameObjects.Image) {
        if (!this.currentDragSource) return;
        
        AudioManager.stopAll();
        AudioManager.play('sfx-ting');
        AudioManager.play('sfx-correct');

        // SDK: đóng attempt đúng
        const sourceKey = this.currentDragSource.texture.key;
        const targetKey = targetAnswerImage.texture.key;
        const edgeStart = this.connectionManager.getContentEdgePoint(this.currentDragSource, targetAnswerImage.x, targetAnswerImage.y);
        const edgeEnd = this.connectionManager.getContentEdgePoint(targetAnswerImage, this.currentDragSource.x, this.currentDragSource.y);
        const pathLength = Math.round(Phaser.Math.Distance.Between(edgeStart.x, edgeStart.y, edgeEnd.x, edgeEnd.y));

        this.matchTracker?.onMatchEnd?.(
            { from_node: sourceKey, to_node: targetKey, path_length_px: pathLength },
            Date.now(),
            { isCorrect: true, errorCode: null }
        );
        console.log(`[MATCH] ${sourceKey} -> ${targetKey} CORRECT (len=${pathLength})`);

        this.currentDragSource.setData('isMatched', true);
        targetAnswerImage.setData('isMatched', true);
        this.currentDragSource.disableInteractive();

        // Vẽ đường nối CỐ ĐỊNH (ngắn nhất, chạm pixel thật) từ nguồn tới đáp án
        this.connectionManager.drawFinalLine(this.currentDragSource, targetAnswerImage, 0x00ff00);

        // Hiệu ứng phóng to - thu nhỏ ảnh đáp án đúng
        this.tweens.add({
            targets: targetAnswerImage,
            scale: targetAnswerImage.scale * 1.25,
            duration: 250,
            yoyo: true,
            repeat: 1,
            ease: 'Sine.easeInOut',
        });

        this.highlightCorrectAnswer(targetAnswerImage);

        this.matchedTargets++;
        sdk.score(this.currentLevelIndex + 1, this.totalTargets);

        if (this.matchedTargets >= this.totalTargets) {
            this.completeLevel();
        }

        this.currentDragSource = null;
    }

    private completeLevel() {
        console.log(`[Scene1] Hoàn thành Màn ${this.currentLevelIndex + 1}!`);
        sdk.progress({ levelIndex: this.currentLevelIndex + 1, total: this.totalTargets, score: this.currentLevelIndex + 1 });

        // SDK: finalize item tracker cho level này
        this.matchTracker?.finalize?.();
        this.matchTracker = null;
        
        // Tắt toàn bộ input của các object còn lại
        const images = this.objectManager.getImageObjects();
        images.forEach(img => img.disableInteractive());

        const fullConfig = this.cache.json.get(DataKeys.LevelS1Config);
        const totalLevels = fullConfig.levels ? fullConfig.levels.length : 1;
        const nextLevelIndex = this.currentLevelIndex + 1;
        const isLastLevel = nextLevelIndex >= totalLevels;

        this.time.delayedCall(GameConstants.SCENE1.TIMING.WIN_DELAY, () => {
            if (isLastLevel) {
                console.log('[Scene1] Hoàn thành tất cả màn! Chuyển EndGame.');
                game.finalizeAttempt();
                game.finishQuestionTimer();
                this.scene.stop(SceneKeys.UI);
                this.scene.start(SceneKeys.EndGame);
            } else {
                console.log(`[Scene1] Chuyển sang màn ${nextLevelIndex + 1}.`);
                this.scene.start(SceneKeys.Scene1, { levelIndex: nextLevelIndex });
            }
        });
    }

    /**
     * Xử lý khi thả sai hoặc thả ra ngoài.
     * @param hitAnswer ảnh đáp án bị hit (null nếu thả ra ngoài)
     */
    private handleWrongDrop(hitAnswer: Phaser.GameObjects.Image | null) {
        AudioManager.play('sfx-wrong');

        // SDK: đóng attempt sai/bỏ dở
        if (this.currentDragSource) {
            const sourceKey = this.currentDragSource.texture.key;

            if (hitAnswer) {
                // Thả vào answer sai -> WRONG_PAIR
                const targetKey = hitAnswer.texture.key;
                const edgeStart = this.connectionManager.getContentEdgePoint(this.currentDragSource, hitAnswer.x, hitAnswer.y);
                const edgeEnd = this.connectionManager.getContentEdgePoint(hitAnswer, this.currentDragSource.x, this.currentDragSource.y);
                const pathLength = Math.round(Phaser.Math.Distance.Between(edgeStart.x, edgeStart.y, edgeEnd.x, edgeEnd.y));

                this.matchTracker?.onMatchEnd?.(
                    { from_node: sourceKey, to_node: targetKey, path_length_px: pathLength },
                    Date.now(),
                    { isCorrect: false, errorCode: "WRONG_PAIR" }
                );
                console.log(`[MATCH] ${sourceKey} -> ${targetKey} WRONG (len=${pathLength})`);
            } else {
                // Thả ra ngoài -> USER_ABANDONED
                this.matchTracker?.onMatchEnd?.(
                    { from_node: sourceKey, to_node: null, path_length_px: 0 },
                    Date.now(),
                    { isCorrect: false, errorCode: "USER_ABANDONED" }
                );
                console.log(`[MATCH] ${sourceKey} -> null ABANDONED`);
            }

            // Hiệu ứng rung lắc
            this.tweens.add({
                targets: this.currentDragSource,
                x: this.currentDragSource.x + 12,
                duration: 50,
                yoyo: true,
                repeat: 3,
                ease: 'Linear',
            });
        }
        
        this.currentDragSource = null;
    }

    private highlightCorrectAnswer(img: Phaser.GameObjects.Image) {
        const gfx = this.add.graphics();
        gfx.setDepth(img.depth + 1);

        const pad = 12;
        const w = img.displayWidth + pad * 2;
        const h = img.displayHeight + pad * 2;

        gfx.strokeRect(img.x - w / 2, img.y - h / 2, w, h);

        this.tweens.add({
            targets: gfx,
            alpha: { from: 1, to: 0.3 },
            duration: 400,
            yoyo: true,
            repeat: 2,
            onComplete: () => { gfx.destroy() }
        });
    }

    // =================================================================
    // PHẦN 4: HƯỚNG DẪN & GỢI Ý (TUTORIAL & HINT)
    // =================================================================
    /** Tutorial đầu game: animation bàn tay hướng dẫn kéo nối. */
    private runHandTutorial() {
        if (!this.isIntroActive) return;

        const pair = this.getHintTargetPair();
        if (!pair) return;
        
        const { source: targetImage, target: targetAnswer } = pair;

        const handHint = this.uiScene.handHint;
        if (!handHint) return;

        const startX = targetImage.x;
        const startY = targetImage.y + targetImage.displayHeight * 0.4;
        
        handHint.setVisible(true)
            .setAlpha(1)
            .setOrigin(0.1, 0.1)
            .setPosition(startX, startY);

        this.activeCircleTween = this.tweens.add({
            targets: handHint,
            x: targetAnswer.x,
            y: targetAnswer.y,
            duration: 2000,
            ease: 'Sine.easeInOut',
            repeat: -1,
            repeatDelay: 500,
            onRepeat: () => {
                handHint.setPosition(startX, startY);
                handHint.setAlpha(1);
            }
        });
    }

    /** Gợi ý khi rảnh (Idle Hint). */
    private showHint() {
        this.stopActiveHint();
        this.pendingHint += 1;
        
        const pair = this.getHintTargetPair();
        if (!pair) return;
        
        const { source: unMatchedCorrectImage, target: targetAnswer } = pair;

        const hintAudioKey = this.currentLevelIndex === 0 ? 'hint' : 'hint2';
        AudioManager.play(hintAudioKey);

        // Nhấp nháy đối tượng đúng còn chưa nối
        const allCorrectAndUnfound = this.objectManager.getImageObjects().filter(obj => 
            this.objectManager.isCorrectAnswer(obj) && !obj.getData('isMatched')
        );
        this.activeHintTargets = allCorrectAndUnfound;
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

        // Bàn tay kéo nối mẫu
        const handHint = this.uiScene.handHint;
        if (!handHint) return;

        const startX = unMatchedCorrectImage.x;
        const startY = unMatchedCorrectImage.y + unMatchedCorrectImage.displayHeight * 0.4;

        handHint.setPosition(startX, startY)
            .setVisible(true)
            .setAlpha(0)
            .setScale(0.7)
            .setOrigin(0.1, 0.1);

        this.tweens.add({
            targets: handHint,
            alpha: 1,
            scale: 1,
            duration: 400,
            ease: 'Cubic.easeOut',
            onComplete: () => {
                this.activeCircleTween = this.tweens.add({
                     targets: handHint,
                     x: targetAnswer.x,
                     y: targetAnswer.y,
                     duration: 1500,
                     ease: 'Sine.easeInOut',
                     onComplete: () => {
                         this.stopActiveHint();
                         this.idleManager.start();
                     }
                 });
            }
        });
    }

    private stopActiveHint() {
        if (this.activeHintTween) {
            this.activeHintTween.stop();
            this.activeHintTween = null;
        }

        if (this.activeHintTargets.length > 0) {
            this.activeHintTargets.forEach(target => {
                this.tweens.killTweensOf(target);
                const baseScale = target.getData('baseScale') || target.scale;
                target.setScale(baseScale);
            });
            this.activeHintTargets = [];
        }

        // Dừng tween xoay tròn
        if (this.activeCircleTween) {
            this.activeCircleTween.stop();
            this.activeCircleTween = null;
        }

        if (this.uiScene && this.uiScene.handHint) {
            this.tweens.killTweensOf(this.uiScene.handHint);
            this.uiScene.handHint.setVisible(false);
            this.uiScene.handHint.setAlpha(0);
        }
    }
}
