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
    S1_Banner = 'banner1',
    S2_Banner = 'banner2',
    S1_Board = 'board',

    Title1 = 'title',
    S1 = 'image1',
    S2 = 'image2',
    S3 = 'image3',
    S4 = 'image4',
    S5 = 'image5',
    S6 = 'image6',

    Answer1 = 'ans1',
    Answer2 = 'ans2',
    Answer3 = 'ans3',
    Answer4 = 'ans4',
    Answer5 = 'ans5',
    Answer6 = 'ans6',
    

    // --- End Game ---
    End_Icon = 'icon_end',
    End_BannerCongrat = 'banner_congrat'
}

// 3. Tên Âm thanh (Audio)
export enum AudioKeys {
    BgmNen = 'bgm-nen',
    VoiceIntro = 'voice_intro1',
    VoiceIntro2 = 'voice_intro2'
}

// 4. Tên File Data (JSON)
export enum DataKeys {
    LevelS1Config = 'level_1_config'
}