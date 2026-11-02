export const ENGLISH_LEVELS = ["intro", "beginner", "intermediate", "advanced"] as const;

export type EnglishLevel = typeof ENGLISH_LEVELS[number];

export const DEFAULT_ENGLISH_LEVEL: EnglishLevel = "intermediate";

export const ENGLISH_LEVEL_LABELS: Record<EnglishLevel, string> = {
  intro: "入門",
  beginner: "初級",
  intermediate: "中級",
  advanced: "上級",
};

export const ENGLISH_LEVEL_DESCRIPTIONS: Record<EnglishLevel, string> = {
  intro: "基本的な単語と短い英文",
  beginner: "身近な出来事をシンプルな英語で",
  intermediate: "日常会話で使える自然な表現",
  advanced: "豊かな言い回しや細かなニュアンス",
};

export const ENGLISH_LEVEL_EXAMPLES: Record<EnglishLevel, { english: string; japanese: string }> = {
  intro: { english: "It's raining.", japanese: "雨が降っている。" },
  beginner: { english: "I forgot my umbrella.", japanese: "傘を忘れた。" },
  intermediate: { english: "I got caught in the rain.", japanese: "雨に降られた。" },
  advanced: { english: "The rain came out of nowhere.", japanese: "突然雨が降り出した。" },
};

export function isEnglishLevel(value: unknown): value is EnglishLevel {
  return typeof value === "string" && ENGLISH_LEVELS.some((level) => level === value);
}
