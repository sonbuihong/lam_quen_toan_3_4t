import * as Phaser from "phaser";

export default class MapScene extends Phaser.Scene {
  constructor() {
    super("MapScene");
  }

  preload() {
    // Load background
    this.load.image("map-bg", "assets/background/background-3.png");
    this.load.image("btn-back", "assets/button/btn-back.png");

    // Load object
    this.load.image("pad", "assets/objects/pad.png");
    this.load.image("star-icon", "assets/objects/star-icon.png");

    this.load.image("fish", "assets/objects/fish.png");
    this.load.image("plane", "assets/objects/plane.png");
    this.load.image("truck", "assets/objects/truck.png");
    this.load.image("starfish", "assets/objects/starfish.png");
    this.load.image("ball", "assets/objects/ball.png");

    this.load.audio("click-sound", "assets/sounds/click.wav");
  }

  create() {
    const { width, height } = this.scale;

    // Nền full màn hình
    const bg = this.add.image(0, 0, "map-bg").setOrigin(0);
    const resizeBackground = () => {
      const scaleX = width / bg.width;
      const scaleY = height / bg.height;
      const scale = Math.max(scaleX, scaleY);
      bg.setScale(scale).setPosition(0, 0);
    };
    resizeBackground();
    this.scale.on("resize", resizeBackground);

    // Nút quay lại
    const backBtn = this.add
      .image(60, 60, "btn-back")
      .setInteractive({ useHandCursor: true })
      .setScale(0.3)
      .setDepth(5);

    // Hiệu ứng hover nhỏ
    backBtn.on("pointerover", () =>
      this.tweens.add({ targets: backBtn, scale: 0.4, duration: 100 })
    );
    backBtn.on("pointerout", () =>
      this.tweens.add({ targets: backBtn, scale: 0.3, duration: 100 })
    );

    backBtn.on("pointerdown", () => {
      this.sound.play("click-sound");
      this.scene.start("MainMenu");
    });

    const levels = [
      { x: width * 0.15, y: height * 0.5, icon: "fish", stars: 1 },
      { x: width * 0.35, y: height * 0.7, icon: "plane", stars: 2 },
      { x: width * 0.65, y: height * 0.8, icon: "truck", stars: 3 },
      { x: width * 0.8, y: height * 0.4, icon: "starfish", stars: 4 },
      { x: width * 0.5, y: height * 0.3, icon: "ball", stars: 5 },
    ];

    levels.forEach((lvl) => {
      // Nền tròn (pad)
      const pad = this.add.image(lvl.x, lvl.y, "pad").setScale(0.4);
      // Vật thể chính
      const obj = this.add.image(lvl.x, lvl.y - 50, lvl.icon).setScale(0.45);
      // Ngôi sao
      const star = this.add
        .image(lvl.x, lvl.y + 60, "star-icon") // Cùng vị trí trung tâm
        .setScale(0.7);
      const starText = this.add
        .text(lvl.x, lvl.y + 60, lvl.stars, {
          fontSize: "20px",
          color: "#000",
          fontFamily: "Arial",
          fontStyle: "bold",
        })
        .setOrigin(0.5);

      // Nhóm lại
      const starGroup = this.add.container(0, 0, [pad, obj, star, starText]);
      starGroup.setSize(star.width * 0.5, star.height * 0.5);
      starGroup.setInteractive({ useHandCursor: true });
      // Hiệu ứng hover scale
      starGroup.on("pointerover", () => {
        this.tweens.add({
          targets: starGroup,
          scale: 0.7,
          duration: 100,
        });
      });

      starGroup.on("pointerout", () => {
        this.tweens.add({
          targets: starGroup,
          scale: 0.6,
          duration: 100,
        });
      });

      // Animation hover
      obj.setInteractive({ useHandCursor: true });
      obj.on("pointerover", () => {
        this.tweens.add({ targets: obj, scale: 0.5, duration: 100 });
      });
      obj.on("pointerout", () => {
        this.tweens.add({ targets: obj, scale: 0.45, duration: 100 });
      });
      obj.on("pointerdown", () => {
        this.sound.play("click-sound");
        console.log("Vào màn:", lvl.stars);
        this.scene.start("GameScene", { level: lvl.stars });
      });
    });
  }
}
