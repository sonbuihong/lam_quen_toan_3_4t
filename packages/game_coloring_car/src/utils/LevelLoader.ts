import Phaser from 'phaser';
import { DataKeys } from '../consts/Keys';
import { GameConstants } from '../consts/GameConstants';
import { GameUtils } from './GameUtils';
import { PaintManager } from './PaintManager';

/**
 * Kieu du lieu tra ve sau khi tao level.
 * Scene se su dung cac thong tin nay de quan ly game state.
 */
export interface LevelData {
    unfinishedPartsMap: Map<string, Phaser.GameObjects.Image>;
    totalParts: number;
}

/**
 * Chiu trach nhiem doc JSON config va tao cac vung to mau (spawn character).
 * Tach rieng tu Scene1 de de bao tri va mo rong them level moi.
 */
export class LevelLoader {
    private scene: Phaser.Scene;
    private paintManager: PaintManager;

    constructor(scene: Phaser.Scene, paintManager: PaintManager) {
        this.scene = scene;
        this.paintManager = paintManager;
    }

    /**
     * Tao level tu JSON config.
     * @returns LevelData chua map cac vung chua to va tong so parts.
     */
    public createLevel(): LevelData {
        const unfinishedPartsMap = new Map<string, Phaser.GameObjects.Image>();
        let totalParts = 0;

        const data = this.scene.cache.json.get(DataKeys.LevelS1Config);
        if (data) {
            const result = this.spawnCharacter(data.teacher);
            result.forEach((hitArea, id) => unfinishedPartsMap.set(id, hitArea));
            totalParts = unfinishedPartsMap.size;
        }

        return { unfinishedPartsMap, totalParts };
    }

    /**
     * Tao nhan vat va cac vung to mau dua tren config JSON.
     * Moi part se duoc tao thanh 1 paintable layer thong qua PaintManager.
     */
    private spawnCharacter(config: any): Map<string, Phaser.GameObjects.Image> {
        const partsMap = new Map<string, Phaser.GameObjects.Image>();
        const cx = GameUtils.pctX(this.scene, config.baseX_pct);
        const cy = GameUtils.pctY(this.scene, config.baseY_pct);

        config.parts.forEach((part: any, index: number) => {
            const id = `${part.key}_${index}`;
            const layerX = cx + part.offsetX;
            const layerY = cy + part.offsetY;

            // Tao vung to mau thong qua PaintManager
            const hitArea = this.paintManager.createPaintableLayer(
                layerX, layerY, part.key, part.scale, id
            );

            // Tinh toan vi tri goi y (centroid cua vung khong trong suot)
            const centerOffset = GameUtils.calculateCenteredOffset(this.scene, part.key);
            hitArea.setData('hintX', centerOffset.x);
            hitArea.setData('hintY', centerOffset.y);
            hitArea.setData('originScale', part.scale);

            // Luu hint points neu co trong config
            if (part.hintPoints && Array.isArray(part.hintPoints)) {
                hitArea.setData('hintPoints', part.hintPoints);
            }

            // SDK Data Setup - Cac truong du lieu can thiet cho PaintTracker
            hitArea.setData("area_px", part.area_px ?? 0);
            hitArea.setData("allowed_colors", part.allowed_colors ?? ["any"]);
            hitArea.setData("correct_color", part.correct_color ?? null);
            hitArea.setData("item_label", part.item_label ?? part.key);

            hitArea.setData("skill_ids", part.skill_ids ?? ["paint_shape"]);

            partsMap.set(id, hitArea);
        });

        // Ve vien (Outline) len tren cung
        this.scene.add
            .image(cx, cy, config.outlineKey)
            .setScale(config.baseScale)
            .setDepth(900);

        return partsMap;
    }
}
