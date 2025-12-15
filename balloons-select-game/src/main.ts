import Phaser from 'phaser';
import GameScene from './scenes/GameScene';
import { EndScene } from './scenes/EndScene';
import { initRotateOrientation } from './rotateOrientation';
import PreloadScene from './scenes/PreloadScene';

declare global {
    interface Window {
        gameScene: any;
    }
}

const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    width: 1280,
    height: 720,
    parent: 'game-container',
    scene: [PreloadScene, GameScene, EndScene],
    backgroundColor: '#ffffff',
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    render: {
        pixelArt: false,
        antialias: true,
        transparent: true,
    },
};

const game = new Phaser.Game(config);

let firstTapHandled = false;

const container = document.getElementById('game-container');
if (container) {
    container.addEventListener(
        'pointerup',
        () => {
            if (firstTapHandled) return;
            firstTapHandled = true;

            // đây là gesture thật trên game-container
            // 1) đánh dấu đã unlock audio
            const gameScene = game.scene.getScene('GameScene') as any;
            if (
                gameScene &&
                typeof gameScene.unlockFirstPrompt === 'function'
            ) {
                gameScene.unlockFirstPrompt();
            }
        },
        { once: true, passive: true }
    );
}

if (container) {
    const handleLeftClick = (ev: PointerEvent) => {
        // đã xử lý tap/click đầu rồi thì thôi
        if (firstTapHandled) return;

        // chỉ xử lý CHUỘT TRÁI
        if (ev.pointerType !== 'mouse' || ev.button !== 0) {
            return;
        }

        firstTapHandled = true;

        const gameScene = game.scene.getScene('GameScene') as any;
        if (gameScene && typeof gameScene.unlockFirstPrompt === 'function') {
            gameScene.unlockFirstPrompt();
        }

        // sau khi xử lý xong, bỏ listener này
        container.removeEventListener('pointerup', handleLeftClick, true);
    };

    // 👇 handler riêng cho chuột trái, chạy ở capture để không bị Phaser nuốt
    container.addEventListener('pointerdown', handleLeftClick, {
        capture: true,
        passive: true,
    });
}

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

    const scale = Math.min(w, h) / 720;
    const baseSize = 80;
    const newSize = baseSize * scale;

    resetBtn.style.width = `${newSize}px`;
    resetBtn.style.height = 'auto';
}

export function showGameButtons() {
    const reset = document.getElementById('btn-reset');
    if (reset) reset.style.display = 'block';
}

export function hideGameButtons() {
    const reset = document.getElementById('btn-reset');
    if (reset) reset.style.display = 'none';
}

// Khởi tạo xoay màn hình
initRotateOrientation(game);

// Scale nút
updateUIButtonScale();
window.addEventListener('resize', updateUIButtonScale);
window.addEventListener('orientationchange', updateUIButtonScale);

document.getElementById('btn-reset')?.addEventListener('click', () => {
    window.gameScene?.restartLevel();
});
