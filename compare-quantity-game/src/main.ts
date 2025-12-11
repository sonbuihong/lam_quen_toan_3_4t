import Phaser from 'phaser';
import { CompareScene } from './scenes/CompareScene';
import { EndGameScene } from './scenes/EndGameScene';
import { initRotateOrientation } from './rotateOrientation';
import PreloadScene from './scenes/PreloadScene';

declare global {
    interface Window {
        compareScene: any;
    }
}

const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    width: 1280,
    height: 720,
    parent: 'game-container',
    backgroundColor: '#ffffff',
    scene: [PreloadScene, CompareScene, EndGameScene],
    scale: {
        mode: Phaser.Scale.FIT, // Canvas tự fit vào container
        autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    render: {
        pixelArt: false,
        antialias: true,
        transparent: true,
    },
};

const game = new Phaser.Game(config);

function resizeGame() {
    const gameDiv = document.getElementById('game-container');

    const w = window.innerWidth;
    const h = window.innerHeight;

    if (gameDiv) {
        gameDiv.style.transform = '';
        gameDiv.style.width = `${w}px`;
        gameDiv.style.height = `${h}px`;
    }
}

window.addEventListener('resize', () => {
    resizeGame();
});
window.addEventListener('orientationchange', () => {
    resizeGame();
});

function updateUIButtonScale() {
    const container = document.getElementById('game-container')!;
    const resetBtn = document.getElementById('btn-reset') as HTMLImageElement;

    const w = container.clientWidth;
    const h = container.clientHeight;

    // base height = 720 (game design gốc)
    const scale = Math.min(w, h) / 720;

    const baseSize = 80; // kích thước nút thiết kế gốc (80px)
    const newSize = baseSize * scale;

    resetBtn.style.width = `${newSize}px`;
    resetBtn.style.height = 'auto';
}

export function showGameButtons() {
    const reset = document.getElementById('btn-reset');

    reset!.style.display = 'block';
}

export function hideGameButtons() {
    const reset = document.getElementById('btn-reset');

    reset!.style.display = 'none';
}

// Khởi tạo xoay màn hình
initRotateOrientation(game);

// Scale nút
updateUIButtonScale();
window.addEventListener('resize', updateUIButtonScale);
window.addEventListener('orientationchange', updateUIButtonScale);

document.getElementById('btn-reset')?.addEventListener('click', () => {
    window.compareScene?.restartGame();
});
