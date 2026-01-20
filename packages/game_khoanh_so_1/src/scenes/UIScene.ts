import Phaser from 'phaser';
import { SceneKeys, TextureKeys } from '../consts/Keys';
import { GameConstants } from '../consts/GameConstants';
import { GameUtils } from '../utils/GameUtils';

export default class UIScene extends Phaser.Scene {
    private sceneKey!: string;
    private paletteButtons: Phaser.GameObjects.Image[] = [];
    private firstColorBtn!: Phaser.GameObjects.Image;
    public handHint!: Phaser.GameObjects.Image;

    constructor() {
        super(SceneKeys.UI);
    }

    init(data: { sceneKey: string }) {
        this.sceneKey = data.sceneKey; // Lưu sceneKey để dùng
        this.paletteButtons = [];
    }

    create() {
        this.createUI();
    }

    private bannerImage!: Phaser.GameObjects.Image;
    private bannerText!: Phaser.GameObjects.Image;

    private createUI() {
        const UI = GameConstants.SCENE1.UI;
        const cx = GameUtils.pctX(this, 0.5);

        // Tính toán vị trí Board dựa trên Banner
        const bannerY = GameUtils.pctY(this, UI.BANNER_Y);
        // Xác định TextureKeys dựa trên SceneKey
        let bannerKey = TextureKeys.S1_Banner;
        let titleKey = TextureKeys.Title1;
        // Hiển thị Banner và Text
        this.bannerImage = this.add.image(cx, bannerY, bannerKey).setScale(0.7).setOrigin(0.5, -0.1);
        
        // Title
        this.add.image(cx, bannerY, titleKey)
            .setOrigin(0.5, -0.75)
            .setScale(1);
        
        // Decor
                // Hiển thị Decor
                this.add.image(cx * 1.79, bannerY + 290, TextureKeys.Decor).setScale(1).setOrigin(0.5, 0.5);
                this.add.image(cx * 0.125, bannerY + 180, TextureKeys.Number).setScale(1).setOrigin(0.5, -0.1);
                this.add.image(cx * 0.255, bannerY + 170, TextureKeys.Dice).setScale(1).setOrigin(0.5, -0.1);
        
        // Tạo bàn tay gợi ý (ẩn đi, set depth cao nhất để đè lên mọi thứ)
        this.handHint = this.add
            .image(0, 0, TextureKeys.HandHint)
            .setDepth(2000) // Đảm bảo nó nằm trên các phần tử UI khác
            .setAlpha(0)
            .setScale(0.7);
    }
}
