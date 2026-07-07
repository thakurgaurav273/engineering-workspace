import { computeNext, formatNumber, financialYearStart, NumberConfig } from './document-numbering.util';

const base: NumberConfig = {
  prefix: 'INV', suffix: '', separator: '-', startNumber: 1, currentNumber: 0,
  padding: 6, resetMode: 'YEARLY', useFinancialYear: false, periodKey: '',
};
const june2026 = new Date(2026, 5, 15); // June
const jan2026 = new Date(2026, 0, 10); // January

describe('formatNumber', () => {
  it('yearly with prefix + year + padding', () => {
    expect(formatNumber(base, 1, june2026)).toBe('INV-2026-000001');
  });
  it('never mode omits the year', () => {
    expect(formatNumber({ ...base, resetMode: 'NEVER', prefix: 'QTN' }, 245, june2026)).toBe('QTN-000245');
  });
  it('monthly includes year and month', () => {
    expect(formatNumber({ ...base, resetMode: 'MONTHLY' }, 3, june2026)).toBe('INV-2026-06-000003');
  });
  it('respects padding and prefix (OFF-2026-0003)', () => {
    expect(formatNumber({ ...base, prefix: 'OFF', padding: 4 }, 3, june2026)).toBe('OFF-2026-0003');
  });
  it('appends a suffix', () => {
    expect(formatNumber({ ...base, suffix: 'A' }, 1, june2026)).toBe('INV-2026-000001-A');
  });
  it('financial year token', () => {
    expect(formatNumber({ ...base, useFinancialYear: true }, 1, june2026)).toBe('INV-2026-27-000001');
    expect(financialYearStart(jan2026)).toBe(2025);
  });
});

describe('computeNext', () => {
  it('first issue uses startNumber and sets the period', () => {
    expect(computeNext(base, june2026)).toEqual({ issued: 1, periodKey: '2026' });
  });
  it('increments within the same period', () => {
    expect(computeNext({ ...base, currentNumber: 5, periodKey: '2026' }, june2026).issued).toBe(6);
  });
  it('resets to startNumber on a new year', () => {
    expect(computeNext({ ...base, currentNumber: 50, periodKey: '2025' }, june2026)).toEqual({ issued: 1, periodKey: '2026' });
  });
  it('resets monthly', () => {
    expect(computeNext({ ...base, resetMode: 'MONTHLY', currentNumber: 9, periodKey: '2026-05' }, june2026)).toEqual({ issued: 1, periodKey: '2026-06' });
  });
  it('never mode just increments, no reset', () => {
    expect(computeNext({ ...base, resetMode: 'NEVER', currentNumber: 244, periodKey: '' }, june2026)).toEqual({ issued: 245, periodKey: '' });
  });
  it('honors a startNumber floor', () => {
    expect(computeNext({ ...base, resetMode: 'NEVER', startNumber: 100, currentNumber: 0, periodKey: '' }, june2026).issued).toBe(100);
  });
});
