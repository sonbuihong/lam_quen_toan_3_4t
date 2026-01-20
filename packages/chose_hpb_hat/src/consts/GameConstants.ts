import { TextureKeys } from './Keys';

/**
 * Chứa toàn bộ hằng số cấu hình của Game.
 * Tập trung tại một chỗ để dễ dàng cân chỉnh (Balancing) mà không cần sửa Logic.
 */
export const GameConstants = {
    // =========================================
    // CẤU HÌNH CHUNG (SYSTEM)
    // =========================================
    PALETTE_DATA: [
        { key: TextureKeys.BtnS1_1, color: 0xE05136 },
        { key: TextureKeys.BtnS1_2, color: 0xFFE007 },
        { key: TextureKeys.BtnS1_3, color: 0x499343 },
        { key: TextureKeys.BtnS1_4, color: 0x539BD7 }, 
        { key: TextureKeys.BtnS1_5, color: 0xFDAB12 },
        { key: TextureKeys.BtnS1_6, color: 0xE97090 },
        { key: TextureKeys.BtnS1_7, color: 0x000000 },    
    ],
    DEBUG_MODE: true, // Set false khi release
    IDLE: {
        /** Thời gian chờ trước khi hiện gợi ý (ms). 10000 = 10 giây */
        THRESHOLD: 10000,
        /** Thời gian hiệu ứng hiện bàn tay (ms) */
        FADE_IN: 800,
        /** Thời gian hiệu ứng ấn xuống (Scale nhỏ lại) (ms) */
        SCALE: 300,
        /** Thời gian hiệu ứng ẩn bàn tay đi (ms) */
        FADE_OUT: 500,
        /** Bàn tay lệch trục X so với vật thể (px) */
        OFFSET_X: 50,
        /** Bàn tay lệch trục Y so với vật thể (px) */
        OFFSET_Y: 50,
    },

    // =========================================
    // CẤU HÌNH GHI ÂM (VOICE)
    // =========================================
    // VOICE: {
        /** Ngưỡng để coi là "đang nói" (0.0 - 1.0) */
        SILENCE_THRESHOLD: 0.04,
        /** Thời gian im lặng (ms) -> Tự động dừng */
        SILENCE_DURATION: 1500,
        /** Thời gian ghi âm tối đa (ms) -> Tự động dừng */
        MAX_RECORD_DURATION: 10000, 
    // },

    // =========================================
    // CẤU HÌNH SCENE
    // =========================================
    SCENE1: {
        UI: {
            /** Vị trí Y của Banner (Tỉ lệ 0.0 - 1.0 so với chiều cao màn hình) */
            BANNER_Y: 0.01,
            /** Khoảng cách từ đáy Banner xuống đỉnh Bảng (Tỉ lệ màn hình) */
            BOARD_OFFSET: 0.03,
            /** Khoảng cách lề trái/phải của 2 bảng (Tỉ lệ màn hình) */
            BOARD_MARGIN_X: 0.01,
            /** Vị trí Mưa: Nằm ở 45% chiều cao của cái Bảng */
            ILLUSTRATION_OFFSET: 0.45,
            /** Vị trí Thơ: Cách đáy Mưa 17% màn hình */
            POEM_OFFSET: 0.05,

            /** Icon O lệch trái 13% chiều rộng bảng */
            ICON_O_X: 0.13,
            /** Icon O lệch xuống 6% chiều cao màn hình */
            ICON_O_Y: 0.05,

            /** Item lệch trục X so với tâm bảng (Tỉ lệ chiều rộng bảng) */
            ITEM_OFFSET_X_1: -0.17,
            ITEM_OFFSET_X_2: -0.17,
            ITEM_OFFSET_X_3: 0.2,
            /** Item lệch trục Y so với tâm bảng (Tỉ lệ chiều rộng bảng) */
            ITEM_OFFSET_Y_1: -0.3,
            ITEM_OFFSET_Y_2: 0.3,
            ITEM_OFFSET_Y_3: 0,
        },
        ANIM: {
            /** Thời gian vật nhấp nhô (Floating) (ms) */
            FLOAT: 1500,
            /** Thời gian bài thơ nhấp nhô (ms) */
            POEM_FLOAT: 1200,
            /** Thời gian icon lắc lư (ms) */
            ICON_SHAKE: 400,
            /** Thời gian rung lắc khi chọn Sai (ms) */
            WRONG_SHAKE: 80,
            /** Thời gian hiện Popup thắng (ms) */
            WIN_POPUP: 600,
        },
        TIMING: {
            /** Delay sau khi đọc xong câu đố mới bắt đầu tính Idle (ms) */
            DELAY_IDLE: 1000,
            /** Delay chuyển sang Scene 2 (ms) */
            DELAY_NEXT: 1000,
            /** Chờ đọc xong voice "Cái ô" mới phát SFX vỗ tay (ms) */
            DELAY_CORRECT_SFX: 1000,
        }
    },

    // =========================================
    // SCENE 2: TÔ MÀU 
    // =========================================
    SCENE2: {
        UI: {
            // BANNER
            BANNER_Y: 0.001,
            DECOR_X: 0.91,
            DECOR_Y: 0.02,
            // BẢNG
            BOARD_OFFSET: 0.03,
            /** Vị trí X của cột màu (Tỉ lệ màn hình) - Bên phải */
            PALETTE_X: 0.91,
            /** Vị trí Y bắt đầu của nút màu đầu tiên (Tỉ lệ màn hình) */
            PALETTE_START_Y: 0.25, // Bắt đầu từ trên xuống
            /** Khoảng cách dọc giữa các nút màu (Tỉ lệ màn hình) */
            PALETTE_SPACING_Y: 0.13,
            
            // Tọa độ đích cho bàn tay hướng dẫn Intro
            HAND_INTRO_END_X: 0.42,
            HAND_INTRO_END_Y: 0.4,
        },
        TIMING: {
            /** Chờ bao lâu mới bắt đầu Intro (ms) */
            INTRO_DELAY: 1000,
            /** Delay restart intro khi xoay màn hình (ms) */
            RESTART_INTRO: 200,
            /** Thắng xong chờ bao lâu chuyển màn EndGame (ms) */
            WIN_DELAY: 2500,
            /** Thời gian nhấp nháy khi tô xong 1 phần (ms) */
            AUTO_FILL: 100,
        },
        INTRO_HAND: {
            MOVE: 600,
            TAP: 200,
            DRAG: 800,
            RUB: 400,
        }
    },

    // =========================================
    // CẤU HÌNH VẼ (PAINT MANAGER)
    // =========================================
    PAINT: {
        BRUSH_SIZE: 100,
        /** Tỉ lệ tô màu để tính là hoàn thành (0.90 = 90%) */
        WIN_PERCENT: 0.90,
        DEFAULT_COLOR: 0x5EA455
    },

    // =========================================
    // END GAME SCENE
    // =========================================
    ENDGAME: {
        UI: {
            /** Banner cách tâm giữa lên trên (Tỉ lệ) */
            BANNER_OFFSET: 0.12,
            /** Icon cách tâm giữa lên trên (px) */
            ICON_OFFSET: 150,
            /** Nút bấm cách tâm giữa xuống dưới (Tỉ lệ) */
            BTN_OFFSET: 0.2,
            /** Khoảng cách giữa 2 nút (px) */
            BTN_SPACING: 250,
        },
        CONFETTI: {
            DELAY: 100,
            MIN_DUR: 3000,
            MAX_DUR: 5000,
        },
        ANIM: {
            ICON_FLOAT: 800,
            ICON_SHAKE: 600,
            FIREWORKS_DELAY: 2000,
        }
    }
} as const; // <--- QUAN TRỌNG: Biến toàn bộ object thành Read-only literals