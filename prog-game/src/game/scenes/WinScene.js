import * as Phaser from "phaser";

export default class WinScene extends Phaser.Scene {
  constructor() {
    super("WinScene");
  }

  preload() {
    this.load.image("frogHappy", "/assets/characters/prog.png");

    // Âm thanh chiến thắng
    this.load.audio("winSound", "/assets/audio/winner.wav");

    // (Tuỳ chọn) hình nền
    this.load.image("background", "/assets/background/background.png");
  }

  create(data) {
    const { width, height } = this.scale;

    // Nền
    const bg = this.add.image(width / 2, height / 2, "background");
    bg.setDisplaySize(width, height);

    // Phát âm thanh chiến thắng
    this.sound.play("winSound", { volume: 0.6 });

    // Hình ếch ăn mừng
    const frog = this.add
      .image(width / 2, height / 2 - 80, "frogHappy")
      .setScale(0.25)
      .setAlpha(0);

    this.tweens.add({
      targets: frog,
      alpha: 1,
      y: height / 2 - 100,
      duration: 1000,
      ease: "Sine.easeOut",
    });

    // Dòng chữ chúc mừng
    const winText = this.add
      .text(
        width / 2,
        height / 2 + 80,
        "Bé giỏi quá, chúc mừng bé đã hoàn thành bài học",
        {
          fontFamily: "Rum Raisin",
          fontSize: "56px",
          color: "#fff176",
          stroke: "#ff4081",
          strokeThickness: 8,
          fontStyle: "bold",
        }
      )
      .setOrigin(0.5)
      .setAlpha(0);

    this.tweens.add({
      targets: winText,
      alpha: 1,
      scale: { from: 0.6, to: 1 },
      duration: 800,
      ease: "Back.Out",
      delay: 600,
    });

    // Hiệu ứng sao lấp lánh
    this.time.addEvent({
      delay: 300,
      loop: true,
      callback: () => {
        const star = this.add.text(
          Phaser.Math.Between(100, width - 100),
          Phaser.Math.Between(100, height - 100),
          "✨",
          { fontSize: "28px" }
        );
        star.setAlpha(0.8);
        this.tweens.add({
          targets: star,
          alpha: 0,
          duration: 1000,
          onComplete: () => star.destroy(),
        });
      },
    });

    // Nút “Chơi lại”
    const replayBtn = this.add
      .text(width / 2, height - 100, "Chơi lại", {
        fontFamily: "Rum Raisin",
        fontSize: "32px",
        color: "#ffffff",
        backgroundColor: "#4caf50",
        padding: { x: 20, y: 10 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    replayBtn.on("pointerover", () =>
      replayBtn.setStyle({ backgroundColor: "#66bb6a" })
    );
    replayBtn.on("pointerout", () =>
      replayBtn.setStyle({ backgroundColor: "#4caf50" })
    );
    replayBtn.on("pointerdown", () => {
      this.sound.play("so1", { volume: 0.5 });
      this.cameras.main.fadeOut(500, 0, 0, 0);
      this.time.delayedCall(500, () => {
        this.scene.start("IntroScene");
      });
    });

    // Hiện điểm
    this.add
      .text(width / 2, height / 2 + 160, `Điểm của bé: ${data.score || 0}`, {
        fontFamily: "Rum Raisin",
        fontSize: "28px",
        color: "#fff",
      })
      .setOrigin(0.5);
  }
}
