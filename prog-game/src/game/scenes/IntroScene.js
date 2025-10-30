import * as Phaser from "phaser";

export default class IntroScene extends Phaser.Scene {
  constructor() {
    super("IntroScene");
  }

  preload() {
    this.load.image("logo", "/assets/ui/logo.png");
  }

  create() {
    const { width, height } = this.scale;

    // Nền gradient
    const g = this.add.graphics();
    const steps = 30;
    for (let i = 0; i < steps; i++) {
      const color = Phaser.Display.Color.Interpolate.ColorWithColor(
        new Phaser.Display.Color(30, 58, 138),
        new Phaser.Display.Color(96, 165, 250),
        steps,
        i
      );
      const hex = Phaser.Display.Color.GetColor(color.r, color.g, color.b);
      g.fillStyle(hex, 1);
      g.fillRect(0, (height / steps) * i, width, height / steps);
    }

    // Logo
    const logo = this.add.image(width / 2, height / 2 - 50, "logo");
    logo.setAlpha(0);
    logo.setScale(0.3);

    // Text
    const text = this.add.text(width / 2, height * 0.7, "IruKa Edu", {
      fontFamily: "Rum Raisin",
      fontSize: "42px",
      color: "#ffffff",
    });
    text.setOrigin(0.5);
    text.setAlpha(0);
    text.setScale(0.5);

    // Logo fade-in
    this.tweens.add({
      targets: logo,
      alpha: 1,
      scale: 0.45,
      duration: 1500,
      ease: "Sine.easeInOut",
      yoyo: true,
      hold: 800,
    });

    // Text zoom-in rồi biến mất
    this.time.delayedCall(1200, () => {
      this.tweens.add({
        targets: text,
        alpha: { from: 0, to: 1 },
        scale: { from: 0.5, to: 1 },
        duration: 800,
        ease: "Back.Out",
        yoyo: true,
        hold: 500,
      });
    });

    // Fade-out toàn màn sau 3.8s
    this.time.delayedCall(3800, () => {
      this.cameras.main.fadeOut(1000, 0, 0, 0);
      this.cameras.main.once(
        Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE,
        () => this.scene.start("PlayScene")
      );
    });
  }
}
