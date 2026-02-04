import Phaser from 'phaser';
import Scene1 from './scenes/Scene1';
import Scene2 from './scenes/Scene2';
import Scene3 from './scenes/Scene3';
import PreloadScene from './scenes/PreloadScene';
import UIScene from './scenes/UIScene';

import EndGameScene from './scenes/EndgameScene';
import { initRotateOrientation } from './utils/rotateOrientation';
import AudioManager from './audio/AudioManager';
import { game, configureSdkContext } from "@iruka-edu/mini-game-sdk";

// Mock dữ liệu khi chạy offline (không qua hub)
configureSdkContext({
  fallback: {
    gameId: "local-game-001",
    lessonId: "local-lesson-001",
    gameVersion: "0.0.0",
  },
});

    declare global {
        interface Window {
            gameScene: any;
            irukaHost: any; // Khai báo thêm để TS không báo lỗi
            irukaGameState: any;
        }
    }

    // --- CẤU HÌNH GAME (Theo cấu trúc mẫu: FIT) ---
    const config: Phaser.Types.Core.GameConfig = {
        type: Phaser.AUTO,
        width: 1920,
        height: 1080,
        parent: 'game-container',
        scene: [PreloadScene, Scene1, Scene2, Scene3, EndGameScene, UIScene],
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

    const gamePhaser = new Phaser.Game(config);

    // --- 2. XỬ LÝ LOGIC UI & XOAY MÀN HÌNH ---
    function updateUIButtonScale() {
        //const container = document.getElementById('game-container')!;
        const resetBtn = document.getElementById('btn-reset') as HTMLImageElement;
        if (!resetBtn) return; // Thêm check null cho an toàn

        const w = window.innerWidth;
        const h = window.innerHeight;
        const newSize = h / 9;

        resetBtn.style.width = `${newSize}px`;
        resetBtn.style.height = `${newSize}px`;
    }

    export function showGameButtons() {
        const reset = document.getElementById('btn-reset');
        if (reset) reset.style.display = 'block';
    }

    export function hideGameButtons() {
        const reset = document.getElementById('btn-reset');
        if (reset) reset.style.display = 'none';
    }

    function attachResetHandler() {
        const resetBtn = document.getElementById('btn-reset') as HTMLImageElement;
        
        if (resetBtn) {
            resetBtn.onclick = async () => {
                console.log('Restart button clicked. Stopping all audio and restarting scene.');

                game.retryFromStart(); // Track restart

                //game.sound.stopAll();
                gamePhaser.sound.stopByKey('bgm-nen');
                AudioManager.stopAll();
                // 2. PHÁT SFX CLIC
                try {
                    AudioManager.play('sfx-click'); 
                } catch (e) {
                    console.error("Error playing sfx-click on restart:", e);
                }

                if (window.gameScene && window.gameScene.scene) {
                     // 1. END SESSION BACKEND BEFORE RESTART
                     // Need to find which scene is currently ACTIVE running to call finishGameSession
                     // window.gameScene is usually the last started scene, but let's be safe
                     const activeScene = gamePhaser.scene.getScenes(true)[0] as any;
                     if (activeScene && activeScene.finishGameSession) {
                         console.log("Calling finishGameSession on active scene:", activeScene.scene.key);
                         try {
                            await activeScene.finishGameSession(true); // true = isUnload/Reset (skip UI)
                         } catch(err) {
                             console.error("Failed to finish session on reset:", err);
                         }
                     }

                     // Hide Popup if exists in UIScene
                     const uiScene = window.gameScene.scene.get('UIScene');
                     if (uiScene && (uiScene as any).hideScorePopup) {
                         (uiScene as any).hideScorePopup();
                     }

                    // Stop current scenes
                    window.gameScene.scene.stop();
                    // Force stop UI scene so it re-inits on Scene1 start
                    gamePhaser.scene.stop('UIScene'); 
                    
                    window.gameScene.scene.start('Scene1', { isRestart: true }); 
                } else {
                    console.error('GameScene instance not found on window. Cannot restart.');
                }
                
                hideGameButtons();
            };
        }
    }

    // Khởi tạo xoay màn hình
    initRotateOrientation(gamePhaser);
    attachResetHandler();

    // Scale nút
    updateUIButtonScale();
    window.addEventListener('resize', updateUIButtonScale);
    window.addEventListener('orientationchange', updateUIButtonScale);

    document.getElementById('btn-reset')?.addEventListener('sfx-click', () => {

        window.gameScene?.scene.restart();
    });

    // --- GAME HUB SDK INTEGRATION ---

    function applyResize(width: number, height: number) {
        const gameDiv = document.getElementById('game-container');
        if (gameDiv) {
            gameDiv.style.width = `${width}px`;
            gameDiv.style.height = `${height}px`;
        }
        // Phaser Scale FIT: gọi resize để canvas update
        gamePhaser.scale.resize(width, height);
    }


    function broadcastSetState(payload: any) {
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


    export const sdk = game.createGameSdk({
      hubOrigin: getHubOrigin(),


      onInit(ctx: any) {
        // reset stats session nếu bạn muốn
        // game.resetAll(); hoặc statsCore.resetAll()


        // báo READY sau INIT
        sdk.ready({
          capabilities: ["resize", "score", "complete", "save_load", "set_state", "stats", "hint"],
        });
        
        // E2E Hook
        import("./e2e/installIrukaE2E").then((m) => m.installIrukaE2E(gamePhaser, sdk));
      },


      onStart() {
        gamePhaser.scene.resume("Scene1");
        gamePhaser.scene.resume("EndGameScene");
      },


      onPause() {
        gamePhaser.scene.pause("Scene1");
      },


      onResume() {
        gamePhaser.scene.resume("Scene1");
      },


      onResize(size: any) {
        applyResize(size.width, size.height);
      },


      onSetState(state: any) {
        broadcastSetState(state);
      },


      onQuit() {
        // QUIT: chốt attempt là quit + gửi complete
        game.finalizeAttempt("quit");
        sdk.complete({
          timeMs: Date.now() - ((window as any).irukaGameState?.startTime ?? Date.now()),
          extras: { reason: "hub_quit", stats: game.prepareSubmitData() },
        });
      },
    });