import { describe, expect, it } from 'vitest';
import { formatMoney } from './money';

describe('formatMoney', () => { it('formats NPR with grouping', () => expect(formatMoney(3860)).toBe('NPR 3,860')); it('shows a positive net sign when requested', () => expect(formatMoney(2620, true)).toBe('+NPR 2,620')); it('keeps negative amounts explicit', () => expect(formatMoney(-1240)).toBe('-NPR 1,240')); });
