import Phaser from 'phaser';
import AudioManager from '../audio/AudioManager';

// ================== STATE CHUNG ==================
let rotateOverlay: HTMLDivElement | null = null;
let isRotateOverlayActive = false;
let currentVoiceKey: string | null = null;
let gameSceneReference: any = null;
let globalBlockListenersAttached = false;

let lastRotateVoiceTime = 0;
const ROTATE_VOICE_COOLDOWN = 1500;
let interruptedVoiceKey: string | null = null;

// ================== CAU HINH CO DINH ==================
type RotateConfig = {
    breakpoint: number;
    message: string;
    lockPointer: boolean;
};

const rotateConfig: RotateConfig = {
    breakpoint: 768,
    message: 'Be Hay Xoay Ngang Man Hinh De Choi Nhe',
    lockPointer: true,
};

// ================== UU TIEN VOICE ==================
function getVoicePriority(key: string): number {
    if (key.startsWith('drag_') || key.startsWith('q_')) return 1;
    if (key === 'voice_need_finish') return 2;
    if (key === 'sfx_correct' || key === 'sfx_wrong') return 3;
    if (key === 'voice_complete' || key === 'voice_intro' || key === 'voice_end' || key === 'voice-rotate') {
        return 4;
    }
    return 1;
}

/**
 * Phat voice co kiem soat uu tien.
 * Khi overlay xoay dang bat -> chi cho phep phat voice-rotate.
 */
export function playVoiceLocked(
    _sound: Phaser.Sound.BaseSoundManager | null,
    key: string
): void {
    // Khi dang overlay xoay ngang -> chi cho phat voice-rotate
    if (isRotateOverlayActive && key !== 'voice-rotate') {
        return;
    }

    // Truong hop dac biet: voice-rotate
    if (key === 'voice-rotate') {
        const now = Date.now();
        if (now - lastRotateVoiceTime < ROTATE_VOICE_COOLDOWN) {
            return;
        }

        if (currentVoiceKey === 'instruction' ||
            currentVoiceKey === 'cau_do' ||
            currentVoiceKey === 'voice_intro_s2') {
            interruptedVoiceKey = currentVoiceKey;
        }

        lastRotateVoiceTime = now;

        try {
            AudioManager.stopAll();
            AudioManager.stopAllVoicePrompts();
        } catch { /* Tranh crash */ }

        currentVoiceKey = null;

        const id = AudioManager.play('voice-rotate');
        if (id === undefined) return;

        currentVoiceKey = 'voice-rotate';
        return;
    }

    // Cac voice binh thuong
    const newPri = getVoicePriority(key);
    const curPri = currentVoiceKey ? getVoicePriority(currentVoiceKey) : 0;

    if (currentVoiceKey === key) return;
    if (currentVoiceKey && curPri > newPri) return;

    if (currentVoiceKey) {
        AudioManager.stop(currentVoiceKey);
        currentVoiceKey = null;
    }

    if (key === 'instruction' || key === 'cau_do' || key === 'voice_intro_s2') {
        interruptedVoiceKey = null;
    }

    const id = AudioManager.play(key);
    if (id === undefined) return;

    currentVoiceKey = key;
}

// ================== BLOCK INPUT KHI OVERLAY BAT ==================
function attachGlobalBlockInputListeners() {
    if (globalBlockListenersAttached) return;
    globalBlockListenersAttached = true;

    const handler = (ev: Event) => {
        if (!isRotateOverlayActive) return;

        ev.stopPropagation();
        if (typeof (ev as any).stopImmediatePropagation === 'function') {
            (ev as any).stopImmediatePropagation();
        }
        ev.preventDefault();

        try {
            playVoiceLocked(null as any, 'voice-rotate');
        } catch { /* Tranh crash */ }
    };

    const events = ['pointerdown', 'pointerup', 'click', 'touchstart', 'touchend', 'mousedown', 'mouseup'];
    events.forEach((type) => {
        window.addEventListener(type, handler, { capture: true, passive: false });
    });
}

// ================== UI OVERLAY XOAY NGANG ==================
function ensureRotateOverlay() {
    if (rotateOverlay) return;

    rotateOverlay = document.createElement('div');
    rotateOverlay.id = 'rotate-overlay';
    rotateOverlay.style.position = 'fixed';
    rotateOverlay.style.inset = '0';
    rotateOverlay.style.zIndex = '2147483647';
    rotateOverlay.style.display = 'none';
    rotateOverlay.style.alignItems = 'center';
    rotateOverlay.style.justifyContent = 'center';
    rotateOverlay.style.textAlign = 'center';
    rotateOverlay.style.background = 'rgba(0, 0, 0, 0.6)';
    rotateOverlay.style.padding = '16px';
    rotateOverlay.style.boxSizing = 'border-box';
    rotateOverlay.style.pointerEvents = rotateConfig.lockPointer ? 'auto' : 'none';

    const box = document.createElement('div');
    box.style.background = 'white';
    box.style.borderRadius = '16px';
    box.style.padding = '16px 20px';
    box.style.maxWidth = '320px';
    box.style.margin = '0 auto';
    box.style.fontFamily = '"Fredoka", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    box.style.boxShadow = '0 8px 24px rgba(0,0,0,0.25)';

    const title = document.createElement('div');
    title.textContent = rotateConfig.message;
    title.style.fontSize = '18px';
    title.style.fontWeight = '700';
    title.style.marginBottom = '8px';
    title.style.color = '#222';

    box.appendChild(title);
    rotateOverlay.appendChild(box);
    document.body.appendChild(rotateOverlay);
}

// ================== CORE LOGIC XOAY + AM THANH ==================
function updateRotateHint() {
    ensureRotateOverlay();
    if (!rotateOverlay) return;

    const w = window.innerWidth;
    const h = window.innerHeight;
    const shouldShow = h > w && w < rotateConfig.breakpoint;

    const overlayWasActive = isRotateOverlayActive;
    isRotateOverlayActive = shouldShow;

    const overlayTurnedOn = !overlayWasActive && shouldShow;
    const overlayTurnedOff = overlayWasActive && !shouldShow;

    rotateOverlay.style.display = shouldShow ? 'flex' : 'none';

    // Khi overlay BAT LEN
    if (overlayTurnedOn) {
        try {
            playVoiceLocked(null as any, 'voice-rotate');
            if (gameSceneReference?.scene?.isActive()) {
                gameSceneReference.scene.pause();
            }
        } catch { /* Tranh crash */ }
    }

    // Khi overlay TAT (xoay ngang lai)
    if (overlayTurnedOff) {
        if (currentVoiceKey === 'voice-rotate') {
            AudioManager.stop('voice-rotate');
            currentVoiceKey = null;
        }

        if (gameSceneReference?.scene?.isPaused()) {
            gameSceneReference.scene.resume();
        }

        // Phuc hoi voice bi gian doan truoc khi xoay
        if (interruptedVoiceKey) {
            if (interruptedVoiceKey === 'voice_intro_s2' && gameSceneReference.restartIntro) {
                gameSceneReference.restartIntro();
            } else {
                playVoiceLocked(null, interruptedVoiceKey);
            }
            interruptedVoiceKey = null;
        }
    }
}

// ================== KHOI TAO ==================
export function initRotateOrientation(_game: Phaser.Game) {
    ensureRotateOverlay();
    attachGlobalBlockInputListeners();
    updateRotateHint();

    window.addEventListener('resize', updateRotateHint);
    window.addEventListener('orientationchange', updateRotateHint as unknown as EventListener);
}

export function resetVoiceState() {
    currentVoiceKey = null;
    interruptedVoiceKey = null;
}

export function setGameSceneReference(scene: any) {
    gameSceneReference = scene;
}
