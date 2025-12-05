let gameInstance = null;

export const initPhaserGame = async (parentId) => {
  if (gameInstance) return gameInstance;

  const Phaser = await import("phaser");

  const { default: IntroScene } = await import("./scenes/IntroScene.js");
  const { default: MainMenu } = await import("./scenes/MainMenu.js");
  const { default: MapScene } = await import("./scenes/MapScene.js");
  const { default: GameScene } = await import("./scenes/GameScene.js");

  const config = {
    type: Phaser.AUTO,
    parent: parentId,
    backgroundColor: "#000000",
    width: 1280,
    height: 720,
    scene: [IntroScene, MainMenu, MapScene, GameScene],
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: 1280,
      height: 720,
    },
    render: {
      antialias: true,
      pixelArt: false,
    },
    physics: {
      default: "arcade",
      arcade: { gravity: { y: 0 }, debug: false },
    },
    dom: { createContainer: true },
  };

  gameInstance = new Phaser.Game(config);

  // Thêm đoạn xử lý xoay màn hình
  handleOrientation();

  window.addEventListener("orientationchange", handleOrientation);
  window.addEventListener("resize", handleOrientation);

  return gameInstance;
};

// Hàm xử lý hướng màn hình
function handleOrientation() {
  const isLandscape = window.innerWidth > window.innerHeight;

  let overlay = document.getElementById("rotate-overlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "rotate-overlay";
    Object.assign(overlay.style, {
      position: "fixed",
      inset: 0,
      background: "#000",
      color: "#fff",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: "1.5rem",
      textAlign: "center",
      zIndex: 9999,
    });
    overlay.textContent = "Vui lòng xoay ngang để chơi game 🎮";
    document.body.appendChild(overlay);
  }

  // Ẩn/hiện overlay
  overlay.style.display = isLandscape ? "none" : "flex";
}
