import {afterEach, describe, expect, it, vi} from 'vitest';
import {followLyric, lyricScrollTop} from '../src/lib/lyricScroll';

const geometry = {
  viewportTop: 0, viewportHeight: 690, scrollHeight: 3000,
  scrollTop: 0, targetTop: 1150, targetHeight: 80, playerTop: 590,
};
afterEach(() => vi.restoreAllMocks());

describe('Android lyric following', () => {
  it('centers a wrapped line above the fixed player, excluding its covered area', () => {
    const scrollTop = lyricScrollTop(geometry);
    const lineCenter = geometry.targetTop - scrollTop + geometry.targetHeight / 2;
    expect(lineCenter).toBe(295);
    expect(lineCenter + geometry.targetHeight / 2).toBeLessThan(geometry.playerTop);
  });

  it('accounts for a reader below a header and an existing scroll position', () => {
    expect(lyricScrollTop({...geometry, viewportTop: 70, playerTop: 660, scrollTop: 500, targetTop: 120})).toBe(295);
  });

  it('keeps the opening and final lines inside the available scroll range', () => {
    expect(lyricScrollTop({...geometry, targetTop: 25})).toBe(0);
    expect(lyricScrollTop({...geometry, targetTop: 5000})).toBe(2310);
    expect(lyricScrollTop({...geometry, scrollHeight: 400, targetTop: 100})).toBe(0);
  });

  it('aligns the beginning of an unusually tall lyric instead of hiding its opening', () => {
    const scrollTop = lyricScrollTop({...geometry, targetHeight: 900});
    expect(geometry.targetTop - scrollTop).toBe(16);
  });

  it('moves the dedicated reader, even when Android scrollIntoView has no effect', () => {
    const reader = document.createElement('main');
    const target = document.createElement('button');
    const player = document.createElement('aside');
    reader.append(target); document.body.append(reader, player);
    Object.defineProperties(reader, {clientHeight: {value: 690}, scrollHeight: {value: 3000}});
    vi.spyOn(reader, 'getBoundingClientRect').mockReturnValue({top: 0} as DOMRect);
    vi.spyOn(target, 'getBoundingClientRect').mockReturnValue({top: 1150, height: 80} as DOMRect);
    vi.spyOn(player, 'getBoundingClientRect').mockReturnValue({top: 590} as DOMRect);
    target.scrollIntoView = vi.fn();
    const windowScroll = vi.spyOn(window, 'scrollTo');
    followLyric(reader, target, player, true);
    expect(reader.scrollTop).toBe(895);
    expect(target.scrollIntoView).not.toHaveBeenCalled();
    expect(windowScroll).not.toHaveBeenCalled();
    followLyric(reader, null, player, true);
    expect(reader.scrollTop).toBe(0);
    reader.remove(); player.remove();
  });

  it('animates the reader and cancels old following when seeking or changing Psalms', () => {
    const reader = document.createElement('main');
    const target = document.createElement('button');
    Object.defineProperties(reader, {clientHeight: {value: 690}, scrollHeight: {value: 3000}});
    vi.spyOn(reader, 'getBoundingClientRect').mockReturnValue({top: 0} as DOMRect);
    vi.spyOn(target, 'getBoundingClientRect').mockReturnValue({top: 1150, height: 80} as DOMRect);
    const callbacks: FrameRequestCallback[] = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => {callbacks.push(callback); return callbacks.length;});
    const cancelFrame = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
    const cancel = followLyric(reader, target, null, false);
    callbacks[0](100);
    callbacks[1](230);
    expect(reader.scrollTop).toBeGreaterThan(0);
    cancel();
    expect(cancelFrame).toHaveBeenCalledWith(3);
  });
});
