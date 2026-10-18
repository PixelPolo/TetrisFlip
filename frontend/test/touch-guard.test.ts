import { describe, expect, it } from 'vitest';
import { shouldBlockTouch } from '../src/ui/touch-guard';

/** A stand-in for a DOM element that sits inside (or not) an element matching a selector. */
const element = (insideNative: boolean) => ({
  closest: (selector: string) => (insideNative && selector.includes('input') ? {} : null),
});

describe('touch guard', () => {
  it('cancels touches on the game screen (board, pad, panels)', () => {
    expect(shouldBlockTouch(element(false))).toBe(true);
  });

  it('leaves form fields, buttons, links and the scrollable menu alone', () => {
    expect(shouldBlockTouch(element(true))).toBe(false);
  });

  it('looks at the parent of a text node', () => {
    expect(shouldBlockTouch({ parentElement: element(false) })).toBe(true);
    expect(shouldBlockTouch({ parentElement: element(true) })).toBe(false);
  });

  it('ignores targets that are not elements', () => {
    expect(shouldBlockTouch(null)).toBe(false);
    expect(shouldBlockTouch({})).toBe(false);
  });
});
