import * as Phaser from "phaser";

export default class GameScene extends Phaser.Scene {
  constructor() {
    super("GameScene");
  }

  preload() {
    // Dữ liệu
    this.load.json("gameData", "data/data.json");

    // UI & background
    this.load.image("bg", "assets/background/background-game.png");
    this.load.image("board", "assets/images/board.png");
    this.load.image("btn-back", "assets/button/btn-back.png");
    this.load.image("btn-answer", "assets/button/btn-answer.png");

    // Vật thể
    this.load.image("cat", "assets/images/cat.png");
    this.load.image("apple", "assets/images/apple.png");
    this.load.image("banana", "assets/images/banana.png");
    this.load.image("bird", "assets/images/bird.png");
    this.load.image("car", "assets/images/car.png");
    this.load.image("fish", "assets/images/fish.png");
    this.load.image("star", "assets/images/star.png");
    this.load.image("rabbit", "assets/images/rabbit.png");
    this.load.image("ballon", "assets/images/ballon.png");
  }

  create(data) {
    console.log(data.level);
    const { width, height } = this.scale;
    const level = data.level || 1;

    // Background
    const bg = this.add.image(0, 0, "bg").setOrigin(0);
    const resizeBg = () => {
      const scaleX = width / bg.width;
      const scaleY = height / bg.height;
      const scale = Math.max(scaleX, scaleY);
      bg.setScale(scale).setPosition(0, 0);
    };
    resizeBg();
    this.scale.on("resize", resizeBg);

    // Fade in nhẹ
    this.cameras.main.fadeIn(600, 0, 0, 0);

    // Lấy dữ liệu level
    this.gameData = this.cache.json.get("gameData");
    this.levelData = this.gameData.levels.find((l) => l.id === level);
    this.currentQuestionIndex = 0;

    // Bảng nền
    const board = this.add.image(width / 2, height / 2, "board").setScale(0);
    this.tweens.add({
      targets: board,
      scale: 0.4,
      ease: "Back.Out",
      duration: 800,
      delay: 200,
    });

    // Nút quay lại
    const backBtn = this.add
      .image(70, 70, "btn-back")
      .setInteractive({ useHandCursor: true })
      .setScale(0.3)
      .setDepth(10);

    backBtn.on("pointerover", () =>
      this.tweens.add({ targets: backBtn, scale: 0.4, duration: 100 })
    );
    backBtn.on("pointerout", () =>
      this.tweens.add({ targets: backBtn, scale: 0.3, duration: 100 })
    );
    backBtn.on("pointerdown", () => {
      this.cameras.main.fadeOut(300, 0, 0, 0);
      this.time.delayedCall(300, () => this.scene.start("MapScene"));
    });

    // Hiển thị câu hỏi đầu tiên
    this.showQuestion();

    // Thanh tiến trình
    this.progressBg = this.add
      .rectangle(width / 2, 50, 500, 20, 0xffffff, 0.5)
      .setStrokeStyle(2, 0x000000)
      .setOrigin(0.5);
    this.progressFill = this.add
      .rectangle(width / 2 - 250, 50, 0, 20, 0xffcc00)
      .setOrigin(0, 0.5);
  }

  // Hiển thị câu hỏi
  showQuestion() {
    const { width, height } = this.scale;
    const q = this.levelData.questions[this.currentQuestionIndex];

    // Xoá nội dung cũ nếu có
    this.children.list.forEach((obj) => {
      if (obj.type === "Image" && obj.texture.key === "btn-answer")
        obj.destroy();
    });
    if (this.questionText) this.questionText.destroy();
    if (this.objectsGroup) this.objectsGroup.destroy();
    if (this.optionTexts) this.optionTexts.forEach((t) => t.destroy());

    // Câu hỏi
    this.questionText = this.add
      .text(width / 2, height / 4 - 20, q.question, {
        fontSize: "36px",
        fontFamily: "Comic Sans MS",
        color: "#000",
        align: "center",
        wordWrap: { width: width * 0.8 },
      })
      .setOrigin(0.5)
      .setAlpha(0);

    this.tweens.add({
      targets: this.questionText,
      alpha: 1,
      y: "-=15",
      duration: 600,
      ease: "Back",
    });

    // Vẽ vật thể
    this.objectsGroup = this.add.group();
    const spacing = 200;
    const startX = width / 2 - ((q.count - 1) * spacing) / 2;

    for (let i = 0; i < q.count; i++) {
      const img = this.add.image(
        startX + i * spacing,
        height / 2 - 50,
        q.object
      );
      img.setScale(0.6);
      this.objectsGroup.add(img);

      // animation nhẹ khi scene load
      this.tweens.add({
        targets: img,
        y: img.y - 20,
        ease: "Sine.inOut",
        duration: 800,
        delay: i * 100,
        yoyo: true,
        repeat: -1,
      });
    }

    // Các nút lựa chọn
    this.optionTexts = [];
    const startY = height / 2 + 160;
    const gapX = 150;
    const startXOpt = width / 2 - (q.options.length - 1) * gapX * 0.5;

    q.options.forEach((opt, i) => {
      const btn = this.add
        .image(startXOpt + i * gapX, startY, "btn-answer")
        .setScale(0.25)
        .setInteractive({ useHandCursor: true })
        .setAlpha(0);

      const txt = this.add
        .text(btn.x, btn.y, opt.label, {
          fontSize: "100px",
          fontFamily: "Comic Sans MS",
          fontStyle: "bold",
          color: "#000",
        })
        .setOrigin(0.5)
        .setAlpha(0);

      // Fade in từng nút
      this.tweens.add({
        targets: [btn, txt],
        alpha: 1,
        scale: { from: 0, to: 0.25 },
        delay: 300 + i * 100,
        duration: 400,
        ease: "Back.Out",
      });

      // Hover effect
      btn.on("pointerover", () =>
        this.tweens.add({ targets: btn, scale: 0.3, duration: 100 })
      );
      btn.on("pointerout", () =>
        this.tweens.add({ targets: btn, scale: 0.25, duration: 100 })
      );
      btn.on("pointerdown", () => this.handleAnswer(opt.isCorrect));

      this.optionTexts.push(txt);
    });
  }

  // Xử lý câu trả lời
  handleAnswer(isCorrect) {
    const { width, height } = this.scale;
    const iconKey = isCorrect ? "correct" : "wrong";

    const icon = this.add
      .image(width / 2, height / 2, iconKey)
      .setScale(0.4)
      .setAlpha(0);

    this.tweens.add({
      targets: icon,
      alpha: 1,
      scale: 0.7,
      ease: "Back.Out",
      duration: 300,
      yoyo: true,
      hold: 500,
      onComplete: () => icon.destroy(),
    });

    // Tiến trình
    const progress =
      ((this.currentQuestionIndex + 1) / this.levelData.questions.length) * 500;
    this.tweens.add({
      targets: this.progressFill,
      width: progress,
      duration: 400,
      ease: "Sine.out",
    });

    // Nếu đúng → chuyển câu tiếp theo
    if (isCorrect) {
      this.time.delayedCall(1000, () => {
        this.currentQuestionIndex++;
        if (this.currentQuestionIndex < this.levelData.questions.length) {
          this.showQuestion();
        } else {
          this.showLevelComplete();
        }
      });
    }
  }

  // HOÀN THÀNH LEVEL
  showLevelComplete() {
    const { width, height } = this.scale;
    const text = this.add
      .text(width / 2, height / 2, "🎉 Bé giỏi quá! Hoàn thành rồi!", {
        fontSize: "40px",
        fontFamily: "Comic Sans MS",
        color: "#ffb700",
      })
      .setOrigin(0.5)
      .setScale(0)
      .setAlpha(0);

    this.tweens.add({
      targets: text,
      alpha: 1,
      scale: 1,
      ease: "Bounce",
      duration: 800,
    });

    this.time.delayedCall(2500, () => {
      this.cameras.main.fadeOut(400, 0, 0, 0);
      this.time.delayedCall(400, () => this.scene.start("MapScene"));
    });
  }
}
