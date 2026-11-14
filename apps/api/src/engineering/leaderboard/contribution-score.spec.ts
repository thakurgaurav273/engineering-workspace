import {
  SCORE_WEIGHTS,
  cadenceScore,
  deliveryScore,
  recognitionScore,
  totalScore,
  workdaysBetween,
} from './contribution-score';

const d = (iso: string) => new Date(iso);

describe('contribution score', () => {
  it('weights sum to 100%: delivery 70, check-ins / updates / recognition 10 each', () => {
    expect(SCORE_WEIGHTS).toEqual({ delivery: 0.7, checkIns: 0.1, updates: 0.1, recognition: 0.1 });
    expect(totalScore({ delivery: 100, checkIns: 100, updates: 100, recognition: 100 })).toBe(100);
    expect(totalScore({ delivery: 100, checkIns: 0, updates: 0, recognition: 0 })).toBe(70);
    expect(totalScore({ delivery: 0, checkIns: 100, updates: 100, recognition: 100 })).toBe(30);
  });

  describe('deliveryScore', () => {
    it('scores 0 when nothing was due or done', () => {
      expect(deliveryScore({ completed: [], overdueOpen: 0 }).score).toBe(0);
    });

    it('counts completion any time on the due date as on time', () => {
      const r = deliveryScore({
        completed: [{ dueDate: d('2026-11-10T00:00:00Z'), completedAt: d('2026-11-10T22:30:00Z') }],
        overdueOpen: 0,
      });
      expect(r).toMatchObject({ score: 100, onTime: 1, late: 0 });
    });

    it('treats issues with no due date as on time', () => {
      expect(deliveryScore({ completed: [{ dueDate: null, completedAt: d('2026-11-10T09:00:00Z') }], overdueOpen: 0 }).score).toBe(100);
    });

    it('gives half credit for late work and none for overdue open issues', () => {
      const r = deliveryScore({
        completed: [
          { dueDate: d('2026-11-10T00:00:00Z'), completedAt: d('2026-11-09T12:00:00Z') }, // on time: 1
          { dueDate: d('2026-11-10T00:00:00Z'), completedAt: d('2026-11-12T12:00:00Z') }, // late: 0.5
        ],
        overdueOpen: 2, // 0 each
      });
      // (1 + 0.5) / 4 = 37.5% -> 38
      expect(r).toEqual({ score: 38, completed: 2, onTime: 1, late: 1, overdue: 2 });
    });
  });

  describe('cadenceScore', () => {
    it('counts distinct days, not posts', () => {
      const r = cadenceScore(
        [d('2026-11-09T09:00:00Z'), d('2026-11-09T17:00:00Z'), d('2026-11-10T10:00:00Z')],
        5,
      );
      expect(r).toEqual({ days: 2, score: 40 });
    });

    it('caps at 100', () => {
      expect(cadenceScore([d('2026-11-08T09:00:00Z'), d('2026-11-09T09:00:00Z')], 1).score).toBe(100);
    });
  });

  it('recognition maxes out at 10', () => {
    expect(recognitionScore(3)).toBe(30);
    expect(recognitionScore(14)).toBe(100);
  });

  it('counts weekdays only, at least one', () => {
    // Mon 9 Nov 2026 .. Sun 15 Nov 2026 -> 5 weekdays
    expect(workdaysBetween(d('2026-11-09T00:00:00Z'), d('2026-11-15T12:00:00Z'))).toBe(5);
    // A window that is only a weekend still yields 1
    expect(workdaysBetween(d('2026-11-14T00:00:00Z'), d('2026-11-15T12:00:00Z'))).toBe(1);
  });
});
