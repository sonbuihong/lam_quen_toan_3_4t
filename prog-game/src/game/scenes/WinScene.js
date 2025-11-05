import * as Phaser from "phaser";

export default class WinScene extends Phaser.Scene {
  constructor() {
    super("WinScene");
  }

  preload() {
    this.load.image("frogHappy", "/assets/characters/prog.png");
    this.load.image("background", "/assets/background/background.png");
    this.load.image("endscene", "/assets/background/end.png");
    this.load.audio("winSound", "/assets/audio/winner.wav");
    this.load.audio("end", "/assets/audio/end.mp3");
  }

  create(data) {
    const { width, height } = this.scale;

    const bg = this.add.image(width / 2, height / 2, "background");
    bg.setDisplaySize(width, height).setDepth(0);

    this.sound.play("winSound", { volume: 0.1 });
    this.sound.play("end", { volume: 0.8 });

    this.addSparkleEffect(width, height);

    this.time.delayedCall(800, () => this.showEndFrame(width, height, data));
  }

  showEndFrame(width, height, data) {
    const endFrame = this.add
      .image(width / 2, height / 2, "endscene")
      .setOrigin(0.5)
      .setScale(0)
      .setDepth(1)
      .setAlpha(0);

    this.tweens.add({
      targets: endFrame,
      alpha: 1,
      scale: 0.6,
      ease: "Back.Out",
      duration: 800,
    });

    this.time.delayedCall(1600, () => {
      this.tweens.add({
        targets: endFrame,
        scale: { from: 0.6, to: 0.63 },
        ease: "Sine.easeInOut",
        duration: 1500,
        yoyo: true,
        repeat: -1,
      });
    });

    this.time.delayedCall(1000, () => {
      this.addReplayButtonInFrame(width, height);
    });
  }

  addReplayButtonInFrame(width, height) {
    const btnWidth = 180;
    const btnHeight = 55;
    const radius = 15;
    const btnY = height / 2 + 190;

    const btnBg = this.add.graphics();
    btnBg.fillStyle(0x4caf50, 1);
    btnBg.lineStyle(3, 0xffffff);
    btnBg.fillRoundedRect(
      width / 2 - btnWidth / 2,
      btnY - btnHeight / 2,
      btnWidth,
      btnHeight,
      radius
    );
    btnBg.strokeRoundedRect(
      width / 2 - btnWidth / 2,
      btnY - btnHeight / 2,
      btnWidth,
      btnHeight,
      radius
    );

    const replayText = this.add
      .text(width / 2, btnY, "Chơi lại", {
        fontFamily: "Rum Raisin",
        fontSize: "30px",
        color: "#ffffff",
      })
      .setOrigin(0.5);

    const container = this.add.container(0, 0, [btnBg, replayText]);
    container.setSize(btnWidth, btnHeight);
    container.setDepth(10);
    container.setInteractive(
      new Phaser.Geom.Rectangle(
        width / 2 - btnWidth / 2,
        btnY - btnHeight / 2,
        btnWidth,
        btnHeight
      ),
      Phaser.Geom.Rectangle.Contains
    );

    container.on("pointerover", () => {
      btnBg.clear();
      btnBg.fillStyle(0x66bb6a, 1);
      btnBg.lineStyle(3, 0xffffff);
      btnBg.fillRoundedRect(
        width / 2 - btnWidth / 2,
        btnY - btnHeight / 2,
        btnWidth,
        btnHeight,
        radius
      );
      btnBg.strokeRoundedRect(
        width / 2 - btnWidth / 2,
        btnY - btnHeight / 2,
        btnWidth,
        btnHeight,
        radius
      );
    });

    container.on("pointerout", () => {
      btnBg.clear();
      btnBg.fillStyle(0x4caf50, 1);
      btnBg.lineStyle(3, 0xffffff);
      btnBg.fillRoundedRect(
        width / 2 - btnWidth / 2,
        btnY - btnHeight / 2,
        btnWidth,
        btnHeight,
        radius
      );
      btnBg.strokeRoundedRect(
        width / 2 - btnWidth / 2,
        btnY - btnHeight / 2,
        btnWidth,
        btnHeight,
        radius
      );
    });

    container.on("pointerdown", () => {
      this.tweens.add({
        targets: container,
        scale: 0.95,
        duration: 100,
        yoyo: true,
        ease: "Sine.easeInOut",
      });

      this.cameras.main.fadeOut(500, 0, 0, 0);
      this.time.delayedCall(500, () => {
        this.scene.stop("MapSceneInfinite");
        this.scene.start("MapSceneInfinite");
      });
    });
  }

  addSparkleEffect(width, height) {
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
        star.setDepth(3).setAlpha(0.8);
        this.tweens.add({
          targets: star,
          alpha: 0,
          duration: 1000,
          onComplete: () => star.destroy(),
        });
      },
    });
  }
}
