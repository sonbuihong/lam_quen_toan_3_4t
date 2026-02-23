import { TextureKeys } from './Keys';

/**
 * Chứa toàn bộ hằng số cấu hình của Game.
 * Tập trung tại một chỗ để dễ dàng cân chỉnh (Balancing) mà không cần sửa Logic.
 */
export const GameConstants = {
    // =========================================
    // MÃ LỖI SDK (ERROR CODES)
    // =========================================
    ERROR_CODES: {
        WRONG_TARGET: "WRONG_TARGET",
        RELEASE_TOO_EARLY: "RELEASE_TOO_EARLY",
        RELEASE_TOO_LATE: "RELEASE_TOO_LATE",
        WRONG_TARGET_HOLD: "WRONG_TARGET_HOLD",
        TIMEOUT: "TIMEOUT",
    },
    // =========================================
    // CẤU HÌNH LASSO
    // =========================================
    LASSO: {
        /** Path ngắn hơn giá trị này (px) = thả tay quá sớm */
        MIN_PATH_LENGTH_PX: 80,
        /** Ít hơn số điểm này = chưa khoanh thành vòng */
        MIN_POINTS: 5,
    },
    // =========================================
    // CẤU HÌNH CHUNG (SYSTEM)
    // =========================================
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
            WIN_DELAY: 2800,
            /** Thời gian nhấp nháy khi tô xong 1 phần (ms) */
            AUTO_FILL: 100,
            /** Thời gian chờ trước khi cho phép tương tác lúc vào game (ms) */
            GAME_START_DELAY: 1000,
        },
        INTRO_HAND: {
            MOVE: 600,
            TAP: 200,
            DRAG: 800,
            RUB: 400,
        }
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