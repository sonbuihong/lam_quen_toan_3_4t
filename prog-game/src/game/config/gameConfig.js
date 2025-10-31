import * as Phaser from "phaser";
import IntroScene from "../scenes/IntroScene";
import MainMenuScene from "../scenes/MainMenuScene";
import MapScene from "../scenes/MapScene";
import MapSceneInfinite from "../scenes/MapSceneInfinite";
import WinScene from "../scenes/WinScene";

const GameConfig = {
  type: Phaser.AUTO,
  width: 1280,
  height: 720,
  parent: "game-container",
  backgroundColor: "#87CEEB",
  physics: {
    default: "arcade",
    arcade: { gravity: { y: 800 }, debug: false },
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    orientation: Phaser.Scale.LANDSCAPE,
  },
  scene: [IntroScene, MainMenuScene, MapScene, MapSceneInfinite, WinScene],
};

export default GameConfig;
