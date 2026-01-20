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
    BtnEraser = 'btn_eraser',
    HandHint = 'hand_hint',
    BoardRight = 'board_right',
    S1_Banner = 'banner_s2',
    S1_Board = 'board_s2',
    Decor = 'decor',
    Number = 'number',
    Dice = 'dice',
    // --- Scene 1 (Voice1) ---
    Mic = 'mic',
    Loa = 'loa',

    Title1 = 'title',
    S1_Ball = 'ball',
    S2_Ball = 'ball2',
    S3_Car = 'car',
    

    // --- End Game ---
    End_Icon = 'icon_end',
    End_BannerCongrat = 'banner_congrat'
}

// 3. Tên Âm thanh (Audio)
export enum AudioKeys {
    BgmNen = 'bgm-nen'
}

// 4. Tên File Data (JSON)
export enum DataKeys {
    LevelS1Config = 'level_1_config',
    LevelS2Config = 'level_2_config',
    LevelS3Config = 'level_3_config'
}