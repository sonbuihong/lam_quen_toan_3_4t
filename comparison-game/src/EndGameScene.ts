import BaseScene from './BaseScene';

export default class EndGameScene extends BaseScene {
  private score = 0;
  private total = 0;

  constructor() {
    super('EndGameScene');
  }

  init(data: { score: number; total: number }) {
    this.score = data.score;
    this.total = data.total;
  }

  create() {
    const { width, height } = this.scale;

    // === chỉnh bg dịch lên trên ===
    const bg = this.createFullScreenBg('bg_end');
    bg.y -= 80; // chỉnh số tùy ý: 40 / 60 / 100

    // Tính scale tương đối theo kích thước màn hình
    const baseSize = Math.min(width, height);
    const targetIconHeight = baseSize * 0.32; 
    const targetBtnSize = baseSize * 0.11;

    // Icon ở phía trên
    const icon = this.add
      .image(width / 2, height / 2 - 60, 'icon')
      .setOrigin(0.5);

    if (icon.height > 0) {
      const iconScale = targetIconHeight / icon.height;
      icon.setScale(iconScale);
    }

    this.tweens.add({
      targets: icon,
      y: icon.y - 20,
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut',
    });

    // Hai nút hình: chơi lại & thoát
    const buttonsY = height - targetBtnSize * 2.2;
    const gapX = targetBtnSize * 1.2;

    // Nút chơi lại
    const replayBtn = this.add
      .image(width / 2 - gapX, buttonsY, 'btn_replay')
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    replayBtn.setDisplaySize(targetBtnSize, targetBtnSize);

    replayBtn.on('pointerdown', () => {
      this.scene.start('GameScene', { levelIndex: 0, score: 0 });
    });

    // Nút thoát (X)
    const exitBtn = this.add
      .image(width / 2 + gapX, buttonsY, 'answer_wrong')
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    exitBtn.setDisplaySize(targetBtnSize * 0.95, targetBtnSize * 0.95);

    exitBtn.on('pointerdown', () => {
      const w = window as any;
      if (typeof w.closeGame === 'function') {
        w.closeGame();
      } else {
        window.location.reload();
      }
    });
  }
}
