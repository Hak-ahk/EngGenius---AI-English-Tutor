export enum Difficulty {
  EASY = 'Easy (Dễ)',
  MEDIUM = 'Medium (Trung bình)',
  ADVANCED = 'Advanced (Nâng cao)'
}

export interface SentencePair {
  english: string;
  vietnamese: string;
}

export interface GeneratedResponse {
  english: string;
  vietnamese: string;
  sentences: SentencePair[];
}

export interface TtsConfig {
  voiceURI: string; // Changed to store the unique ID of the system voice
  speed: number;
}
