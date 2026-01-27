import Phaser from 'phaser';
import { SceneKeys, TextureKeys } from '../consts/Keys';
import { GameConstants } from '../consts/GameConstants';
import { GameUtils } from '../utils/GameUtils';
import { PaintManager } from '../utils/PaintManager';

export default class UIScene extends Phaser.Scene {
    private paintManager!: PaintManager;
    private sceneKey!: string;
    private paletteButtons: Phaser.GameObjects.Image[] = [];
    private firstColorBtn!: Phaser.GameObjects.Image;
    public handHint!: Phaser.GameObjects.Image;
    constructor() {
        super(SceneKeys.UI);
    }

    init(data: { paintManager: PaintManager; sceneKey: string }) {
        this.paintManager = data.paintManager;
        this.sceneKey = data.sceneKey; // Lưu sceneKey để dùng
        this.paletteButtons = [];
    }

    create() {
        this.createUI();
    }

    private bannerImage!: Phaser.GameObjects.Image;
    private bannerText!: Phaser.GameObjects.Image;
    private decorImage!: Phaser.GameObjects.Image;
    private so1Image!: Phaser.GameObjects.Image;
    private diceImage!: Phaser.GameObjects.Image;

    private createUI() {
        this.refreshBanner();
        
        // Tạo bàn tay gợi ý (ẩn đi, set depth cao nhất để đè lên mọi thứ)
        this.handHint = this.add
            .image(0, 0, TextureKeys.HandHint)
            .setDepth(2000) // Đảm bảo nó nằm trên các phần tử UI khác
            .setAlpha(0)
            .setScale(0.7);
        
        this.createPalette();
    }

    public updateScene(data: { paintManager: PaintManager; sceneKey: string }) {
        if (!this.sys) return; // ✅ Guard clause: Prevent update if scene is destroyed

        this.paintManager = data.paintManager;
        this.sceneKey = data.sceneKey; // Lưu sceneKey để dùng
        
        // Cập nhật Banner theo Scene mới
        this.refreshBanner();

        // Reset Palette Visuals (Optionally, if we want to reset active color visual)
        this.resetPaletteVisuals(); 
    }

    private refreshBanner() {
        if (!this.sys) return; // ✅ Guard clause

        const UI = GameConstants.SCENE1.UI;
        const cx = GameUtils.pctX(this, 0.5);
        const bannerY = GameUtils.pctY(this, UI.BANNER_Y);

        // Xác định TextureKeys dựa trên SceneKey
        let bannerKey = TextureKeys.S1_Banner;
        let textBannerKey = TextureKeys.S1_Banner_Text;
        let textOriginY = -0.7; // Mặc định cho Scene 1

        if (this.sceneKey === SceneKeys.Scene2) {
            textBannerKey = TextureKeys.S2_Banner_Text;
            textOriginY = -0.8; // Ví dụ: Scene 2 chỉnh lại
        } else if (this.sceneKey === SceneKeys.Scene3) {
            textBannerKey = TextureKeys.S3_Banner_Text;
            textOriginY = -1; // Ví dụ: Scene 3 chỉnh lại
        }

        // --- UPDATE OR CREATE BANNER IMAGE ---
        if (this.bannerImage) {
            this.bannerImage.setTexture(bannerKey);
        } else {
            this.bannerImage = this.add.image(cx, bannerY, bannerKey).setScale(0.7).setOrigin(0.5, -0.1);
        }

        // --- UPDATE OR CREATE BANNER TEXT ---
        if (this.bannerText) {
            this.bannerText.setTexture(textBannerKey);
            this.bannerText.setOrigin(0.5, textOriginY); // Cập nhật origin
        } else {
            this.bannerText = this.add.image(cx, bannerY, textBannerKey).setScale(0.9).setOrigin(0.5, textOriginY);
        }
    }

    private createPalette() {
        const UI = GameConstants.SCENE1.UI;
        // Chọn bộ màu dựa trên SceneKey
        const paletteData = GameConstants.PALETTE_DATA;

        const spacingX = GameUtils.pctX(this, UI.PALETTE_SPACING_X);
        const paletteY = GameUtils.pctY(this, UI.PALETTE_Y);
        
        // Tính toán vị trí bắt đầu để căn giữa
        const totalItems = paletteData.length + 1; // +1 cho Eraser
        const totalWidth = (totalItems - 1) * spacingX;
        const startX = (GameUtils.getW(this) - totalWidth) / 2;

        paletteData.forEach((item, i) => {
            const btnX = startX + i * spacingX;
            const btnY = paletteY;

            const btn = this.add.image(btnX, btnY, item.key).setInteractive().setDepth(1);

            // Logic visual: Nút đầu tiên to hơn (đang chọn)
            if (i === 0) {
                this.firstColorBtn = btn;
                btn.setScale(0.9).setAlpha(1);
                this.paintManager.setColor(item.color); // ✅ Sync màu cọ với nút đầu tiên
            } else {
                btn.setAlpha(0.8).setScale(0.7);
            }

            btn.on('pointerdown', () => {
                this.updatePaletteVisuals(btn);
                this.paintManager.setColor(item.color); // Đổi màu cọ
            });
            this.paletteButtons.push(btn);
        });

        // Tạo nút Tẩy (Eraser) - Nằm tiếp theo trong hàng ngang
        const eraserIndex = paletteData.length;
        const eraserX = startX + eraserIndex * spacingX;
        const eraserY = paletteY;

        const eraser = this.add
            .image(eraserX, eraserY, TextureKeys.BtnEraser)
            .setInteractive()
            .setAlpha(0.8)
            .setScale(0.7)
            .setDepth(1);
        eraser.on('pointerdown', () => {
            this.updatePaletteVisuals(eraser);
            this.paintManager.setEraser();
        });
        this.paletteButtons.push(eraser);
    }

    // Cập nhật hiệu ứng to/nhỏ của các nút màu khi được chọn
    private updatePaletteVisuals(activeBtn: Phaser.GameObjects.Image) {
        this.paletteButtons.forEach((b) => b.setScale(0.7).setAlpha(0.8));
        activeBtn.setScale(0.9).setAlpha(1);
    }

    public hidePalette() {
        this.tweens.add({
            targets: this.paletteButtons,
            scale: 0,
            alpha: 0,
            duration: 500,
            ease: 'Back.In'
        });
    }

    public hideBanners() {
        if (this.bannerImage) this.bannerImage.destroy();
        if (this.bannerText) this.bannerText.destroy();
        if (this.decorImage) this.decorImage.destroy();
        if (this.so1Image) this.so1Image.destroy();
        if (this.diceImage) this.diceImage.destroy();
    }

    private resetPaletteVisuals() {
        if (!this.paletteButtons || this.paletteButtons.length === 0) return;

        // Reset tất cả về state không chọn
        this.paletteButtons.forEach((b) => b.setScale(0.7).setAlpha(0.8));

        // Highlight nút đầu tiên (nút màu đỏ)
        if (this.firstColorBtn) {
            this.firstColorBtn.setScale(0.9).setAlpha(1);
        }

        // --- QUAN TRỌNG: Đặt lại màu cho PaintManager trùng với nút đầu tiên ---
        const firstColor = GameConstants.PALETTE_DATA[0].color;
        this.paintManager.setColor(firstColor);
    }
}
