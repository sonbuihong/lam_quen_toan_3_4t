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
        this.load.image(TextureKeys.S1_Banner, 'assets/images/S1/banner1.png');
        this.load.image(TextureKeys.S1_Board, 'assets/images/bg/board_scene.png');

        // --- Scene 1 Assets 1 ---
        this.load.image(TextureKeys.S1, 'assets/images/S1/1.png');
        this.load.image(TextureKeys.S2, 'assets/images/S1/2.png');
        this.load.image(TextureKeys.S3, 'assets/images/S1/3.png');
        this.load.image(TextureKeys.S4, 'assets/images/S1/4.png');

        // --- Answer ---
        this.load.image(TextureKeys.Answer1, 'assets/images/S1/ans1.png');
        this.load.image(TextureKeys.Answer2, 'assets/images/S1/ans2.png');
        this.load.image(TextureKeys.Answer3, 'assets/images/S1/ans3.png');
        this.load.image(TextureKeys.Answer4, 'assets/images/S1/ans4.png');

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