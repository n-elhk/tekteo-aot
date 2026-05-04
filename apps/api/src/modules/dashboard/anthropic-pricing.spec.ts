import { describe, expect, it } from 'vitest';
import { computeCost } from './anthropic-pricing';

describe('computeCost', () => {
  it('returns 0 when tokens is 0', () => {
    expect(computeCost(0, 'claude-opus-4-7')).toBe(0);
  });

  it('returns 0 when model is null', () => {
    expect(computeCost(1_000_000, null)).toBe(0);
  });

  it('uses fallback rate (3.0) for unknown models', () => {
    expect(computeCost(1_000_000, 'gpt-4-turbo')).toBe(3.0);
  });

  it('matches haiku-4-5 prefix and computes blended cost', () => {
    // 0.80 * 0.4 + 4.00 * 0.6 = 0.32 + 2.4 = 2.72
    expect(computeCost(1_000_000, 'claude-haiku-4-5')).toBeCloseTo(2.72, 5);
  });

  it('matches versioned model name via startsWith', () => {
    // claude-haiku-4-5-20251001 → matches claude-haiku-4-5
    expect(computeCost(1_000_000, 'claude-haiku-4-5-20251001')).toBeCloseTo(
      2.72,
      5,
    );
  });

  it('matches sonnet-4-6 prefix', () => {
    // 3.00 * 0.4 + 15.0 * 0.6 = 1.2 + 9.0 = 10.2
    expect(computeCost(1_000_000, 'claude-sonnet-4-6')).toBeCloseTo(10.2, 5);
  });

  it('matches opus-4-7 prefix', () => {
    // 15.0 * 0.4 + 75.0 * 0.6 = 6.0 + 45.0 = 51.0
    expect(computeCost(1_000_000, 'claude-opus-4-7')).toBeCloseTo(51.0, 5);
  });

  it('scales linearly with tokens', () => {
    expect(computeCost(500_000, 'claude-haiku-4-5')).toBeCloseTo(1.36, 5);
  });
});
