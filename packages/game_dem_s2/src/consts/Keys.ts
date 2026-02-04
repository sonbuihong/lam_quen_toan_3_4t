// src/consts/Keys.ts

// 1. Tên các Màn chơi (Scene)
export enum SceneKeys {
    Preload = 'PreloadScene',
    Scene1 = 'Scene1',
    Scene2 = 'Scene2',
    Scene3 = 'Scene3',
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
    S1 = 'cake',


    //--- SpriteSheet ---
    Sprite1 = 'sprite1',
    Sprite2 = 'sprite2',
    Sprite3 = 'happy',
    Sprite4 = 'sad',

    // --- Score Popup ---
    ScorePopup = 'score_popup',
    Six = 'six',
    Seven = 'seven',
    Eight = 'eight',
    Nine = 'nine',
    Ten = 'ten',
    

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
}