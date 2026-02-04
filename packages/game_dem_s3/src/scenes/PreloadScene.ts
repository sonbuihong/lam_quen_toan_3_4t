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
        this.load.image(TextureKeys.HandHint, 'assets/images/ui/hand.png');
        this.load.image(TextureKeys.S1_Banner, 'assets/images/ui/banner.png');
        this.load.image(TextureKeys.S1_Board, 'assets/images/bg/board_scene.png');
        this.load.image(TextureKeys.Number, 'assets/images/ui/so.png');
        this.load.image(TextureKeys.Dice, 'assets/images/ui/dice.png');
        this.load.image(TextureKeys.Mic, 'assets/images/ui/microphone.png');

        // --- Scene 1 Assets 1 ---
        this.load.image(TextureKeys.S1, 'assets/images/S1/1.png');
        // this.load.image(TextureKeys.Loa, 'assets/images/S1/loa.png');
        this.load.image(TextureKeys.Title1, 'assets/images/S1/questionTitle.png');

        // --- Scene 1 Assets 2 ---
        this.load.image(TextureKeys.S2, 'assets/images/S2/2.png');
        this.load.image(TextureKeys.Title1, 'assets/images/S1/questionTitle.png');

        // -- Scene 1 Assets 3 --
        this.load.image(TextureKeys.S3, 'assets/images/S3/3.png');
        this.load.image(TextureKeys.Title3, 'assets/images/S3/Question.png');

        // --- SpriteSheet ---
        this.load.spritesheet(TextureKeys.Sprite1, 'assets/images/sprite/spritesheet1.png', {
            frameWidth: 345,
            frameHeight: 310
        });
        this.load.spritesheet(TextureKeys.Sprite2, 'assets/images/sprite/spritesheet2.png', {
            frameWidth: 300,
            frameHeight: 424
        });
        this.load.spritesheet(TextureKeys.Sprite3, 'assets/images/sprite/happy.png', {
            frameWidth: 300,
            frameHeight: 308
        });
        this.load.spritesheet(TextureKeys.Sprite4, 'assets/images/sprite/sad.png', {
            frameWidth: 300,
            frameHeight: 310
        });

        // --- Score Popup ---
        // this.load.image(TextureKeys.ScorePopup, 'assets/images/ui/score_popup.png');

        this.load.image(TextureKeys.Six, 'assets/images/score/6d.png');
        this.load.image(TextureKeys.Seven, 'assets/images/score/7d.png');
        this.load.image(TextureKeys.Eight, 'assets/images/score/8d.png');
        this.load.image(TextureKeys.Nine, 'assets/images/score/9d.png');
        this.load.image(TextureKeys.Ten, 'assets/images/score/10d.png');


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
        // Tải xong thì chuyển sang Scene1
        this.scene.start(SceneKeys.Scene1);
    }
}