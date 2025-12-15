import Phaser from 'phaser';
import type { LessonConcept } from '../types/lesson';
import { domBackgroundManager } from '../domBackground';
import { hideGameButtons } from '../../main';

type DifficultyLevel = 1 | 2 | 3;
type LessonOption = {
    lessonId: string;
    concept: LessonConcept;
    // imageKey: string; // 👈 thêm
    title: string;
    difficultyBgKey: string;
};

// const SINGLE_LESSON: LessonOption = {
//     lessonId: 'height_basic_01',
//     concept: 'HEIGHT',
//     title: 'Cao / Thấp',
//     difficultyBgKey: 'diff_height', // popup chọn độ khó tương ứng
// };

const SINGLE_LESSON: LessonOption = {
    lessonId: 'size_basic_01',
    concept: 'SIZE',
    title: 'To / Nhỏ / Bằng nhau',
    difficultyBgKey: 'diff_size', // popup chọn độ khó tương ứng
};

// const SINGLE_LESSON: LessonOption = {
//     lessonId: 'length_basic_01',
//     concept: 'LENGTH',
//     title: 'Dài / Ngắn',
//     difficultyBgKey: 'diff_length', // popup chọn độ khó tương ứng
// };

// const SINGLE_LESSON: LessonOption = {
//     lessonId: 'width_basic_01',
//     concept: 'WIDTH',
//     title: 'Rộng / Hẹp',
//     difficultyBgKey: 'diff_width', // popup chọn độ khó tương ứng
// };

export class LessonSelectScene extends Phaser.Scene {
    constructor() {
        super('LessonSelectScene');
    }

    preload() {
        if (!this.textures.exists('menu_panel')) {
            this.load.image('menu_panel', 'assets/ui/menu_panel.png'); // bảng xanh to
        }

        if (!this.textures.exists('diff_height')) {
            this.load.image('diff_height', 'assets/ui/diff_height.png');
        }
        if (!this.textures.exists('diff_size')) {
            this.load.image('diff_size', 'assets/ui/diff_size.png');
        }
        if (!this.textures.exists('diff_length')) {
            this.load.image('diff_length', 'assets/ui/diff_length.png');
        }
        if (!this.textures.exists('diff_width')) {
            this.load.image('diff_width', 'assets/ui/diff_width.png');
        }
    }

    create() {
        domBackgroundManager.setBackgroundByKey('DEFAULT');

        // 👉 Vào phát show luôn popup chọn độ khó
        this.time.delayedCall(100, () => {
            this.openDifficultyPopup(SINGLE_LESSON);
        });

        hideGameButtons();
    }

    private openDifficultyPopup(option: LessonOption) {
        const { lessonId, difficultyBgKey } = option;
        const centerX = this.scale.width / 2;
        const centerY = this.scale.height / 2 + 40;

        // 🔥 Ảnh popup riêng cho từng bài (CHỌN ĐỘ KHÓ + icon)
        const popupBg = this.add
            .image(centerX, centerY, difficultyBgKey)
            .setOrigin(0.5);

        // scale để fit màn (có thể chỉnh lại tuỳ file)
        const targetWidth = Math.min(this.scale.width * 1, 620);
        const scale = targetWidth / popupBg.width;
        popupBg.setScale(scale);

        // Tính vị trí nút theo chính cái popup
        const btnAreaY = popupBg.y + popupBg.displayHeight / 2 - 100; // gần đáy card
        const btnWidth = 140;
        const btnHeight = 50;
        const btnSpacing = 170;

        type BtnCfg = { label: string; level: DifficultyLevel; color: number };

        const btnConfigs: BtnCfg[] = [
            { label: 'Dễ', level: 1, color: 0x0a9b35 }, // xanh
            { label: 'Vừa', level: 2, color: 0xf6c515 }, // vàng
            { label: 'Khó', level: 3, color: 0xd62828 }, // đỏ
        ];

        const popupObjects: Phaser.GameObjects.GameObject[] = [
            // overlay,
            popupBg,
        ];

        btnConfigs.forEach((cfg, idx) => {
            const x = centerX + (idx - 1) * btnSpacing;
            const y = btnAreaY;

            // vẽ nút bo góc bằng Graphics
            const radius = 14;

            const g = this.add.graphics();
            g.fillStyle(cfg.color, 1);
            g.fillRoundedRect(
                -btnWidth / 2,
                -btnHeight / 2,
                btnWidth,
                btnHeight,
                radius
            );

            const btnText = this.add
                .text(0, 0, cfg.label, {
                    fontSize: '25px',
                    color: '#ffffff',
                    align: 'center',
                    fontFamily: '"Baloo 2"',
                    fontStyle: '700',
                })
                .setOrigin(0.5);

            btnText.setDepth(2);

            // gom lại thành 1 container cho dễ tween + click
            const btn = this.add.container(x, y, [g, btnText]);
            btn.setSize(btnWidth, btnHeight);
            btn.setInteractive({ useHandCursor: true });

            popupObjects.push(btn);

            // hover
            btn.on('pointerover', () => {
                this.tweens.add({
                    targets: btn,
                    scaleX: 1.05,
                    scaleY: 1.05,
                    duration: 100,
                });
            });

            btn.on('pointerout', () => {
                this.tweens.add({
                    targets: btn,
                    scaleX: 1,
                    scaleY: 1,
                    duration: 100,
                });
            });

            // click
            btn.on('pointerdown', () => {
                const difficultyLevel = cfg.level;

                popupObjects.forEach((obj) => obj.destroy());

                this.scene.start('PreloadScene', {
                    lessonId,
                    difficulty: difficultyLevel,
                });
            });
        });
    }
}
