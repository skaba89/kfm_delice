import { describe, it, expect } from 'vitest';
import { getTier, getTierProgress, TIER_THRESHOLDS } from '@/lib/hooks/use-loyalty';

describe('getTier', () => {
  it('should return Bronze for 0 points', () => {
    const tier = getTier(0);
    expect(tier.name).toBe('Bronze');
    expect(tier.min).toBe(0);
  });

  it('should return Bronze for points within Bronze range (0-100)', () => {
    expect(getTier(1).name).toBe('Bronze');
    expect(getTier(50).name).toBe('Bronze');
    expect(getTier(100).name).toBe('Bronze');
  });

  it('should return Silver for 101 points', () => {
    const tier = getTier(101);
    expect(tier.name).toBe('Silver');
    expect(tier.min).toBe(101);
  });

  it('should return Silver for points within Silver range (101-500)', () => {
    expect(getTier(200).name).toBe('Silver');
    expect(getTier(350).name).toBe('Silver');
    expect(getTier(500).name).toBe('Silver');
  });

  it('should return Gold for 501 points', () => {
    const tier = getTier(501);
    expect(tier.name).toBe('Gold');
    expect(tier.min).toBe(501);
  });

  it('should return Gold for points within Gold range (501-1000)', () => {
    expect(getTier(600).name).toBe('Gold');
    expect(getTier(800).name).toBe('Gold');
    expect(getTier(1000).name).toBe('Gold');
  });

  it('should return Platinum for 1001 points', () => {
    const tier = getTier(1001);
    expect(tier.name).toBe('Platinum');
    expect(tier.min).toBe(1001);
  });

  it('should return Platinum for very high points', () => {
    expect(getTier(5000).name).toBe('Platinum');
    expect(getTier(100000).name).toBe('Platinum');
  });

  it('should return correct discount for each tier', () => {
    expect(getTier(0).discount).toBe('2%');
    expect(getTier(101).discount).toBe('5%');
    expect(getTier(501).discount).toBe('10%');
    expect(getTier(1001).discount).toBe('15%');
  });

  it('should return correct next threshold for each tier', () => {
    expect(getTier(0).next).toBe(101);
    expect(getTier(101).next).toBe(501);
    expect(getTier(501).next).toBe(1001);
    expect(getTier(1001).next).toBe(Infinity);
  });

  it('should handle boundary values between Bronze and Silver', () => {
    expect(getTier(100).name).toBe('Bronze');
    expect(getTier(101).name).toBe('Silver');
  });

  it('should handle boundary values between Silver and Gold', () => {
    expect(getTier(500).name).toBe('Silver');
    expect(getTier(501).name).toBe('Gold');
  });

  it('should handle boundary values between Gold and Platinum', () => {
    expect(getTier(1000).name).toBe('Gold');
    expect(getTier(1001).name).toBe('Platinum');
  });
});

describe('getTierProgress', () => {
  it('should return 0 at the start of Bronze tier', () => {
    expect(getTierProgress(0)).toBe(0);
  });

  it('should return progress within Bronze tier', () => {
    // Bronze: 0 -> 101, so 50/101 ≈ 50%
    expect(getTierProgress(50)).toBe(50);
  });

  it('should return ~99 at the end of Bronze tier', () => {
    // (100 - 0) / (101 - 0) * 100 = 99.009... → 99
    expect(getTierProgress(100)).toBe(99);
  });

  it('should return 0 at the start of Silver tier', () => {
    expect(getTierProgress(101)).toBe(0);
  });

  it('should return progress within Silver tier', () => {
    // Silver: 101 -> 501, range = 400
    // (301 - 101) / (501 - 101) * 100 = 200/400 * 100 = 50
    expect(getTierProgress(301)).toBe(50);
  });

  it('should return ~99 at the end of Silver tier', () => {
    // (500 - 101) / (501 - 101) * 100 = 399/400 * 100 = 99.75 → 100
    expect(getTierProgress(500)).toBe(100);
  });

  it('should return 0 at the start of Gold tier', () => {
    expect(getTierProgress(501)).toBe(0);
  });

  it('should return progress within Gold tier', () => {
    // Gold: 501 -> 1001, range = 500
    // (751 - 501) / (1001 - 501) * 100 = 250/500 * 100 = 50
    expect(getTierProgress(751)).toBe(50);
  });

  it('should return 100 for Platinum tier (no next tier)', () => {
    expect(getTierProgress(1001)).toBe(100);
    expect(getTierProgress(5000)).toBe(100);
    expect(getTierProgress(100000)).toBe(100);
  });
});

describe('TIER_THRESHOLDS', () => {
  it('should have exactly 4 tiers', () => {
    expect(TIER_THRESHOLDS).toHaveLength(4);
  });

  it('should have tiers in ascending order of min points', () => {
    for (let i = 1; i < TIER_THRESHOLDS.length; i++) {
      expect(TIER_THRESHOLDS[i].min).toBeGreaterThan(TIER_THRESHOLDS[i - 1].min);
    }
  });

  it('should have correct tier names', () => {
    expect(TIER_THRESHOLDS.map(t => t.name)).toEqual(['Bronze', 'Silver', 'Gold', 'Platinum']);
  });
});
