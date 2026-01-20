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
    S1_Banner = 'banner',
    S1_Board = 'board',
    Number = 'number',
    Dice = 'dice',

    Title1 = 'title',
    Hat = 'hat',
    Ans1 = 'ans1',
    Ans2 = 'ans2',

    // các nút màu cho bảng chọn màu
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
    VoiceIntro = 'voice_intro'
}

// 4. Tên File Data (JSON)
export enum DataKeys {
    LevelS1Config = 'level_1_config'
}