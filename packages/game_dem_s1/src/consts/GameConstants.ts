import { SceneKeys } from './Keys';
 import { TextureKeys } from './Keys';

/**
 * Chứa toàn bộ hằng số cấu hình của Game.
 * Tập trung tại một chỗ để dễ dàng cân chỉnh (Balancing) mà không cần sửa Logic.
 */
export const GameConstants = {
    // =========================================
    // CẤU HÌNH CHUNG (SYSTEM)
    // =========================================
    
    DEBUG_MODE: true, // Set false khi release
    TRANSITION_DELAY: 4000, // Thời gian chờ chuyển màn (ms)
    FLOW: [SceneKeys.Scene1, SceneKeys.Scene2, SceneKeys.Scene3], // Cấu hình luồng game
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
    VOICE: {
        /** Ngưỡng để coi là "đang nói" (0.0 - 1.0) */
        SILENCE_THRESHOLD: 0.04,
        /** Thời gian im lặng (ms) -> Tự động dừng */
        SILENCE_DURATION: 2000,
        /** Thời gian ghi âm tối đa (ms) -> Tự động dừng */
        MAX_RECORD_DURATION: 5000,
        /** Thời gian ghi âm tối thiểu (ms) -> Nếu thấp hơn coi là nhiễu */
        MIN_DURATION: 250, 
    },

    // =========================================
    // SCENE 1: 
    // =========================================
    SCENE1: {
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
            INTRO_DELAY: 600,
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
    // CẤU HÌNH 
    // =========================================
    

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