import { useEffect } from "react";
import * as Phaser from "phaser";
import GameConfig from "../game/config/gameConfig";

export default function GameCanvas() {
  useEffect(() => {
    const game = new Phaser.Game(GameConfig);
    return () => game.destroy(true);
  }, []);

  return <div id="game-container" className="w-full h-screen"></div>;
}
