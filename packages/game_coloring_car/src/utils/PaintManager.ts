import Phaser from 'phaser';
import { GameConstants } from '../consts/GameConstants';
import { game } from "@iruka-edu/mini-game-sdk";

// Type alias cho PaintTracker instance
const createPaintTracker = game.createPaintTracker;

/**
 * Quan ly toan bo logic to mau: tao layer, ve brush, kiem tra tien do,
 * freeze/unfreeze part, va tich hop per-part PaintTracker theo game-paint.md.
 *
 * MOI PART = 1 TRACKER (1 ItemResult trong payload stats.items[])
 * MOI LAN BE TO (pointerdown -> pointerup) = 1 ATTEMPT trong history[]
 */
export class PaintManager {
    private scene: Phaser.Scene;

    // Config
    private brushColor: number = GameConstants.PAINT.DEFAULT_COLOR;
    private brushSize: number = GameConstants.PAINT.BRUSH_SIZE;
    private brushTexture: string = 'brush_circle';

    // State
    private isErasing: boolean = false;
    private activeRenderTexture: Phaser.GameObjects.RenderTexture | null = null;
    private activeHitArea: Phaser.GameObjects.Image | null = null;

    // Vi tri cu de ve LERP (noi suy giua cac diem)
    private lastX: number = 0;
    private lastY: number = 0;

    // Camera filter
    private ignoreCameraId: number = 0;

    // Map luu mau da dung cho tung phan
    private partColors: Map<string, Set<number>> = new Map();

    // Khoang cach chua kiem tra de toi uu hieu nang
    private partUncheckedMetrics: Map<string, number> = new Map();

    // Cache mask data de tranh readback GPU nhieu lan
    private maskCache: Map<string, Uint8ClampedArray> = new Map();

    private readonly CHECK_THRESHOLD: number = 300;

    // Canvas tam de tai su dung (khong tao moi lien tuc)
    private helperCanvasPaint: HTMLCanvasElement;
    private helperCanvasMask: HTMLCanvasElement;

    // --- PER-PART PAINT TRACKER (theo game-paint.md) ---
    // 1 part = 1 tracker, moi pointerdown->pointerup = 1 attempt
    private paintTrackers = new Map<string, ReturnType<typeof createPaintTracker>>();
    private nextItemSeq: number = 0;

    // Dem so lan doi mau cho tung part (dung cho response)
    private partColorChangeCount: Map<string, number> = new Map();
    private partLastColor: Map<string, number> = new Map();

    // Luu luong pixel lan to truoc do de tinh delta tung net
    private partPreviousPaintInPx: Map<string, number> = new Map();
    private partPreviousPaintOutPx: Map<string, number> = new Map();

    // Callback khi to xong 1 phan
    private onPartComplete: (id: string, rt: Phaser.GameObjects.RenderTexture, usedColors: Set<number>) => void;

    constructor(
        scene: Phaser.Scene,
        onComplete: (id: string, rt: Phaser.GameObjects.RenderTexture, usedColors: Set<number>) => void
    ) {
        this.scene = scene;
        this.onPartComplete = onComplete;
        this.scene.input.topOnly = false;

        this.helperCanvasPaint = document.createElement('canvas');
        this.helperCanvasMask = document.createElement('canvas');

        this.createBrushTexture();
    }

    private createBrushTexture() {
        if (!this.scene.textures.exists(this.brushTexture)) {
            const canvas = this.scene.textures.createCanvas(this.brushTexture, this.brushSize, this.brushSize);
            if (canvas) {
                const ctx = canvas.context;
                const grd = ctx.createRadialGradient(
                    this.brushSize / 2, this.brushSize / 2, 0,
                    this.brushSize / 2, this.brushSize / 2, this.brushSize / 2
                );
                grd.addColorStop(0, 'rgba(255, 255, 255, 1)');
                grd.addColorStop(1, 'rgba(255, 255, 255, 0)');
                ctx.fillStyle = grd;
                ctx.fillRect(0, 0, this.brushSize, this.brushSize);
                canvas.refresh();
            }
        }
    }

    public setColor(color: number) {
        this.isErasing = false;
        this.brushColor = color;
    }

    public setEraser() {
        this.isErasing = true;
    }

    public setIgnoreCameraId(id: number) {
        this.ignoreCameraId = id;
    }

    public isPainting(): boolean {
        return this.activeRenderTexture !== null;
    }

    // =================================================================
    // PER-PART PAINT TRACKER (game-paint.md)
    // =================================================================

    /**
     * Lay hoac tao PaintTracker cho 1 part.
     * Theo tai lieu game-paint.md section 3:
     * - meta: item_type, seq, run_seq, difficulty, scene_id, scene_seq, scene_type, skill_ids
     * - expected: regions[{id, area_px, allowed_colors, correct_color}], min_region_coverage
     */
    private getOrCreatePaintTracker(partId: string, partKey: string) {
        let t = this.paintTrackers.get(partId);
        if (!t) {
            const seq = ++this.nextItemSeq;
            const scene1 = this.scene as any;

            const hitArea = scene1.unfinishedPartsMap.get(partId);

            const areaPx = hitArea?.getData("area_px") ?? 0;
            const allowedColors = hitArea?.getData("allowed_colors") ?? ["any"];
            const correctColor = hitArea?.getData("correct_color") ?? null;
            const itemLabel = hitArea?.getData("item_label") ?? partKey;

            const minCov =
                hitArea?.getData("min_region_coverage") ?? GameConstants.PAINT.WIN_PERCENT;

            const maxSpill =
                hitArea?.getData("max_spill_ratio") ?? 0;

            t = createPaintTracker({
                meta: {
                    item_type: "paint-shape", // tô hình // hoặc item_type: "paint-char",  // tô chữ
                    seq,
                    item_label: itemLabel,
                    run_seq: scene1.runSeq ?? 1,
                    difficulty: 1,
                    scene_id: "SCN_PAINT_01",
                    scene_seq: seq,
                    scene_type: "paint",
                    skill_ids: [],
                },
                expected: {
                    regions: [
                        {
                            id: partId,
                            area_px: areaPx,
                            allowed_colors: allowedColors,
                            correct_color: correctColor,
                        },
                    ],
                    min_region_coverage: minCov,
                    max_spill_ratio: maxSpill,
                },
            });

            this.paintTrackers.set(partId, t);
        }
        return t;
    }

    // =================================================================
    // PAINTABLE LAYER
    // =================================================================

    /**
     * Tao 1 paintable layer (vung co the to mau).
     * Gom: Mask image, RenderTexture, HitArea tuong tac.
     */
    public createPaintableLayer(
        x: number, y: number, key: string, scale: number, uniqueId: string
    ): Phaser.GameObjects.Image {
        const maskImage = this.scene.make.image({ x, y, key, add: false }).setScale(scale);
        const mask = maskImage.createBitmapMask();

        const rtW = maskImage.width * scale;
        const rtH = maskImage.height * scale;
        const rt = this.scene.add.renderTexture(x - rtW / 2, y - rtH / 2, rtW, rtH);

        rt.clear().setAlpha(0);
        rt.setOrigin(0, 0).setDepth(10);
        rt.setData('id', uniqueId);
        rt.setData('key', key);
        rt.setData('isFinished', false);
        rt.setData('mask', mask);

        if (this.ignoreCameraId) rt.cameraFilter = this.ignoreCameraId;

        // HitArea voi opacity thap de nhan tuong tac nhung khong che hinh
        const hitArea = this.scene.add.image(x, y, key).setScale(scale).setAlpha(0.01).setDepth(50);
        hitArea.setInteractive({ useHandCursor: true, pixelPerfect: true });
        if (this.ignoreCameraId) hitArea.cameraFilter = this.ignoreCameraId;

        hitArea.setData('layer', rt);
        rt.setData('hitArea', hitArea);
        hitArea.setData('id', uniqueId);
        hitArea.setData('partKey', key);

        hitArea.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
            if (this.activeHitArea !== hitArea) {
                if (this.activeHitArea) {
                    this.freezePart(this.activeHitArea);
                }
                this.unfreezePart(hitArea);
                this.activeHitArea = hitArea;
            }

            const activeLayer = hitArea.getData('layer');
            if (!(activeLayer instanceof Phaser.GameObjects.RenderTexture)) return;

            // Bat mask khi cham vao lan dau (toi uu render)
            if (!activeLayer.mask) {
                const storedMask = activeLayer.getData('mask');
                if (storedMask) activeLayer.setMask(storedMask);
            }

            this.activeRenderTexture = activeLayer;
            this.lastX = pointer.x - activeLayer.x;
            this.lastY = pointer.y - activeLayer.y;

            // PaintTracker: Ghi nhan vung nay duoc hien thi (onShown)
            const tracker = this.getOrCreatePaintTracker(uniqueId, key);
            tracker.onShown(Date.now());

            this.paint(pointer, activeLayer);
        });

        return hitArea;
    }

    public handlePointerMove(pointer: Phaser.Input.Pointer) {
        if (pointer.isDown && this.activeRenderTexture) {
            this.paint(pointer, this.activeRenderTexture);
        }
    }

    public handlePointerUp() {
        if (this.isErasing) {
            this.activeRenderTexture = null;
            return;
        }
        if (this.activeRenderTexture) {
            const id = this.activeRenderTexture.getData('id');
            // Luon check progress va gui tracking khi nhac tay (moi lan = 1 attempt)
            this.checkProgressAndTrack(this.activeRenderTexture, this.activeHitArea!);
            this.partUncheckedMetrics.set(id, 0);
            this.activeRenderTexture = null;
        }
    }

    // =================================================================
    // FREEZE / UNFREEZE - Chuyen doi giua RenderTexture va Image tinh
    // =================================================================

    private freezePart(hitArea: Phaser.GameObjects.Image) {
        const currentLayer = hitArea.getData('layer');
        if (currentLayer instanceof Phaser.GameObjects.RenderTexture) {
            const uniqueId = hitArea.getData('id');
            const key = `painted_tex_${uniqueId}`;

            if (this.scene.textures.exists(key)) {
                this.scene.textures.remove(key);
            }
            (currentLayer as any).saveTexture(key);

            const img = this.scene.add.image(currentLayer.x, currentLayer.y, key);
            img.setOrigin(0, 0).setDepth(10);

            const storedMask = currentLayer.getData('mask');
            if (storedMask) img.setMask(storedMask);
            if (this.ignoreCameraId) img.cameraFilter = this.ignoreCameraId;

            img.setData('id', uniqueId);
            img.setData('key', currentLayer.getData('key'));
            img.setData('isFinished', currentLayer.getData('isFinished'));
            img.setData('mask', storedMask);

            hitArea.setData('layer', img);
            currentLayer.destroy();
        }
    }

    private unfreezePart(hitArea: Phaser.GameObjects.Image) {
        const currentLayer = hitArea.getData('layer');

        if (currentLayer instanceof Phaser.GameObjects.Image) {
            const width = currentLayer.width;
            const height = currentLayer.height;
            const x = currentLayer.x;
            const y = currentLayer.y;

            const rt = this.scene.add.renderTexture(x, y, width, height);
            rt.setOrigin(0, 0).setDepth(10);

            currentLayer.clearMask();
            rt.draw(currentLayer, 0, 0);

            const storedMask = currentLayer.getData('mask');
            if (storedMask) rt.setMask(storedMask);
            if (this.ignoreCameraId) rt.cameraFilter = this.ignoreCameraId;

            rt.setData('id', currentLayer.getData('id'));
            rt.setData('key', currentLayer.getData('key'));
            rt.setData('isFinished', currentLayer.getData('isFinished'));
            rt.setData('mask', storedMask);

            hitArea.setData('layer', rt);
            rt.setData('hitArea', hitArea);

            currentLayer.destroy();
        }
    }

    // =================================================================
    // PAINT - Thuat toan LERP de ve muot
    // =================================================================

    private paint(pointer: Phaser.Input.Pointer, rt: Phaser.GameObjects.RenderTexture) {
        const currentX = pointer.x - rt.x;
        const currentY = pointer.y - rt.y;
        const distance = Phaser.Math.Distance.Between(this.lastX, this.lastY, currentX, currentY);

        // Bo qua neu di chuyen qua it
        if (distance < 10) return;

        const id = rt.getData('id');
        const currentDist = this.partUncheckedMetrics.get(id) || 0;
        this.partUncheckedMetrics.set(id, currentDist + distance);

        const stepSize = this.brushSize * 0.65;
        let steps = Math.ceil(distance / stepSize);
        if (steps > 50) steps = 50;
        const offset = this.brushSize / 2;

        for (let i = 0; i < steps; i++) {
            const t = i / steps;
            const interpX = this.lastX + (currentX - this.lastX) * t;
            const interpY = this.lastY + (currentY - this.lastY) * t;

            if (this.isErasing) {
                rt.erase(this.brushTexture, interpX - offset, interpY - offset);
            } else {
                rt.draw(this.brushTexture, interpX - offset, interpY - offset, 1.0, this.brushColor);
            }
        }

        if (this.isErasing) {
            rt.erase(this.brushTexture, currentX - offset, currentY - offset);
        } else {
            rt.draw(this.brushTexture, currentX - offset, currentY - offset, 1.0, this.brushColor);

            // Theo doi mau da dung (ke ca khi da to xong de tiep tuc gui tracking neu be to lai)
            if (!this.partColors.has(id)) {
                this.partColors.set(id, new Set());
            }
            this.partColors.get(id)?.add(this.brushColor);

            // Dem so lan doi mau (dung cho tracking response)
            const lastColor = this.partLastColor.get(id);
            if (lastColor !== undefined && lastColor !== this.brushColor) {
                this.partColorChangeCount.set(id, (this.partColorChangeCount.get(id) || 0) + 1);
            }
            this.partLastColor.set(id, this.brushColor);
        }

        this.lastX = currentX;
        this.lastY = currentY;
    }

    // =================================================================
    // CHECK PROGRESS + TRACKER - Moi lan nhac tay = 1 attempt (onDone)
    // =================================================================

    /**
     * Kiem tra tien do to mau va gui tracking data len SDK.
     * Theo game-paint.md section 5.2: moi pointerup -> tao response va goi onDone.
     */
    private checkProgressAndTrack(
        rt: Phaser.GameObjects.RenderTexture,
        hitArea: Phaser.GameObjects.Image
    ) {
        const id = rt.getData('id');
        const key = rt.getData('key');

        rt.snapshot((snapshot) => {
            if (!(snapshot instanceof HTMLImageElement)) return;

            const w = snapshot.width;
            const h = snapshot.height;
            const checkW = Math.floor(w / 4);
            const checkH = Math.floor(h / 4);

            const ctxPaint = this.getRecycledContext(this.helperCanvasPaint, snapshot, checkW, checkH);
            if (!ctxPaint) return;
            const paintData = ctxPaint.getImageData(0, 0, checkW, checkH).data;

            let maskData = this.maskCache.get(id);
            if (!maskData) {
                const sourceImg = this.scene.textures.get(key).getSourceImage() as HTMLImageElement;
                const ctxMask = this.getRecycledContext(this.helperCanvasMask, sourceImg, checkW, checkH);
                if (!ctxMask) return;
                maskData = ctxMask.getImageData(0, 0, checkW, checkH).data;
                this.maskCache.set(id, maskData);
            }

            let paintInPx = 0;
            let paintOutPx = 0;
            let totalMaskPx = 0;

            for (let i = 3; i < paintData.length; i += 4) {
                if (maskData[i] > 0) {
                    totalMaskPx++;
                    if (paintData[i] > 0) paintInPx++;
                } else {
                    if (paintData[i] > 0) paintOutPx++;
                }
            }

            const previousPaintInPx = this.partPreviousPaintInPx.get(id) || 0;
            const previousPaintOutPx = this.partPreviousPaintOutPx.get(id) || 0;
            
            // Cap nhat cho lan to ke tiep
            this.partPreviousPaintInPx.set(id, paintInPx);
            this.partPreviousPaintOutPx.set(id, paintOutPx);

            let deltaPaintInPx = paintInPx - previousPaintInPx;
            let deltaPaintOutPx = paintOutPx - previousPaintOutPx;

            if (deltaPaintInPx < 0) deltaPaintInPx = 0;
            if (deltaPaintOutPx < 0) deltaPaintOutPx = 0;

            const deltaCoverage = totalMaskPx > 0 ? deltaPaintInPx / totalMaskPx : 0;
            const absoluteCoverage = totalMaskPx > 0 ? paintInPx / totalMaskPx : 0;

            const minCov = GameConstants.PAINT.WIN_PERCENT;
            const expectedAreaPx = Math.max(hitArea.getData("area_px") || 1, 1);

            // --- Build response theo game-paint.md section 5.2 ---
            const colorChangeCount = this.partColorChangeCount.get(id) || 0;
            const hexColorStr = `#${this.brushColor.toString(16).padStart(6, '0')}`;
            
            const strokePaintInPx = Math.floor(deltaCoverage * expectedAreaPx);
            const strokePaintOutPx = Math.floor(deltaPaintOutPx * 16);

            const response = {
                selected_color: [hexColorStr],
                brush_size: this.brushSize,
                color_change_count: colorChangeCount,
                brush_change_count: 0,
                regions_result: [
                    {
                        region_id: id,
                        area_px: expectedAreaPx,
                        paint_in_px: strokePaintInPx,
                        paint_out_px: strokePaintOutPx,
                        coverage: deltaCoverage,
                    },
                ],
                total_paint_in_px: strokePaintInPx,
                total_paint_out_px: strokePaintOutPx,
                completion_pct: deltaCoverage,
            };

            // --- Gui tracking: onDone = 1 attempt ---
            const isCorrect = true;//absoluteCoverage >= minCov;
            const tracker = this.getOrCreatePaintTracker(id, key);
            tracker.onDone(response, Date.now(), {
                isCorrect: isCorrect,
                // errorCode: isCorrect ? null : GameConstants.ERROR_CODES.LOW_COVERAGE,
            });

            // --- Kiem tra hoan thanh vung nay ---
            if (absoluteCoverage >= minCov && !rt.getData('isFinished')) {
                rt.setData('isFinished', true);

                const usedColors = this.partColors.get(id) || new Set([this.brushColor]);
                this.onPartComplete(id, rt, usedColors);
            }
        });
    }

    private getRecycledContext(canvas: HTMLCanvasElement, img: HTMLImageElement, w: number, h: number) {
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.clearRect(0, 0, w, h);
            ctx.drawImage(img, 0, 0, w, h);
        }
        return ctx;
    }

    // =================================================================
    // CLEANUP - Dong tracker khi ket thuc game hoac restart
    // =================================================================

    /**
     * Ghi nhan hint vao tracker cua 1 part cu the.
     * SDK se tang hint_used cua item do, tu do prepareSubmitData() tong hop dung hintCount.
     */
    public addHintToTracker(partId: string, partKey: string) {
        const tracker = this.getOrCreatePaintTracker(partId, partKey);
        tracker.hint(1);
    }

    /**
     * Finalize tat ca tracker con do truoc khi ket thuc game.
     * Theo game-paint.md section 6: truoc prepareSubmitData phai finalize het.
     */
    public closeAllTrackers() {
        this.paintTrackers.forEach((tracker) => {
            if (tracker) {
                tracker.finalize();
            }
        });
        this.paintTrackers.clear();
    }

    /** Xoa du lieu khi restart game */
    public clearTrackersData() {
        this.paintTrackers.clear();
        this.partColors.clear();
        this.partUncheckedMetrics.clear();
        this.partColorChangeCount.clear();
        this.partLastColor.clear();
        this.partPreviousPaintInPx.clear();
        this.partPreviousPaintOutPx.clear();
        this.maskCache.clear();
        this.nextItemSeq = 0;
    }
}
