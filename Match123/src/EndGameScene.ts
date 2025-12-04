import Phaser from "phaser";

export default class EndGameScene extends Phaser.Scene {
  // private bgm?: Phaser.Sound.BaseSound;
  constructor() {
    super({ key: "EndGameScene" });
  }
  
  preload(): void {
    // Tất cả asset (bg_end1/2, replay_endgame, exit_endgame, bgm, voice_end)
    // đã được load trong preloadGameAssets ở assetLoader.ts
  }

  create(): void {
	// Ẩn nút viewport ở màn endgame
    (window as any).setGameButtonsVisible?.(false);

    // Random background viewport cho màn endgame (ngoài canvas)
    (window as any).setRandomEndViewportBg?.();

    const cam = this.cameras.main;
    const width = cam.width;
    const height = cam.height;

    // KHÔNG setBackgroundColor để canvas giữ trong suốt
    // cam.setBackgroundColor("#ffffff");

    // Nhạc nền
    let bgm = this.sound.get("bgm_main");
    if (!bgm) {
      bgm = this.sound.add("bgm_main", { loop: true, volume: 0.28 });
      bgm.play();
    } else if (!bgm.isPlaying) {
      bgm.play();
    }
    // this.bgm = bgm;

    // Voice kết thúc
    if (this.sound && this.sound.play) {
      this.sound.play("voice_end", { volume: 1 });
    }

    // Panel endgame (bg_end1 / bg_end2) vẽ trong canvas
    const BG_KEYS = ["bg_end1", "bg_end2"];
    const chosenBG = Phaser.Utils.Array.GetRandom(BG_KEYS);

    // const DESIGN_W = 2160;
    // const DESIGN_H = 1620;
    // const SAFE_TOP = 230;
    // const SAFE_BOTTOM = 260;

    // const AOI_TOP = SAFE_TOP;
    // const AOI_BOTTOM = DESIGN_H - SAFE_BOTTOM;
    // const AOI_CENTER = (AOI_TOP + AOI_BOTTOM) / 2;

    // const scaleBG = Math.max(width / DESIGN_W, height / DESIGN_H);

    // const bg = this.add
    //   .image(width / 2, 0, chosenBG)
    //   .setOrigin(0.5, 0)
    //   .setScale(scaleBG);

    // const AOI_center_scaled = AOI_CENTER * scaleBG;
    // const screenCenterY = height / 2;
    // bg.y = screenCenterY - AOI_center_scaled;
	    const DESIGN_W = 2160;
    const DESIGN_H = 1620;

    // Thu nhỏ panel để luôn nằm trọn trong canvas, căn giữa
    const panelMaxW = width * 1.2;
    const panelMaxH = height * 1.2;

    const scaleBG = Math.min(panelMaxW / DESIGN_W, panelMaxH / DESIGN_H);

    const bg = this.add
      .image(width / 2, height / 2 - height * 0.04, chosenBG)
      .setOrigin(0.5, 0.5)
      .setScale(scaleBG);


    const bottomOfPanelY = bg.getBottomCenter().y;
    const BTN_FROM_BOTTOM_RATIO = 0.18;
    const btnY = bottomOfPanelY - bg.displayHeight * BTN_FROM_BOTTOM_RATIO;

    const BTN_OFFSET_X_RATIO = 0.12;
    const btnOffsetX = bg.displayWidth * BTN_OFFSET_X_RATIO;

    // Nút replay – asset "replay_endgame"
    const replayBtn = this.add
      .image(cam.centerX - btnOffsetX, btnY, "replay_endgame")
      .setOrigin(0.5)
      .setScale(0.75 * scaleBG)
      .setInteractive({ useHandCursor: true });

    replayBtn.on("pointerdown", () => {
      this.scene.start("GameScene", { level: 0 });
    });

    // Nút exit – asset "exit_endgame"
    const exitBtn = this.add
      .image(cam.centerX + btnOffsetX, btnY, "exit_endgame")
      .setOrigin(0.5)
      .setScale(0.75 * scaleBG)
      .setInteractive({ useHandCursor: true });

    exitBtn.on("pointerdown", () => {
      const bgmNow = this.sound.get("bgm_main");
      if (bgmNow && bgmNow.isPlaying) {
        bgmNow.stop();
      }
      this.scene.start("OverlayScene");
    });
  }
}
