export enum Difficulty {
  EASY = 'Easy (Dễ)',
  MEDIUM = 'Medium (Trung bình)',
  ADVANCED = 'Advanced (Nâng cao)'
}

export enum VoiceName {
  Puck = 'Puck',
  Charon = 'Charon',
  Kore = 'Kore',
  Fenrir = 'Fenrir',
  Zephyr = 'Zephyr'
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
  voice: VoiceName;
  speed: number;
}
