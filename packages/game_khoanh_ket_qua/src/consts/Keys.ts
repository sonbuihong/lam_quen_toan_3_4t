// src/consts/Keys.ts

// 1. Tên các Màn chơi (Scene)
export enum SceneKeys {
    Preload = 'PreloadScene',
    Scene1 = 'Scene1',
    EndGame = 'EndGameScene',
    UI = 'UIScene'
}

// 2. Tên các Hình ảnh (Texture)
export enum TextureKeys {
    // --- UI Dùng Chung ---
    BtnExit = 'btn_exit',
    BtnReset = 'btn_reset',
    HandHint = 'hand_hint',
    S1_Banner = 'banner',
    S1_Board = 'board',

    
    imgTopic = 'topic',
    frameAns = 'frameAns',
    Title1 = 'title1',
    Title2 = 'title2',
    Title3 = 'title3',
    Title4 = 'title4',

    // --- asset Level ---
    S1 = '1',
    S2 = '2',
    S3 = '3',
    S4 = '4',
    S5 = '5',
    S6 = '6',
    S7 = '7',
    S8 = '8',

    // --- End Game ---
    End_Icon = 'icon_end',
    End_BannerCongrat = 'banner_congrat'
}

// 3. Tên Âm thanh (Audio)
export enum AudioKeys {
    BgmNen = 'bgm-nen',
    VoiceIntro = 'voice-intro'
}

// 4. Tên File Data (JSON)
export enum DataKeys {
    LevelS1Config = 'level_1_config'
}