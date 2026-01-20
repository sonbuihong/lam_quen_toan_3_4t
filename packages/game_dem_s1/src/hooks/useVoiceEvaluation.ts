import { 
    StartSession,
    Submit,
    EndSession,
    StartSessionRequest, 
    ExerciseType, 
    SubmitAnswerRequest,
    EndSessionRequest,
    StartSessionResponse,
    SubmitAnswerResponse,
    EndSessionResponse
} from '../lib/voice-session-client';

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
            
            // Sử dụng hàm StartSession thay vì client instance
            const res = await StartSession(req);
            
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

            // Sử dụng hàm Submit
            const res = await Submit(req);
            
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
            
            // Sử dụng hàm EndSession
            // Note: Assuming EndSession or fetch underneath supports key 'keepalive' in options or we patch the type here
            // Since we can't see the library code, we cast it if needed, but passing property to object is safe in JS/TS.
            const res = await EndSession(req);
            
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
