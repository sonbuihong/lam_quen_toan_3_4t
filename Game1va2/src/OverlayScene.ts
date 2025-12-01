// OverlayScene.ts – canvas trong suốt, BG nằm ở viewport
import { preloadIntroAssets, preloadGameAssets } from "./assetLoader";
import Phaser from "phaser";

export default class OverlayScene extends Phaser.Scene {
  bgm?: Phaser.Sound.BaseSound;
  _started?: boolean;
  private gameAssetsReady = false;

  constructor() {
    super({ key: "OverlayScene" });
  }

  preload(): void {
    const cam = this.cameras.main;
    const width = cam.width;
    const height = cam.height;

    console.log("🟦 PRELOAD start – screen:", width, height);
    preloadIntroAssets(this);
  }

  create(): void {
    (window as any).setRandomIntroViewportBg?.();

    const width = this.scale.width;
    const height = this.scale.height;

    const DESIGN_W = 2160;
    const DESIGN_H = 1620;
    const uiScale = Math.min(width / DESIGN_W, height / DESIGN_H);
    console.log("UI scale:", uiScale);

    console.log("🟦 CREATE start – screen:", width, height);
    console.log("Texture check:", {
      btn_start: this.textures.exists("btn_start"),
      intro_char_1: this.textures.exists("intro_char_1"),
      intro_char_2: this.textures.exists("intro_char_2"),
      intro_title: this.textures.exists("intro_title"),
    });

    // ===== SCALE CHO TỪNG THÀNH PHẦN (để cân bố cục) =====
    const CHAR_SCALE = uiScale * 1;       // nhân vật to hơn chút
    const TITLE_SCALE = uiScale * 1.15;     // title rõ hơn
    const BTN_SCALE = uiScale * 1.7;        // nút bắt đầu to, dễ bấm
    const BTN_SCALE_HOVER = BTN_SCALE * 1.08;

        // ========== CHARACTER – RANDOM 2 SPRITES ==========
    const charKeys = ["intro_char_1", "intro_char_2"];
    const chosenChar = Phaser.Utils.Array.GetRandom(charKeys);
    console.log("🎭 Chosen character:", chosenChar);

    // Offset riêng cho từng nhân vật (tùy bạn tinh chỉnh)
    const charOffsets: Record<string, { dx: number; dy: number }> = {
      intro_char_1: { dx: 0, dy: 0 },
      intro_char_2: { dx: width * 0.035, dy: 0 }, // lệch nhẹ sang trái 1% màn
    };
    const offset = charOffsets[chosenChar] || { dx: 0, dy: 0 };

    this.add
      .image(width * 0.5 + offset.dx, height * 0.93 + offset.dy, chosenChar)
      .setOrigin(0.5, 1)
      .setScale(uiScale * 1.2)
      .setDepth(-998)
      .setScrollFactor(0);


    // ========== TITLE TÁCH RIÊNG ==========
    const title = this.add
      .image(width * 0.5, height * 0.03, "intro_title") // hạ xuống một chút
      .setOrigin(0.5, 0)
      .setScale(TITLE_SCALE)
      .setDepth(1)
      .setScrollFactor(0);

    console.log("TITLE geom:", {
      texKey: title.texture.key,
      w: title.width,
      h: title.height,
      displayW: title.displayWidth,
      displayH: title.displayHeight,
      x: title.x,
      y: title.y,
    });

    // ========== PRELOAD GAME ASSETS NGẦM ==========
    this.load.reset();
    preloadGameAssets(this);
    this.load.once("complete", () => {
      console.log("✅ Game assets preloaded in background");
      this.gameAssetsReady = true;
    });
    this.load.start();

    // ========== MUSIC ==========
    let bgm = this.sound.get("bgm_main") as Phaser.Sound.BaseSound | null;
    if (!bgm) {
      bgm = this.sound.add("bgm_main", { loop: true, volume: 0.28 });
    }
    this.bgm = bgm;

    const startGame = () => {
      console.log("▶️ Start Game triggered");
      if (this._started) return;
      this._started = true;

      if (!this.gameAssetsReady) {
        console.log("⏳ Game assets still loading...");
        this.load.once("complete", () => {
          this.scene.start("GameScene", { level: 0 });
        });
        return;
      }

      if (this.bgm && !this.bgm.isPlaying) this.bgm.play();
      this.sound.play("voice_intro", { volume: 1 });

      this.scene.start("GameScene", { level: 0 });
    };

    // ========== START BUTTON ==========
    const startY = height * 0.8;
    console.log("Button Y position:", startY);

    const startButton = this.add
      .image(width / 2, startY, "btn_start")
      .setOrigin(0.5)
      .setScale(BTN_SCALE)
      .setDepth(2)
      .setInteractive({ useHandCursor: true });

    console.log("Button created:", {
      x: startButton.x,
      y: startButton.y,
      scale: startButton.scale,
      visible: startButton.visible,
      alpha: startButton.alpha,
    });

    startButton.on("pointerdown", startGame);

    startButton.on("pointerover", () => {
      startButton.setScale(BTN_SCALE_HOVER);
    });

    startButton.on("pointerout", () => {
      startButton.setScale(BTN_SCALE);
    });
  }
}
