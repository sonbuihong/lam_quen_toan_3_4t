import BaseScene from './BaseScene';

export default class EndGameScene extends BaseScene {
  constructor() {
    super('EndGameScene');
  }

  create() {
    const { width, height } = this.scale;

    // Ẩn hai nút HTML viewport ở màn kết thúc
    if ((window as any).setGameButtonsVisible) {
      (window as any).setGameButtonsVisible(false);
    }

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
    try {
      this.sound.play('voice_end');
    } catch (e) {
      console.warn('[CompareGame] Không phát được voice_end:', e);
    }

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
      .image(width / 2 + gapX, buttonsY, 'next_end')
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
