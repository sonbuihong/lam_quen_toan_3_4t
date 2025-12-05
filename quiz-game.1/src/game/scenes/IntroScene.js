import * as Phaser from "phaser";

export default class IntroScene extends Phaser.Scene {
  constructor() {
    super("IntroScene");
  }

  preload() {
    this.load.image("bg1", "assets/background/background-1.png");
    this.load.image("bg2", "assets/background/background-2.png");

    this.load.audio("bg-music", "assets/sounds/bg-music.mp3");
  }

  create() {
    this.music = this.sound.add("bg-music", {
      loop: true,
      volume: 0.3,
    });

    // Khi người chơi click lần đầu → phát nhạc
    this.input.once("pointerdown", () => {
      if (!this.music.isPlaying) this.music.play();
    });

    // 🖼️ Tạo background 1
    const bg1 = this.add.image(0, 0, "bg1").setOrigin(0);
    const bg2 = this.add.image(0, 0, "bg2").setOrigin(0);

    // Hàm scale nền cho vừa toàn màn hình
    const resizeBackground = () => {
      const { width, height } = this.scale;

      // Tính toán tỷ lệ co giãn để phủ kín toàn màn hình
      const scaleX1 = width / bg1.width;
      const scaleY1 = height / bg1.height;
      const scaleX2 = width / bg2.width;
      const scaleY2 = height / bg2.height;

      const scale1 = Math.max(scaleX1, scaleY1);
      const scale2 = Math.max(scaleX2, scaleY2);

      bg1.setScale(scale1).setPosition(0, 0);
      bg2.setScale(scale2).setPosition(0, 0);
    };

    // Gọi lần đầu khi tạo scene
    resizeBackground();

    // Cập nhật mỗi khi màn hình thay đổi kích thước (responsive)
    this.scale.on("resize", resizeBackground);

    // Ẩn ban đầu
    bg1.setAlpha(0);
    bg2.setAlpha(0);

    // Hiệu ứng fade ảnh 1 → ảnh 2 → sang MainMenu
    this.tweens.add({
      targets: bg1,
      alpha: 1,
      duration: 1000,
      onComplete: () => {
        this.time.delayedCall(1000, () => {
          this.tweens.add({ targets: bg1, alpha: 0, duration: 1000 });
          this.tweens.add({
            targets: bg2,
            alpha: 1,
            duration: 1000,
            onComplete: () => {
              this.time.delayedCall(1500, () => {
                this.scene.start("MainMenu");
              });
            },
          });
        });
      },
    });
  }
}
