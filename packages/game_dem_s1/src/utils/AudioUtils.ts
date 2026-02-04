/**
 * Phát lại file âm thanh vừa ghi âm (dành cho mục đích debug)
 * @param audioBlob File hoặc Blob âm thanh cần phát
 */
export function playRecordedAudio(audioBlob: Blob | File) {
    if (!audioBlob) {
        console.warn("[AudioUtils] No audio blob to play");
        return;
    }

    try {
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        
        console.log("🔊 [AudioUtils] Playing recorded audio...", audioBlob.size, "bytes");
        
        audio.play().catch(e => console.error("[AudioUtils] Error playing audio:", e));

        // Cleanup URL sau khi nghe xong để tránh memory leak
        audio.onended = () => {
            console.log("✅ [AudioUtils] Audio playback finished");
            URL.revokeObjectURL(audioUrl);
        };
    } catch (err) {
        console.error("[AudioUtils] Failed to setup audio playback:", err);
    }
}
