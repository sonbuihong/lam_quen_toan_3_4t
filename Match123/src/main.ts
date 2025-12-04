import Phaser from "phaser";
import OverlayScene from "./OverlayScene";
import GameScene from "./GameScene";
import EndGameScene from "./EndGameScene";

// ================== TẠO CONTAINER GAME ==================
const containerId = "game-container";
let container = document.getElementById(containerId);
if (!container) {
  container = document.createElement("div");
  container.id = containerId;
  document.body.appendChild(container);
}

// ================== CSS CHO HTML & BODY ==================
const root = document.documentElement;

root.style.margin = "0";
root.style.padding = "0";
root.style.width = "100%";
root.style.height = "100%";

document.body.style.margin = "0";
document.body.style.padding = "0";
document.body.style.width = "100%";
document.body.style.height = "100%";

// ========== RANDOM BACKGROUND VIEWPORT ==========
const INTRO_VIEWPORT_BGS = [
  "assets/bg/bg1.webp",
  "assets/bg/bg2.webp",
  "assets/bg/bg3.webp",
  "assets/bg/bg4.webp",
  "assets/bg/bg5.webp",
];

const GAME_VIEWPORT_BGS = [
  "assets/bg/bg1.webp",
  "assets/bg/bg2.webp",
  "assets/bg/bg3.webp",
  "assets/bg/bg4.webp",
  "assets/bg/bg5.webp",
];

const END_VIEWPORT_BGS = [
  "assets/bg/bg1.webp",
  "assets/bg/bg2.webp",
  "assets/bg/bg3.webp",
  "assets/bg/bg4.webp",
  "assets/bg/bg5.webp",
];

// Cho phép chỉnh vị trí BG (center / top...)
function setViewportBg(url: string, position: string = "center center") {
  document.body.style.backgroundImage = `url("${url}")`;
  document.body.style.backgroundRepeat = "no-repeat";
  document.body.style.backgroundSize = "cover";
  document.body.style.backgroundPosition = position;
  document.body.style.boxSizing = "border-box";
}

export function setRandomIntroViewportBg() {
  const url =
    INTRO_VIEWPORT_BGS[Math.floor(Math.random() * INTRO_VIEWPORT_BGS.length)];

  const isLandscape = window.innerWidth > window.innerHeight;

  // Landscape: ưu tiên giữ phần trên (title), cắt nhiều phía dưới
  if (isLandscape) {
    setViewportBg(url, "center top");
  } else {
    setViewportBg(url, "center center");
  }
}

export function setRandomGameViewportBg() {
  const url =
    GAME_VIEWPORT_BGS[Math.floor(Math.random() * GAME_VIEWPORT_BGS.length)];
  setViewportBg(url, "center center");
}

export function setRandomEndViewportBg() {
  const url =
    END_VIEWPORT_BGS[Math.floor(Math.random() * END_VIEWPORT_BGS.length)];
  setViewportBg(url, "center center");
}

// ========== HIỆN / ẨN NÚT VIEWPORT ==========
function setGameButtonsVisible(visible: boolean) {
  const replayBtn = document.getElementById("btn-replay") as
    | HTMLButtonElement
    | null;
  const nextBtn = document.getElementById("btn-next") as
    | HTMLButtonElement
    | null;
  const display = visible ? "block" : "none";
  if (replayBtn) replayBtn.style.display = display;
  if (nextBtn) nextBtn.style.display = display;
}

// ================== CSS CHO CONTAINER (TRONG SUỐT) ==================
if (container instanceof HTMLDivElement) {
  container.style.position = "fixed";
  container.style.inset = "0"; // full màn hình
  container.style.margin = "0";
  container.style.padding = "0";
  container.style.display = "flex";
  container.style.justifyContent = "center";
  container.style.alignItems = "center";
  container.style.overflow = "hidden";
  container.style.boxSizing = "border-box";
  container.style.background = "transparent";
}

// Giữ tham chiếu game để tránh tạo nhiều lần (HMR, reload…)
let game: Phaser.Game | null = null;
// ================== OVERLAY NHẮC XOAY NGANG ==================
let rotateOverlay: HTMLDivElement | null = null;

// ========== HÀM CHỐNG SPAM / CHỒNG VOICE ==========
let currentVoice: Phaser.Sound.BaseSound | null = null;
let currentVoiceKey: string | null = null;
let isRotateOverlayActive = false; // trạng thái overlay xoay ngang

// Lưu lại BGM loop + question đang phát khi bước vào overlay dọc
let pausedLoopKeys: string[] = [];
let pendingQuestionKey: string | null = null;

function getVoicePriority(key: string): number {
  // Ưu tiên thấp: drag / câu hỏi
  if (key.startsWith("drag_") || key.startsWith("q_")) return 1;

  // Nhắc nhở
  if (key === "voice_need_finish") return 2;

  // Âm đúng / sai – trung bình
  if (key === "sfx_correct" || key === "sfx_wrong") return 3;

  // Hoàn thành / intro / end / xoay – cao nhất
  if (
    key === "voice_complete" ||
    key === "voice_intro" ||
    key === "voice_end" ||
    key === "voice_rotate"
  ) {
    return 4;
  }

  // Mặc định
  return 1;
}

export function playVoiceLocked(
  sound: Phaser.Sound.BaseSoundManager,
  key: string
): void {
  if (isRotateOverlayActive && key !== "voice_rotate") {
    console.warn(`[Match123] Đang overlay xoay ngang, chỉ phát voice_rotate!`);
    return;
  }

  const newPri = getVoicePriority(key);
  const curPri = currentVoiceKey ? getVoicePriority(currentVoiceKey) : 0;

  // Nếu đang phát 1 voice:
  if (currentVoice && currentVoice.isPlaying) {
    // Nếu cùng 1 key (kể cả sfx_wrong) -> bỏ qua, không spam
    if (currentVoiceKey === key) {
      return;
    }

    // Nếu voice hiện tại có priority cao hơn hoặc bằng thì giữ nguyên, bỏ qua voice mới
    if (curPri >= newPri) {
      return;
    }

    // Nếu voice mới ưu tiên cao hơn thì dừng voice cũ trước
    currentVoice.stop();
    currentVoice = null;
    currentVoiceKey = null;
  }

  let instance = sound.get(key) as Phaser.Sound.BaseSound | null;
  if (!instance) {
    try {
      instance = sound.add(key);
      if (!instance) {
        console.warn(
          `[Match123] Không phát được audio key="${key}": Asset chưa được preload hoặc chưa có trong cache.`
        );
        return;
      }
    } catch (e) {
      console.warn(`[Match123] Không phát được audio key="${key}":`, e);
      return;
    }
  }

  currentVoice = instance;
  currentVoiceKey = key;
  instance.once("complete", () => {
    if (currentVoice === instance) {
      currentVoice = null;
      currentVoiceKey = null;
    }
  });
  instance.play();
}

// Cố gắng resume AudioContext khi overlay bật/tắt
function resumeSoundContext(gameScene: GameScene) {
  const sm = gameScene.sound as any;
  const ctx: AudioContext | undefined = sm.context || sm.audioContext;
  if (ctx && ctx.state === "suspended" && typeof ctx.resume === "function") {
    ctx.resume();
  }
}

function ensureRotateOverlay() {
  if (rotateOverlay) return;

  rotateOverlay = document.createElement("div");
  rotateOverlay.id = "rotate-overlay";
  rotateOverlay.style.position = "fixed";
  rotateOverlay.style.inset = "0";
  rotateOverlay.style.zIndex = "9999";
  rotateOverlay.style.display = "none";
  rotateOverlay.style.alignItems = "center";
  rotateOverlay.style.justifyContent = "center";
  rotateOverlay.style.textAlign = "center";
  rotateOverlay.style.background = "rgba(0, 0, 0, 0.6)";
  rotateOverlay.style.padding = "16px";
  rotateOverlay.style.boxSizing = "border-box";

  const box = document.createElement("div");
  box.style.background = "white";
  box.style.borderRadius = "16px";
  box.style.padding = "16px 20px";
  box.style.maxWidth = "320px";
  box.style.margin = "0 auto";
  box.style.fontFamily =
    '"Fredoka", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  box.style.boxShadow = "0 8px 24px rgba(0,0,0,0.25)";

  const title = document.createElement("div");
  title.textContent = "Bé Hãy Xoay Ngang Màn Hình Để Chơi Nhé 🌈";
  title.style.fontSize = "18px";
  title.style.fontWeight = "700";
  title.style.marginBottom = "8px";
  title.style.color = "#222";

  box.appendChild(title);
  rotateOverlay.appendChild(box);
  document.body.appendChild(rotateOverlay);
}

function updateRotateHint() {
  ensureRotateOverlay();
  if (!rotateOverlay) return;

  const w = window.innerWidth;
  const h = window.innerHeight;
  const shouldShow = h > w && w < 768;

  const overlayWasActive = isRotateOverlayActive;
  isRotateOverlayActive = shouldShow;

  const overlayTurnedOn = !overlayWasActive && shouldShow;
  const overlayTurnedOff = overlayWasActive && !shouldShow;

  rotateOverlay.style.display = shouldShow ? "flex" : "none";

  const gameScene = game?.scene?.getScene("GameScene") as GameScene | undefined;
  if (!gameScene || !gameScene.sound) {
    return;
  }

  const soundManager = gameScene.sound as any;
  const sounds = soundManager.sounds as Phaser.Sound.BaseSound[] | undefined;

  // Khi vừa bước vào màn hình dọc (overlay bật)
  if (overlayTurnedOn && Array.isArray(sounds)) {
    resumeSoundContext(gameScene);

    pausedLoopKeys = [];
    pendingQuestionKey = null;

    sounds.forEach((snd: Phaser.Sound.BaseSound) => {
      if (
        snd &&
        typeof snd.key === "string" &&
        snd.key !== "voice_rotate" &&
        snd.isPlaying &&
        typeof snd.stop === "function"
      ) {
        if ((snd as any).loop) {
          pausedLoopKeys.push(snd.key);
        }
        if (snd.key.startsWith("q_")) {
          pendingQuestionKey = snd.key;
        }
        snd.stop();
      }
    });
  }

  // Khi overlay bật lên lần đầu -> phát voice_rotate (nếu có)
  if (overlayTurnedOn) {
    const tryPlayVoiceRotate = () => {
      // gameScene có thể bị stop/start lại, nên lấy lại mỗi lần
      const scene = game?.scene?.getScene("GameScene") as
        | GameScene
        | undefined;
      if (!scene || !scene.sound) return;

      const isActive = scene.scene.isActive();
      const hasVoiceRotate =
        !!(scene.cache as any)?.audio?.exists?.("voice_rotate") ||
        !!scene.sound.get("voice_rotate");
      if (isActive && hasVoiceRotate) {
        playVoiceLocked(scene.sound, "voice_rotate");
      } else {
        // Nếu chưa sẵn sàng (scene chưa active hoặc sound chưa load) thì thử lại sau
        setTimeout(tryPlayVoiceRotate, 300);
      }
    };
    tryPlayVoiceRotate();
  }

  // Khi overlay tắt -> dừng voice_rotate, phát lại BGM + question nếu có
  if (overlayTurnedOff) {
    resumeSoundContext(gameScene);

    const rotateSound = gameScene.sound.get(
      "voice_rotate"
    ) as Phaser.Sound.BaseSound | null;
    if (rotateSound && rotateSound.isPlaying) {
      rotateSound.stop();
    }
    if (currentVoice === rotateSound) {
      currentVoice = null;
      currentVoiceKey = null;
    }

    pausedLoopKeys.forEach((key) => {
      const bg = gameScene.sound.get(key) as Phaser.Sound.BaseSound | null;
      if (bg) {
        (bg as any).loop = true;
        bg.play();
      }
    });
    pausedLoopKeys = [];

    if (pendingQuestionKey) {
      playVoiceLocked(gameScene.sound, pendingQuestionKey);
      pendingQuestionKey = null;
    }
  }
}

function setupRotateHint() {
  ensureRotateOverlay();
  updateRotateHint();
  window.addEventListener("resize", updateRotateHint);
  window.addEventListener("orientationchange", updateRotateHint as any);
}

// Cho các Scene gọi qua window
(Object.assign(window as any, {
  setRandomIntroViewportBg,
  setRandomGameViewportBg,
  setRandomEndViewportBg,
  setGameButtonsVisible,
  playVoiceLocked,
}));

// ================== CẤU HÌNH PHASER ==================
const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 1280,
  height: 720, // 16:9
  parent: containerId,
  transparent: true, // Canvas trong suốt để nhìn thấy background của body
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  render: {
    pixelArt: false,
    antialias: true,
  },
  scene: [OverlayScene, GameScene, EndGameScene],
};

// ================== KẾT NỐI NÚT HTML (ngoài Phaser) ==================
function setupHtmlButtons() {
  const replayBtn = document.getElementById("btn-replay");
  if (replayBtn) {
    replayBtn.addEventListener("click", () => {
      if (!game) return;
      const scene = game.scene.getScene("GameScene") as GameScene;
      if (!scene) return;
      scene.scene.restart({ level: scene.level });
    });
  }

  const nextBtn = document.getElementById("btn-next");
  if (nextBtn) {
    nextBtn.addEventListener("click", () => {
      if (!game) return;
      const scene = game.scene.getScene("GameScene") as GameScene;
      if (!scene) return;

      if (!scene.isLevelComplete()) {
        playVoiceLocked(scene.sound, "voice_need_finish");
        return;
      }

      const nextIndex = scene.level + 1;
      if (nextIndex >= scene.levels.length) {
        scene.scene.start("EndGameScene");
      } else {
        scene.scene.restart({ level: nextIndex });
      }
    });
  }

  // Mặc định ẩn nút (intro, endgame)
  setGameButtonsVisible(false);
}

// ================== CHỜ FONT FREDOKA ==================
function waitForFredoka(): Promise<void> {
  if (!document.fonts || !document.fonts.load) return Promise.resolve();

  return new Promise<void>((resolve) => {
    let done = false;

    document.fonts.load('400 20px "Fredoka"').then(() => {
      if (!done) {
        done = true;
        resolve();
      }
    });

    setTimeout(() => {
      if (!done) {
        done = true;
        resolve();
      }
    }, 10);
  });
}

// ================== HANDLE RESIZE / ORIENTATION ==================
function setupPhaserResize(currentGame: Phaser.Game) {
  const refresh = () => {
    // Cho browser ổn định layout rồi mới đo lại
    setTimeout(() => {
      currentGame.scale.refresh();
    }, 50);
  };

  window.addEventListener("resize", refresh);
  window.addEventListener("orientationchange", refresh as any);

  // Gọi 1 lần ban đầu
  refresh();
}

// ================== KHỞI TẠO GAME ==================
async function initGame() {
  try {
    await waitForFredoka();
  } catch (e) {
    console.warn("Không load kịp font Fredoka, chạy game luôn.");
  }

  if (!game) {
    setRandomIntroViewportBg();
    game = new Phaser.Game(config);
    setupHtmlButtons();
    setupPhaserResize(game);
    setupRotateHint(); 
  }

  setTimeout(() => {
    const canvas =
      document.querySelector<HTMLCanvasElement>("#game-container canvas");
    if (canvas) {
      canvas.style.margin = "0";
      canvas.style.padding = "0";
      canvas.style.display = "block";
      canvas.style.imageRendering = "auto";
      canvas.style.backgroundColor = "transparent";
    }
  }, 50);
}

document.addEventListener("DOMContentLoaded", initGame);
