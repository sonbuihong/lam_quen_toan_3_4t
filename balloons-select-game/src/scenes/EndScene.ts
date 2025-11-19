import Phaser from "phaser";

export class EndScene extends Phaser.Scene {
    constructor() {
        super({ key: "EndScene" });
    }

    create() {
        const { width, height } = this.cameras.main;

        // Background
        this.add.rectangle(width / 2, height / 2, width, height, 0x8fcaff);

        // Banner "Kết thúc"
        const banner = this.add.text(width / 2, 200, "Chúc mừng!", {
            fontSize: "72px",
            fontFamily: "Arial",
            color: "#ffffff",
            fontStyle: "bold",
        }).setOrigin(0.5);

        // Nút chơi lại
        const replayBtn = this.add.text(width / 2, height / 2, "Chơi lại", {
            fontSize: "48px",
            fontFamily: "Arial",
            color: "#ffffff",
            backgroundColor: "#ff6b6b",
            padding: { left: 20, right: 20, top: 10, bottom: 10 },
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });

        // Hover effect
        replayBtn.on('pointerover', () => replayBtn.setStyle({ backgroundColor: "#ff8787" }));
        replayBtn.on('pointerout', () => replayBtn.setStyle({ backgroundColor: "#ff6b6b" }));

        // Click: restart game
        replayBtn.on('pointerdown', () => {
            this.scene.start("GameScene", {
                levelData: {
                    correctNumber: Phaser.Math.Between(1, 4),
                    options: [1, 2, 3, 4] // hoặc generate lại
                }
            });
        });

        // Thêm âm thanh khi hover/click nếu muốn
        // this.sound.play('sfx_click');
    }
}
