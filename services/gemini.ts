import { GoogleGenAI, Type } from "@google/genai";
import { Difficulty, GeneratedResponse } from "../types";

// NOTE: Hardcoded API Key for demo purposes based on user request.
// In production, use environment variables or a backend proxy.
const apiKey = 'PASTE_YOUR_API_KEY_HERE'; 
const ai = new GoogleGenAI({ apiKey });

// Helper to check key
const checkApiKey = () => {
    if (!apiKey || apiKey === 'PASTE_YOUR_API_KEY_HERE' || apiKey === '') {
        return false;
    }
    return true;
};

export const generateAnswer = async (
  question: string,
  difficulty: Difficulty
): Promise<GeneratedResponse> => {
  if (!checkApiKey()) throw new Error("Missing API Key");

  try {
    const model = "gemini-2.5-flash";
    const prompt = `
      You are an expert English tutor for Vietnamese students.
      The user asks: "${question}".
      Please generate a suggested answer in English suitable for a "${difficulty}" proficiency level.
      
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
  if (!checkApiKey()) return "Vui lòng cấu hình API Key trong file code.";

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
            text: `Please listen to this audio. The user is trying to read the following sentence: "${targetText}".
            Provide brief, constructive feedback in Vietnamese on their pronunciation, intonation, and fluency.
            Highlight any specific words they mispronounced. Keep it encouraging.`,
          },
        ],
      },
    });
    return response.text || "Không thể phân tích âm thanh.";
  } catch (error) {
    console.error("Error checking pronunciation:", error);
    return "Có lỗi xảy ra khi kiểm tra phát âm. Vui lòng thử lại.";
  }
};
