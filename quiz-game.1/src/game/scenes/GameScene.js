import * as Phaser from "phaser";
import { speakWithFPT } from "../../utils/fptVoice.js";

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
    this.load.image("correct", "assets/images/correct.png");
    this.load.image("wrong", "assets/images/wrong.png");
    this.load.image("level-complete", "assets/images/level-complete.png");

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

    this.load.audio("click-sound", "assets/sounds/click.wav");
    this.load.audio("sound-correct", "assets/sounds/correct.wav");
    this.load.audio("sound-wrong", "assets/sounds/wrong.wav");
    this.load.audio("done", "assets/sounds/done.wav");
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
      this.sound.play("click-sound");
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

    // Nếu đang có tween hoặc phần tử cũ thì xoá/fade-out trước
    if (this.currentTweens && Array.isArray(this.currentTweens)) {
      this.currentTweens.forEach((tw) => tw.stop && tw.stop());
    }
    this.currentTweens = [];

    const oldElements = [];

    if (this.questionText) oldElements.push(this.questionText);
    if (
      this.objectsGroup &&
      this.objectsGroup.scene &&
      this.objectsGroup.active &&
      typeof this.objectsGroup.getChildren === "function"
    ) {
      oldElements.push(...this.objectsGroup.getChildren());
    }
    if (this.optionButtons && Array.isArray(this.optionButtons))
      oldElements.push(...this.optionButtons);
    if (this.optionTexts && Array.isArray(this.optionTexts))
      oldElements.push(...this.optionTexts);

    // Fade out rồi destroy — và sau đó mới tạo câu mới
    if (oldElements.length > 0) {
      this.tweens.add({
        targets: oldElements,
        alpha: 0,
        y: "+=30",
        duration: 300,
        ease: "Sine.easeIn",
        onComplete: () => {
          oldElements.forEach((el) => el?.destroy && el.destroy());
          this.questionText = null;
          this.objectsGroup = null;
          this.optionButtons = [];
          this.optionTexts = [];

          // Tạo câu hỏi mới sau khi phần cũ xoá xong
          this._renderQuestion(q, width, height);
        },
      });
    } else {
      this._renderQuestion(q, width, height);
    }
  }

  _renderQuestion(q, width, height) {
    speakWithFPT(q.question);
    // Câu hỏi
    this.questionText = this.add
      .text(width / 2, height / 4, q.question, {
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

    // Hiển thị vật thể
    this.objectsGroup = this.add.group();
    const spacing = 150;
    const startX = width / 2 - ((q.count - 1) * spacing) / 2;

    for (let i = 0; i < q.count; i++) {
      const img = this.add.image(
        startX + i * spacing,
        height / 2 - 50,
        q.object
      );
      img.setScale(0.3);
      this.objectsGroup.add(img);

      // Animation nhẹ khi load câu hỏi
      const tw = this.tweens.add({
        targets: img,
        y: img.y - 20,
        ease: "Sine.inOut",
        duration: 800,
        delay: i * 100,
        yoyo: true,
        repeat: -1,
      });
      this.currentTweens.push(tw);
    }

    // Tạo nút chọn đáp án
    this.optionButtons = [];
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

      this.tweens.add({
        targets: [btn, txt],
        alpha: 1,
        scale: { from: 0, to: 0.25 },
        delay: 300 + i * 100,
        duration: 400,
        ease: "Back.Out",
      });

      btn.on("pointerover", () =>
        this.tweens.add({ targets: btn, scale: 0.3, duration: 100 })
      );
      btn.on("pointerout", () =>
        this.tweens.add({ targets: btn, scale: 0.25, duration: 100 })
      );
      btn.on("pointerdown", () => {
        this.handleAnswer(opt.isCorrect);
        this.sound.play("click-sound");
      });

      this.optionButtons.push(btn);
      this.optionTexts.push(txt);
    });
  }

  // Xử lý câu trả lời
  handleAnswer(isCorrect) {
    const { width, height } = this.scale;
    const iconKey = isCorrect ? "correct" : "wrong";

    // Hiện icon đúng / sai
    const icon = this.add
      .image(width / 2, height / 2, iconKey)
      .setScale(0.4)
      .setAlpha(0);

    this.tweens.add({
      targets: icon,
      alpha: 1,
      scale: 0.4,
      ease: "Back.Out",
      duration: 300,
      yoyo: true,
      hold: 500,
      onComplete: () => icon.destroy(),
    });

    if (isCorrect) {
      speakWithFPT("Giỏi quá! Chính xác rồi!");
      // Phát âm thanh đúng (nếu chưa mute)
      if (!this.game.sound.mute)
        this.sound.play("sound-correct", { volume: 0.8 });

      // Cập nhật tiến trình (sau khi đúng)
      const progress =
        ((this.currentQuestionIndex + 1) / this.levelData.questions.length) *
        500;

      this.tweens.add({
        targets: this.progressFill,
        width: progress,
        duration: 500,
        ease: "Sine.out",
      });

      // Chuyển câu sau 1s
      this.time.delayedCall(3000, () => {
        this.currentQuestionIndex++;
        if (this.currentQuestionIndex < this.levelData.questions.length) {
          this.showQuestion();
        } else {
          this.showLevelComplete();
        }
      });
    } else {
      speakWithFPT("Sai rồi, thử lại nhé!");
      // Âm thanh sai
      if (!this.game.sound.mute)
        this.sound.play("sound-wrong", { volume: 0.8 });

      // Nếu sai → thêm hiệu ứng rung (shake)
      this.tweens.add({
        targets: this.questionContainer,
        x: "+=10",
        yoyo: true,
        repeat: 3,
        duration: 80,
      });
    }
  }

  // Hoàn thành Level
  showLevelComplete() {
    const { width, height } = this.scale;
    this.sound.play("done", { volume: 0.8 });
    // Ảnh chúc mừng hoàn thành
    const completeIcon = this.add
      .image(width / 2, height / 2, "level-complete")
      .setScale(0)
      .setAlpha(0);

    // Animation hiển thị ảnh
    this.tweens.add({
      targets: completeIcon,
      alpha: 1,
      scale: 0.4,
      ease: "Back.Out",
      duration: 800,
    });
    speakWithFPT("Chúc mừng bé đã hoàn thành thử thách");
    // Sau vài giây thì trở về MapScene
    this.time.delayedCall(2500, () => {
      this.cameras.main.fadeOut(400, 0, 0, 0);
      this.time.delayedCall(400, () => this.scene.start("MapScene"));
    });
  }
}
