import Phaser from 'phaser';
import { gameConfig } from './game/config';

declare global {
    interface Window {
        lessonScene: any;
    }
}

new Phaser.Game(gameConfig);

// --- Xử lý xoay ngang trên mobile ---
function resizeGame() {
    const gameDiv = document.getElementById('game-container')!;
    const rotateMsg = document.getElementById('rotate-msg')!;

    const w = window.innerWidth;
    const h = window.innerHeight;

    if (h > w) {
        // Điện thoại dọc → hiển thị overlay
        rotateMsg.style.display = 'block';
        gameDiv.style.transform = 'rotate(90deg)';
        gameDiv.style.transformOrigin = 'center center';
        gameDiv.style.width = `${h}px`;
        gameDiv.style.height = `${w}px`;
    } else {
        // Landscape → ẩn overlay
        rotateMsg.style.display = 'none';
        gameDiv.style.transform = '';
        gameDiv.style.width = `${w}px`;
        gameDiv.style.height = `${h}px`;
    }
}

function updateUIButtonScale() {
    const container = document.getElementById('game-container')!;
    const resetBtn = document.getElementById('btn-reset') as HTMLImageElement;
    const nextBtn = document.getElementById('btn-next') as HTMLImageElement;

    const w = container.clientWidth;
    const h = container.clientHeight;

    // base height = 720 (game design gốc)
    const scale = Math.min(w, h) / 720;

    const baseSize = 80; // kích thước nút thiết kế gốc (80px)
    const newSize = baseSize * scale;

    resetBtn.style.width = `${newSize}px`;
    resetBtn.style.height = 'auto';

    nextBtn.style.width = `${newSize}px`;
    nextBtn.style.height = 'auto';
}

export function showGameButtons() {
    const reset = document.getElementById('btn-reset');
    const next = document.getElementById('btn-next');

    reset!.style.display = 'block';
    next!.style.display = 'block';
}

export function hideGameButtons() {
    const reset = document.getElementById('btn-reset');
    const next = document.getElementById('btn-next');

    reset!.style.display = 'none';
    next!.style.display = 'none';
}

// Gọi lần đầu
window.addEventListener('resize', () => {
    resizeGame();
    updateUIButtonScale();
});
window.addEventListener('orientationchange', () => {
    resizeGame();
    updateUIButtonScale();
});

// Gọi lần đầu
resizeGame();
updateUIButtonScale();

document.getElementById('btn-reset')?.addEventListener('click', () => {
    window.lessonScene?.restartLevel();
});

document.getElementById('btn-next')?.addEventListener('click', () => {
    window.lessonScene?.goToNextLevel();
});
