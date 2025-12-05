"use client";

import { useEffect, useRef } from "react";
import { initPhaserGame } from "@/game/main";
import * as Phaser from "phaser";

export default function Home() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let game: Phaser.Game | null = null;

    (async () => {
      if (containerRef.current) {
        game = await initPhaserGame(containerRef.current.id);
      }
    })();

    return () => {
      game?.destroy(true);
    };
  }, []);

  return (
    <div className="flex justify-center items-center h-screen bg-black">
      <div id="phaser-container" ref={containerRef}></div>
    </div>
  );
}
