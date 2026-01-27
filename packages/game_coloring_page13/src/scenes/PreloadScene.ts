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

        // --- UI Assets ---
        this.load.image(TextureKeys.S1_Banner, 'assets/images/ui/banner_s2.png');
        
        this.load.image(TextureKeys.S1_Board, 'assets/images/bg/board_scene_2.png');

        // - Scene 1 Assets
        this.load.image(TextureKeys.S1_Banner_Text, 'assets/images/S1/banner_text.png');
        this.load.image(TextureKeys.S2_Banner_Text, 'assets/images/S2/banner_text.png');
        this.load.image(TextureKeys.S3_Banner_Text, 'assets/images/S3/banner_text.png');
        
        this.load.image(TextureKeys.S1_Outline, 'assets/images/S1/outline.png');
        this.load.image(TextureKeys.S1_Outline1, 'assets/images/S1/outline1.png');
        this.load.image(TextureKeys.S1_1, 'assets/images/S1/1.png');
        this.load.image(TextureKeys.S1_2, 'assets/images/S1/2.png');

        // - Scene 2 Assets
        this.load.image(TextureKeys.S2_Outline, 'assets/images/S2/outline.png');
        this.load.image(TextureKeys.S2_Outline1, 'assets/images/S2/outline1.png');
        
        // Parts Object 1
        this.load.image(TextureKeys.S2_1_1, 'assets/images/S2/1_1.png');
        this.load.image(TextureKeys.S2_1_2, 'assets/images/S2/1_2.png');
        this.load.image(TextureKeys.S2_1_3, 'assets/images/S2/1_3.png');
        this.load.image(TextureKeys.S2_1_4, 'assets/images/S2/1_4.png');
        this.load.image(TextureKeys.S2_1_6, 'assets/images/S2/1_6.png');
        this.load.image(TextureKeys.S2_1_7, 'assets/images/S2/1_7.png');

        // Parts Object 2
        this.load.image(TextureKeys.S2_2, 'assets/images/S2/2.png');

        // - Scene 3 Assets
        this.load.image(TextureKeys.S3_Outline, 'assets/images/S3/outline.png');
        this.load.image(TextureKeys.S3_Outline1, 'assets/images/S3/outline1.png');
        // Parts Object 1
        this.load.image(TextureKeys.S3_1_1, 'assets/images/S3/1_1.png');
        this.load.image(TextureKeys.S3_1_2, 'assets/images/S3/1_2.png');
        this.load.image(TextureKeys.S3_1_3, 'assets/images/S3/1_3.png');
        // Parts Object 2
        this.load.image(TextureKeys.S3_2_1, 'assets/images/S3/2_1.png');
        this.load.image(TextureKeys.S3_2_2, 'assets/images/S3/2_2.png');
        this.load.image(TextureKeys.S3_2_3, 'assets/images/S3/2_3.png');

        
        // Bảng màu Scene 
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

        // 4. End Game Assets
        this.load.image(TextureKeys.End_Icon, 'assets/images/ui/icon_end.png');
        this.load.image(TextureKeys.End_BannerCongrat, 'assets/images/bg/banner_congrat.png');

        // 5. Audio (Phaser)
        // Lưu ý: Key BgmNen đã được define trong Keys.ts, và file âm thanh này dùng chung
        this.load.audio(AudioKeys.BgmNen, 'assets/audio/sfx/nhac_nen.mp3');
        
        // TODO: Ensure these files exist or Logic will fail to load? 
        // Phaser load audio will just error on 404 but continue scene.
        this.load.audio(AudioKeys.VoiceIntroS1, 'assets/audio/prompt/instruction_s1.mp3');
        this.load.audio(AudioKeys.VoiceIntroS2, 'assets/audio/prompt/instruction_s2.mp3');
        this.load.audio(AudioKeys.VoiceIntroS3, 'assets/audio/prompt/instruction_s3.mp3');
    }

    create() {
        // Tải xong thì chuyển sang Scene1
        this.scene.start(SceneKeys.Scene1);
    }
}