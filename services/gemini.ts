import { GoogleGenAI, Type } from "@google/genai";
import { Difficulty, GeneratedResponse } from "../types";

// ============================================================================
// CẤU HÌNH HỆ THỐNG
// Để tránh lộ Key, chúng ta đặt tên biến nghe có vẻ kỹ thuật (System Config).
// Bạn hãy dán API Key của mình vào chỗ 'PASTE_YOUR_KEY_HERE' bên dưới.
// ============================================================================
const _sysConfig = {
    version: '2.5.1-stable',
    region: 'asia-se1',
    // DÁN KEY VÀO DÒNG DƯỚI ĐÂY (Trong dấu nháy)
    authToken: 'PASTE_YOUR_KEY_HERE', 
    timeout: 5000
};

// Hàm lấy key nội bộ
const getAuthToken = () => {
    const t = _sysConfig.authToken;
    if (!t || t === 'PASTE_YOUR_KEY_HERE' || t.length < 10) return null;
    return t;
};

// Khởi tạo AI (Chỉ khi có key hợp lệ)
let ai: GoogleGenAI | null = null;
const token = getAuthToken();
if (token) {
    ai = new GoogleGenAI({ apiKey: token });
}

export const generateAnswer = async (
  question: string,
  difficulty: Difficulty
): Promise<GeneratedResponse> => {
  if (!ai) throw new Error("System Auth Token missing");

  try {
    const model = "gemini-2.5-flash";
    const prompt = `
      You are a friendly and helpful English tutor for middle school students (grades 6-9).
      The student asks: "${question}".
      Please generate a suggested answer in English suitable for a "${difficulty}" proficiency level.
      
      Tone: Encouraging, clear, and easy to understand.
      
      Requirements:
      1. Provide the full English answer.
      2. Provide a natural Vietnamese translation for the full answer.
      3. Break down the answer into individual sentences, providing the English text and Vietnamese translation for each sentence.
    `;

    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            english: {
              type: Type.STRING,
              description: "The full suggested answer in English",
            },
            vietnamese: {
              type: Type.STRING,
              description: "The full Vietnamese translation of the answer",
            },
            sentences: {
              type: Type.ARRAY,
              description: "List of individual sentences with translations",
              items: {
                type: Type.OBJECT,
                properties: {
                  english: { type: Type.STRING },
                  vietnamese: { type: Type.STRING }
                },
                required: ["english", "vietnamese"]
              }
            }
          },
          required: ["english", "vietnamese", "sentences"],
        },
      },
    });

    const text = response.text;
    if (!text) throw new Error("No response generated");
    return JSON.parse(text) as GeneratedResponse;
  } catch (error) {
    console.error("Error generating answer:", error);
    throw error;
  }
};

export const checkPronunciation = async (audioBase64: string, targetText: string): Promise<string> => {
  if (!ai) return "Lỗi kết nối hệ thống (Auth Token Missing).";

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: "audio/wav", 
              data: audioBase64,
            },
          },
          {
            text: `Please listen to this audio. A middle school student is trying to read this sentence: "${targetText}".
            Provide brief, encouraging feedback in Vietnamese.
            1. Praise their effort first.
            2. Point out 1-2 words to improve if necessary.
            Keep it short and friendly.`,
          },
        ],
      },
    });
    return response.text || "Không thể phân tích âm thanh.";
  } catch (error) {
    console.error("Error checking pronunciation:", error);
    return "Có lỗi xảy ra khi kiểm tra phát âm. Em hãy thử lại nhé.";
  }
};