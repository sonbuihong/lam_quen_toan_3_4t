let gameInstance = null;

export const initPhaserGame = async (parentId) => {
  // Nếu game đã tồn tại, không tạo lại
  if (gameInstance) return gameInstance;

  const Phaser = await import("phaser");

  const { default: IntroScene } = await import("./scenes/IntroScene.js");
  const { default: MainMenu } = await import("./scenes/MainMenu.js");
  const { default: MapScene } = await import("./scenes/MapScene.js");
  const { default: GameScene } = await import("./scenes/GameScene.js");

  gameInstance = new Phaser.Game({
    type: Phaser.AUTO,
    width: window.innerWidth,
    height: window.innerHeight,
    parent: parentId,
    backgroundColor: "#ffffff",
    scene: [IntroScene, MainMenu, MapScene, GameScene],
    scale: {
      mode: Phaser.Scale.FIT, // co giãn hợp lý theo kích thước màn hình
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    physics: {
      default: "arcade",
      arcade: {
        debug: false,
      },
    },
  });

  return gameInstance;
};
