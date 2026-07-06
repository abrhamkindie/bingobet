import { describe, it, expect } from 'vitest';
import { errorMessage, fmtETB, fmtNum, t } from './i18n.js';

describe('errorMessage', () => {
  it('maps known ApiError codes to friendly copy', () => {
    expect(errorMessage({ code: 'INSUFFICIENT_BALANCE' })).toBe(t.errors.INSUFFICIENT_BALANCE);
    expect(errorMessage({ code: 'NETWORK' })).toBe(t.errors.NETWORK);
    expect(errorMessage({ code: 'DAILY_ALREADY_CLAIMED' })).toBe(t.errors.DAILY_ALREADY_CLAIMED);
  });

  it('falls back to the server message for unknown non-HTTP codes', () => {
    expect(errorMessage({ code: 'CUSTOM_THING', message: 'Custom problem' })).toBe('Custom problem');
  });

  it('uses the default for raw HTTP codes and empty errors', () => {
    expect(errorMessage({ code: 'HTTP_500', message: 'x' })).toBe(t.errors.default);
    expect(errorMessage(null)).toBe(t.errors.default);
  });

  it('honors an explicit fallback', () => {
    expect(errorMessage(null, 'nope')).toBe('nope');
  });
});

describe('money formatting', () => {
  it('rounds ETB to whole numbers with grouping', () => {
    expect(fmtETB(1234.5)).toBe('1,235');
    expect(fmtETB(0)).toBe('0');
    expect(fmtETB(undefined)).toBe('0');
  });
  it('formats plain numbers with grouping', () => {
    expect(fmtNum(1000000)).toBe('1,000,000');
  });
});
