const FPT_API_KEY = "Y6cOAzkF6ac0DlD4STe1BqAukfwpieDk";
const FPT_VOICE = "thuminh";

export const speakWithFPT = async (text) => {
  try {
    const response = await fetch("https://api.fpt.ai/hmi/tts/v5", {
      method: "POST",
      headers: {
        "api-key": FPT_API_KEY,
        voice: FPT_VOICE,
        speed: "",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: text,
    });

    const result = await response.json();

    // API FPT trả về link âm thanh trong trường 'async'
    if (result.async) {
      const audio = new Audio(result.async);
      audio.play();
      return result.async;
    } else {
      console.error("Không lấy được file âm thanh:", result);
    }
  } catch (err) {
    console.error("Lỗi khi gọi FPT TTS:", err);
  }
};
