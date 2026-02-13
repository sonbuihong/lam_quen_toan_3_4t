import Phaser from 'phaser';
import { SceneKeys, TextureKeys, AudioKeys, DataKeys } from '../consts/Keys';
import AudioManager from '../audio/AudioManager';

export default class PreloadScene extends Phaser.Scene {
    constructor() {
        super(SceneKeys.Preload);
    }

    preload() {
        // 1. UI Chung
        this.load.image(TextureKeys.BtnExit, 'assets/images/ui/btn_exit.png');
        this.load.image(TextureKeys.BtnReset, 'assets/images/ui/btn_reset.png');
        this.load.image(TextureKeys.HandHint, 'assets/images/ui/hand.png');
        this.load.image(TextureKeys.S1_Banner, 'assets/images/S1/BAN.png');
        this.load.image(TextureKeys.S1_Board, 'assets/images/bg/board_scene.png');

        this.load.image(TextureKeys.imgTopic, 'assets/images/S1/questionImg.png');
        this.load.image(TextureKeys.frameAns, 'assets/images/S1/frameAns.png');

        this.load.image(TextureKeys.Title1, 'assets/images/S1/question1.png');
        this.load.image(TextureKeys.Title2, 'assets/images/S2/question2.png');
        this.load.image(TextureKeys.Title3, 'assets/images/S3/question3.png');
        this.load.image(TextureKeys.Title4, 'assets/images/S4/question4.png');

        // --- Scene 1 Assets 1 ---
        this.load.image(TextureKeys.S1, 'assets/images/S1/1.png');
        this.load.image(TextureKeys.S2, 'assets/images/S1/2.png');
        this.load.image(TextureKeys.S3, 'assets/images/S2/1.png');
        this.load.image(TextureKeys.S4, 'assets/images/S2/2.png');
        this.load.image(TextureKeys.S5, 'assets/images/S3/1.png');
        this.load.image(TextureKeys.S6, 'assets/images/S3/2.png');
        this.load.image(TextureKeys.S7, 'assets/images/S4/1.png');
        this.load.image(TextureKeys.S8, 'assets/images/S4/2.png');

        // - Config JSON
        // Lưu ý: File json gốc là level_s1_config.json, nhưng ta load vào key LevelS1Config
        this.load.json(DataKeys.LevelS1Config, 'assets/data/level_s1_config.json');

        // 4. End Game Assets
        // this.load.image(TextureKeys.End_Icon, 'assets/images/ui/icon_end.png');
        // this.load.image(TextureKeys.End_BannerCongrat, 'assets/images/bg/banner_congrat.png');

        // 5. Audio (Phaser)
        // Lưu ý: Key BgmNen đã được define trong Keys.ts, và file âm thanh này dùng chung
        this.load.audio(AudioKeys.BgmNen, 'assets/audio/sfx/nhac_nen.mp3');
    }

    create() {
        // Start Scene1 ngay
        this.scene.start(SceneKeys.Scene1);
        
        // Vẫn gọi load ngầm để cache sau này (nếu muốn)
        const essentials = [
            AudioKeys.VoiceIntro, 
            'sfx-correct', 
            'sfx-ting', 
            'sfx-wrong'
        ];
        AudioManager.loadEssentials(essentials).then(() => {
             console.log("Essential audio pre-loaded in background.");
             AudioManager.loadRest();
        });
    }
}