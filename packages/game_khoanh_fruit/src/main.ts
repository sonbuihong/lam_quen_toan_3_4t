import Phaser from 'phaser';
import Scene1 from './scenes/Scene1';
import PreloadScene from './scenes/PreloadScene';
import UIScene from './scenes/UIScene';
import { SceneKeys } from './consts/Keys';

import EndGameScene from './scenes/EndgameScene';
import { initRotateOrientation } from './utils/rotateOrientation';
import AudioManager from './audio/AudioManager';
import { game } from "@iruka-edu/mini-game-sdk";

    declare global {
        interface Window {
            gameScene: any;
            irukaHost: any; // Khai báo thêm để TS không báo lỗi
            irukaGameState: any;
        }
    }

    // --- GAME HUB SDK INTEGRATION ---

    function applyResize(width: number, height: number) {
        const gameDiv = document.getElementById('game-container');
        if (gameDiv) {
            gameDiv.style.width = `${width}px`;
            gameDiv.style.height = `${height}px`;
        }
        // Phaser Scale FIT: gọi resize để canvas update
        if (gamePhaser) gamePhaser.scale.resize(width, height);
    }


    function broadcastSetState(payload: any) {
        if (!gamePhaser) return;
        // chuyển xuống scene đang chạy để bạn route helper (audio/score/timer/result...)
        const scene = gamePhaser.scene.getScenes(true)[0] as any;
        scene?.applyHubState?.(payload);
    }


    // lấy hubOrigin: tốt nhất từ query param, fallback document.referrer
    function getHubOrigin(): string {
      const qs = new URLSearchParams(window.location.search);
      const o = qs.get("hubOrigin");
      if (o) return o;


      // fallback: origin của referrer (hub)
      try {
        const ref = document.referrer;
        if (ref) return new URL(ref).origin;
      } catch {}
      return "*"; // nếu protocol của bạn bắt buộc origin cụ thể thì KHÔNG dùng "*"
    }


import { installIrukaE2E } from './e2e/installIrukaE2E';

    export const sdk = game.createGameSdk({
      hubOrigin: getHubOrigin(),


      onInit(ctx: any) {
        // reset stats session nếu bạn muốn
        // game.resetAll(); hoặc statsCore.resetAll()
        installIrukaE2E(sdk);


        // báo READY sau INIT
        sdk.ready({
          capabilities: ["resize", "score", "complete", "save_load", "set_state", "stats", "hint"],
        });
      },


      onStart() {
        if (gamePhaser) {
             gamePhaser.scene.resume("Scene1");
             gamePhaser.scene.resume("EndGameScene");
        }
      },


      onPause() {
        if (gamePhaser) gamePhaser.scene.pause("Scene1");
      },


      onResume() {
        if (gamePhaser) gamePhaser.scene.resume("Scene1");
      },


      onResize(size: any) {
        applyResize(size.width, size.height);
      },


      onSetState(state: any) {
        broadcastSetState(state);
      },


      onQuit() {
        // Cleanup scene trước khi finalize session
        const activeScene = gamePhaser?.scene.getScene('Scene1') as any;
        if (activeScene?.scene?.isActive()) {
          activeScene.shutdown();
        }

        game.finalizeAttempt("quit");
        sdk.complete({
          timeMs: Date.now() - ((window as any).irukaGameState?.startTime ?? Date.now()),
          extras: { reason: "hub_quit", stats: game.prepareSubmitData() },
        });
      },
    });

    let gamePhaser: Phaser.Game;

    // --- CẤU HÌNH GAME (Theo cấu trúc mẫu: FIT) ---
    const config: Phaser.Types.Core.GameConfig = {
        type: Phaser.AUTO,
        width: 1920,
        height: 1080,
        parent: 'game-container',
        scene: [PreloadScene, Scene1, EndGameScene, UIScene],
        backgroundColor: '#ffffff',
        scale: {
            mode: Phaser.Scale.FIT,       // Dùng FIT để co giãn giữ tỉ lệ
            autoCenter: Phaser.Scale.CENTER_BOTH,
        },
        physics: {
            default: 'arcade',
            arcade: { debug: false }
        },
        render: {
            transparent: true,
        },
    };

    gamePhaser = new Phaser.Game(config);

    // --- 4. CẤU HÌNH UI & XOAY MÀN HÌNH (SETUP SAU KHI GAME ĐÃ KHỞI TẠO) ---

    export function showGameButtons() {
        const reset = document.getElementById('btn-reset');
        if (reset) reset.style.display = 'block';
    }

    export function hideGameButtons() {
        const reset = document.getElementById('btn-reset');
        if (reset) reset.style.display = 'none';
    }

    function updateUIButtonScale() {
        const resetBtn = document.getElementById('btn-reset') as HTMLImageElement;
        if (!resetBtn) return;
        const h = window.innerHeight;
        const newSize = h / 9;
        resetBtn.style.width = `${newSize}px`;
        resetBtn.style.height = `${newSize}px`;
    }

    function attachResetHandler() {
        const resetBtn = document.getElementById('btn-reset') as HTMLImageElement;
        if (resetBtn) {
            resetBtn.onclick = () => {
                console.log('Restart button clicked.');
                //game.retryFromStart(); // DUPLICATE - Đã gọi ở EndgameScene
                gamePhaser.sound.stopByKey('bgm-nen');
                AudioManager.stopAll();
                try {
                    AudioManager.play('sfx-click'); 
                } catch (e) { console.error(e); }

                // Sử dụng gamePhaser để quản lý Scene, an toàn hơn dùng biến global window.gameScene
                gamePhaser.scene.stop(SceneKeys.Scene1);
                gamePhaser.scene.start(SceneKeys.Scene1, { isRestart: true }); 
                
                // hideGameButtons(); 
            };
        }
    }

    // Init Logic
    initRotateOrientation(gamePhaser);
    attachResetHandler();
    updateUIButtonScale();
    window.addEventListener('resize', updateUIButtonScale);
    window.addEventListener('orientationchange', updateUIButtonScale);

    document.getElementById('btn-reset')?.addEventListener('sfx-click', () => {
        window.gameScene?.scene.restart();
    });