import Phaser from 'phaser';

export default class PreloadScene extends Phaser.Scene {
    constructor() {
        super('PreloadScene');
    }

    preload() {
        // Backgrounds
        this.load.image('bg_game', 'assets/bg/bg2.webp');
        this.load.image('bg_end', 'assets/icon/bge.webp');
        this.load.image('icon', 'assets/icon/icon1.webp');

        // Characters
        this.load.image('balloon', 'assets/char/compressed_BALLON.webp');
        this.load.image('girl_balloon', 'assets/char/compressed_GIRL 1 BALLON.webp');
        this.load.image('boy_balloon', 'assets/char/compressed_BOY.webp');
        this.load.image('girl_flower', 'assets/char/compressed_FLOWER 1.webp');
        this.load.image('boy_flower', 'assets/char/compressed_FLOWER 2.webp');
        this.load.image('flower', 'assets/char/flower.webp');
        this.load.image('girl_balloon_plus', 'assets/char/ballon2.png');
        this.load.image('girl_flower_plus', 'assets/char/flower2.png');

        // UI & Banner
        this.load.image('banner_question', 'assets/button/Rectangle 1.png');
        this.load.image('answer_correct', 'assets/button/V.png');
        this.load.image('answer_wrong', 'assets/button/X.png');
        this.load.image('btn_next', 'assets/button/next.png');
        this.load.image('answer_default', 'assets/button/DRAW.png');
        this.load.image('btn_primary_pressed', 'assets/button/HTU.png');
        this.load.image('btn_replay', 'assets/button/replay.png');
        this.load.svg('next_end', 'assets/button/next_end.svg');

        // Audio
        this.load.audio('bgm_main', 'assets/audio/bgm_main.mp3');
        this.load.audio('sfx_click', 'assets/audio/click.mp3');
        this.load.audio('sfx_correct', 'assets/audio/correct.mp3');
        this.load.audio('sfx_wrong', 'assets/audio/error.mp3');
        this.load.audio('voice_need_finish', 'assets/audio/finish.mp3');
        this.load.audio('voice_complete', 'assets/audio/complete.wav');
        this.load.audio('correct', 'assets/audio/sfx_correct.ogg');
        this.load.audio('wrong', 'assets/audio/sfx_wrong.ogg');
        // voice hướng dẫn kéo cho bóng / hoa
        this.load.audio('drag_balloon', 'assets/audio/keo_bong.mp3');
        this.load.audio('drag_flower', 'assets/audio/keo_hoa.mp3');
        // voice đọc câu hỏi banner (mỗi kiểu một file)
        this.load.audio('q_balloon_more', 'assets/audio/more_b.mp3');
        this.load.audio('q_balloon_less', 'assets/audio/less_b.mp3');
        this.load.audio('q_flower_more', 'assets/audio/more_f.mp3');
        this.load.audio('q_flower_less', 'assets/audio/less_f.mp3');
        this.load.audio('voice_end', 'assets/audio/voice_end.ogg');
    }

    create() {
    // BGM nền dùng chung cho mọi scene
    let bgm = this.sound.get('bgm_main');
    if (!bgm) {
    bgm = this.sound.add('bgm_main', { loop: true, volume: 0.4 });
    }
    bgm.play();
    this.scene.start('GameScene');
    }

}
