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
    private bgm!: Phaser.Sound.BaseSound;
    private paintManager!: PaintManager;
    private idleManager!: IdleManager;
    private fpsCounter!: FPSCounter;

    private unfinishedPartsMap: Map<string, Phaser.GameObjects.Image> = new Map();
    private finishedParts: Set<string> = new Set();
    private totalParts: number = 0;
    private score: number = 0;
    private isIntroActive: boolean = false;
    private isWaitingForIntroStart: boolean = false; // Auto-start

    private get handHint(): Phaser.GameObjects.Image | undefined {
         const uiScene = this.scene.get(SceneKeys.UI) as any;
         return uiScene?.handHint;
    }

    private activeHintTween: Phaser.Tweens.Tween | null = null;
    private activeHintTarget: Phaser.GameObjects.Image | null = null;

    constructor() {
        super(SceneKeys.Scene3);
    }

    init(data?: { isRestart: boolean }) {
        this.unfinishedPartsMap.clear();
        this.finishedParts.clear();
        this.totalParts = 0;
        this.score = 0;

        this.isWaitingForIntroStart = false;

        if (data?.isRestart) {
            game.retryFromStart();
        }
    }

    create() {
        showGameButtons();

        this.setupSystem();
        this.setupBackgroundAndAudio();
        this.createUI();
        
        // Check if UI Scene is already active
        const uiScene = this.scene.get(SceneKeys.UI);
        if (uiScene.scene.isActive()) {
             (uiScene as any).updateSceneKey(SceneKeys.Scene3);
             (uiScene as any).paintManager = this.paintManager;
        } else {
            this.scene.launch(SceneKeys.UI, { 
                paintManager: this.paintManager,
                sceneKey: SceneKeys.Scene3 
            });
        }

        this.createLevel();
        
        game.setTotal(1);
        (window as any).irukaGameState = {
            startTime: Date.now(),
            currentScore: 0,
        };
        sdk.score(this.score, 0);
        sdk.progress({ levelIndex: 2, total: 1 });
        game.startQuestionTimer();

        this.setupInput();

        this.events.on('wake', () => {
            this.idleManager.reset();
            if (this.input.keyboard) this.input.keyboard.enabled = true;
        });

        const soundManager = this.sound as Phaser.Sound.WebAudioSoundManager;
        if (soundManager.context && soundManager.context.state === 'suspended') {
             soundManager.context.resume();
        }
        this.time.delayedCall(500, () => {
             this.playIntroSequence();
        });
    }

    update(time: number, delta: number) {
        if (
            !this.paintManager.isPainting() &&
            !this.isIntroActive &&
            this.finishedParts.size < this.totalParts
        ) {
            this.idleManager.update(delta);
        }

        if (this.fpsCounter) {
            this.fpsCounter.update();
        }
    }

    shutdown() {
        this.stopIntro();

        this.paintManager = null as any;
        // REMOVED: this.scene.stop(SceneKeys.UI);
        // REMOVED: this.bgm.stop();
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

        this.paintManager = new PaintManager(this, (id, rt, usedColors) => {
            this.handlePartComplete(id, rt, usedColors);
        });

        this.idleManager = new IdleManager(GameConstants.IDLE.THRESHOLD, () =>
            this.showHint()
        );
    }

    private setupInput() {
        this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
            this.paintManager.handlePointerMove(p);
            if(this.paintManager.isPainting()) {
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
        const UI = GameConstants.SCENE1.UI;
        const cx = GameUtils.pctX(this, 0.5);
        const scl = [1, 0.72];

        // Scene 3 Banner
        const bannerHeight = this.textures.get(TextureKeys.S3_Banner).getSourceImage().height * 0.7; // Scale 0.7

        const boardY = bannerHeight + GameUtils.pctY(this, UI.BOARD_OFFSET);
        this.add
            .image(cx, boardY, TextureKeys.S1_Board) // Reuse Board
            .setOrigin(0.5, 0)
            .setScale(scl[0], scl[1])
            .setDepth(0)
            .displayWidth = GameUtils.getW(this) * 0.8;
    }

    private createLevel() {
        // Load Scene 3 Config
        const data = this.cache.json.get(DataKeys.LevelS3Config);
        if (data) {
            this.spawnCharacter(data.teacher);
            this.createDecorativeObject(data.flower);
        }
    }

    private createDecorativeObject(config: any) {
        if (!config) return;
        const cx = GameUtils.pctX(this, config.baseX_pct);
        const cy = GameUtils.pctY(this, config.baseY_pct);
        
        if (config.frameKey && config.frameKey !== "") {
            this.add.image(cx, cy, config.frameKey)
                .setOrigin(0.5)
                .setScale(config.baseScale)
                .setDepth(5);
        }

        if (config.outlineKey) {
            this.add.image(cx, cy, config.outlineKey)
                .setScale(config.baseScale)
                .setDepth(5);
        }
    }

    private spawnCharacter(config: any) {
        const cx = GameUtils.pctX(this, config.baseX_pct);
        const cy = GameUtils.pctY(this, config.baseY_pct);

        config.parts.forEach((part: any, index: number) => {
            const id = `${part.key}_${index}`;
            const layerX = cx + part.offsetX;
            const layerY = cy + part.offsetY;

            const hitArea = this.paintManager.createPaintableLayer(
                layerX,
                layerY,
                part.key,
                part.scale,
                id
            );

            const rt = hitArea.getData('layer');
            if (rt) {
                rt.setDepth(910);
            }

            const centerOffset = GameUtils.calculateCenteredOffset(this, part.key);
            let hX = centerOffset.x;
            let hY = centerOffset.y;

            hitArea.setData('hintX', hX);
            hitArea.setData('hintY', hY);
            hitArea.setData('originScale', part.scale);
            
            if (part.hintPoints && Array.isArray(part.hintPoints)) {
                hitArea.setData('hintPoints', part.hintPoints);

                this.drawHintDebug(hitArea, part.hintPoints);
            }

            this.unfinishedPartsMap.set(id, hitArea);
            this.totalParts++;
        });

        const outline = this.add
            .image(cx, cy, config.outlineKey)
            .setScale(config.baseScale)
            .setDepth(900)
            .setInteractive({ pixelPerfect: true });

        this.drawDebugAxes(outline);
    }

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
            levelIndex: 2,
            score: this.score,
        });
        game.finishQuestionTimer();
        if (this.finishedParts.size < this.totalParts) {
            game.startQuestionTimer();
        }

        if (usedColors.size === 1) {
            const singleColor = usedColors.values().next().value || 0;
            rt.setBlendMode(Phaser.BlendModes.NORMAL);
            rt.fill(singleColor);
        }

        this.unfinishedPartsMap.delete(id);

        AudioManager.play('sfx-ting');

        this.tweens.add({
            targets: rt,
            alpha: 0.8,
            yoyo: true,
            duration: GameConstants.SCENE1.TIMING.AUTO_FILL,
            repeat: 2,
        });

        if (this.finishedParts.size >= this.totalParts) {
            console.log('WIN SCENE 3!');
            
            // Xóa UI (Nút màu & Banner) -> REMOVED for transition
            // const uiScene = this.scene.get(SceneKeys.UI) as any;
            // if (uiScene) {
            //     if (uiScene.hidePalette) uiScene.hidePalette();
            //     if (uiScene.hideBanners) uiScene.hideBanners();
            // }

            this.time.delayedCall(GameConstants.SCENE1.TIMING.WIN_DELAY, () => {
                this.scene.start(SceneKeys.Scene4);
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
        playVoiceLocked(null, 'voice_intro_s2'); 
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

    private runHandTutorial() {
        if (!this.isIntroActive) return;

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
            const originScale = target?.getData('originScale') || 1;
            const baseX = target?.x || 0;
            const baseY = target?.y || 0;

            const firstP = hintPoints[0];
            const firstDestX = baseX + (firstP.x * originScale);
            const firstDestY = baseY + (firstP.y * originScale);

            tweensChain.push({ x: firstDestX, y: firstDestY, duration: INTRO.DRAG, delay: 100 });

            tweensChain.push({
                x: '-=30',
                y: '-=10',
                duration: INTRO.RUB,
                yoyo: true,
                repeat: 3,
            });

            for (let i = 1; i < hintPoints.length; i++) {
                const p = hintPoints[i];
                const destX = baseX + (p.x * originScale);
                const destY = baseY + (p.y * originScale);
                tweensChain.push({ x: destX, y: destY, duration: INTRO.DRAG });
            
             tweensChain.push({
                x: '-=30',
                y: '-=10',
                duration: INTRO.RUB,
                yoyo: true,
                repeat: 3,
            });
            }

        } else {
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
                if (this.isIntroActive)
                    this.time.delayedCall(1000, () =>
                        this.runHandTutorial()
                            );
                    },
        });

        this.tweens.chain({
            targets: this.handHint,
            tweens: tweensChain,
        });
    }

    private showHint() {
        game.addHint();
        const items = Array.from(this.unfinishedPartsMap.values());
        if (items.length === 0) return;
        
        const target = items[Math.floor(Math.random() * items.length)];

        AudioManager.play('hint');
        
        const IDLE_CFG = GameConstants.IDLE;

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
            
            const firstP = hintPoints[0];
            startHintX = baseX + (firstP.x * originScale);
            startHintY = baseY + (firstP.y * originScale);
            
            tweensChain.push({ alpha: 1, x: startHintX, y: startHintY, duration: IDLE_CFG.FADE_IN });
            tweensChain.push({ scale: 0.5, duration: IDLE_CFG.SCALE, yoyo: true, repeat: 3 });
            
        } else {
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
            this.activeHintTarget.setAlpha(1);
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
