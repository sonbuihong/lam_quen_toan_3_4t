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
        
        this.load.image(TextureKeys.Decor, 'assets/images/ui/decor.png');
        this.load.image(TextureKeys.So1, 'assets/images/ui/so1.png');
        this.load.image(TextureKeys.Dice, 'assets/images/ui/dice.png');

        // --- Scene 1 (Crocodile) Assets ---
        this.load.image(TextureKeys.S1_Banner, 'assets/images/S1/banner.png');
        this.load.image(TextureKeys.S1_BannerText, 'assets/images/S1/questionTitle.png');
        this.load.image(TextureKeys.S1_Board, 'assets/images/bg/board_scene_2.png');

        // 
        // this.load.image(TextureKeys.S1_Frame, 'assets/images/S1/frame.png');
        this.load.image(TextureKeys.S1_Outline, 'assets/images/S1/outline.png');
        this.load.image(TextureKeys.S1_1, 'assets/images/S1/1.png');
        this.load.image(TextureKeys.S1_Q1, 'assets/images/S1/q1.png');
        this.load.image(TextureKeys.S1_Q2, 'assets/images/S1/q2.png');
        this.load.image(TextureKeys.S2_Q1, 'assets/images/S2/q1.png');
        this.load.image(TextureKeys.S2_Q2, 'assets/images/S2/q2.png');
        this.load.image(TextureKeys.S3_Q1, 'assets/images/S3/q1.png');
        this.load.image(TextureKeys.S3_Q2, 'assets/images/S3/q2.png');

        // - Config JSON
        // Lưu ý: File json gốc là level_s1_config.json, nhưng ta load vào key LevelS1Config
        this.load.json(DataKeys.LevelS1Config, 'assets/data/level_s1_config.json');
        this.load.json(DataKeys.LevelS2Config, 'assets/data/level_s2_config.json');
        this.load.json(DataKeys.LevelS3Config, 'assets/data/level_s3_config.json');

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