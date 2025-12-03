import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';
import type { LessonConcept } from '../types/lesson';
import { domBackgroundManager } from '../domBackground';
import { hideGameButtons } from '../../main';

type DifficultyLevel = 1 | 2 | 3;
type LessonOption = {
    lessonId: string;
    concept: LessonConcept;
    imageKey: string; // 👈 thêm
    title: string;
};

const LESSON_OPTIONS: LessonOption[] = [
    {
        lessonId: 'height_basic_01',
        concept: 'HEIGHT',
        imageKey: 'card_height', // ảnh card Cao/Thấp
        title: 'Cao/Thấp',
    },
    {
        lessonId: 'size_basic_01',
        concept: 'SIZE',
        imageKey: 'card_size', // ảnh card To/Nhỏ/Bằng nhau
        title: 'To/Nhỏ/Bằng nhau',
    },
    {
        lessonId: 'length_basic_01',
        concept: 'LENGTH',
        imageKey: 'card_length', // ảnh card Dài/Ngắn
        title: 'Dài/Ngắn',
    },
    {
        lessonId: 'width_basic_01',
        concept: 'WIDTH',
        imageKey: 'card_width', // ảnh card Rộng/Hẹp
        title: 'Rộng/Hẹp',
    },
];

export class LessonSelectScene extends Phaser.Scene {
    constructor() {
        super('LessonSelectScene');
    }

    preload() {
        if (!this.textures.exists('menu_panel')) {
            this.load.image('menu_panel', 'assets/ui/menu_panel.webp'); // bảng xanh to
        }

        // 4 card nhỏ bên trong
        if (!this.textures.exists('card_height')) {
            this.load.image('card_height', 'assets/ui/card_height.webp');
        }
        if (!this.textures.exists('card_size')) {
            this.load.image('card_size', 'assets/ui/card_size.webp');
        }
        if (!this.textures.exists('card_length')) {
            this.load.image('card_length', 'assets/ui/card_length.webp');
        }
        if (!this.textures.exists('card_width')) {
            this.load.image('card_width', 'assets/ui/card_width.webp');
        }
    }

    create() {
        domBackgroundManager.setBackgroundByKey('DEFAULT');

        const centerX = GAME_WIDTH / 2;
        const centerY = GAME_HEIGHT / 2;

        // ===== BẢNG TO =====
        const board = this.add
            .image(centerX, centerY, 'menu_panel')
            .setOrigin(0.5);

        // scale để bảng chiếm khoảng 80% chiều ngang
        const targetWidth = GAME_WIDTH * 0.65;
        const ratio = board.height / board.width;
        board.setDisplaySize(targetWidth, targetWidth * ratio);
        board.setDepth(0);

        // Vẽ 4 card bên trong bảng
        this.renderLessonOptions(board);

        hideGameButtons();
    }

    private renderLessonOptions(board: Phaser.GameObjects.Image) {
        const centerX = board.x;
        const centerY = board.y + 40; // lệch xuống chút cho giống hình

        const colSpacing = board.displayWidth * 0.34; // chỉnh cho khớp layout
        const rowSpacing = board.displayHeight * 0.305;

        const positions = [
            { x: centerX - colSpacing / 2, y: centerY - rowSpacing / 2 },
            { x: centerX + colSpacing / 2, y: centerY - rowSpacing / 2 },
            { x: centerX - colSpacing / 2, y: centerY + rowSpacing / 2 },
            { x: centerX + colSpacing / 2, y: centerY + rowSpacing / 2 },
        ];

        LESSON_OPTIONS.forEach((opt, idx) => {
            const pos = positions[idx] ?? positions[positions.length - 1];

            // ===== CARD ẢNH (có sẵn text + icon) =====
            const card = this.add
                .image(pos.x, pos.y, opt.imageKey)
                .setOrigin(0.5)
                .setInteractive({ useHandCursor: true });

            // scale các card về cùng kích thước tương đối (nếu cần)
            const targetCardWidth = board.displayWidth * 0.32; // ~1/3 bảng
            const scale = targetCardWidth / card.width;
            card.setScale(scale);

            card.scene.tweens.add({
                targets: card,
                scaleX: scale * 1.02,
                scaleY: scale * 1.02,
                yoyo: true, // lặp lặp
                ease: 'Sine.easeInOut',
                duration: 800,
                repeat: -1, // lặp vô hạn
            });

            // card.setDepth(1); // trên bảng

            // click card: mở popup chọn độ khó (logic cũ)
            card.on('pointerdown', () => {
                this.openDifficultyPopup(opt);
            });
        });
    }

    private openDifficultyPopup(option: LessonOption) {
        const { title, lessonId } = option;

        // Overlay mờ che nền
        const overlay = this.add
            .rectangle(
                0,
                0,
                this.scale.width,
                this.scale.height,
                0x000000,
                0.45
            )
            .setOrigin(0, 0)
            .setInteractive(); // chặn click xuống dưới

        const centerX = this.scale.width / 2;
        const centerY = this.scale.height / 2;

        // Khung popup
        const popupWidth = 520;
        const popupHeight = 320;
        const cornerRadius = 24; // độ bo góc

        // ====== NỀN POPUP BO GÓC ======
        const popupBg = this.add.graphics();

        // viền
        popupBg.lineStyle(2, 0xcccccc, 1);
        // màu nền
        popupBg.fillStyle(0xffffff, 1);

        // vẽ từ tâm (0,0) để dễ canh giữa
        popupBg.fillRoundedRect(
            -popupWidth / 2,
            -popupHeight / 2,
            popupWidth,
            popupHeight,
            cornerRadius
        );
        popupBg.strokeRoundedRect(
            -popupWidth / 2,
            -popupHeight / 2,
            popupWidth,
            popupHeight,
            cornerRadius
        );

        // đặt vị trí ở giữa màn
        popupBg.setPosition(centerX, centerY);

        const titleText = this.add
            .text(centerX, centerY - 110, `Chọn độ khó\n${title}`, {
                fontSize: '24px',
                color: '#000',
                align: 'center',
            })
            .setOrigin(0.5);

        const btnWidth = 140;
        const btnHeight = 60;
        const btnSpacing = 170;
        const btnY = centerY + 40;

        type BtnCfg = { label: string; level: DifficultyLevel; color: number };

        const btnConfigs: BtnCfg[] = [
            { label: 'Dễ', level: 1, color: 0x81c784 }, // <= difficulty 1
            { label: 'Vừa', level: 2, color: 0xffb74d }, // <= difficulty 2
            { label: 'Khó', level: 3, color: 0xe57373 }, // <= difficulty 3
        ];

        const popupObjects: Phaser.GameObjects.GameObject[] = [
            overlay,
            popupBg,
            titleText,
        ];

        btnConfigs.forEach((cfg, idx) => {
            const x = centerX + (idx - 1) * btnSpacing;

            const btnRect = this.add
                .rectangle(x, btnY, btnWidth, btnHeight, cfg.color, 1)
                .setOrigin(0.5)
                .setInteractive({ useHandCursor: true });

            const btnText = this.add
                .text(x, btnY, cfg.label, {
                    fontSize: '22px',
                    color: '#ffffff',
                })
                .setOrigin(0.5);

            popupObjects.push(btnRect, btnText);

            btnRect.on('pointerover', () => {
                this.tweens.add({
                    targets: [btnRect, btnText],
                    scaleX: 1.05,
                    scaleY: 1.05,
                    duration: 100,
                });
            });

            btnRect.on('pointerout', () => {
                this.tweens.add({
                    targets: [btnRect, btnText],
                    scaleX: 1,
                    scaleY: 1,
                    duration: 100,
                });
            });

            btnRect.on('pointerdown', () => {
                const difficultyLevel = cfg.level; // 1 / 2 / 3

                // xoá popup
                popupObjects.forEach((obj) => obj.destroy());

                // sang PreloadScene, truyền lessonId + difficulty
                this.scene.start('PreloadScene', {
                    lessonId,
                    difficulty: difficultyLevel,
                });
            });
        });

        // optional: click ra ngoài để đóng popup
        overlay.on('pointerdown', () => {
            popupObjects.forEach((obj) => obj.destroy());
        });
    }
}
