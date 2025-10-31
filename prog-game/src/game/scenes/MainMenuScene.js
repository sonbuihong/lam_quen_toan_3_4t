import * as Phaser from "phaser";

export default class MainMenuScene extends Phaser.Scene {
  constructor() {
    super("MainMenu");
  }

  preload() {
    // Assets cơ bản
    this.load.image("prog", "/assets/characters/prog.png");
    this.load.image("lotus", "/assets/ui/lotus.png"); // lá sen
    // this.load.audio("click", "/assets/audio/click.mp3"); // âm thanh click
  }

  create() {
    const { width, height } = this.scale;

    // Nền gradient
    const g = this.add.graphics();
    const steps = 30;
    for (let i = 0; i < steps; i++) {
      const color = Phaser.Display.Color.Interpolate.ColorWithColor(
        new Phaser.Display.Color(153, 214, 214),
        new Phaser.Display.Color(79, 177, 161),
        steps,
        i
      );
      g.fillStyle(Phaser.Display.Color.GetColor(color.r, color.g, color.b), 1);
      g.fillRect(0, (height / steps) * i, width, height / steps);
    }

    // Bong bóng trồi lên
    this.time.addEvent({
      delay: 400, // Xuất hiện nhanh hơn
      loop: true,
      callback: () => {
        const x = Phaser.Math.Between(0, width);
        const y = height + 30;
        const radius = Phaser.Math.Between(6, 14); // To hơn nhiều
        const bubble = this.add.circle(
          x,
          y,
          radius,
          0xffffff,
          Phaser.Math.FloatBetween(0.2, 0.5)
        );

        // Hiệu ứng nhấp nháy ánh sáng
        this.tweens.add({
          targets: bubble,
          scale: { from: 1, to: 1.15 },
          alpha: { from: 0.6, to: 0.3 },
          duration: Phaser.Math.Between(800, 1500),
          yoyo: true,
          repeat: -1,
          ease: "Sine.easeInOut",
        });

        // Hiệu ứng nổi lên
        this.tweens.add({
          targets: bubble,
          y: y - Phaser.Math.Between(250, 500),
          x: x + Phaser.Math.Between(-40, 40), // Trôi nhẹ sang ngang
          alpha: 0,
          duration: Phaser.Math.Between(4000, 6000),
          ease: "Sine.easeOut",
          onComplete: () => bubble.destroy(),
        });
      },
    });

    // Lá sen trang trí
    const leafLeft = this.add
      .image(width * 0.2, height * 0.8, "lotus")
      .setScale(0.3);
    const leafRight = this.add
      .image(width * 0.8, height * 0.8, "lotus")
      .setScale(0.3);
    this.tweens.add({
      targets: [leafLeft, leafRight],
      angle: { from: -3, to: 3 },
      duration: 2000,
      yoyo: true,
      repeat: -1,
      ease: "Sine.inOut",
    });

    // Logo Game
    const prog = this.add.image(width / 2 - 48, height * 0.3, "prog");
    prog.setAlpha(0);
    prog.setScale(0.5);
    this.tweens.add({
      targets: prog,
      alpha: 1,
      duration: 1000,
      ease: "Sine.easeInOut",
    });

    // Fade in mượt
    this.tweens.add({
      targets: prog,
      alpha: 1,
      duration: 1000,
      ease: "Sine.easeInOut",
    });

    // Hiệu ứng phóng to - thu nhỏ liên tục
    this.tweens.add({
      targets: prog,
      scale: { from: 0.3, to: 0.4 },
      duration: 1500,
      yoyo: true,
      repeat: -1, // lặp vô hạn
      ease: "Sine.easeInOut",
    });

    // Text Play
    const playText = this.add.text(width / 2, height * 0.7, "PLAY GAME", {
      fontFamily: "Rum Raisin",
      fontSize: "64px",
      color: "#ffffff",
    });
    playText.setOrigin(0.5);
    playText.setInteractive({ useHandCursor: true });

    // Hiệu ứng “thở” nhẹ
    this.tweens.add({
      targets: playText,
      scale: { from: 1, to: 1.05 },
      duration: 1000,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    // Gợn nước khi hover
    playText.on("pointerover", () => {
      const ripple = this.add.circle(
        playText.x,
        playText.y + 5,
        0,
        0xffffff,
        0.25
      );
      this.tweens.add({
        targets: ripple,
        radius: 100,
        alpha: 0,
        duration: 800,
        onComplete: () => ripple.destroy(),
      });
    });

    // Click -> Âm thanh + Fade out + Chuyển Scene
    playText.on("pointerdown", () => {
      // this.sound.play("click", { volume: 0.5 });
      this.cameras.main.fadeOut(800, 0, 0, 0);
      this.cameras.main.once(
        Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE,
        () => this.scene.start("MapSceneInfinite")
      );
    });

    // Text nhỏ bên dưới
    this.add
      .text(width / 2, height - 30, "© IruKa Edu 2025", {
        fontFamily: "Rum Raisin",
        fontSize: "24px",
        color: "#ffffff88",
      })
      .setOrigin(0.5);
  }
}
