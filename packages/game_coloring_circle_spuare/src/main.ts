import Phaser from 'phaser';
import Scene1 from './scenes/Scene1';
import Scene2 from './scenes/Scene2';
import PreloadScene from './scenes/PreloadScene';
import UIScene from './scenes/UIScene';

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

    // --- CẤU HÌNH GAME (Theo cấu trúc mẫu: FIT) ---
    const config: Phaser.Types.Core.GameConfig = {
        type: Phaser.AUTO,
        width: 1920,
        height: 1080,
        parent: 'game-container',
        scene: [PreloadScene, Scene1, Scene2, EndGameScene, UIScene],
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

    // --- 2. XỬ LÝ LOGIC UI & XOAY MÀN HÌNH (Giữ nguyên logic cũ của bạn) ---
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
            resetBtn.onclick = () => {
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
                    window.gameScene.scene.stop();
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
          capabilities: ["resize", "score", "complete", "save_load", "set_state"],
        });
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

    // --- E2E INTEGRATION ---
    import { installIrukaE2E } from './e2e/installIrukaE2E';
    installIrukaE2E(sdk);

    // --- AUDIO UNLOCK REPORTING (FROM SAMPLE) ---
    let firstTapHandled = false;
    const container = document.getElementById('game-container');
    if (container) {
        container.addEventListener(
            'pointerup',
            () => {
                if (firstTapHandled) return;
                firstTapHandled = true;

                // Báo cho SDK biết user đã tương tác -> Audio Context unlock
                sdk.progress({ audioUnlocked: true });
                
                // (Optional) Gọi logic unlock của Scene nếu cần, nhưng Scene1 đã tự handle pointerdown.
                // Ở đây chủ yếu để báo SDK.
            },
            { once: true, passive: true }
        );
    }

