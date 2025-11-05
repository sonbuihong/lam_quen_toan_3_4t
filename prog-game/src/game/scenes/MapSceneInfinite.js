import * as Phaser from "phaser";

export default class MapSceneInfinite extends Phaser.Scene {
  constructor() {
    super("MapSceneInfinite");
    this.score = 0;
    this.isJumping = false;
    this.totalTargets = 15;
  }

  preload() {
    // Hình ảnh
    this.load.image("frog", "/assets/characters/image.png");
    this.load.image("lotus", "/assets/ui/lotus.png");
    this.load.image("number1", "/assets/ui/number_1.png");
    this.load.image("gameBg", "/assets/background/background1.png");

    // Âm thanh
    this.load.audio("so1", "/assets/audio/so1.mp3");
    this.load.audio("jump", "/assets/audio/jump.wav");
    this.load.audio("ring", "/assets/audio/ring.wav");
    this.load.audio("bgMusic", "/assets/audio/bg_music.wav");
    this.load.audio("intro", "/assets/audio/intro.mp3");
  }

  create() {
    this.score = 0;
    this.isJumping = false;
    this.totalTargets = 15;

    const { width, height } = this.scale;

    // Nền
    this.bg = this.add
      .tileSprite(0, 0, width, height, "gameBg")
      .setOrigin(0)
      .setDepth(-1)
      .setScrollFactor(0);

    this.createFish();
    this.createProgressBar();
    this.createInstructions();

    this.createInitialLotuses();
    this.createFrog();

    // Camera
    this.cameras.main.startFollow(this.frog, true, 0.05, 0.05);
    this.cameras.main.setLerp(0.1, 0);

    // Âm nhạc
    if (!this.sound.get("bgMusic")) {
      const bgMusic = this.sound.add("bgMusic", { loop: true, volume: 0.3 });
      bgMusic.play();
    }
    this.sound.play("intro");
  }

  update() {
    if (this.bg) {
      this.bg.tilePositionX = this.cameras.main.scrollX * 0.3;
    }
    this.cameras.main.scrollY = 0;
  }

  // Tạo cá bơi quanh
  createFish() {
    const colors = [0xffa500, 0xff6347, 0xffd700, 0xff4500, 0x1e90ff, 0x00ced1];

    const spawnFish = () => {
      const cam = this.cameras.main;
      const spawnX = Phaser.Math.Between(
        cam.scrollX - 200,
        cam.scrollX + cam.width + 200
      );
      const spawnY = Phaser.Math.Between(320, 500);
      const direction = Phaser.Math.Between(0, 1) === 0 ? 1 : -1;

      const fish = this.add.graphics();
      const color = Phaser.Utils.Array.GetRandom(colors);
      const size = Phaser.Math.Between(12, 28);
      fish.fillStyle(color, 1);
      fish.fillEllipse(0, 0, size, size / 2);
      fish.fillTriangle(
        -size * 0.4,
        0,
        -size * 0.8,
        -size * 0.3,
        -size * 0.8,
        size * 0.3
      );
      fish.setPosition(spawnX, spawnY);
      fish.scaleX = direction;

      this.tweens.add({
        targets: fish,
        x:
          direction === 1
            ? spawnX + Phaser.Math.Between(400, 800)
            : spawnX - Phaser.Math.Between(400, 800),
        duration: Phaser.Math.Between(3500, 6000),
        ease: "Sine.easeInOut",
        onComplete: () => fish.destroy(),
      });
    };

    this.time.addEvent({
      delay: 400,
      loop: true,
      callback: spawnFish,
    });
  }

  createProgressBar() {
    const { width } = this.scale;
    this.progressBox = this.add.graphics();
    this.progressBox.lineStyle(4, 0xffffff, 0.8);
    this.progressBox.strokeRoundedRect(width / 2 - 120, 20, 240, 40, 10);
    this.progressBox.setScrollFactor(0);

    this.progressBar = this.add.graphics().setScrollFactor(0);

    this.progressText = this.add
      .text(width / 2, 40, "0 / 15", {
        fontFamily: "Rum Raisin",
        fontSize: "24px",
        color: "#ffffff",
        stroke: "#145214",
        strokeThickness: 3,
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setScrollFactor(0);

    this.progressPercent = 0;
  }

  updateProgressBar() {
    const { width } = this.scale;
    const newPercent = Math.min(this.score / this.totalTargets, 1);

    this.tweens.add({
      targets: this,
      progressPercent: newPercent,
      duration: 400,
      ease: "Sine.easeOut",
      onUpdate: () => {
        this.progressBar.clear();
        this.progressBar.fillStyle(0x00cc00, 1);
        this.progressBar.fillRoundedRect(
          width / 2 - 115,
          25,
          230 * this.progressPercent,
          30,
          8
        );
      },
    });

    this.progressText.setText(`${this.score} / ${this.totalTargets}`);
    if (this.score >= this.totalTargets) this.winGame();
  }

  createInitialLotuses() {
    this.lotuses = [];
    const startX = 150;
    const startY = this.scale.height / 2 - 50;

    for (let i = 0; i < 10; i++) {
      const lotus = this.spawnLotus(
        startX + i * 200,
        startY + Phaser.Math.Between(-20, 20),
        i === 0
      );
      this.lotuses.push(lotus);
    }

    // Gán click
    this.lotuses.forEach((lotus, i) => {
      lotus.setInteractive({ useHandCursor: true });
      lotus.on("pointerdown", () => this.handleLotusClick(lotus, i));
    });
  }

  spawnLotus(x, y, isFirst = false) {
    const hasNumber = !isFirst && Phaser.Math.Between(0, 100) < 40;
    const lotus = this.add.image(x, y, "lotus").setScale(0.12).setDepth(1);
    lotus.hasNumber = hasNumber;
    lotus.collected = false;

    if (hasNumber) {
      const number = this.add
        .image(x, y - 50, "number1")
        .setScale(0.15)
        .setDepth(3);
      lotus.numberSprite = number;
    }

    return lotus;
  }

  createFrog() {
    const startPad = this.lotuses[0];
    this.frog = this.add.sprite(startPad.x, startPad.y - 25, "frog");
    this.frog.setScale(0.15).setDepth(5);
    this.currentIndex = 0;
  }

  createInstructions() {
    const { width } = this.scale;
    this.instructionText = this.add
      .text(width / 2, 90, "Nhấn vào lá sen kế bên để ếch nhảy!", {
        fontSize: "28px",
        fontFamily: "Rum Raisin",
        color: "#ffffff",
        stroke: "#2e8b57",
        strokeThickness: 4,
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setScrollFactor(0);
  }

  handleLotusClick(lotus, index) {
    if (this.isJumping) return;
    if (index !== this.currentIndex + 1) return;

    this.sound.play("jump");
    this.isJumping = true;
    this.jumpToLotus(lotus, () => {
      this.createRipple(lotus.x, lotus.y);

      if (lotus.hasNumber && !lotus.collected) {
        lotus.collected = true;
        if (lotus.numberSprite) lotus.numberSprite.destroy();
        this.sound.play("ring");
        this.sound.play("so1");
        this.score++;
        this.updateProgressBar();
      }

      this.currentIndex = index;
      this.isJumping = false;
      if (index > this.lotuses.length - 4) this.extendMap();
    });
  }

  jumpToLotus(target, onComplete) {
    const startX = this.frog.x;
    const startY = this.frog.y;
    const targetX = target.x;
    const targetY = target.y - 25;

    const jumpDuration = 600; // ms
    const v0y = 700; // tốc độ bật lên
    const g = 2000; // trọng lực
    const startTime = this.time.now;

    const event = this.time.addEvent({
      delay: 16,
      loop: true,
      callback: () => {
        const t = (this.time.now - startTime) / 1000;
        const progress = Math.min(t / (jumpDuration / 1000), 1);

        const x = Phaser.Math.Linear(startX, targetX, progress);
        const y = startY - (v0y * t - 0.5 * g * t * t);

        this.frog.setPosition(x, y);

        if (progress >= 1) {
          this.frog.setPosition(targetX, targetY);
          event.remove();
          if (onComplete) onComplete();
        }
      },
    });
  }

  extendMap() {
    const lastPad = this.lotuses[this.lotuses.length - 1];
    for (let i = 1; i <= 5; i++) {
      const newX = lastPad.x + i * 200;
      const newY = this.scale.height / 2 + Phaser.Math.Between(-30, 30);
      const newLotus = this.spawnLotus(newX, newY);
      this.lotuses.push(newLotus);
      newLotus.setInteractive({ useHandCursor: true });
      newLotus.on("pointerdown", () =>
        this.handleLotusClick(newLotus, this.lotuses.indexOf(newLotus))
      );
    }

    if (this.lotuses.length > 20) {
      const old = this.lotuses.splice(0, 5);
      old.forEach((pad) => {
        if (pad.numberSprite) pad.numberSprite.destroy();
        pad.destroy();
      });
      this.currentIndex -= 5;
    }
  }

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
    this.sound.stopAll();
    this.time.removeAllEvents();
    this.tweens.killAll();
    this.cameras.main.fadeOut(1000, 0, 0, 0);
    this.time.delayedCall(1000, () => {
      this.scene.start("WinScene", { score: this.score });
    });
  }
}
