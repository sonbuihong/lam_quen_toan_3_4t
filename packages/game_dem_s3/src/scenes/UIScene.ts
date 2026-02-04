import Phaser from 'phaser';
import ScorePopup from '../components/ScorePopup';
import { SceneKeys, TextureKeys } from '../consts/Keys';
import { GameConstants } from '../consts/GameConstants';
import { GameUtils } from '../utils/GameUtils';

export default class UIScene extends Phaser.Scene {
    private sceneKey!: string;
    private paletteButtons: Phaser.GameObjects.Image[] = [];
    private firstColorBtn!: Phaser.GameObjects.Image;
    public handHint!: Phaser.GameObjects.Image;
    
    // --- POPUP ---
    private scorePopup!: ScorePopup;

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
        // Hiển thị Banner
        this.bannerImage = this.add.image(cx, bannerY, bannerKey).setScale(0.7).setOrigin(0.5, -0.1);
        
        // Title (Added here to be on top of Banner)
        // Scene1 & Scene2: Dùng Title1
        // Scene3: Dùng Title3
        if(this.sceneKey === SceneKeys.Scene1 || this.sceneKey === SceneKeys.Scene2){
            this.add.image(cx, bannerY, TextureKeys.Title1)
                .setOrigin(0.5, -0.9)
                .setScale(0.85);
        } else if(this.sceneKey === SceneKeys.Scene3){
            this.add.image(cx, bannerY, TextureKeys.Title3)
                .setOrigin(0.5, -0.9)
                .setScale(0.85);
        }

        // Tạo bàn tay gợi ý (ẩn đi, set depth cao nhất để đè lên mọi thứ)
        this.handHint = this.add
            .image(0, 0, TextureKeys.HandHint)
            .setDepth(2000) // Đảm bảo nó nằm trên các phần tử UI khác
            .setAlpha(0)
            .setScale(0.7);
            
        // Init Score Popup
        this.scorePopup = new ScorePopup(this, cx, GameUtils.pctY(this, 0.5));
    }

    public showScorePopup(score: number, feedback: string) {
        if (this.scorePopup) {
            this.scorePopup.show(score, feedback);
        }
    }

    public showProcessingPopup() {
        if (this.scorePopup) {
            this.scorePopup.showProcessing();
        }
    }

    public hideScorePopup() {
        if (this.scorePopup) {
            this.scorePopup.hide();
        }
    }

    public showFinalScorePopup(finalScore: number) {
        if (this.scorePopup) {
            this.scorePopup.showFinal(finalScore);
        }
    }
}

