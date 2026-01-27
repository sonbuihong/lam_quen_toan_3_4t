// src/scenes/PreloadScene.ts
import Phaser from 'phaser';
import { SceneKeys, TextureKeys, AudioKeys, DataKeys } from '../consts/Keys';

export default class PreloadScene extends Phaser.Scene {
    constructor() {
        super(SceneKeys.Preload);
    }

    preload() {
        // 1. UI Chung
        this.load.image(TextureKeys.BtnExit, 'assets/images/ui/btn_exit.png');
        this.load.image(TextureKeys.BtnReset, 'assets/images/ui/btn_reset.png');
        this.load.image(TextureKeys.BtnEraser, 'assets/images/ui/btn_eraser.png');
        this.load.image(TextureKeys.HandHint, 'assets/images/ui/hand.png');
        

        // --- Scene 1 (Crocodile) Assets ---
        this.load.image(TextureKeys.S1_Banner, 'assets/images/S1/banner_s2.png');
        this.load.image(TextureKeys.S1_BannerText, 'assets/images/S1/banner_text.png');
        this.load.image(TextureKeys.S1_Board, 'assets/images/bg/board_scene_2.png');
        this.load.image(TextureKeys.S1_Obj, 'assets/images/S1/obj1.png');

        this.load.image(TextureKeys.S1_Outline, 'assets/images/S1/outline.png');
        this.load.image(TextureKeys.S1_1, 'assets/images/S1/1.png');
        this.load.image(TextureKeys.S1_2, 'assets/images/S1/2.png');
        this.load.image(TextureKeys.S1_3, 'assets/images/S1/3.png');
        this.load.image(TextureKeys.S1_4, 'assets/images/S1/4.png');
        this.load.image(TextureKeys.S1_5, 'assets/images/S1/5.png');

        // Bảng màu Scene 1 (Crocodile Colors)
        this.load.image(TextureKeys.BtnS1_1, 'assets/images/color/cl1.png');
        this.load.image(TextureKeys.BtnS1_2, 'assets/images/color/cl2.png');
        this.load.image(TextureKeys.BtnS1_3, 'assets/images/color/cl3.png');
        this.load.image(TextureKeys.BtnS1_4, 'assets/images/color/cl4.png');
        this.load.image(TextureKeys.BtnS1_5, 'assets/images/color/cl5.png');
        this.load.image(TextureKeys.BtnS1_6, 'assets/images/color/cl6.png');
        this.load.image(TextureKeys.BtnS1_7, 'assets/images/color/cl7.png');

        // - Config JSON
        // Lưu ý: File json gốc là level_s1_config.json, nhưng ta load vào key LevelS1Config
        this.load.json(DataKeys.LevelS1Config, 'assets/data/level_s1_config.json');
        this.load.json(DataKeys.LevelS2Config, 'assets/data/level_s2_config.json');
        this.load.json(DataKeys.LevelS3Config, 'assets/data/level_s3_config.json');
        this.load.json(DataKeys.LevelS4Config, 'assets/data/level_s4_config.json');

        // --- Scene 2 Assets ---
        this.load.image(TextureKeys.S2_Banner, 'assets/images/S2/banner_s2.png');
        this.load.image(TextureKeys.S2_Obj, 'assets/images/S2/obj1.png');
        this.load.image(TextureKeys.S2_Outline, 'assets/images/S2/outline.png');
        this.load.image(TextureKeys.S2_1, 'assets/images/S2/1.png');

        // --- Scene 3 Assets ---
        this.load.image(TextureKeys.S3_Banner, 'assets/images/S3/banner_s2.png');
        this.load.image(TextureKeys.S3_Obj, 'assets/images/S3/obj1.png');
        this.load.image(TextureKeys.S3_Outline, 'assets/images/S3/outline.png');
        this.load.image(TextureKeys.S3_1, 'assets/images/S3/1.png');
        this.load.image(TextureKeys.S3_2, 'assets/images/S3/2.png');
        this.load.image(TextureKeys.S3_3, 'assets/images/S3/3.png');

        // --- Scene 4 Assets ---
        this.load.image(TextureKeys.S4_Banner, 'assets/images/S4/banner_s2.png');
        this.load.image(TextureKeys.S4_Obj, 'assets/images/S4/obj1.png');
        this.load.image(TextureKeys.S4_Outline, 'assets/images/S4/outline.png');
        this.load.image(TextureKeys.S4_1, 'assets/images/S4/1.png');
        this.load.image(TextureKeys.S4_2, 'assets/images/S4/2.png');

        // 4. End Game Assets
        this.load.image(TextureKeys.End_Icon, 'assets/images/ui/icon_end.png');
        this.load.image(TextureKeys.End_BannerCongrat, 'assets/images/bg/banner_congrat.png');

        // 5. Audio (Phaser)
        // Lưu ý: Key BgmNen đã được define trong Keys.ts, và file âm thanh này dùng chung
        this.load.audio(AudioKeys.BgmNen, 'assets/audio/sfx/nhac_nen.mp3');
    }

    create() {
        // Tải xong thì chuyển sang Scene1
        this.scene.start(SceneKeys.Scene1);
    }
}