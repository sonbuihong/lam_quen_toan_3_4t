import Phaser from 'phaser';
import Scene1 from './scenes/Scene1';
import PreloadScene from './scenes/PreloadScene';
import UIScene from './scenes/UIScene';
import EndGameScene from './scenes/EndGameScene';
import { initRotateOrientation } from './utils/rotateOrientation';
import AudioManager from './audio/AudioManager';

// Iruka SDK
import { game } from "@iruka-edu/mini-game-sdk";
import { installIrukaE2E } from './e2e/installIrukaE2E';
import { getFixedSubmitData } from './utils/SDKHelper';
import { GameConstants } from './consts/GameConstants';

declare global {
    interface Window {
        gameScene: any;
        irukaGameState?: {
            startTime: number;
            currentScore: number;
        };
    }
}

// --- CAU HINH PHASER ---
const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    width: 1920,
    height: 1080,
    parent: 'game-container',
    scene: [PreloadScene, Scene1, EndGameScene, UIScene],
    backgroundColor: '#ffffff',
    scale: {
        mode: Phaser.Scale.FIT,
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

export const gamePhaser = new Phaser.Game(config);

// --- IRUKA SDK INTEGRATION ---

function applyResize(width: number, height: number) {
    const gameDiv = document.getElementById('game-container');
    if (gameDiv) {
        gameDiv.style.width = `${width}px`;
        gameDiv.style.height = `${height}px`;
    }
    gamePhaser.scale.resize(width, height);
}

function broadcastSetState(payload: any) {
    const scene = gamePhaser.scene.getScenes(true)[0] as any;
    // Bắn state vào scene đang chạy. Nếu scene đó có applyHubState thì gọi.
    if (scene && typeof scene.applyHubState === 'function') {
        scene.applyHubState(payload);
    }
}

function getHubOrigin(): string {
    const qs = new URLSearchParams(window.location.search);
    const o = qs.get("hubOrigin");
    if (o) return o;

    // Khi khong co hubOrigin trong query string, fallback "*"
    // Truong hop production: Game Hub se luon truyen hubOrigin qua URL
    // Truong hop dev/test: Cho phep chay doc lap voi wildcard
    console.warn("[GameSDK] hubOrigin khong co trong URL, fallback '*'. Game se khong gui postMessage chinh xac khi chay trong GameHub.");
    return "*";
}

export let sdk = game.createGameSdk({
    hubOrigin: getHubOrigin(),

    onInit(_ctx) {
        // Báo READY sau INIT với các capabilities:
        sdk.ready({
            capabilities: ["resize", "score", "complete", "save_load", "set_state", "stats", "hint", "paint"],
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

    onResize(size) {
        applyResize(size.width, size.height);
    },

    onSetState(state) {
        broadcastSetState(state);
    },

    onQuit() {
        // QUIT: chot attempt la quit + gui complete
        game.finalizeAttempt("quit");
        sdk.complete({
            timeMs: Date.now() - ((window as any).irukaGameState?.startTime ?? Date.now()),
            extras: { reason: GameConstants.ERROR_CODES.USER_ABANDONED, stats: getFixedSubmitData() },
        });
    },
});

installIrukaE2E(sdk);


// --- UI BUTTON LOGIC ---

function updateUIButtonScale() {
    const resetBtn = document.getElementById('btn-reset') as HTMLImageElement;
    if (!resetBtn) return;

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
    if (!resetBtn) return;

    resetBtn.onclick = () => {
        if (gamePhaser) gamePhaser.sound.stopByKey('bgm-nen');
        AudioManager.stopAll();
        AudioManager.play('sfx-click');

        if (window.gameScene && window.gameScene.scene) {
            window.gameScene.scene.stop();
            window.gameScene.scene.start('Scene1', { isRestart: true });
        }

        hideGameButtons();
    };
}

// --- KHOI TAO ---
initRotateOrientation(gamePhaser);
attachResetHandler();
updateUIButtonScale();
window.addEventListener('resize', updateUIButtonScale);
window.addEventListener('orientationchange', updateUIButtonScale);