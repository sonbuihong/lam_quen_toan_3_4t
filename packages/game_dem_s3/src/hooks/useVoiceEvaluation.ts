import { voice } from "@iruka-edu/mini-game-sdk";

export enum ExerciseType {
    NURSERY_RHYME = "NURSERY_RHYME",
    COUNTING = "COUNTING",
    SPELLING = "SPELLING",
}

// Minimal interfaces for props since we removed the old client imports
export interface StartSessionRequest {
    childId: string;
    gameId: string;
    lessonId: string;
    gameVersion: string;
    gameType: ExerciseType;
    testmode?: boolean;
    ageLevel?: string;
}

export interface EndSessionRequest {
    sessionId: string;
    totalQuestionsExpect: number;
    isUserAborted: boolean;
    testmode?: boolean;
    learner_id?: string;
    age_level?: string;
    keepalive?: boolean;
}

export interface SubmitAnswerRequest {
    sessionId: string;
    childId: string;
    audioFile: File | Blob;
    questionIndex: number;
    targetText: string | object;
    durationMs: number;
    exerciseType: ExerciseType;
    testmode?: boolean;
}

export interface StartSessionResponse {
    sessionId: string;
    allowPlay: boolean;
    index: number;
    quotaRemaining: number;
    message?: string;
    testMode?: boolean;
    debugInfo?: any;
}

export interface SubmitAnswerResponse {
    score: number;
    attitude_level: string;
    feedback: string;
    testMode?: boolean;
    debugInfo?: any;
}

export interface EndSessionResponse {
    status: string;
    finalScore: number;
    completionPct: number;
    quotaDeducted: boolean;
    violations?: any;
    testMode?: boolean;
    debugInfo?: any;
}


// We rely on SDK return types implicitly or define minimal if needed
// For now, let's keep the function signatures compatible with the existing hook logic


export interface UseVoiceEvaluationProps {
    childId?: string;
    gameId?: string;
    lessonId?: string;
    gameVersion?: string;
    gameType?: ExerciseType;
    ageLevel?: string; // e.g "3-4", "4-5", "5-6"
    testmode?: boolean;
}

/**
 * Custom Hook (Helper) để quản lý logic SDK Voice Evaluation
 * Giúp code UI (Scene) gọn gàng hơn, tách biệt logic API.
 */
export function useVoiceEvaluation(defaultProps: UseVoiceEvaluationProps = {}) {
    // --- State (Closure variables) ---
    // Lưu ý: Vì không phải React component nên không có re-render.
    // Các giá trị này được cập nhật sau mỗi gọi hàm.
    let sessionId: string | null = null;
    let isLoading: boolean = false;
    let error: string | null = null;
    let currentScore: number | null = null;
    
    // --- Config ---
    const config = {
        childId: defaultProps.childId || "sonbui",
        gameId: defaultProps.gameId || "game_dem_so_1",
        lessonId: defaultProps.lessonId || "lesson_121",
        gameVersion: defaultProps.gameVersion || "1.0.0",
        gameType: defaultProps.gameType || ExerciseType.COUNTING,
        ageLevel: defaultProps.ageLevel || "3-4",
        testmode: defaultProps.testmode ?? true 
    };

    // --- Methods ---

    /**
     * Bắt đầu phiên học (Start Session)
     */
    const startEvaluation = async (overrides?: Partial<StartSessionRequest>): Promise<StartSessionResponse> => {
        isLoading = true;
        error = null;
        try {
            const req: StartSessionRequest = {
                childId: config.childId,
                gameId: config.gameId,
                lessonId: config.lessonId,
                gameVersion: config.gameVersion,
                gameType: config.gameType,
                testmode: config.testmode,
                ageLevel: config.ageLevel,
                ...overrides 
            };
            
            // Sử dụng hàm voice.StartSession từ SDK
            // SDK v2 tự động lấy context từ configureSdkContext nên chỉ cần testmode (nếu cần override)
            const res = await voice.StartSession({ testmode: config.testmode });

            
            // Cập nhật state
            sessionId = res.sessionId;
            
            return res;
        } catch (err: any) {
            error = err.message || "Khởi tạo phiên thất bại";
            console.error("Start Session Error:", error);
            throw err;
        } finally {
            isLoading = false;
        }
    };

    /**
     * Gửi file ghi âm để chấm điểm (Submit)
     */
    const submitAudio = async (
        audioBlob: Blob, 
        targetText: string | object, 
        questionIndex: number,
        durationMs: number = 0
    ): Promise<SubmitAnswerResponse> => {
        if (!sessionId) {
            const msg = "Chưa có Session ID. Hãy gọi startEvaluation trước.";
            error = msg;
            throw new Error(msg);
        }

        isLoading = true;
        error = null;
        
        try {
            // Convert Blob -> File object
            const audioFile = new File([audioBlob], "recording.wav", { type: "audio/wav" });

            const req: SubmitAnswerRequest = {
                sessionId,
                childId: config.childId,
                audioFile,
                questionIndex,
                targetText,
                durationMs,
                exerciseType: config.gameType, // Note: prop name is gameType but request needs exerciseType
                testmode: config.testmode
            };

            // Sử dụng hàm voice.Submit từ SDK
            const res = await voice.Submit({
                audioFile,
                questionIndex, // SDK có thể cần +1 hoặc không, giữ nguyên logic hiện tại
                targetText,
                durationMs,
                exerciseType: config.gameType,
                testmode: config.testmode
            });

            
            // Cập nhật state
            currentScore = res.score;
            
            return res;
        } catch (err: any) {
            error = err.message || "Gửi bài thất bại";
            console.error("Submit Error:", error);
            throw err;
        } finally {
            isLoading = false;
        }
    };

    /**
     * Kết thúc phiên học (End Session)
     */
    const finishEvaluation = async (
        totalQuestionsExpect: number = 6, 
        isUserAborted: boolean = false,
        keepalive: boolean = false
    ): Promise<EndSessionResponse | null> => {
        if (!sessionId) {
            console.warn("Không có Session để kết thúc.");
            return null;
        }

        isLoading = true;
        try {
            const req: EndSessionRequest & { keepalive?: boolean } = {
                sessionId,
                totalQuestionsExpect,
                isUserAborted,
                testmode: config.testmode,
                learner_id: config.childId,
                age_level: config.ageLevel,
                keepalive
            };
            
            // Sử dụng hàm voice.EndSession từ SDK
            const res = await voice.EndSession({ 
                totalQuestionsExpect, 
                isUserAborted, 
                testmode: config.testmode 
            });

            
            // Cleanup
            sessionId = null; 
            
            return res;
        } catch (err: any) {
            error = err.message || "Kết thúc phiên thất bại";
            console.error("End Session Error:", error);
            throw err;
        } finally {
            isLoading = false;
        }
    };

    // --- Return API ---
    return {
        // State getters
        get sessionId() { return sessionId; },
        get isLoading() { return isLoading; },
        get error() { return error; },
        get currentScore() { return currentScore; },
        
        // Functions
        startEvaluation,
        submitAudio,
        finishEvaluation,
        setSessionId: (id: string) => { sessionId = id; }
    };
}
