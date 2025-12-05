import * as Phaser from "phaser";

export default class MainMenu extends Phaser.Scene {
  constructor() {
    super("MainMenu");
  }

  preload() {
    this.load.image("bg", "assets/background/background-menu.png");
    this.load.image("btnPlay", "assets/button/btn-play.png");
    this.load.image("btnStar", "assets/button/btn-star.png");
    this.load.image("btnMenu", "assets/button/btn-menu.png");
    this.load.image("btnSound", "assets/button/btn-sound.png");
    this.load.image("btnInfo", "assets/button/btn-info.png");
    this.load.image("btnTrophy", "assets/button/btn-trophy.png");

    this.load.audio("click-sound", "assets/sounds/click.wav");
  }

  create() {
    const { width, height } = this.scale;

    // Nền
    this.add.image(width / 2, height / 2, "bg").setDisplaySize(width, height);

    // Nút Play (ở giữa)
    const playBtn = this.add
      .image(width / 2, height / 2, "btnPlay")
      .setInteractive({ useHandCursor: true })
      .setScale(1);

    playBtn.setScale(0.2);

    // Hiệu ứng nhịp đập (tự động phóng to - thu nhỏ liên tục)
    this.tweens.add({
      targets: playBtn,
      scale: { from: 0.2, to: 0.22 }, // phóng to nhẹ 10%
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    // Khi hover chuột: phóng to nhanh hơn một chút
    // playBtn.on('pointerover', () => {
    //     this.tweens.add({
    //         targets: playBtn,
    //         scale: 0.25,
    //         duration: 150,
    //         ease: 'Back.Out'
    //     });
    // });

    // Khi rời chuột: thu nhỏ lại về kích thước gốc
    // playBtn.on('pointerout', () => {
    //     this.tweens.add({
    //         targets: playBtn,
    //         scale: 0.2,
    //         duration: 150,
    //         ease: 'Back.In'
    //     });
    // });

    // Khi nhấn nút: chuyển sang MapScene
    playBtn.on("pointerdown", () => {
      this.sound.play("click-sound");
      this.tweens.add({
        targets: playBtn,
        scale: 0.18,
        duration: 100,
        yoyo: true,
        onComplete: () => {
          this.scene.start("MapScene");
        },
      });
    });

    // Menu icon bên trái
    // Danh sách icon (thêm btnSoundOff nếu bạn có sẵn ảnh)
    const icons = [
      { key: "btnStar", y: 140 },
      { key: "btnMenu", y: 230 },
      { key: "btnSound", y: 320 },
      { key: "btnInfo", y: 410 },
      { key: "btnTrophy", y: 500 },
    ];

    // Biến cục bộ giữ nút âm thanh
    let soundBtn = null;

    icons.forEach((icon) => {
      const btn = this.add
        .image(80, icon.y, icon.key)
        .setInteractive({ useHandCursor: true })
        .setScale(0.3);

      // Hiệu ứng hover
      btn.on("pointerover", () =>
        this.tweens.add({ targets: btn, scale: 0.4, duration: 100 })
      );
      btn.on("pointerout", () =>
        this.tweens.add({ targets: btn, scale: 0.3, duration: 100 })
      );

      // Nếu là nút âm thanh
      if (icon.key === "btnSound") {
        soundBtn = btn;

        btn.on("pointerdown", () => {
          // Chuyển trạng thái bật/tắt âm
          this.game.sound.mute = !this.game.sound.mute;

          // Nếu vừa bật lại thì phát click, nếu tắt thì im lặng
          if (!this.game.sound.mute) {
            this.sound.play("click-sound");
          }

          console.log(
            `Âm thanh hiện đang ${this.game.sound.mute ? "TẮT" : "BẬT"}`
          );
        });
      } else {
        // Các nút còn lại: chỉ phát âm click + log
        btn.on("pointerdown", () => {
          if (!this.game.sound.mute) this.sound.play("click-sound");
          console.log(`${icon.key} clicked`);
        });
      }
    });
  }
}
