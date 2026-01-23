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
    // BoardRight = 'board_right',
    Decor = 'decor',
    So1 = 'so1',
    Dice = 'dice',

    // --- Scene 1 (New Crocodile) ---
    S1_Banner = 'banner_s2',
    S1_BannerText = 'text_banner_s2',
    S1_Board = 'board_s2',
    
    // Tô màu Cá Sấu (Mapped to Scene 1 logic)
    S1_Casau_Template = 'ca_sau_template',
    S1_Frame = 'frame',
    
    S1_Name = 'name',
    S1_Name_Bg = 'name_bg',
    S1_Outline = 'outline',
    S1_1 = '1',
    // S1_2 = '2',
    // S1_3 = '3',
    // S1_4 = '4',
    S1_Q1 = 'q1',
    S1_Q2 = 'q2',
    S2_Q1 = 's2_q1',
    S2_Q2 = 's2_q2',
    S3_Q1 = 's3_q1',
    S3_Q2 = 's3_q2',

    // Các nút màu Scene 1 (Formerly S2 Colors)
    BtnS1_1 = 's1_btn_1',
    BtnS1_2 = 's1_btn_2',
    BtnS1_3 = 's1_btn_3',
    BtnS1_4 = 's1_btn_4',
    BtnS1_5 = 's1_btn_5',
    BtnS1_6 = 's1_btn_6',
    BtnS1_7 = 's1_btn_7',

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