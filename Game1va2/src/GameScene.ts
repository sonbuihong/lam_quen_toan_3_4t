// GameScene.ts – TypeScript, giữ nguyên logic từ bản JS

import Phaser from "phaser";
import { preloadGameAssets, BUTTON_ASSET_URLS } from "./assetLoader";

// ========== TYPES ==========
interface CardData {
  index: number;
  number: number;
  asset?: string;
  cardW: number;
  cardH: number;
}

type ImageWithData = Phaser.GameObjects.Image & {
  customData?: CardData;
  hoverTint?: number;
  activeTint?: number;
};

interface HolePos {
  x: number;
  y: number;
}

interface LineSegment {
  x0: number;
  y0: number;
  bodyLen: number;
  thickness: number;
  angle: number;
}

interface LevelItem {
  number: number;
  asset: string;
  label: string;
}

interface LevelConfig {
  items: LevelItem[];
  background: string;
  character: string;
}

// ========== CONSTANTS ==========
// Dịch ngang: 0.0 = mép trái, 1.0 = mép phải
const HOLE_OFFSET_X_RATIO = 0.2;

// Dịch dọc: 0.5 = giữa; <0.5 lên trên; >0.5 xuống dưới
const HOLE_OFFSET_Y_LEFT_RATIO = 0.494;
const HOLE_OFFSET_Y_RIGHT_RATIO = 0.494;

// Bán kính lỗ = tỉ lệ theo chiều cao card gốc (225px, lỗ 32px)
const HOLE_RADIUS_RATIO = (32 / 2) / 225;

//const HOLE_ALONG_FACTOR = 0.85;
const LINE_THICKNESS_FACTOR = 0.55;
//const LINE_TRIM_FACTOR = 0.12;

// Độ lệch lỗ theo đường chéo (chưa dùng, để 0)
const HOLE_SLOPE_OFFSET_RATIO = 0.0;

// Offset tinh chỉnh theo index từng thẻ
const HOLE_OFFSET_NUMBER_DX = [0.139, 0.133, 0.138, 0.138];
const HOLE_OFFSET_NUMBER_DY = [-0.038, -0.027, -0.030, -0.017];

const HOLE_OFFSET_OBJECT_DX = [-0.138, -0.133, -0.133, -0.138];
const HOLE_OFFSET_OBJECT_DY = [-0.034, -0.034, -0.014, -0.019];

// Tay hướng dẫn
const HAND_ASSET_KEY = "hand";
const HAND_FINGER_ORIGIN_X = 0.8;
const HAND_FINGER_ORIGIN_Y = 0.2;

const ALL_ASSETS_12 = [
  "flower",
  "bear",
  "ball",
  "marble",
  "drum",
  "rabbit",
  "clock",
  "red",
  "yellow",
  "babie",
];

const LABEL_BY_ASSET: Record<string, string> = {};

const ONE_TWO_PATTERNS = [
  [1, 1, 1, 2],
  [1, 1, 2, 2],
  [1, 2, 2, 2],
];

// ========== UTILS ==========
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildOneTwoLevels(): LevelConfig[] {
  const shuffledAssets = shuffle(ALL_ASSETS_12);

  const level1 = shuffledAssets.slice(0, 4);
  const level2 = shuffledAssets.slice(4, 8);
  const level3 = shuffledAssets.slice(8, 10).concat(shuffledAssets.slice(0, 2));

  const bgKeys = ["bg1", "bg2", "bg3"];
  const charKeys = ["char1", "char2", "char1"];

  const groups = [level1, level2, level3];

  return groups.map((assets, i) => {
    const pattern =
      ONE_TWO_PATTERNS[Math.floor(Math.random() * ONE_TWO_PATTERNS.length)];

    const items: LevelItem[] = assets.map((key, idx) => ({
      number: pattern[idx],
      asset: key,
      label: LABEL_BY_ASSET[key] || "",
    }));

    return {
      items,
      background: bgKeys[i],
      character: charKeys[i],
    };
  });
}

// ========== MAIN CLASS ==========
export default class GameScene extends Phaser.Scene {
  levels: LevelConfig[];
  level: number = 0;

  handHint: Phaser.GameObjects.Image | null = null;
  scaleBG: number = 1;

  numbers: ImageWithData[] = [];
  objects: ImageWithData[] = [];

  matches: boolean[] = [];
  permanentLines: Phaser.GameObjects.Image[] = [];
  dragLine: Phaser.GameObjects.Image | null = null;

  isDragging: boolean = false;
  dragStartIdx: number | null = null;

  replayBtn?: Phaser.GameObjects.GameObject;
  nextBtn?: Phaser.GameObjects.GameObject;

  bgm?: Phaser.Sound.BaseSound;

  constructor() {
    super({ key: "GameScene" });
    this.levels = buildOneTwoLevels();
  }

  preload() {
    preloadGameAssets(this);
  }

  init(data: { level?: number }) {
    this.level = typeof data.level === "number" ? data.level : 0;
  }

  // Bán kính lỗ theo chiều cao thẻ hiện tại
  getHoleRadius(card: Phaser.GameObjects.Image): number {
    return card.displayHeight * HOLE_RADIUS_RATIO;
  }

  // Tính tâm lỗ trên 1 card
  getHolePos(
    card: ImageWithData,
    side: "left" | "right" = "right",
    slopeDir: number = 0
  ): HolePos {
    const offsetX = card.displayWidth * HOLE_OFFSET_X_RATIO;

    const yRatio =
      side === "right" ? HOLE_OFFSET_Y_RIGHT_RATIO : HOLE_OFFSET_Y_LEFT_RATIO;

    const baseOffsetY = card.displayHeight * (yRatio - 0.5);
    const slopeOffset = slopeDir * card.displayHeight * HOLE_SLOPE_OFFSET_RATIO;

    let idx = card.customData?.index ?? 0;
    idx = Math.min(3, Math.max(0, idx));

    let extraDX = 0;
    let extraDY = 0;

    if (side === "right") {
      extraDX = card.displayWidth * (HOLE_OFFSET_NUMBER_DX[idx] || 0);
      extraDY = card.displayHeight * (HOLE_OFFSET_NUMBER_DY[idx] || 0);
    } else {
      extraDX = card.displayWidth * (HOLE_OFFSET_OBJECT_DX[idx] || 0);
      extraDY = card.displayHeight * (HOLE_OFFSET_OBJECT_DY[idx] || 0);
    }

    const baseX =
      side === "right"
        ? card.x + card.displayWidth / 2 - offsetX
        : card.x - card.displayWidth / 2 + offsetX;

    const baseY = card.y + baseOffsetY + slopeOffset;

    return {
      x: baseX + extraDX,
      y: baseY + extraDY,
    };
  }

  // Tính đoạn line giữa 2 lỗ
  computeSegment(
    start: HolePos,
    end: HolePos,
    rStart: number,
    rEnd: number,
    thicknessFactor = LINE_THICKNESS_FACTOR,
    innerFactor = 0.8
  ): LineSegment {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;

    const cStart = rStart * innerFactor;
    const cEnd = rEnd * innerFactor;

    const bodyLen = Math.max(dist - cStart - cEnd, 0);

    const x0 = start.x + (dx / dist) * cStart;
    const y0 = start.y + (dy / dist) * cStart;

    const thickness = rStart * 2 * thicknessFactor;
    const angle = Math.atan2(dy, dx);

    return { x0, y0, bodyLen, thickness, angle };
  }

  drawAllLines() {
    this.permanentLines.forEach((l) => l.destroy());
    this.permanentLines = [];

    if (!this.matches) return;

    for (let i = 0; i < this.matches.length; i++) {
      if (!this.matches[i]) continue;

      const startCard = this.numbers[i];
      const n = startCard.customData!.number;

      const objIdx = this.objects.findIndex(
        (o) =>
          o.customData!.number === n && o.texture.key.startsWith("card_yellow2")
      );
      if (objIdx === -1) continue;

      const endCard = this.objects[objIdx];

      const dyC = endCard.y - startCard.y;
      let sStart = 0,
        sEnd = 0;
      if (dyC !== 0) {
        sStart = -1;
        sEnd = 1;
      }

      const start = this.getHolePos(startCard, "right", sStart);
      const end = this.getHolePos(endCard, "left", sEnd);

      const rStart = this.getHoleRadius(startCard);
      const rEnd = this.getHoleRadius(endCard);

      const seg = this.computeSegment(start, end, rStart, rEnd);

      const line = this.add
        .image(seg.x0, seg.y0, "line_glow")
        .setOrigin(0, 0.5)
        .setDisplaySize(seg.bodyLen, seg.thickness)
        .setRotation(seg.angle);

      this.permanentLines.push(line);
    }
  }

  create() {
    const cam = this.cameras.main;
    const width = cam.width;
    const height = cam.height;
        // Hiện nút viewport ở màn game
    (window as any).setGameButtonsVisible?.(true);

    this.input.setDefaultCursor("default");

    // ===== BGM =====
    let bgm = this.sound.get("bgm_main") as Phaser.Sound.BaseSound | null;
    if (!bgm) {
      bgm = this.sound.add("bgm_main", { loop: true, volume: 0.28 });
      bgm.play();
    } else if (!bgm.isPlaying) {
      bgm.play();
    }
    this.bgm = bgm;

    const level = this.levels[this.level];

    // Random background viewport cho màn game (ngoài canvas)
    (window as any).setRandomGameViewportBg?.();

    // ===== GÁN ASSET PRELOAD CHO NÚT VIEWPORT =====
    const replayBtnEl = document.getElementById("btn-replay") as HTMLButtonElement | null;
    const nextBtnEl = document.getElementById("btn-next") as HTMLButtonElement | null;

    const setBtnBgFromUrl = (el: HTMLButtonElement | null, url: string | undefined) => {
      if (!el || !url) return;
      el.style.backgroundImage = `url("${url}")`;
      el.style.backgroundRepeat = "no-repeat";
      el.style.backgroundPosition = "center";
      el.style.backgroundSize = "contain";
    };

    setBtnBgFromUrl(replayBtnEl, BUTTON_ASSET_URLS.replay_svg);
    setBtnBgFromUrl(nextBtnEl, BUTTON_ASSET_URLS.next_svg);

    const ensureNearest = (key: string | undefined) => {
      if (!key) return;
      if (this.textures.exists(key)) {
        this.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
      }
    };

    if (level) {
      ensureNearest(level.background);
      ensureNearest(level.character);
    }

    ["line_glow"].forEach((key) => ensureNearest(key));

    let scaleBG = 1;
    this.scaleBG = 1;

    // ===== CHARACTER =====
    let scaleChar: number;
    let charX: number;
    const charY = height - 10;

    const baseCharScale = height / 720;
    scaleChar = baseCharScale * 0.65;
    charX = width * 0.11;

        if (this.textures.exists(level.character)) {
          const charImg = this.add
            .image(charX, charY, level.character)
            .setOrigin(0.5, 1)
            .setScale(scaleChar);

          // Animation: nhún + lắc nhẹ
          this.tweens.add({
            targets: charImg,
            y: charY - height * 0.02,
            duration: 900,
            yoyo: true,
            repeat: -1,
            ease: "Sine.inOut",
          });

          this.tweens.add({
            targets: charImg,
            angle: { from: -2, to: 2 },
            duration: 900,
            yoyo: true,
            repeat: -1,
            ease: "Sine.inOut",
          });

          // Debug thông tin ảnh nhân vật (tuỳ bạn giữ hay bỏ)
          const charFrame = charImg.texture.getSourceImage();
          const charOrigW = charFrame.width || charImg.texture.get().width;
          const charOrigH = charFrame.height || charImg.texture.get().height;
          console.log(
            "CHAR texture:",
            charImg.texture.key,
            "goc:",
            charOrigW,
            charOrigH,
            "size:",
            charImg.width,
            charImg.height,
            "displaySize:",
            charImg.displayWidth,
            charImg.displayHeight,
            "scale:",
            charImg.scaleX,
            charImg.scaleY
          );
        } else {
          this.add
            .text(charX, charY, "😊", {
              fontSize: `${Math.round(120 * scaleChar)}px`,
            })
            .setOrigin(0.5, 1);
        }


    // ===== BOARD =====
    const items = level.items;
    const shuffled = Phaser.Utils.Array.Shuffle([...items]);

    const boardOrigW = 1603;
    const boardOrigH = 1073;

    let boardAreaW: number;
    let boardAreaH: number;
    let boardX: number;
    let boardY: number;

    const marginX = width * 0.05;
    const spanW = width - 2 * marginX;
    boardAreaW = spanW * 0.9;
    boardAreaH = height * 0.7;
    boardX = width * 0.56;
    boardY = height * 0.48;

    let scaleBoard = Math.min(
      boardAreaW / boardOrigW,
      boardAreaH / boardOrigH,
      1
    );
    const boardW = boardOrigW * scaleBoard;
    const boardH = boardOrigH * scaleBoard;

    if (this.textures.exists("board")) {
      const boardImg = this.add
        .image(boardX, boardY, "board")
        .setOrigin(0.5)
        .setScale(scaleBoard);
      const boardFrame = boardImg.texture.getSourceImage();
      const boardOrigW2 = boardFrame.width || boardImg.texture.get().width;
      const boardOrigH2 = boardFrame.height || boardImg.texture.get().height;
      console.log(
        "BOARD texture:",
        boardImg.texture.key,
        "goc:",
        boardOrigW2,
        boardOrigH2,
        "size:",
        boardImg.width,
        boardImg.height,
        "displaySize:",
        boardImg.displayWidth,
        boardImg.displayHeight,
        "scale:",
        boardImg.scaleX,
        boardImg.scaleY
      );
    }

    const colObjX = boardX - boardW * 0.25;
    const colNumX = boardX + boardW * 0.25;

    this.numbers = [];
    this.objects = [];

    const cardGap = 20 * scaleBoard;
    const cardW = 685 * scaleBoard;
    const cardH = 249 * scaleBoard;
    const totalH = 4 * cardH + 3 * cardGap;
    const verticalNudge = boardH * 0.012;
    const baseY = boardY - totalH / 2 + cardH / 2 + verticalNudge;

    // ===== NUMBER CARDS (LEFT) =====
    this.matches = Array(4).fill(false);

    items.forEach((item, i) => {
      const y = baseY + i * (cardH + cardGap);

      const card = this.add
        .image(colObjX, y, "card")
        .setOrigin(0.5)
        .setDisplaySize(cardW, cardH) as ImageWithData;

      const cardFrame = card.texture.getSourceImage();
      const cardOrigW = cardFrame.width || card.texture.get().width;
      const cardOrigH = cardFrame.height || card.texture.get().height;
      console.log(
        "CARD texture:",
        card.texture.key,
        "goc:",
        cardOrigW,
        cardOrigH,
        "size:",
        card.width,
        card.height,
        "displaySize:",
        card.displayWidth,
        card.displayHeight,
        "scale:",
        card.scaleX,
        card.scaleY
      );

      const hoverTint = 0xfff9c4;
      const activeTint = 0xffe082;

      card.setInteractive({
        useHandCursor: true,
        cursor: "pointer",
        draggable: true,
      });

      card.on("pointerover", () => {
        if (!this.matches[i] && this.dragStartIdx !== i) {
          card.setTint(hoverTint);
        }
      });

      card.on("pointerout", () => {
        if (!this.matches[i] && this.dragStartIdx !== i) {
          card.clearTint();
        }
      });

      this.add
        .text(colObjX, y, String(item.number), {
          fontFamily: "Fredoka",
          fontSize: `${Math.round(cardH * 0.65)}px`,
          color: "#ff006e",
          fontStyle: "900",
          stroke: "#fff",
          strokeThickness: Math.round(cardH * 0.08),
          resolution: 2,
          align: "center",
        })
        .setOrigin(0.5, 0.5);

      card.customData = {
        index: i,
        number: item.number,
        cardW,
        cardH,
      };

      card.hoverTint = hoverTint;
      card.activeTint = activeTint;

      this.numbers.push(card);
    });

    // ===== OBJECT CARDS (RIGHT) =====
    shuffled.forEach((item, i) => {
      const y = baseY + i * (cardH + cardGap);

      const card = this.add
        .image(colNumX, y, "card2")
        .setOrigin(0.5)
        .setDisplaySize(cardW, cardH) as ImageWithData;

      const card2Frame = card.texture.getSourceImage();
      const card2OrigW = card2Frame.width || card.texture.get().width;
      const card2OrigH = card2Frame.height || card.texture.get().height;
      console.log(
        "CARD2 texture:",
        card.texture.key,
        "goc:",
        card2OrigW,
        card2OrigH,
        "size:",
        card.width,
        card.height,
        "displaySize:",
        card.displayWidth,
        card.displayHeight,
        "scale:",
        card.scaleX,
        card.scaleY
      );

      const dropHoverTint = 0xc8e6ff;

      card.setInteractive({ useHandCursor: true, cursor: "pointer" });

      card.on("pointerover", () => {
        if (!card.texture || card.texture.key !== "card_yellow2") {
          card.setTint(dropHoverTint);
        }
      });

      card.on("pointerout", () => {
        card.clearTint();
      });

      if (this.textures.exists(item.asset)) {
        const tmp = this.add.image(0, 0, item.asset);
        const aW = tmp.width;
        const aH = tmp.height;
        const iconFrame = tmp.texture.getSourceImage();
        const iconOrigW = iconFrame.width || tmp.texture.get().width;
        const iconOrigH = iconFrame.height || tmp.texture.get().height;
        console.log(
          "ICON texture:",
          tmp.texture.key,
          "goc:",
          iconOrigW,
          iconOrigH,
          "size:",
          aW,
          aH
        );
        tmp.destroy();

        const count = item.number;
        const gapX = -10;

        const maxIconHeight = cardH * (count === 1 ? 0.98 : 0.95);
        let iconScale = maxIconHeight / aH;

        const iconWidthScaled = aW * iconScale;
        const totalWidth = count * iconWidthScaled + (count - 1) * Math.abs(gapX);
        const maxWidth = cardW * 0.9;
        if (totalWidth > maxWidth) {
          const shrink = maxWidth / totalWidth;
          iconScale *= shrink;
        }

        iconScale = Math.round(iconScale * 1000) / 1000;

        console.log("ICON scale calc:", {
          asset: item.asset,
          count,
          cardW,
          cardH,
          aW,
          aH,
          maxIconHeight,
          iconWidthScaled: aW * iconScale,
          totalWidth: count * aW * iconScale + (count - 1) * Math.abs(gapX),
          maxWidth,
          iconScale,
        });

        const stepX = aW * iconScale + gapX;
        const groupWidth = aW * iconScale + (count - 1) * stepX;

        const startX = colNumX - groupWidth / 2 + (aW * iconScale) / 2;

        for (let k = 0; k < count; k++) {
          const iconImg = this.add
            .image(startX + k * stepX, y, item.asset)
            .setOrigin(0.5, 0.5)
            .setScale(iconScale);
          console.log(
            "ICON render:",
            iconImg.texture.key,
            "displaySize:",
            iconImg.displayWidth,
            iconImg.displayHeight,
            "scale:",
            iconImg.scaleX,
            iconImg.scaleY
          );
        }
      }

      this.add
        .text(colNumX, y + cardH / 2 - 32 * scaleBG, item.label || "", {
          fontFamily: "Fredoka",
          fontSize: `${Math.round(48 * scaleBG)}px`,
          color: "#222",
          stroke: "#fff",
          strokeThickness: 6,
          shadow: {
            offsetX: 0,
            offsetY: 2,
            color: "#000",
            blur: 4,
          },
          resolution: 2,
          align: "center",
        })
        .setOrigin(0.5, 0.5);

      card.customData = {
        index: i,
        number: item.number,
        asset: item.asset,
        cardW,
        cardH,
      };

      this.objects.push(card);
    });

    // ===== HAND HINT – CHỈ LEVEL ĐẦU =====
    if (this.level === 0) {
      this.createHandHintForFirstPair(items);

      this.input.once("pointerdown", () => {
        if (this.handHint) {
          this.tweens.add({
            targets: this.handHint,
            alpha: 0,
            duration: 200,
            onComplete: () => {
              this.handHint?.destroy();
              this.handHint = null;
            },
          });
        }
      });
    }

    // ===== DRAG CONNECT =====
    this.permanentLines = [];
    this.dragLine = null;
    this.isDragging = false;
    this.dragStartIdx = null;
    this.matches = Array(4).fill(false);

    this.numbers.forEach((numCard, idx) => {
      numCard.on("pointerdown", () => {
        if (this.matches[idx]) return;

        this.isDragging = true;
        this.dragStartIdx = idx;

        if (numCard.activeTint) {
          numCard.setTint(numCard.activeTint);
        }

        const start = this.getHolePos(numCard, "right", 0);
        const r = this.getHoleRadius(numCard);
        const thick = r * 2 * LINE_THICKNESS_FACTOR;

        this.dragLine = this.add
          .image(start.x, start.y, "line_glow")
          .setOrigin(0, 0.5)
          .setDisplaySize(1, thick)
          .setAlpha(0);

        this.tweens.add({
          targets: this.dragLine,
          alpha: { from: 0, to: 1 },
          duration: 120,
          ease: "Quad.Out",
        });
      });
    });

    this.input.on("pointermove", (p: Phaser.Input.Pointer) => {
      if (!this.isDragging || this.dragStartIdx === null || !this.dragLine) return;

      const startCard = this.numbers[this.dragStartIdx];
      const dyC = p.y - startCard.y;
      const s = dyC !== 0 ? -1 : 0;

      const start = this.getHolePos(startCard, "right", s);
      const rStart = this.getHoleRadius(startCard);

      const end = { x: p.x, y: p.y };
      const seg = this.computeSegment(start, end, rStart, 0);

      this.dragLine.x = seg.x0;
      this.dragLine.y = seg.y0;
      this.dragLine.setDisplaySize(seg.bodyLen, seg.thickness);
      this.dragLine.rotation = seg.angle;
    });

    this.input.on("pointerup", (p: Phaser.Input.Pointer) => {
      if (!this.isDragging || this.dragStartIdx === null) return;

      const startIndex = this.dragStartIdx;
      const startCard = this.numbers[startIndex];
      const n = items[startIndex].number;

      let matched = false;

      this.objects.forEach((objCardRaw) => {
        const b = objCardRaw.getBounds();
        if (!Phaser.Geom.Rectangle.Contains(b, p.x, p.y)) return;

        const objCard = objCardRaw;
        const objN = objCard.customData!.number;

        if (n !== objN && !this.matches[startIndex]) {
          this.sound.play("sfx_wrong");
        }

        if (n === objN && !this.matches[startIndex]) {
          matched = true;
          this.matches[startIndex] = true;

          this.sound.play("sfx_correct");

          startCard.clearTint();
          objCard.clearTint();

          startCard
            .setTexture("card_yellow")
            .setDisplaySize(
              startCard.customData!.cardW,
              startCard.customData!.cardH
            );

          objCard
            .setTexture("card_yellow2")
            .setDisplaySize(
              objCard.customData!.cardW,
              objCard.customData!.cardH
            );

          if (this.dragLine) {
            const dyC2 = objCard.y - startCard.y;
            let sStart = 0,
              sEnd = 0;
            if (dyC2 !== 0) {
              sStart = -1;
              sEnd = 1;
            }

            const st = this.getHolePos(startCard, "right", sStart);
            const ed = this.getHolePos(objCard, "left", sEnd);

            const rStart = this.getHoleRadius(startCard);
            const rEnd = this.getHoleRadius(objCard);

            const seg = this.computeSegment(st, ed, rStart, rEnd);

            this.dragLine.x = seg.x0;
            this.dragLine.y = seg.y0;
            this.dragLine.setDisplaySize(seg.bodyLen, seg.thickness);
            this.dragLine.rotation = seg.angle;

            this.permanentLines.push(this.dragLine);
            this.dragLine = null;
          }
        }
      });

      if (!matched) {
        if (this.dragLine) this.dragLine.destroy();
        if (!this.matches[startIndex]) startCard.clearTint();
      }

      this.isDragging = false;
      this.dragStartIdx = null;

      if (this.matches.every((m) => m)) {
        this.time.delayedCall(2000, () => {
          this.sound.play("voice_complete");
        });
      }
    });
  }

  // Tay gợi ý cho cặp đầu tiên
  createHandHintForFirstPair(items: LevelItem[]) {
    if (!this.textures.exists(HAND_ASSET_KEY)) return;
    if (!this.numbers || !this.objects || this.numbers.length === 0) return;

    for (let i = 0; i < this.numbers.length; i++) {
      const numCard = this.numbers[i];
      const n = items[i]?.number;
      if (n == null) continue;

      const objCard = this.objects.find(
        (o) => o.customData && o.customData.number === n
      );
      if (!objCard) continue;

      const startPos = this.getHolePos(numCard, "right", 0);
      const rawEndPos = this.getHolePos(objCard, "left", 0);

      const extraIntoObject = objCard.displayWidth * 0.35;

      const endPos = {
        x: rawEndPos.x + extraIntoObject,
        y: rawEndPos.y,
      };

      const handScale = this.scaleBG * 0.6;

      this.handHint = this.add
        .image(startPos.x, startPos.y, HAND_ASSET_KEY)
        .setOrigin(HAND_FINGER_ORIGIN_X, HAND_FINGER_ORIGIN_Y)
        .setScale(handScale)
        .setAlpha(0.95);

      this.tweens.add({
        targets: this.handHint,
        x: endPos.x,
        y: endPos.y,
        duration: 800,
        yoyo: true,
        repeat: -1,
        ease: "Sine.inOut",
      });

      this.tweens.add({
        targets: this.handHint,
        angle: { from: -8, to: 8 },
        duration: 500,
        yoyo: true,
        repeat: -1,
        ease: "Sine.inOut",
      });

      break;
    }
  }

  redrawLines() {
    this.drawAllLines();
  }

  createButton(
    x: number,
    y: number,
    label: string,
    assetKey: string | null,
    bgColor: string | null,
    onClick: () => void,
    size: number = 32
  ): Phaser.GameObjects.GameObject {
    let btn: Phaser.GameObjects.GameObject;

    if (assetKey && this.textures.exists(assetKey)) {
      const img = this.add
        .image(x, y, assetKey)
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true, cursor: "pointer" })
        .setDisplaySize(size, size);

      img.on("pointerdown", onClick);
      btn = img;
    } else {
      const txt = this.add
        .text(x, y, label, {
          fontFamily: "Fredoka",
          fontSize: `${size}px`,
          color: "#fff",
          backgroundColor: bgColor || undefined,
          padding: { left: 16, right: 16, top: 8, bottom: 8 },
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true, cursor: "pointer" });

      txt.on("pointerdown", onClick);
      btn = txt;
    }

    return btn;
  }

  isLevelComplete(): boolean {
    return this.matches.every((m) => m);
  }
}
