import Phaser from 'phaser';
import { hideGameButtons } from '../../main';
// import { GAME_WIDTH, GAME_HEIGHT } from '../config';

type DifficultyLevel = 1 | 2 | 3;

export class SummaryScene extends Phaser.Scene {
    private lessonId!: string;
    // private score!: number;
    // private total!: number;
    private difficulty: DifficultyLevel = 3; // thêm field

    private containerEl: HTMLElement | null = null;
    private confettiEvent?: Phaser.Time.TimerEvent;

    constructor() {
        super('SummaryScene');
    }

    private clearDimBackground() {
        if (this.containerEl) {
            this.containerEl.classList.remove('dim-overlay');
            this.containerEl.classList.remove('dim-filter');
        }
    }

    init(data: {
        lessonId: string;
        score: number;
        total: number;
        difficulty?: DifficultyLevel;
    }) {
        this.lessonId = data.lessonId;
        // this.score = data.score;
        // this.total = data.total;
        this.difficulty = data.difficulty ?? 3; // nhận lại độ khó vừa chơi
    }

    create() {
        // Title
        // this.add
        //     .text(GAME_WIDTH / 2, 200, 'Hoàn thành bài học', {
        //         fontSize: '30px',
        //         color: '#000',
        //         align: 'center',
        //     })
        //     .setOrigin(0.5);

        // // Result
        // this.add
        //     .text(
        //         GAME_WIDTH / 2,
        //         260,
        //         `Con đã trả lời đúng ${this.score}/${this.total} câu`,
        //         {
        //             fontSize: '24px',
        //             color: '#2E7D32',
        //         }
        //     )
        //     .setOrigin(0.5);

        // // Nút chơi lại bài hiện tại
        // const replayBtn = this.add
        //     .rectangle(GAME_WIDTH / 2, 340, 220, 55, 0x42a5f5, 1)
        //     .setInteractive({ useHandCursor: true });

        // this.add
        //     .text(GAME_WIDTH / 2, 340, 'Chơi lại', {
        //         fontSize: '22px',
        //         color: '#fff',
        //     })
        //     .setOrigin(0.5);

        // replayBtn.on('pointerdown', () => {
        //     // 🔥 replay đúng lesson + đúng độ khó
        //     this.scene.start('PreloadScene', {
        //         lessonId: this.lessonId,
        //         difficulty: this.difficulty,
        //     });
        // });

        // // Nút về menu chọn bài
        // const menuBtn = this.add
        //     .rectangle(GAME_WIDTH / 2, 410, 220, 55, 0x9e9e9e, 1)
        //     .setInteractive({ useHandCursor: true });

        // this.add
        //     .text(GAME_WIDTH / 2, 410, 'Chọn bài khác', {
        //         fontSize: '20px',
        //         color: '#fff',
        //     })
        //     .setOrigin(0.5);

        // menuBtn.on('pointerdown', () => {
        //     this.scene.start('LessonSelectScene');
        // });

        const w = this.scale.width;
        const h = this.scale.height;

        (this.scene.get('CompareScene') as any)?.stopAllVoices?.();

        // Phát âm thanh chúc mừng khi vào màn hình
        this.sound.play('complete');

        this.containerEl = document.getElementById('game-container');

        // 👉 bật lớp mờ nền
        if (this.containerEl) {
            this.containerEl.classList.add('dim-overlay'); // hoặc 'dim-filter'
        }

        // Phát âm thanh chiến thắng sau 2s
        this.time.delayedCall(2000, () => {
            this.sound.play('fireworks');
            this.sound.play('applause');
        });

        // ==== Banner kết quả (ảnh nền) ====
        this.add
            .image(w / 2, h / 2 - h * 0.12, 'banner_congrat')
            .setOrigin(0.5)
            .setDepth(100)
            .setDisplaySize(w * 0.9, h * 0.9); // full màn

        // ==== Các nút ngang dưới banner ====
        const btnScale = Math.min(w, h) / 1280;
        const spacing = 250 * btnScale;

        // Nút Chơi lại (quay về màn hình chơi)
        const replayBtn = this.add
            .image(w / 2 - spacing, h / 2 + h * 0.2, 'btn_reset')
            .setOrigin(0.5)
            .setScale(btnScale)
            .setDepth(101)
            .setInteractive({ useHandCursor: true });

        replayBtn.on('pointerdown', () => {
            // 1. Tắt toàn bộ âm thanh đang chạy (end game + mọi scene khác)
            this.sound.stopAll();

            const preload = this.scene.get('PreloadScene') as any;
            preload?.stopAllVoices?.();

            this.sound.play('sfx_click');
            this.clearDimBackground();
            this.stopConfetti();
            this.scene.stop('SummaryScene');

            // 🔥 replay đúng lesson + đúng độ khó
            this.scene.start('PreloadScene', {
                lessonId: this.lessonId,
                difficulty: this.difficulty,
            });
        });

        // Nút Thoát (tùy bạn xử lý gì)
        const exitBtn = this.add
            .image(w / 2 + spacing, h / 2 + h * 0.2, 'btn_exit')
            .setOrigin(0.5)
            .setScale(btnScale)
            .setDepth(101)
            .setInteractive({ useHandCursor: true });

        exitBtn.on('pointerdown', () => {
            this.sound.play('sfx_click');
            this.clearDimBackground();
            this.stopConfetti();
            this.scene.start('LessonSelectScene');
        });

        // Hover effect (nếu cần trên desktop)
        [replayBtn, exitBtn].forEach((btn) => {
            btn.on('pointerover', () => btn.setScale(btnScale * 1.1));
            btn.on('pointerout', () => btn.setScale(btnScale));
        });

        hideGameButtons();
        this.createConfettiEffect();
    }

    private createConfettiEffect(): void {
        const width = this.cameras.main.width;
        const colors = [
            0xff6b6b, 0x4ecdc4, 0xffe66d, 0x95e1d3, 0xf38181, 0xaa96da,
        ];
        const shapes: Array<'circle' | 'rect'> = ['circle', 'rect'];

        // Tạo confetti liên tục
        this.confettiEvent = this.time.addEvent({
            delay: 100,
            callback: () => {
                // chỉ tạo khi scene còn active
                if (!this.scene.isActive()) return;

                for (let i = 0; i < 3; i++) {
                    this.createConfettiPiece(
                        Phaser.Math.Between(0, width),
                        -20,
                        Phaser.Utils.Array.GetRandom(colors),
                        Phaser.Utils.Array.GetRandom(shapes)
                    );
                }
            },
            loop: true,
        });
    }

    private createConfettiPiece(
        x: number,
        y: number,
        color: number,
        shape: 'circle' | 'rect'
    ): void {
        let confetti: Phaser.GameObjects.Arc | Phaser.GameObjects.Rectangle;

        if (shape === 'circle') {
            confetti = this.add.circle(
                x,
                y,
                Phaser.Math.Between(4, 8),
                color,
                1
            );
        } else {
            confetti = this.add.rectangle(
                x,
                y,
                Phaser.Math.Between(6, 12),
                Phaser.Math.Between(10, 20),
                color,
                1
            );
        }

        confetti.setDepth(999);
        confetti.setRotation((Phaser.Math.Between(0, 360) * Math.PI) / 180);

        const duration = Phaser.Math.Between(3000, 5000);
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
            this.confettiEvent.remove(false); // không gọi callback nữa
            this.confettiEvent = undefined;
        }
    }
}
