// src/consts/Keys.ts

// 1. Tên các Màn chơi (Scene)
export enum SceneKeys {
    Preload = 'PreloadScene',
    Scene1 = 'Scene1',
    Scene2 = 'Scene2',
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
    // BoardRight = 'board_right',

    // --- Scene 1 (New Crocodile) ---
    S1_Banner = 'banner_s2',
    S1_BannerText = 'text_banner_s1',
    S1_Board = 'board_s2',

    // --- Scene 2 ---
    S2_BannerText = 'text_banner_s2',

    S1_Outline = 'outline',
    S1_1 = '1',
    S1_2 = '2',

    // Các nút màu Scene 1 (Formerly S2 Colors)
    BtnS1_1 = 's1_btn_1',
    BtnS1_4 = 's1_btn_4',

    // --- Scene 2 ---
    S2_Outline = 's2_outline',
    S2_1 = 's2_1',
    S2_2 = 's2_2',
    S2_3 = 's2_3',
    S2_4 = 's2_4',

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
    LevelS2Config = 'level_2_config'
}