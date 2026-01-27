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


    // --- Scene 1 (New Crocodile) ---
    // --- UI Assets ---
    S1_Banner = 's1_banner',
    S1_Banner_Text = 's1_banner_text',
    S2_Banner_Text = 's2_banner_text',
    S3_Banner_Text = 's3_banner_text',
    
    S1_Board = 's1_board',
    
    S1_Outline = 'outline',
    S1_Outline1 = 'outline1',
    S1_1 = '1',
    S1_2 = '2',

    // --- Scene 2 ---
    S2_Outline = 's2_outline',
    S2_Outline1 = 's2_outline1',
    // Parts for Teacher (Object 1)
    S2_1_1 = 's2_1_1',
    S2_1_2 = 's2_1_2',
    S2_1_3 = 's2_1_3',
    S2_1_4 = 's2_1_4',
    S2_1_6 = 's2_1_6',
    S2_1_7 = 's2_1_7',
    
    // Parts for Teacher1 (Object 2)
    S2_2 = 's2_2',

    // --- Scene 3 ---
    S3_Outline = 's3_outline',
    S3_Outline1 = 's3_outline1',
    // Parts for Object 1
    S3_1_1 = 's3_1_1',
    S3_1_2 = 's3_1_2',
    S3_1_3 = 's3_1_3',
    // Parts for Object 2
    S3_2_1 = 's3_2_1',
    S3_2_2 = 's3_2_2',
    S3_2_3 = 's3_2_3',

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
    BgmNen = 'bgm-nen',
    VoiceIntroS1 = 'voice_intro_s1',
    VoiceIntroS2 = 'voice_intro_s2',
    VoiceIntroS3 = 'voice_intro_s3'
}

// 4. Tên File Data (JSON)
export enum DataKeys {
    LevelS1Config = 'level_1_config',
    LevelS2Config = 'level_2_config',
    LevelS3Config = 'level_3_config'
}