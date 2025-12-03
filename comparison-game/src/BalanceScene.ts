import Phaser from 'phaser';
import type GameScene from './GameScene';



type Subject = 'BALLOON' | 'FLOWER';

const GIRL_TEXTURE: Record<Subject, string> = {
  BALLOON: 'girl_balloon',
  FLOWER: 'girl_flower',
};

const BOY_TEXTURE: Record<Subject, string> = {
  BALLOON: 'boy_balloon',
  FLOWER: 'boy_flower',
};

// asset sau khi đã thêm bóng/hoa (nếu chưa có, sẽ fallback về asset thường)
const GIRL_UPGRADE_TEXTURE: Record<Subject, string> = {
  BALLOON: 'girl_balloon_plus',
  FLOWER: 'girl_flower_plus',
};

const BOY_UPGRADE_TEXTURE: Record<Subject, string> = {
  BALLOON: 'boy_balloon_plus',
  FLOWER: 'boy_flower_plus',
};

const HAND_OFFSET: Record<Subject, { x: number; y: number }> = {
  BALLOON: { x: 55, y: -80 },
  FLOWER: { x: 40, y: -40 },
};

const UPGRADE_OFFSET: Record<Subject, { x: number; y: number }> = {
  BALLOON: { x: 50, y: 0 },
  FLOWER: { x: 0, y: 0 },
};

type BalanceInitData = {
  leftCount: number;
  rightCount: number;
  subject: Subject;
  // nhân vật ở màn chính đang cầm ÍT đồ hơn (để biết ai cần được thêm bóng/hoa)
  lessCharacter: 'GIRL' | 'BOY';
};

export default class BalanceScene extends Phaser.Scene {
  private subject: Subject = 'BALLOON';

  // layout
  private panelLeftX = 240;
  private actorY = 450;

  private leftActorCenterX = 640;
  private rightActorCenterX = 1030;

  private objectScale = 0.3;

  private girlBase!: Phaser.GameObjects.Image;
  private girlUpgraded!: Phaser.GameObjects.Image;
  private boyBase!: Phaser.GameObjects.Image;
  private boyUpgraded!: Phaser.GameObjects.Image;

  private girlSide: 'LEFT' | 'RIGHT' = 'LEFT';
  private boySide: 'LEFT' | 'RIGHT' = 'RIGHT';
  private upgradeCharacter: 'GIRL' | 'BOY' = 'GIRL';

  constructor() {
    super('BalanceScene');
  }

  init(data: BalanceInitData) {
    this.subject = data.subject ?? 'BALLOON';
    this.upgradeCharacter = data.lessCharacter ?? 'GIRL';
  }

  create() {
    const { width } = this.scale;

    this.scene.bringToTop();

    if ((window as any).setGameButtonsVisible) {
      (window as any).setGameButtonsVisible(true);
    }

    // Banner
    const bannerY = 80;
    const banner = this.add
      .image(width / 2, bannerY, 'btn_primary_pressed')
      .setOrigin(0.5);
    const bannerBaseScaleY = 0.65;
    banner.setScale(bannerBaseScaleY);

    const bannerText =
      this.subject === 'BALLOON'
        ? 'THÊM BÓNG BAY CHO HAI BẠN BẰNG NHAU NHÉ!'
        : 'THÊM BÔNG HOA CHO HAI LỌ BẰNG NHAU NHÉ!';

    const titleText = this.add
      .text(width / 2, bannerY, bannerText, {
        fontFamily: 'San Francisco, "Noto Sans", system-ui, sans-serif',
        fontSize: '30px',
        fontStyle: '700',
        color: '#FFFFFF',
        align: 'center',
      })
      .setOrigin(0.5);

    // Tự động kéo dài banner để ôm trọn text
    const textWidth = titleText.width;
    const baseBannerWidth = banner.width;
    const padding = 200; // tăng khoảng dư hai bên cho thoải mái hơn
    const minBannerWidth = 800;
    const desiredWidth = Math.max(minBannerWidth, textWidth + padding);
    const scaleX = desiredWidth / baseBannerWidth;
    banner.setScale(scaleX, bannerBaseScaleY);

    // Panel trái
    const leftPanelX = 80;
    const leftPanelY = 160;
    const leftPanelWidth = 320;
    const leftPanelHeight = 500;

    const leftCenterOffsetX = 8;
    const leftCenterOffsetY = -10;

    const leftPanelCenterX =
      leftPanelX + leftPanelWidth / 2 + leftCenterOffsetX;
    this.panelLeftX = leftPanelCenterX;

    const leftPanel = this.add.graphics();
    leftPanel.fillStyle(0xffffff, 1);
    leftPanel.fillRoundedRect(
      leftPanelX,
      leftPanelY,
      leftPanelWidth,
      leftPanelHeight,
      30
    );

    // Panel nhân vật
    const actorPanelX = 450;
    const actorPanelY = 160;
    const actorPanelWidth = 760;
    const actorPanelHeight = 500;

    const actorPanel = this.add.graphics();
    actorPanel.fillStyle(0xffffff, 1);
    actorPanel.fillRoundedRect(
      actorPanelX,
      actorPanelY,
      actorPanelWidth,
      actorPanelHeight,
      30
    );

    // tâm hai nửa + tâm dọc panel
    const actorPanelCenterY = actorPanelY + actorPanelHeight / 2;
    this.leftActorCenterX = actorPanelX + actorPanelWidth * 0.25;
    this.rightActorCenterX = actorPanelX + actorPanelWidth * 0.75;

    this.actorY = actorPanelCenterY + 20;

    // Random vị trí nhân vật nhận kéo: cô bé / cậu bé trái-phải
    this.girlSide = Math.random() < 0.5 ? 'LEFT' : 'RIGHT';
    this.boySide = this.girlSide === 'LEFT' ? 'RIGHT' : 'LEFT';

    // ===== Nhân vật base & upgraded (cùng tâm) =====
    const girlBaseKey = GIRL_TEXTURE[this.subject];
    const boyBaseKey = BOY_TEXTURE[this.subject];

    const girlTex = this.textures.get(girlBaseKey).getSourceImage() as
      | HTMLImageElement
      | HTMLCanvasElement;
    const boyTex = this.textures.get(boyBaseKey).getSourceImage() as
      | HTMLImageElement
      | HTMLCanvasElement;

    const maxCharHeight = actorPanelHeight * 0.8;
    const maxCharWidth = actorPanelWidth * 0.3;

    // Tính scale cho từng ảnh rồi lấy scale chung nhỏ nhất
    const girlScaleRaw = Math.min(
      maxCharHeight / girlTex.height,
      maxCharWidth / girlTex.width
    );
    const boyScaleRaw = Math.min(
      maxCharHeight / boyTex.height,
      maxCharWidth / boyTex.width
    );
    const charScale = Math.min(girlScaleRaw, boyScaleRaw);
    const girlScale = charScale;
    const boyScale = charScale;

    const girlUpKeyCandidate = GIRL_UPGRADE_TEXTURE[this.subject];
    const boyUpKeyCandidate = BOY_UPGRADE_TEXTURE[this.subject];

    const girlUpgradeKey = this.textures.exists(girlUpKeyCandidate)
      ? girlUpKeyCandidate
      : girlBaseKey;
    const boyUpgradeKey = this.textures.exists(boyUpKeyCandidate)
      ? boyUpKeyCandidate
      : boyBaseKey;

    const upgradeOffset = UPGRADE_OFFSET[this.subject];

    // Girl – base & upgraded luôn cùng (x,y), origin 0.5 nên ở đúng giữa nửa panel
    const girlX =
      this.girlSide === 'LEFT'
        ? this.leftActorCenterX
        : this.rightActorCenterX;

    this.girlBase = this.add
      .image(girlX, this.actorY, girlBaseKey)
      .setOrigin(0.5, 0.5)
      .setScale(girlScale);
    this.girlUpgraded = this.add
      .image(
        girlX + upgradeOffset.x,
        this.actorY + upgradeOffset.y,
        girlUpgradeKey
      )
      .setOrigin(0.5, 0.5)
      .setScale(girlScale)
      .setAlpha(0);

    // Boy – base & upgraded cũng cùng (x,y)
    const boyX =
      this.boySide === 'LEFT'
        ? this.leftActorCenterX
        : this.rightActorCenterX;

    this.boyBase = this.add
      .image(boyX, this.actorY, boyBaseKey)
      .setOrigin(0.5, 0.5)
      .setScale(boyScale);
    this.boyUpgraded = this.add
      .image(
        boyX + upgradeOffset.x,
        this.actorY + upgradeOffset.y,
        boyUpgradeKey
      )
      .setOrigin(0.5, 0.5)
      .setScale(boyScale)
      .setAlpha(0);

    // ===== Scale chung cho bóng/hoa =====
    const objectTextureKey = this.subject === 'BALLOON' ? 'balloon' : 'flower';
    const tex = this.textures.get(objectTextureKey).getSourceImage() as
      | HTMLImageElement
      | HTMLCanvasElement;
    const texW = tex.width;
    const texH = tex.height;

    const targetBalloonHeight = girlTex.height * girlScale * 0.7;
    const scaleFromChar = targetBalloonHeight / texH;

    const maxLeftWidth = leftPanelWidth * 0.45;
    const maxLeftHeight = leftPanelHeight * 0.5;
    const scaleFromPanel = Math.min(maxLeftWidth / texW, maxLeftHeight / texH);

    this.objectScale = Math.min(scaleFromChar, scaleFromPanel);

    // Bên nào sẽ nhận thêm bóng/hoa? – dựa theo nhân vật ít đồ hơn ở màn chính
    const upgradeSide: 'LEFT' | 'RIGHT' =
      this.upgradeCharacter === 'GIRL' ? this.girlSide : this.boySide;

    // ===== BÓNG/HOA KÉO Ở PANEL TRÁI =====
    // asset kéo luôn xuất phát ở đúng tâm panel trái
    const startX = this.panelLeftX;
    const centerY = leftPanelY + leftPanelHeight / 2 + leftCenterOffsetY;
    const startY = centerY;

    const draggable = this.add
      .image(startX, startY, objectTextureKey)
      .setScale(this.objectScale)
      .setInteractive({ draggable: true });

    const idleTween = this.tweens.add({
      targets: draggable,
      y: startY - 15,
      angle: -3,
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut',
    });

    this.input.setDraggable(draggable);

    draggable.on('dragstart', () => {
      idleTween.stop();
      draggable.setAngle(0);
    });

    draggable.on('drag', (_: Phaser.Input.Pointer, x: number, y: number) => {
      draggable.x = x;
      draggable.y = y;
    });

    // vùng valid quanh tay / bình hoa
    const handOffset = HAND_OFFSET[this.subject];

    const targetActorCenterX =
      upgradeSide === 'LEFT' ? this.leftActorCenterX : this.rightActorCenterX;
    const targetX = targetActorCenterX + handOffset.x;
    const targetY = this.actorY + handOffset.y;

    draggable.on('dragend', () => {
      const dist = Phaser.Math.Distance.Between(
        draggable.x,
        draggable.y,
        targetX,
        targetY
      );

      if (dist < 180) {
        draggable.disableInteractive();

        idleTween.stop();

        this.tweens.add({
          targets: draggable,
          alpha: 0,
          duration: 220,
          onComplete: () => draggable.destroy(),
        });

        const baseSprite =
          this.upgradeCharacter === 'GIRL' ? this.girlBase : this.boyBase;
        const upgradedSprite =
          this.upgradeCharacter === 'GIRL'
            ? this.girlUpgraded
            : this.boyUpgraded;

        const upgradedCenterX =
          upgradeSide === 'LEFT'
            ? this.leftActorCenterX
            : this.rightActorCenterX;

        upgradedSprite.setPosition(
          upgradedCenterX + upgradeOffset.x,
          this.actorY + upgradeOffset.y
        );

        this.tweens.add({
          targets: baseSprite,
          alpha: 0,
          duration: 220,
        });

        this.tweens.add({
          targets: upgradedSprite,
          alpha: 1,
          duration: 220,
          delay: 80,
          onComplete: () => {
            (window as any).playVoiceLocked(this.sound, 'voice_complete');

            const gameScene = this.scene.get('GameScene') as GameScene | null;
            if (gameScene) {
              gameScene.subgameDone = true;
            }
          },
        });
      } else {
        // trả lại đúng tâm panel trái khi kéo sai
        draggable.x = startX;
        draggable.y = startY;
        draggable.setAngle(0);
        idleTween.restart();
      }
    });

    const dragKey =
      this.subject === 'BALLOON' ? 'drag_balloon' : 'drag_flower';
    (window as any).playVoiceLocked(this.sound, dragKey);
  }
}
