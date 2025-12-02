import Phaser from 'phaser';

export default class BaseScene extends Phaser.Scene {
  constructor(key: string) {
    super(key);
  }

  protected createFullScreenBg(textureKey: string) {
    const { width, height } = this.scale;
    const bg = this.add.image(0, 0, textureKey).setOrigin(0, 0);

    const scaleX = width / bg.width;
    const scaleY = height / bg.height;
    const scale = Math.max(scaleX, scaleY);

    bg.setScale(scale);
    bg.setScrollFactor(0);

    return bg;
  }

  protected createButton(
    x: number,
    y: number,
    label: string,
    onClick: () => void
  ) {
    const btn = this.add
      .image(x, y, 'btn_primary')
      .setInteractive({ useHandCursor: true });

    const text = this.add
      .text(x, y, label, {
        fontSize: '24px',
        color: '#ffffff',
      })
      .setOrigin(0.5);

    btn.on('pointerdown', () => {
      btn.setTexture('btn_primary_pressed');
      (window as any).playVoiceLocked(this.sound, 'sfx_click');
    });

    btn.on('pointerup', () => {
      btn.setTexture('btn_primary');
      onClick();
    });

    btn.on('pointerout', () => {
      btn.setTexture('btn_primary');
    });

    return { btn, text };
  }
}
