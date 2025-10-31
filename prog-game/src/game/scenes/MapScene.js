import * as Phaser from "phaser";

export default class MapScene extends Phaser.Scene {
  constructor() {
    super("MapScene");
    this.score = 0;
    this.isJumping = false;
    this.totalTargets = 15;
  }

  preload() {
    this.load.image("frog", "/assets/characters/image.png");
    this.load.image("background", "/assets/background/background.png");
    this.load.image("lotus", "/assets/ui/lotus.png");
    this.load.image("number1", "/assets/ui/number_1.png");
    this.load.audio("so1", "/assets/audio/so1.mp3");
  }

  create() {
    this.createSky();
    this.createPond();
    this.createFish();
    this.createProgressBar();

    this.createLotuses();
    this.createFrog();
    this.createInstructions();

    this.input.on("pointerdown", (pointer) => this.handleJump(pointer));
    this.input.keyboard.on("keydown-SPACE", () => this.handleJump());
  }

  // Bầu trời
  createSky() {
    const { width } = this.scale;
    const sky = this.add.graphics();
    sky.fillGradientStyle(0x75e675, 0x4fc04f, 0x7fe97f, 0x63d863, 1);
    sky.fillRect(0, 0, width, 150);
  }

  // Mặt nước
  createPond() {
    const { width, height } = this.scale;
    const pond = this.add.graphics();
    pond.fillRoundedRect(50, 120, width - 100, height - 160, 20);
  }

  // Cá bơi
  createFish() {
    for (let i = 0; i < 5; i++) {
      const fish = this.add.graphics();
      const colors = [0xffa500, 0xff6347, 0xffd700, 0xff4500];
      fish.fillStyle(colors[i % colors.length], 1);
      fish.fillEllipse(0, 0, 25, 12);
      fish.fillTriangle(-10, 0, -20, -6, -20, 6);
      fish.setPosition(
        Phaser.Math.Between(100, 1200),
        Phaser.Math.Between(300, 560)
      );

      this.tweens.add({
        targets: fish,
        x: Phaser.Math.Between(100, 1200),
        duration: Phaser.Math.Between(6000, 9000),
        repeat: -1,
        yoyo: true,
        ease: "Sine.easeInOut",
      });
    }
  }

  // Thanh tiến trình
  createProgressBar() {
    const { width } = this.scale;
    this.progressBox = this.add.graphics();
    this.progressBar = this.add.graphics();

    this.progressBox.fillStyle(0x000000, 0.3);
    this.progressBox.fillRoundedRect(width / 2 - 120, 20, 240, 40, 10);

    this.progressText = this.add
      .text(width / 2, 40, "0 / 15", {
        fontFamily: "Arial, sans-serif",
        fontSize: "20px",
        color: "#ffffff",
        stroke: "#228B22",
        strokeThickness: 3,
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    this.updateProgressBar();
  }

  updateProgressBar() {
    const { width } = this.scale;
    this.progressBar.clear();

    const percent = Math.min(this.score / this.totalTargets, 1);
    this.progressBar.fillStyle(0x00cc00, 1);
    this.progressBar.fillRoundedRect(width / 2 - 115, 27, 230 * percent, 26, 8);

    this.progressText.setText(`${this.score} / ${this.totalTargets}`);

    if (this.score >= this.totalTargets) this.winGame();
  }

  // Tạo 20 lá sen cố định
  createLotuses() {
    this.lotuses = [];

    // Vị trí cố định (tự tay sắp cho đẹp)
    const positions = [
      { x: 150, y: 500 },
      { x: 280, y: 400 },
      { x: 410, y: 480 },
      { x: 550, y: 370 },
      { x: 700, y: 450 },
      { x: 840, y: 340 },
      { x: 980, y: 420 },
      { x: 1120, y: 380 },
      { x: 1260, y: 500 },
      { x: 1400, y: 400 },
      { x: 1540, y: 470 },
      { x: 1680, y: 360 },
      { x: 1820, y: 430 },
      { x: 1960, y: 490 },
      { x: 2100, y: 380 },
      { x: 2240, y: 460 },
      { x: 2380, y: 350 },
      { x: 2520, y: 410 },
      { x: 2660, y: 490 },
      { x: 2800, y: 380 },
    ];

    // Các lá có số 1 (bạn tùy chỉnh danh sách)
    const leavesWithOne = [2, 5, 7, 10, 13, 15, 18];

    positions.forEach((pos, i) => {
      const hasNumber = leavesWithOne.includes(i + 1);
      const lotus = this.add.image(pos.x, pos.y, "lotus");

      lotus.setScale(0.12);
      lotus.setDepth(2);
      lotus.hasNumber = hasNumber;
      lotus.collected = false;

      // Nếu có số 1 thì thêm sprite số 1 lên trên
      if (hasNumber) {
        const number = this.add
          .image(pos.x, pos.y - 40, "number1") // 👈 cao hơn lá sen
          .setScale(0.08);
        number.setDepth(3);
        lotus.numberSprite = number;

        // Hiệu ứng số 1 lơ lửng nhè nhẹ
        this.tweens.add({
          targets: number,
          y: pos.y - 45,
          duration: Phaser.Math.Between(1000, 1500),
          yoyo: true,
          repeat: -1,
          ease: "Sine.easeInOut",
        });
      }

      // Rung nhẹ
      this.tweens.add({
        targets: lotus,
        y: pos.y + Phaser.Math.Between(-5, 5),
        duration: Phaser.Math.Between(2000, 3000),
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });

      this.lotuses.push(lotus);
    });
  }

  // Ếch khởi đầu
  createFrog() {
    const startPad = this.lotuses[0];
    this.frog = this.add.sprite(startPad.x, startPad.y - 25, "frog");
    this.frog.setScale(0.15);
    this.frog.setDepth(5);
    this.currentPad = startPad;
  }

  // Hướng dẫn
  createInstructions() {
    const { width } = this.scale;
    const text = this.add.text(width / 2, 90, "Nhấn vào lá sen để ếch nhảy!", {
      fontSize: "24px",
      color: "#ffffff",
      stroke: "#2e8b57",
      strokeThickness: 4,
      fontStyle: "bold",
    });
    text.setOrigin(0.5);
  }

  // Nhảy đến lá được nhấn
  handleJump(pointer) {
    if (this.isJumping) return;

    const clickX = pointer?.x ?? this.frog.x + 100;
    const clickY = pointer?.y ?? this.frog.y;

    let closest = this.lotuses.reduce((nearest, pad) => {
      const dist = Phaser.Math.Distance.Between(clickX, clickY, pad.x, pad.y);
      return !nearest || dist < nearest.dist ? { pad, dist } : nearest;
    }, null);

    if (closest && closest.dist < 150 && closest.pad !== this.currentPad) {
      this.jumpTo(closest.pad);
    }
  }

  // Nhảy đến lá mới
  jumpTo(pad) {
    this.isJumping = true;

    this.tweens.add({
      targets: this.frog,
      x: pad.x,
      y: pad.y - 50,
      duration: 400,
      ease: "Quad.easeOut",
      onComplete: () => {
        this.createRipple(pad.x, pad.y);

        // Nếu là lá có số 1
        if (pad.hasNumber && !pad.collected) {
          pad.collected = true;
          pad.hasNumber = false;
          pad.setTexture("lotus");

          // 👉 Xóa sprite số 1 nếu có
          if (pad.numberSprite) {
            pad.numberSprite.destroy();
            pad.numberSprite = null;
          }

          // Hiệu ứng chữ “SỐ 1!”
          const text = this.add
            .text(this.scale.width / 2, this.scale.height / 2, "SỐ 1!", {
              fontSize: "64px",
              fontStyle: "bold",
              color: "#00ff00",
              stroke: "#006600",
              strokeThickness: 8,
            })
            .setOrigin(0.5)
            .setAlpha(0);

          this.tweens.add({
            targets: text,
            alpha: 1,
            scale: 1.2,
            duration: 400,
            yoyo: true,
            onComplete: () => text.destroy(),
          });

          // Âm thanh + giọng đọc
          this.sound.play("so1");
          this.score++;
          this.updateProgressBar();
        }

        // Hạ ếch xuống lá
        this.tweens.add({
          targets: this.frog,
          y: pad.y - 25,
          duration: 300,
          ease: "Bounce.easeOut",
          onComplete: () => {
            this.currentPad = pad;
            this.isJumping = false;
          },
        });
      },
    });
  }

  // Hiệu ứng gợn sóng
  createRipple(x, y) {
    for (let i = 0; i < 3; i++) {
      const ripple = this.add.graphics();
      ripple.lineStyle(3, 0xffffff, 0.6);
      ripple.strokeCircle(x, y, 10);
      this.tweens.add({
        targets: ripple,
        alpha: 0,
        duration: 1000,
        delay: i * 200,
        onComplete: () => ripple.destroy(),
      });
      this.tweens.add({
        targets: ripple,
        scaleX: 5,
        scaleY: 5,
        duration: 1000,
        delay: i * 200,
      });
    }
  }

  winGame() {
    this.input.enabled = false;
    this.cameras.main.fadeOut(1000, 0, 0, 0);
    this.time.delayedCall(1000, () => {
      this.scene.start("WinScene", { score: this.score });
    });
  }
}
