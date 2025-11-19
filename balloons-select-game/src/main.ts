import Phaser from "phaser";
import GameScene from "./scenes/GameScene";
import NextScene from "./scenes/NextSence";
import { EndScene } from "./scenes/EndScene";

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 1280,
  height: 720,
  backgroundColor: "#000000",
  scene: [GameScene, NextScene, EndScene],
};

new Phaser.Game(config);
