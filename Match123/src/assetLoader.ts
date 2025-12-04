import Phaser from "phaser";

// Các URL gốc cho nút UI – dùng chung cho preload và HTML button
export const BUTTON_ASSET_URLS = {
  replay_svg: "assets/button/replay.png",
  next_svg: "assets/button/next.png",
};

// Chỉ load những asset cần cho màn intro
export function preloadIntroAssets(scene: Phaser.Scene): void {
  // AUDIO: chỉ cần nhạc nền + voice_intro
  scene.load.audio("voice_intro", "assets/audio/voice_intro.ogg");
  scene.load.audio("bgm_main", "assets/audio/bgm_main.ogg");

  // BG intro
  scene.load.image("intro_bg_1", "assets/intro/bge1.webp");
  scene.load.image("intro_bg_2", "assets/intro/bge2.webp");
  scene.load.image("intro_bg_3", "assets/intro/bge3.webp");

  // CHARACTER & TITLE intro – rất quan trọng
  scene.load.image("intro_char_1", "assets/intro/char1.webp");
  scene.load.image("intro_char_2", "assets/intro/char_intro2.webp");
  scene.load.image("intro_title", "assets/intro/title.webp");

  // Nút start
  scene.load.image("btn_start", "assets/button/btn_start.webp");
}


// Load toàn bộ asset dùng trong game (GameScene + EndGameScene)
export function preloadGameAssets(scene: Phaser.Scene): void {
  // --- AUDIO ---
  scene.load.audio("voice_intro", "assets/audio/voice_intro.ogg");
  scene.load.audio("voice_complete", "assets/audio/voice_complete.ogg");
  scene.load.audio("voice_need_finish", "assets/audio/voice_need_finish.ogg");
  scene.load.audio("sfx_correct", "assets/audio/sfx_correct.ogg");
  scene.load.audio("sfx_wrong", "assets/audio/sfx_wrong.ogg");
  scene.load.audio("bgm_main", "assets/audio/bgm_main.ogg");
  scene.load.audio("voice_end", "assets/audio/voice_end.ogg");
  scene.load.audio("voice_rotate", "assets/audio/xoay.ogg");

  // --- BACKGROUND ---
  scene.load.image("bg1", "assets/bg/bg1.webp");
  scene.load.image("bg2", "assets/bg/bg2.webp");
  scene.load.image("bg3", "assets/bg/bg3.webp");

  // --- CHARACTERS ---
  scene.load.image("char", "assets/char/char.webp");
  // dùng lại cho OverlayScene nếu quay lại intro
  scene.load.image("intro_char_1", "assets/intro/char1.webp");
  scene.load.image("intro_title", "assets/intro/title.webp");

  // --- BUTTONS ---
  scene.load.image("btn_start", "assets/button/btn_start.webp");
  scene.load.image("replay_endgame", "assets/button/replay_endgame.webp");
  scene.load.image("replay_svg", BUTTON_ASSET_URLS.replay_svg);
  scene.load.image("next_svg", BUTTON_ASSET_URLS.next_svg);
  scene.load.image("exit_endgame", "assets/button/exit.webp");

  // --- CARDS ---
  scene.load.image("card", "assets/card/card.webp");
  scene.load.image("card2", "assets/card/card2.webp");
  scene.load.image("card_yellow", "assets/card/card_yellow.webp");
  scene.load.image("card_yellow2", "assets/card/card_yellow2.webp");
  scene.load.image("card_glow", "assets/card/card_glow.webp");
  scene.load.image("line_glow", "assets/card/line_glow.webp");
  scene.load.image("board", "assets/card/board.webp");

  // --- ICONS ---
  scene.load.image("spoon", "assets/icon/spoon.webp");
  scene.load.image("bowl", "assets/icon/bowl.webp");
  scene.load.image("lamp", "assets/icon/lamp.webp");
  scene.load.image("clock", "assets/icon/clock.webp");
  scene.load.image("hand", "assets/icon/hand.webp");
;

  // --- BG END ---
  scene.load.image("bg_end1", "assets/bg_end/bg_end1.webp");
  scene.load.image("bg_end2", "assets/bg_end/bg_end2.webp");

}

// Giữ hàm cũ cho tương thích, nếu đâu đó vẫn gọi preloadAssets
export function preloadAssets(scene: Phaser.Scene): void {
  preloadGameAssets(scene);
}
