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
  "assets/intro/bge1.webp",
  "assets/intro/bge2.webp",
  "assets/intro/bge3.webp",
];

const GAME_VIEWPORT_BGS = [
  "assets/bg/bg1.webp",
  "assets/bg/bg2.webp",
  "assets/bg/bg3.webp",
  "assets/bg/bg4.webp",
  "assets/bg/bg5.webp",
  "assets/bg/bg6.webp",
  "assets/bg/bg7.webp",
];

const END_VIEWPORT_BGS = [
  "assets/bg/bg1.webp",
  "assets/bg/bg2.webp",
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

// Cho các Scene gọi qua window
(Object.assign(window as any, {
  setRandomIntroViewportBg,
  setRandomGameViewportBg,
  setRandomEndViewportBg,
  setGameButtonsVisible,
}));

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

  // Nội dung thông báo
  const box = document.createElement("div");
  box.style.background = "white";
  box.style.borderRadius = "16px";
  box.style.padding = "16px 20px";
  box.style.maxWidth = "320px";
  box.style.margin = "0 auto";
  box.style.fontFamily = '"Fredoka", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  box.style.boxShadow = "0 8px 24px rgba(0,0,0,0.25)";

  const title = document.createElement("div");
  title.textContent = "Bé Hãy Xoay Ngang Màn Hình Để Chơi Nhé 🌈";
  title.style.fontSize = "18px";
  title.style.fontWeight = "700";
  title.style.marginBottom = "8px";
  title.style.color = "#222";

  // const desc = document.createElement("div");
  // //desc.textContent = "Để chơi game rõ và dễ thao tác hơn, vui lòng xoay ngang thiết bị.";
  // desc.style.fontSize = "14px";
  // desc.style.lineHeight = "1.4";
  // desc.style.color = "#444";
  box.appendChild(title);
  // box.appendChild(desc);
  rotateOverlay.appendChild(box);

  document.body.appendChild(rotateOverlay);
}

function updateRotateHint() {
  ensureRotateOverlay();

  if (!rotateOverlay) return;

  const w = window.innerWidth;
  const h = window.innerHeight;

  // Điều kiện hiển thị:
  // - Thiết bị đang ở portrait (đứng)
  // - Và chiều rộng nhỏ hơn 768px (chủ yếu mobile / tablet nhỏ)
  const shouldShow = h > w && w < 768;

  rotateOverlay.style.display = shouldShow ? "flex" : "none";
}
function setupRotateHint() {
  // Tạo overlay nếu chưa có
  ensureRotateOverlay();
  // Cập nhật trạng thái ngay lần đầu
  updateRotateHint();

  // Lắng nghe thay đổi kích thước / xoay
  window.addEventListener("resize", updateRotateHint);
  window.addEventListener("orientationchange", updateRotateHint as any);
}

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
        scene.sound.play("voice_need_finish");
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
