import Phaser from 'phaser';
import { hideGameButtons, showGameButtons, sdk } from '../main'; // Import SDK tu main
import AudioManager from '../audio/AudioManager';
import { resetVoiceState } from '../utils/rotateOrientation';
import { TextureKeys, SceneKeys } from '../consts/Keys';
import { GameConstants } from '../consts/GameConstants';

// Iruka SDK
import { game } from "@iruka-edu/mini-game-sdk";

export default class EndGameScene extends Phaser.Scene {
    private confettiEvent?: Phaser.Time.TimerEvent;
    private hasCompleted: boolean = false; // Co theo doi da complete chua
    private reason?: string;

    constructor() {
        super(SceneKeys.EndGame);
    }

    init(data?: { hasCompleted?: boolean; reason?: string }) {
        // Nhan co hasCompleted tu Scene1 khi game da thang va gui complete roi
        this.hasCompleted = data?.hasCompleted ?? false;
        this.reason = data?.reason;
    }

    create() {
        resetVoiceState();

        game.finalizeAttempt();
        const submitStats = game.prepareSubmitData();
        const score = submitStats.finalScore || 0;
        let durationMs = 0;
        if ((window as any).irukaGameState && (window as any).irukaGameState.startTime) {
            durationMs = Date.now() - (window as any).irukaGameState.startTime;
        }
        
        const submitReason = this.hasCompleted ? this.reason : GameConstants.ERROR_CODES.USER_ABANDONED;

        sdk.complete({
            score: score,
            timeMs: durationMs,
            extras: { reason: submitReason, stats: submitStats },
        });

        const w = this.scale.width;
        const h = this.scale.height;
        AudioManager.loadAll();
        AudioManager.play('complete');

        this.time.delayedCall(1500, () => {
            AudioManager.play('fireworks');
            AudioManager.play('applause');
        });

        const ENDGAME_UI = GameConstants.ENDGAME.UI;

        // Banner
        this.add
            .image(w / 2, h / 2 - h * ENDGAME_UI.BANNER_OFFSET, TextureKeys.End_BannerCongrat)
            .setOrigin(0.5)
            .setDepth(100)
            .setDisplaySize(w * 0.9, h * 0.9);

        // Icon 
        if (this.textures.exists(TextureKeys.End_Icon)) {
            const icon = this.add.image(w / 2, h / 2 - ENDGAME_UI.ICON_OFFSET, TextureKeys.End_Icon);
            icon.setScale(0.5);
            icon.setDepth(1005);

            // Animation float
            this.tweens.add({
                targets: icon,
                y: icon.y - 10,
                duration: GameConstants.ENDGAME.ANIM.ICON_FLOAT,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut',
            });
            // Animation shake
            this.tweens.add({
                targets: icon,
                angle: { from: -5, to: 5 },
                duration: GameConstants.ENDGAME.ANIM.ICON_SHAKE,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut',
            });
        }

        // === NUT CHUC NANG (luon hien thi, khong phu thuoc icon) ===
        const btnScale = Math.min(w, h) / 1280;
        const spacing = ENDGAME_UI.BTN_SPACING * btnScale;

        // Nut choi lai
        const replayBtn = this.add
            .image(w / 2 - spacing, h / 2 + h * ENDGAME_UI.BTN_OFFSET, TextureKeys.BtnReset)
            .setOrigin(0.5)
            .setScale(btnScale)
            .setDepth(101)
            .setInteractive({ useHandCursor: true });

        replayBtn.on('pointerdown', () => {
            this.time.removeAllEvents();
            this.sound.stopAll();
            AudioManager.stopAll();
            AudioManager.play('sfx-click');
            this.stopConfetti();
            showGameButtons();

            // retryFromStart is called inside Scene1.init() when isRestart=true
            this.scene.start(SceneKeys.Scene1, { isRestart: true, fromEndGame: true });
        });

        // Nut Exit
        const exitBtn = this.add
            .image(w / 2 + spacing, h / 2 + h * ENDGAME_UI.BTN_OFFSET, TextureKeys.BtnExit)
            .setOrigin(0.5)
            .setScale(btnScale)
            .setDepth(101)
            .setInteractive({ useHandCursor: true });

        exitBtn.on('pointerdown', () => {
            AudioManager.play('sfx-click');
            AudioManager.stopAll();
            this.stopConfetti();
            hideGameButtons();
        });

        // Hover effect
        [replayBtn, exitBtn].forEach((btn) => {
            btn.on('pointerover', () => btn.setScale(btnScale * 1.1));
            btn.on('pointerout', () => btn.setScale(btnScale));
        });

        hideGameButtons();
        this.createConfettiEffect();
    }

    private createConfettiEffect(): void {
        const width = this.cameras.main.width;
        const colors = [0xff6b6b, 0x4ecdc4, 0xffe66d, 0x95e1d3, 0xf38181, 0xaa96da];
        const shapes: Array<'circle' | 'rect'> = ['circle', 'rect'];

        this.confettiEvent = this.time.addEvent({
            delay: GameConstants.ENDGAME.CONFETTI.DELAY,
            callback: () => {
                if (!this.scene.isActive()) return;
                for (let i = 0; i < 3; i++) {
                    this.createConfettiPiece(
                        Phaser.Math.Between(0, width), -20,
                        Phaser.Utils.Array.GetRandom(colors),
                        Phaser.Utils.Array.GetRandom(shapes)
                    );
                }
            },
            loop: true,
        });
    }

    private createConfettiPiece(
        x: number, y: number, color: number, shape: 'circle' | 'rect'
    ): void {
        let confetti: Phaser.GameObjects.Arc | Phaser.GameObjects.Rectangle;

        if (shape === 'circle') {
            confetti = this.add.circle(x, y, Phaser.Math.Between(4, 8), color, 1);
        } else {
            confetti = this.add.rectangle(
                x, y,
                Phaser.Math.Between(6, 12), Phaser.Math.Between(10, 20),
                color, 1
            );
        }

        confetti.setDepth(999);
        confetti.setRotation((Phaser.Math.Between(0, 360) * Math.PI) / 180);

        const duration = Phaser.Math.Between(
            GameConstants.ENDGAME.CONFETTI.MIN_DUR,
            GameConstants.ENDGAME.CONFETTI.MAX_DUR
        );
        const targetY = this.cameras.main.height + 50;
        const drift = Phaser.Math.Between(-100, 100);

        this.tweens.add({
            targets: confetti,
            y: targetY,
            x: x + drift,
            rotation: confetti.rotation + Phaser.Math.Between(2, 4) * Math.PI,
            duration,
            ease: 'Linear',
            onComplete: () => confetti.destroy(),
        });

        this.tweens.add({
            targets: confetti,
            alpha: { from: 1, to: 0.3 },
            duration,
            ease: 'Cubic.easeIn',
        });
    }

    private stopConfetti(): void {
        if (this.confettiEvent) {
            this.confettiEvent.remove(false);
            this.confettiEvent = undefined;
        }
    }
}