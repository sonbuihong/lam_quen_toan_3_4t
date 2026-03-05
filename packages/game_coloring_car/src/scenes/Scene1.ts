import Phaser from 'phaser';

import { SceneKeys, AudioKeys } from '../consts/Keys';
import { GameConstants } from '../consts/GameConstants';
import { IdleManager } from '../utils/IdleManager';
import { changeBackground } from '../utils/BackgroundManager';
import { PaintManager } from '../utils/PaintManager';
import { LevelLoader } from '../utils/LevelLoader';
import {
    playVoiceLocked,
    setGameSceneReference,
    resetVoiceState,
} from '../utils/rotateOrientation';
import { GameUtils } from '../utils/GameUtils';
import AudioManager from '../audio/AudioManager';
import { showGameButtons, sdk } from '../main';
import { game } from "@iruka-edu/mini-game-sdk";

export default class Scene1 extends Phaser.Scene {
    private bgm!: Phaser.Sound.BaseSound;

    // --- MANAGERS ---
    private paintManager!: PaintManager;
    private idleManager!: IdleManager;
    private levelLoader!: LevelLoader;

    // --- GAME STATE ---
    private unfinishedPartsMap: Map<string, Phaser.GameObjects.Image> = new Map();
    private finishedParts: Set<string> = new Set();
    private totalParts: number = 0;
    private score: number = 0;
    private hintCount: number = 0;
    private hasCompleted: boolean = false;

    // Tracker variable for Paint-Shape BI format
    public runSeq: number = 1;

    // --- HINT & INTRO STATE ---
    private isIntroActive: boolean = false;
    private activeHintTween: Phaser.Tweens.Tween | null = null;
    private activeHintTarget: Phaser.GameObjects.Image | null = null;

    // Tham chieu den handHint (lay tu UIScene)
    private get handHint(): Phaser.GameObjects.Image | undefined {
        const uiScene = this.scene.get(SceneKeys.UI) as any;
        return uiScene?.handHint;
    }

    constructor() {
        super(SceneKeys.Scene1);
    }

    /**
     * Khoi tao lai du lieu khi Scene bat dau hoac Restart.
     * Clear Map/Set de tranh loi tham chieu den object cu da bi destroy.
     */
    init(data?: { isRestart: boolean; fromEndGame?: boolean }) {
        this.unfinishedPartsMap.clear();
        this.finishedParts.clear();
        this.totalParts = 0;
        this.score = 0;
        this.hintCount = 0;
        this.hasCompleted = false;

        if (data && data.isRestart) {
            this.runSeq += 1;
            game.retryFromStart();
            if (this.paintManager) {
                this.paintManager.clearTrackersData();
            }
        }
    }

    create() {
        showGameButtons();

        this.setupSystem();
        this.setupBackgroundAndAudio();
        this.createUI();

        // Chay UI Scene
        this.scene.launch(SceneKeys.UI, {
            paintManager: this.paintManager,
            sceneKey: SceneKeys.Scene1
        });

        // Tao level va lay du lieu
        const levelData = this.levelLoader.createLevel();
        this.unfinishedPartsMap = levelData.unfinishedPartsMap;
        this.totalParts = levelData.totalParts;

        // SDK: Set tong so phan can to
        game.setTotal(this.totalParts);
        (window as any).irukaGameState = {
            startTime: Date.now(),
            currentScore: 0,
        };
        sdk?.score(this.score, 0);
        sdk?.progress({ levelIndex: 0, total: this.totalParts });
        game.startQuestionTimer();

        this.setupInput();

        // Register shutdown handler via Phaser event system
        this.events.on(Phaser.Scenes.Events.SHUTDOWN, this.handleShutdown, this);

        // Su kien khi quay lai tab game
        this.events.on('wake', () => {
            this.idleManager.reset();
            if (this.input.keyboard) this.input.keyboard.enabled = true;
        });

        // Tu dong chay intro khi scene duoc tao
        const soundManager = this.sound as Phaser.Sound.WebAudioSoundManager;
        if (soundManager.context && soundManager.context.state === 'suspended') {
            soundManager.context.resume();
        }
        setTimeout(() => {
            this.playIntroSequence();
        }, 300);
    }

    update(_time: number, delta: number) {
        // Chi dem thoi gian Idle khi KHONG dang to, KHONG dang intro, va CHUA thang
        if (
            !this.paintManager.isPainting() &&
            !this.isIntroActive &&
            this.finishedParts.size < this.totalParts
        ) {
            this.idleManager.update(delta);
        }
    }

    private handleShutdown() {
        this.stopIntro();
        this.paintManager.closeAllTrackers();
        this.paintManager = null as any;
        this.scene.stop(SceneKeys.UI);
        if (this.bgm) {
            this.bgm.stop();
        }
        this.events.off(Phaser.Scenes.Events.SHUTDOWN, this.handleShutdown, this);
    }

    /** Expose cho rotateOrientation goi khi can restart intro */
    public restartIntro() {
        this.stopIntro();
        this.time.delayedCall(GameConstants.SCENE1.TIMING.RESTART_INTRO, () =>
            this.playIntroSequence()
        );
    }

    // =================================================================
    // SYSTEM SETUP
    // =================================================================

    private setupSystem() {
        resetVoiceState();
        (window as any).gameScene = this;
        setGameSceneReference(this);

        // Khoi tao PaintManager voi callback khi to xong 1 phan
        this.paintManager = new PaintManager(this, (id, rt, usedColors) => {
            this.handlePartComplete(id, rt, usedColors);
        });

        // Khoi tao IdleManager
        this.idleManager = new IdleManager(GameConstants.IDLE.THRESHOLD, () => {
            this.showHint();
        });

        // Khoi tao LevelLoader
        this.levelLoader = new LevelLoader(this, this.paintManager);
    }

    private setupInput() {
        this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
            this.paintManager.handlePointerMove(p);
            if (this.paintManager.isPainting()) {
                this.idleManager.reset();
                this.stopIntro();
                this.stopActiveHint();
            }
        });
        this.input.on('pointerup', () => this.paintManager.handlePointerUp());

        this.input.on('pointerdown', () => {
            this.idleManager.reset();
            this.stopIntro();
            this.stopActiveHint();
        });
    }

    private setupBackgroundAndAudio() {
        changeBackground('assets/images/bg/background.jpg');

        if (this.sound.get(AudioKeys.BgmNen)) {
            this.sound.stopByKey(AudioKeys.BgmNen);
        }
        this.bgm = this.sound.add(AudioKeys.BgmNen, {
            loop: true,
            volume: 0.25,
        });
        this.bgm.play();
    }

    // =================================================================
    // UI
    // =================================================================

    private createUI() {
        const UI = GameConstants.SCENE1.UI;
        const cx = GameUtils.pctX(this, 0.5);
        const scl = [1, 0.72];

        const bannerHeight = this.textures.get('banner_s2').getSourceImage().height * 0.7;

        const boardY = bannerHeight + GameUtils.pctY(this, UI.BOARD_OFFSET);
        const board = this.add
            .image(cx, boardY, 'board_s2')
            .setOrigin(0.5, 0)
            .setScale(scl[0], scl[1])
            .setDepth(0);

        board.displayWidth = this.scale.width * 0.93;
    }

    // =================================================================
    // SAVE / LOAD LOGIC
    // =================================================================
    
    /**
     * Duoc trigger tu hubOrigin onSetState
     */
    public applyHubState(payload: any) {
        if (!payload || !payload.score) return;
        
        // Restore Score and Progress
        this.score = payload.score;
        if (payload.finishedParts) {
            const arr = payload.finishedParts as string[];
            arr.forEach(id => {
                const rtHitArea = this.unfinishedPartsMap.get(id);
                if (rtHitArea) {
                    const rtLayer = rtHitArea.getData('layer');
                    if (rtLayer && rtLayer instanceof Phaser.GameObjects.RenderTexture) {
                        rtLayer.setData('isFinished', true);
                        const singleColor = GameConstants.PAINT.DEFAULT_COLOR;
                        rtLayer.setBlendMode(Phaser.BlendModes.NORMAL);
                        rtLayer.fill(singleColor);
                    }
                    this.finishedParts.add(id);
                    this.unfinishedPartsMap.delete(id);
                }
            });
        }
    }

    // =================================================================
    // GAMEPLAY LOGIC
    // =================================================================

    /**
     * Xu ly khi mot bo phan duoc to xong.
     * Cap nhat diem, SDK tracking, va kiem tra dieu kien thang.
     */
    private handlePartComplete(
        id: string,
        rt: Phaser.GameObjects.RenderTexture,
        usedColors: Set<number>
    ) {
        this.finishedParts.add(id);
        this.score += 1;

        // SDK: Ghi nhan hoan thanh 1 phan
        game.finishQuestionTimer();
        game.recordCorrect({ scoreDelta: 1 });

        if ((window as any).irukaGameState) {
            (window as any).irukaGameState.currentScore = this.score;
        }

        // Game Hub: Cap nhat diem va tien do
        sdk?.score(this.score, 1);
        sdk?.progress({
            levelIndex: this.finishedParts.size,
            score: this.score,
            total: this.totalParts
        });

        // Game Hub: Luu state
        sdk?.requestSave({
            score: this.score,
            levelIndex: this.finishedParts.size,
            finishedParts: Array.from(this.finishedParts)
        });

        // Logic auto-fill: Neu chi dung 1 mau -> fill mau do cho dep
        if (usedColors.size === 1) {
            const singleColor = usedColors.values().next().value || 0;
            rt.setBlendMode(Phaser.BlendModes.NORMAL);
            rt.fill(singleColor);
        }

        // Xoa khoi danh sach chua to
        this.unfinishedPartsMap.delete(id);

        AudioManager.play('sfx-ting');

        // Hieu ung nhap nhay
        this.tweens.add({
            targets: rt,
            alpha: 0.8,
            yoyo: true,
            duration: GameConstants.SCENE1.TIMING.AUTO_FILL,
            repeat: 2,
        });

        // Kiem tra dieu kien thang
        if (this.finishedParts.size >= this.totalParts) {
            AudioManager.play('sfx-correct_s2');

            // An UI
            const uiScene = this.scene.get(SceneKeys.UI) as any;
            if (uiScene) {
                if (uiScene.hidePalette) uiScene.hidePalette();
                if (uiScene.hideBanners) uiScene.hideBanners();
            }

            const reason = this.hintCount > GameConstants.IDLE.MAX_HINT_COUNT
                ? GameConstants.ERROR_CODES.HINT_RELIANCE
                : undefined;

            this.time.delayedCall(GameConstants.SCENE1.TIMING.WIN_DELAY, () => {
                // Dong tat ca PaintTracker con do truoc khi chuyen scene
                // Giup be co the tiep tuc to de luu record tracker trong doan delay nay
                this.paintManager.closeAllTrackers();
                this.scene.start(SceneKeys.EndGame, { hasCompleted: true, reason });
            });
        } else {
            // Bat dau dem thoi gian cho phan tiep theo
            game.startQuestionTimer();
        }
    }

    // =================================================================
    // INTRO TUTORIAL & IDLE HINT
    // =================================================================

    /** Khoi chay sequence huong dan dau game */
    private playIntroSequence() {
        this.isIntroActive = true;
        playVoiceLocked(null, 'voice_intro_s2');
        this.time.delayedCall(GameConstants.SCENE1.TIMING.INTRO_DELAY, () => {
            if (this.isIntroActive) this.runHandTutorial();
        });
    }

    /** Dung intro va bat dau dem thoi gian idle */
    private stopIntro() {
        this.isIntroActive = false;
        this.idleManager.start();

        if (this.handHint) {
            this.handHint.setAlpha(0).setPosition(-200, -200);
        }
    }

    /** Dung hint dang chay (khi nguoi choi cham vao man hinh) */
    private stopActiveHint() {
        if (this.activeHintTween) {
            this.activeHintTween.stop();
            this.activeHintTween = null;
        }

        if (this.activeHintTarget) {
            this.tweens.killTweensOf(this.activeHintTarget);
            this.activeHintTarget.setAlpha(0.01);
            this.activeHintTarget.setScale(this.activeHintTarget.getData('originScale'));
            this.activeHintTarget = null;
        }

        if (this.handHint) {
            this.tweens.killTweensOf(this.handHint);
            this.handHint.setAlpha(0).setPosition(-200, -200);
        }
    }

    /** Hien goi y: Chon ngau nhien 1 vung chua to va chi tay vao */
    private showHint() {
        this.hintCount += 1;

        const items = Array.from(this.unfinishedPartsMap.values());
        if (items.length === 0) return;

        // Random 1 bo phan chua to
        const target = items[Math.floor(Math.random() * items.length)];

        // Ghi nhan hint vao tracker cua part duoc hint (item-level)
        // SDK se tang hint_used, tu do prepareSubmitData() tong hop dung hintCount
        const partId = target.getData('id') as string;
        const partKey = target.getData('partKey') as string;
        this.paintManager.addHintToTracker(partId, partKey);
        game.addHint();

        AudioManager.play('hint');

        const IDLE_CFG = GameConstants.IDLE;

        // Visual 1: Nhap nhay bo phan do de gay chu y
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

        // Visual 2: Ban tay chi vao vung can to
        const hX = target.getData('hintX') || 0;
        const hY = target.getData('hintY') || 0;
        const originScale = target.getData('originScale') || 1;

        let destX = target.x + (hX * originScale);
        let destY = target.y + (hY * originScale);

        if (!this.handHint) return;

        this.handHint.setOrigin(0, 0);

        const hintPoints = target?.getData('hintPoints');

        let startHintX = destX;
        let startHintY = destY;

        const tweensChain: any[] = [];

        if (hintPoints && hintPoints.length > 0) {
            const baseX = target?.x || 0;
            const baseY = target?.y || 0;

            // Tinh diem dau tien
            const firstP = hintPoints[0];
            startHintX = baseX + (firstP.x * originScale);
            startHintY = baseY + (firstP.y * originScale);

            // Hien ra tai diem dau tien
            tweensChain.push({ alpha: 1, x: startHintX, y: startHintY, duration: IDLE_CFG.FADE_IN });
            tweensChain.push({ scale: 0.5, duration: IDLE_CFG.SCALE, yoyo: true, repeat: 3 });

            // Di chuyen va Tap o cac diem tiep theo
            for (let i = 1; i < hintPoints.length; i++) {
                const p = hintPoints[i];
                const dX = baseX + (p.x * originScale);
                const dY = baseY + (p.y * originScale);
                tweensChain.push({ x: dX, y: dY, duration: IDLE_CFG.SCALE * 2 });
                tweensChain.push({ scale: 0.5, duration: IDLE_CFG.SCALE, yoyo: true, repeat: 3 });
            }

            tweensChain.push({ alpha: 0, duration: IDLE_CFG.FADE_OUT });
        } else {
            // Fallback: Chi vao trong tam
            tweensChain.push({ alpha: 1, x: destX, y: destY, duration: IDLE_CFG.FADE_IN });
            tweensChain.push({ scale: 0.5, duration: IDLE_CFG.SCALE, yoyo: true, repeat: 3 });
            tweensChain.push({ alpha: 0, duration: IDLE_CFG.FADE_OUT });
        }

        this.handHint.setPosition(startHintX, startHintY)
            .setAlpha(0).setScale(0.7);

        this.tweens.chain({
            targets: this.handHint,
            tweens: tweensChain
        });
    }

    /** Tutorial dau game: Tay di chuyen tu nut mau den vung to */
    private runHandTutorial() {
        if (!this.isIntroActive) return;

        // Tim bo phan muc tieu (bo phan dau tien chua to)
        const items = Array.from(this.unfinishedPartsMap.values());
        let target: Phaser.GameObjects.Image | undefined;
        let destX = 0;
        let destY = 0;

        if (items.length > 0) {
            target = items[0];
            const hX = target.getData('hintX') || 0;
            const hY = target.getData('hintY') || 0;
            const originScale = target.getData('originScale') || 1;
            destX = target.x + (hX * originScale);
            destY = target.y + (hY * originScale);
        } else {
            const UI = GameConstants.SCENE1.UI;
            destX = GameUtils.pctX(this, UI.HAND_INTRO_END_X);
            destY = GameUtils.pctY(this, UI.HAND_INTRO_END_Y);
        }

        const UI = GameConstants.SCENE1.UI;
        const INTRO = GameConstants.SCENE1.INTRO_HAND;

        // Tinh toa do nut mau dau tien (Horizontal Layout)
        const spacingX = GameUtils.pctX(this, UI.PALETTE_SPACING_X);
        const paletteData = GameConstants.PALETTE_DATA;
        const totalItems = paletteData.length + 1;
        const totalWidth = (totalItems - 1) * spacingX;
        const startX = (GameUtils.getW(this) - totalWidth) / 2;

        const paletteY = GameUtils.pctY(this, UI.PALETTE_Y);
        const dragY = destY + 30;

        if (!this.handHint) return;

        this.handHint.setOrigin(0, 0);
        this.handHint.setPosition(startX, paletteY).setAlpha(0).setScale(0.7);

        const hintPoints = target?.getData('hintPoints');

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
            // Di chuyen qua tung diem goi y tren vung to
            const originScale = target?.getData('originScale') || 1;
            const baseX = target?.x || 0;
            const baseY = target?.y || 0;

            const firstP = hintPoints[0];
            const firstDestX = baseX + (firstP.x * originScale);
            const firstDestY = baseY + (firstP.y * originScale);

            tweensChain.push({ x: firstDestX, y: firstDestY, duration: INTRO.DRAG, delay: 100 });
            tweensChain.push({
                x: '-=30', y: '-=10',
                duration: INTRO.RUB, yoyo: true, repeat: 3,
            });

            for (let i = 1; i < hintPoints.length; i++) {
                const p = hintPoints[i];
                const pX = baseX + (p.x * originScale);
                const pY = baseY + (p.y * originScale);
                tweensChain.push({ x: pX, y: pY, duration: INTRO.DRAG });
                tweensChain.push({
                    x: '-=30', y: '-=10',
                    duration: INTRO.RUB, yoyo: true, repeat: 3,
                });
            }
        } else {
            // Fallback: Drag den center roi Rub
            tweensChain.push({ x: destX, y: dragY, duration: INTRO.DRAG, delay: 100 });
            tweensChain.push({
                x: '-=30', y: '-=10',
                duration: INTRO.RUB, yoyo: true, repeat: 3,
            });
        }

        // Bien mat va lap lai neu intro chua ket thuc
        tweensChain.push({
            alpha: 0,
            duration: 500,
            onComplete: () => {
                this.handHint?.setPosition(-200, -200);
                if (this.isIntroActive) {
                    this.time.delayedCall(1000, () => this.runHandTutorial());
                }
            },
        });

        this.tweens.chain({
            targets: this.handHint,
            tweens: tweensChain,
        });
    }
}
