import {fireEvent, render, screen} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import App from '../src/App';

beforeEach(() => {
  window.history.replaceState({}, '', '/psalms/100/primary');
  localStorage.clear();
  window.ReactNativeWebView = {postMessage: vi.fn()};
  vi.spyOn(window, 'matchMedia').mockImplementation(query => ({
    matches: query === '(prefers-reduced-motion: reduce)', media: query,
    onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => true,
  }));
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    return {
      top: this.id === 'main-content' ? 0 : this.getAttribute('aria-label') === 'Tune player' ? 590 : 1200,
      height: this.id === 'main-content' ? 690 : 80,
    } as DOMRect;
  });
});
afterEach(() => {delete window.ReactNativeWebView; vi.restoreAllMocks();});

describe('native reader scrolling', () => {
  it('reveals a selected lyric while paused even when WebView scrollIntoView does nothing', () => {
    render(<App />);
    const reader = screen.getByRole('main');
    Object.defineProperties(reader, {clientHeight: {value: 690}, scrollHeight: {value: 5000}});
    const target = screen.getByRole('button', {name: 'Start from: For why? the LORD our God is good,'});
    target.scrollIntoView = vi.fn();
    fireEvent.click(target);
    expect(reader.scrollTop).toBe(945);
    expect(target.scrollIntoView).not.toHaveBeenCalled();
    expect(screen.getByRole('button', {name: 'Play tune'})).toBeInTheDocument();
  });

  it('returns to the opening text on restart, including when already at tick zero', () => {
    render(<App />);
    const reader = screen.getByRole('main');
    reader.scrollTop = 700;
    fireEvent.click(screen.getByRole('button', {name: 'Restart Psalm'}));
    expect(reader.scrollTop).toBe(0);
  });
});
