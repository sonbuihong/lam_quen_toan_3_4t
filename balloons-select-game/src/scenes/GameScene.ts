import Phaser from 'phaser';
import { showGameButtons } from '../main';

interface LevelData {
    correctNumber: number;
    options: number[];
}

export default class GameScene extends Phaser.Scene {
    rabbit!: Phaser.GameObjects.Image;
    promptText!: Phaser.GameObjects.Text;
    banner!: Phaser.GameObjects.Image;
    balloons: Phaser.GameObjects.Container[] = [];

    currentLevel = 0;
    levels: LevelData[] = [
        { correctNumber: 1, options: [1, 2, 3, 4] },
        { correctNumber: 2, options: [1, 2, 3, 4] },
        { correctNumber: 3, options: [1, 2, 3, 4] },
        { correctNumber: 4, options: [1, 2, 3, 4] },
    ];

    constructor() {
        super('GameScene');
    }

    private getW() {
        return this.scale.width;
    }
    private getH() {
        return this.scale.height;
    }

    private pctX(p: number) {
        return this.getW() * p;
    } // p = 0..1
    private pctY(p: number) {
        return this.getH() * p;
    } // p = 0..1

    // ⭐ Giữ level khi restart
    init(data: any) {
        this.currentLevel = data?.level ?? 0;
        (this as any).isProcessing = false;
    }

    get levelData() {
        return this.levels[this.currentLevel];
    }

    getPromptText(): string {
        return `${this.levelData.correctNumber}`;
    }

    playPromptAudio() {
        const num = this.levelData.correctNumber;
        // key audio theo số
        const audioKey = `vo_prompt_${num}`;

        // play audio
        this.sound.play(audioKey);
    }

    preload() {
        // IMAGES
        this.load.image('rabbit_idle', '/assets/images/rabbit_idle.png');
        this.load.image('rabbit_cheer', '/assets/images/rabbit_cheer.png');
        this.load.image('banner_top', '/assets/images/banner_top.png');
        this.load.image('banner_no_text', '/assets/images/banner_no_text.png');

        this.load.image('btn_reset', 'assets/images/btn_reset.png');
        this.load.image('btn_exit', 'assets/images/btn_exit.png');

        this.load.image('balloon_red', 'assets/images/balloon_red.png');
        this.load.image('balloon_blue', 'assets/images/balloon_blue.png');
        this.load.image('balloon_green', 'assets/images/balloon_green.png');
        this.load.image('balloon_purple', 'assets/images/balloon_purple.png');

        this.load.spritesheet('pop_red', 'assets/images/pop_red.png', {
            frameWidth: 1024,
            frameHeight: 1829,
        });

        this.load.spritesheet('pop_blue', 'assets/images/pop_blue.png', {
            frameWidth: 1024,
            frameHeight: 1829,
        });

        this.load.spritesheet('pop_green', 'assets/images/pop_green.png', {
            frameWidth: 1024,
            frameHeight: 1698,
        });

        this.load.spritesheet('pop_purple', 'assets/images/pop_purple.png', {
            frameWidth: 1024,
            frameHeight: 1829,
        });

        this.load.image('apple', 'assets/images/apple.png');
        this.load.image('flower', 'assets/images/flower.png');
        this.load.image('carrot', 'assets/images/carrot.png');
        this.load.image('leaf', 'assets/images/leaf.png');

        this.load.image('icon_next', 'assets/images/icon_next.png');
        this.load.image('board_bg', 'assets/images/board_bg.png');

        // AUDIO
        this.load.audio('vo_prompt_1', 'assets/audio/vo_prompt_1.mp3');
        this.load.audio('vo_prompt_2', 'assets/audio/vo_prompt_2.mp3');
        this.load.audio('vo_prompt_3', 'assets/audio/vo_prompt_3.mp3');
        this.load.audio('vo_prompt_4', 'assets/audio/vo_prompt_4.mp3');
        this.load.audio('sfx_correct', 'assets/audio/sfx_correct.wav');
        this.load.audio('sfx_wrong', 'assets/audio/sfx_wrong.wav');
        this.load.audio('sfx_click', 'assets/audio/sfx_click.wav');
        this.load.audio('sfx_pop', 'assets/audio/sfx_pop.wav');
        this.load.audio('correct_answer', 'assets/audio/correct_answer.mp3');

        this.load.audio('vo_count_1', 'assets/audio/vo_count_1.mp3');
        this.load.audio('vo_count_2', 'assets/audio/vo_count_2.mp3');
        this.load.audio('vo_count_3', 'assets/audio/vo_count_3.mp3');
        this.load.audio('vo_count_4', 'assets/audio/vo_count_4.mp3');
    }

    create() {
        // Cho phép html-button gọi vào GameScene qua global
        (window as any).gameScene = this;

        const w = this.getW();
        const h = this.getH();

        this.balloons = []; // reset balloons

        // rabbit: đặt theo tỉ lệ
        this.rabbit = this.add.image(
            this.pctX(0.15),
            this.pctY(0.7),
            'rabbit_idle'
        );
        // scale rabbit theo kích thước màn: ví dụ 12% chiều cao
        this.rabbit.setDisplaySize(this.getH() * 0.5, this.getH() * 0.75);

        // banner top
        this.banner = this.add.image(
            this.pctX(0.5),
            this.pctY(0.11),
            'banner_top'
        );
        this.banner.setDisplaySize(w * 0.55, h * 1.3);

        // prompt text
        this.promptText = this.add
            .text(this.pctX(0.65), this.pctY(0.115), this.getPromptText(), {
                fontSize: `${Math.round(this.getH() * 0.1)}px`,
                fontFamily: 'sv-dumlings',
                color: '#FFFF00',
                fontStyle: 'bold',
                stroke: '#FFFF00',
                strokeThickness: 4,
            })
            .setOrigin(0.5);

        // phát giọng đọc
        this.playPromptAudio();

        this.createBalloons();

        const colors = ['red', 'blue', 'green', 'purple'];

        colors.forEach((color) => {
            const key = `pop_${color}_anim`;
            // const sheet = `pop_${color}`;

            // Quan trọng: tránh tạo lại gây xung đột key
            if (!this.anims.exists(key)) {
                this.anims.create({
                    key: key,
                    frames: this.anims.generateFrameNumbers(`pop_${color}`, {
                        start: 0,
                        end: 4,
                    }),
                    frameRate: 20,
                    hideOnComplete: true,
                    repeat: 0,
                });
            }
        });

        showGameButtons();
    }

    restartLevel() {
        this.scene.restart({ level: 0 });
    }

    exitGame() {
        this.scene.start('MenuScene');
    }

    shutdown() {
        // Xóa tham chiếu khi rời scene để tránh lỗi
        delete (window as any).gameScene;
    }

    createBalloons() {
        const w = this.getW();
        const h = this.getH();
        const baseSize = Math.min(w, h) * 0.3; // kích thước balloon dựa trên màn hình

        // Xếp 2 hàng x 2 cột
        const positions = [
            { x: 0.4, y: 0.4 },
            { x: 0.6, y: 0.4 },
            { x: 0.4, y: 0.75 },
            { x: 0.6, y: 0.75 },
        ];
        const shuffledPositions = Phaser.Utils.Array.Shuffle(positions);

        const colors = [
            'balloon_red',
            'balloon_green',
            'balloon_blue',
            'balloon_purple',
        ];
        const shuffledColors = Phaser.Utils.Array.Shuffle(colors);

        this.levelData.options.forEach((num, index) => {
            const pos = shuffledPositions[index];
            const x = this.pctX(pos.x);
            const endY = this.pctY(pos.y);

            // 🟢 Đặt balloon ở trên màn hình
            const startY = endY - h * 1.2;

            const balloon = this.add.container(x, startY);

            const img = this.add
                .image(0, 0, shuffledColors[index])
                .setDisplaySize(baseSize, baseSize);

            const balloonKey = shuffledColors[index]; // balloon_red
            const popKey = balloonKey.replace('balloon_', 'pop_'); // pop_red

            img.setData('balloonKey', balloonKey);
            img.setData('popKey', popKey);

            (balloon as any).popKey = popKey;
            (balloon as any).balloonKey = balloonKey;

            const text = this.add
                .text(0, 0, String(num), {
                    fontSize: `${Math.round(baseSize * 0.45)}px`,
                    color: '#ffffff',
                    fontStyle: 'bold',
                })
                .setOrigin(0.5);

            balloon.add([img, text]);
            (balloon as any).value = num;

            img.setInteractive({ useHandCursor: true });
            img.on('pointerdown', () => this.handleSelect(balloon));

            this.balloons.push(balloon);

            // Tween rơi xuống + pulse nhỏ
            this.tweens.add({
                targets: balloon,
                y: endY,
                duration: 1500,
                ease: 'Bounce.easeOut',
                onComplete: () => {
                    this.tweens.add({
                        targets: balloon,
                        scaleX: 1.05,
                        scaleY: 1.05,
                        yoyo: true,
                        repeat: -1,
                        duration: 900,
                        ease: 'Sine.easeInOut',
                        delay: index * 120,
                    });
                },
            });
        });
    }

    handleSelect(balloon: Phaser.GameObjects.Container) {
        const value = (balloon as any).value;

        if (value === this.levelData.correctNumber) {
            this.onCorrect(balloon);
        } else {
            this.onWrong(balloon);
        }
    }

    onWrong(balloon: Phaser.GameObjects.Container) {
        this.sound.play('sfx_wrong');

        // Lấy sprite bên trong container (child đầu tiên)
        const img = balloon.getAt(0) as Phaser.GameObjects.Image;

        this.tweens.add({
            targets: img,
            angle: { from: -10, to: 10 },
            duration: 80,
            yoyo: true,
            repeat: 2,
            onComplete: () => img.setAngle(0),
        });
    }

    onCorrect(balloon: Phaser.GameObjects.Container) {
        if ((this as any).isProcessing) return;
        (this as any).isProcessing = true;

        this.sound.play('sfx_correct');
        this.sound.play('correct_answer');

        const w = this.scale.width;
        const h = this.scale.height;

        (balloon as any).isCorrect = true;

        // Disable tất cả bóng
        this.balloons.forEach((b) => b.disableInteractive());

        // Lấy image + text trong bóng
        const balloonImg = balloon.getAt(0) as Phaser.GameObjects.Image;
        const balloonText = balloon.getAt(1) as Phaser.GameObjects.Text;

        const baseScale = (Math.min(w, h) / 1280) * 2;

        // ================================
        // 1) ĐƯA BÓNG ĐÚNG LÊN TRƯỚC TẤT CẢ
        // ================================
        this.children.bringToTop(balloon);
        balloon.setDepth(9999);

        // ================================
        // 2) Tween bóng đúng → bay vào giữa
        //    Phóng to cả container → ảnh + chữ cùng lớn
        // ================================
        this.tweens.add({
            targets: balloon,
            x: w / 2,
            y: h / 2,
            scaleX: 1.5,
            scaleY: 1.5,
            duration: 600,
            ease: 'Back.Out',
        });

        // Tăng scale riêng của ảnh bóng (cho đẹp hơn)
        this.tweens.add({
            targets: balloonImg,
            scaleX: baseScale,
            scaleY: baseScale,
            duration: 1500,
            delay: 300,
            ease: 'Quad.easeOut',
        });

        // Tăng scale chữ số
        this.tweens.add({
            targets: balloonText,
            scaleX: 1.5,
            scaleY: 1.5,
            duration: 1500,
            delay: 300,
            ease: 'Quad.easeOut',
        });

        // ===== Xử lý bóng sai nổ lần lượt =====
        let poppedCount = 0;
        const totalWrong = this.balloons.length - 1;

        this.balloons.forEach((b, index) => {
            if ((b as any).isCorrect) return; // bỏ bóng đúng

            const popKey = (b as any).popKey;

            // ⭐ Tạo sprite animation
            const pop = this.add
                .sprite(b.x, b.y, popKey)
                .setScale((Math.min(w, h) / 1280) * 0.8)
                .setAlpha(0)
                .setDepth(9000); // cho lên trên

            // Hẹn giờ nổ lần lượt
            this.time.delayedCall(500 + index * 500, () => {
                // trả pop lên visible
                pop.setAlpha(1);

                // chơi animation
                pop.play(`${popKey}_anim`);

                // play sound
                this.sound.play('sfx_pop');

                // xóa bóng sai
                b.destroy();

                // đếm bóng nổ
                poppedCount++;

                // khi nổ xong tự ẩn sprite (vì hideOnComplete = true)
                pop.on('animationcomplete', () => {
                    pop.destroy();
                });

                // ⭕ Nếu tất cả bóng sai đã nổ xong
                if (poppedCount === totalWrong) {
                    this.time.delayedCall(500, () => {
                        // Hiệu ứng thu nhỏ rồi biến mất
                        this.tweens.add({
                            targets: balloon,
                            scaleX: 0,
                            scaleY: 0,
                            alpha: 0,
                            duration: 400,
                            ease: 'Back.In',
                            onComplete: () => {
                                balloon.destroy();

                                //delay 300ms rồi hiện bảng số
                                this.time.delayedCall(300, () => {
                                    // Chọn item random
                                    const items = [
                                        'apple',
                                        'flower',
                                        'carrot',
                                        'leaf',
                                    ];
                                    const itemKey =
                                        items[
                                            Math.floor(
                                                Math.random() * items.length
                                            )
                                        ];

                                    // Hiện bảng số
                                    const waitTime = this.showNumberBoard(
                                        this.levelData.correctNumber,
                                        itemKey,
                                        'board_bg'
                                    );

                                    // Chờ đọc xong rồi hiện next
                                    this.time.delayedCall(waitTime, () => {
                                        this.showNextButton();
                                    });
                                });
                            },
                        });
                    });
                }
                //     },
                // });
            });
        });

        this.rabbit.setTexture('rabbit_cheer').setScale(1.15);
    }

    showNumberBoard(number: number, itemKey: string, boardBgKey?: string) {
        // Lấy kích thước màn hình
        const w = this.scale.width;
        const h = this.scale.height;

        // Bảng cố định theo tỉ lệ màn hình
        const boardWidth = w * 0.5;
        const boardHeight = h * 0.55;
        const boardX = w / 2;
        const boardY = h / 1.8;

        const delayPerItem = 500;
        const voiceDuration = 600; // ước lượng

        // Background bảng (sprite hoặc graphics)
        if (boardBgKey) {
            const bg = this.add.image(boardX, boardY, boardBgKey);
            bg.setDisplaySize(boardWidth, boardHeight);
        } else {
            // fallback: graphics màu xanh nhạt
            const graphics = this.add.graphics();
            graphics.fillStyle(0x8fcaff, 1);
            graphics.fillRoundedRect(
                boardX - boardWidth / 2,
                boardY - boardHeight / 2,
                boardWidth,
                boardHeight,
                20
            );
        }

        // Kích thước item theo tỉ lệ
        const itemSize = Math.min(boardWidth, boardHeight) / 3; // ~200px trên màn chuẩn 1280x720
        const padding = itemSize * 0.1; // khoảng cách giữa item

        // Số lượng item mỗi hàng
        let itemsPerRow = 1;
        if (number >= 3) itemsPerRow = 2; // 1 hàng nếu 1-2, 2 hàng nếu 3-4
        const numRows = Math.ceil(number / itemsPerRow);

        // Tính startX, startY để căn giữa bảng
        const totalWidth = itemsPerRow * itemSize + (itemsPerRow - 1) * padding;
        const totalHeight = numRows * itemSize + (numRows - 1) * padding;
        const startX = boardX - totalWidth / 2 + itemSize / 2;
        const startY = boardY - totalHeight / 2 + itemSize / 2;

        for (let i = 0; i < number; i++) {
            const row = Math.floor(i / itemsPerRow);
            const col = i % itemsPerRow;

            const x = startX + col * (itemSize + padding);
            const y = startY + row * (itemSize + padding);

            // Hiển thị từng item với delay
            this.time.delayedCall(i * 500, () => {
                const img = this.add
                    .image(x, y, itemKey)
                    .setDisplaySize(itemSize, itemSize);

                // Tween “nảy” khi xuất hiện
                this.tweens.add({
                    targets: img,
                    scale: { from: 0, to: 1 },
                    ease: 'Back.easeOut',
                    duration: 400,
                });

                // Phát audio đếm số (nếu có)

                this.sound.play(`vo_count_${i + 1}`, { volume: 1 });
            });
        }

        // **Cập nhật banner trên cùng** (hiển thị số)
        this.banner.setTexture('banner_no_text');
        this.promptText
            .setText(`${number}`)
            .setPosition(this.pctX(0.5), this.pctY(0.1));

        const totalTime = number * delayPerItem + voiceDuration;
        return totalTime;
    }

    showNextButton() {
        const w = this.scale.width;
        const h = this.scale.height;

        const offset = Math.min(w, h) * 0.1;
        const btnScale = Math.min(w, h) / 1280;

        const nextButton = this.add
            .image(w - offset, h - offset, 'icon_next')
            .setInteractive({ useHandCursor: true })
            .setScale(btnScale)
            .setOrigin(1)
            .setAlpha(0);

        nextButton.setAlpha(1);

        this.tweens.add({
            targets: nextButton,
            scale: btnScale * 1.1,
            yoyo: true,
            repeat: -1,
            duration: 500,
        });

        nextButton.once('pointerdown', () => {
            this.sound.play('sfx_click');

            this.time.delayedCall(300, () => {
                this.currentLevel++;
                if (this.currentLevel >= this.levels.length) {
                    this.scene.start('EndScene');
                } else {
                    this.scene.restart({ level: this.currentLevel });
                }
            });
        });
    }
}
