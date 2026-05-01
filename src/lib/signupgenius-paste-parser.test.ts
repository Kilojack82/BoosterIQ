import { describe, expect, it } from 'vitest';
import { parsePastedRoster } from './signupgenius-paste-parser';

describe('parsePastedRoster', () => {
  it('parses a basic numbered roster under role headers', () => {
    const input = `
Concession stand
1. Sarah Smith
2. (open)
3. Mike Johnson

Grill
1. Tom Davis
2. (open)
3. Jane Brown
`;
    const result = parsePastedRoster(input);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.slots).toEqual([
      { role: 'Concession stand', slot_position: 1, filled_by_name: 'Sarah Smith' },
      { role: 'Concession stand', slot_position: 2, filled_by_name: null },
      { role: 'Concession stand', slot_position: 3, filled_by_name: 'Mike Johnson' },
      { role: 'Grill', slot_position: 1, filled_by_name: 'Tom Davis' },
      { role: 'Grill', slot_position: 2, filled_by_name: null },
      { role: 'Grill', slot_position: 3, filled_by_name: 'Jane Brown' },
    ]);
  });

  it('strips parenthetical time ranges from role headers', () => {
    const input = `
Concession stand (3:30 PM - 5:30 PM)
1. Alice
`;
    const result = parsePastedRoster(input);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.slots[0]?.role).toBe('Concession stand');
  });

  it('treats common open-slot variants as null fill', () => {
    const input = `
Cleanup crew
1. (open)
2. needed
3. empty
4. Open
`;
    const result = parsePastedRoster(input);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.slots.map((s) => s.filled_by_name)).toEqual([null, null, null, null]);
  });

  it('returns failure on empty input', () => {
    const r = parsePastedRoster('');
    expect(r.ok).toBe(false);
  });

  it('returns failure when no numbered slots are present', () => {
    const r = parsePastedRoster('Just some random text\nmore stuff');
    expect(r.ok).toBe(false);
  });

  it('handles dot or paren after slot number', () => {
    const input = `
Setup crew
1) Anne
2. Beth
`;
    const result = parsePastedRoster(input);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.slots).toHaveLength(2);
    expect(result.slots[0]?.filled_by_name).toBe('Anne');
    expect(result.slots[1]?.filled_by_name).toBe('Beth');
  });
});
