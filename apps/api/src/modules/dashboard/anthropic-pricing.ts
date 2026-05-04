/**
 * Anthropic pricing table — blended cost per million tokens
 * (formula: inputPrice * 0.4 + outputPrice * 0.6).
 *
 * Mirrors the values used in the legacy aotekteo dashboard. Update
 * this table when Anthropic ships new models or revises prices.
 */
const PRICE_PER_MILLION_TOKENS: Record<string, number> = {
  'claude-haiku-4-5': 0.8 * 0.4 + 4.0 * 0.6,
  'claude-3-5-haiku': 0.8 * 0.4 + 4.0 * 0.6,
  'claude-3-haiku': 0.25 * 0.4 + 1.25 * 0.6,
  'claude-sonnet-4-6': 3.0 * 0.4 + 15.0 * 0.6,
  'claude-3-7-sonnet': 3.0 * 0.4 + 15.0 * 0.6,
  'claude-3-5-sonnet': 3.0 * 0.4 + 15.0 * 0.6,
  'claude-opus-4-7': 15.0 * 0.4 + 75.0 * 0.6,
  'claude-opus-4': 15.0 * 0.4 + 75.0 * 0.6,
};

const FALLBACK_RATE = 3.0;

export function computeCost(tokens: number, model: string | null): number {
  if (!tokens || !model) return 0;
  const entry = Object.entries(PRICE_PER_MILLION_TOKENS).find(([prefix]) =>
    model.startsWith(prefix),
  );
  const rate = entry?.[1] ?? FALLBACK_RATE;
  return (tokens / 1_000_000) * rate;
}
