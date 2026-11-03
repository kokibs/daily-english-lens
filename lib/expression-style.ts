export const EXPRESSION_STYLES = ["conversation", "casual", "polite"] as const;

export type ExpressionStyle = typeof EXPRESSION_STYLES[number];

export const DEFAULT_EXPRESSION_STYLE: ExpressionStyle = "conversation";

export const EXPRESSION_STYLE_LABELS: Record<ExpressionStyle, string> = {
  conversation: "日常会話",
  casual: "SNS・カジュアル",
  polite: "丁寧な表現",
};

export const EXPRESSION_STYLE_EXAMPLES: Record<ExpressionStyle, string> = {
  conversation: "I got caught in the rain.",
  casual: "Got soaked on my way home.",
  polite: "I got caught in the rain on my way home.",
};

export function isExpressionStyle(value: unknown): value is ExpressionStyle {
  return typeof value === "string" && EXPRESSION_STYLES.some((style) => style === value);
}
