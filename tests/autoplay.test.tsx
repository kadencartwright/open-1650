import {act, fireEvent, render, screen, cleanup} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import type {CompiledPerformance} from '../src/audio/compilePerformance';

const transport = vi.hoisted(() => ({completed: new Set<string>(), id: '', play: vi.fn(), loop: false}));
vi.mock('../src/audio/useSingAlong', () => ({
  useSingAlong: (performance: CompiledPerformance) => {
    transport.id = performance.id;
    return {
      status: transport.completed.has(performance.id) ? 'ended' : 'idle',
      currentTick: transport.completed.has(performance.id) ? performance.durationTicks : 0,
      bpm: performance.defaultBpm, volume: 0.7, loopStanza: transport.loop,
      error: null, audioReady: false, activeStanza: undefined, activeLine: undefined,
      activeSyllable: undefined, play: transport.play, pause: vi.fn(), toggle: vi.fn(),
      prepareAudio: vi.fn(), scheduleTransport: vi.fn(), getTransportSnapshot: vi.fn(),
      restart: vi.fn(), seek: vi.fn(), setBpm: vi.fn(), setVolume: vi.fn(), setLoopStanza: vi.fn(),
    };
  },
}));
import App from '../src/App';

beforeEach(() => {
  localStorage.clear(); transport.completed.clear(); transport.play.mockClear(); transport.loop = false;
  window.history.replaceState({}, '', '/psalms/001/primary'); vi.useFakeTimers();
});
afterEach(() => {cleanup(); vi.useRealTimers();});

describe('continuous Psalter playback', () => {
  it('automatically loads and starts each next primary Psalm, then stops at 150', async () => {
    const view = render(<App />);
    fireEvent.click(screen.getByLabelText('Autoplay next Psalm'));
    for (let number = 1; number <= 150; number++) {
      expect(screen.getByRole('heading', {level: 1, name: `Psalm ${number}`})).toBeInTheDocument();
      transport.completed.add(transport.id);
      view.rerender(<App />);
      await act(async () => {await vi.advanceTimersByTimeAsync(1501);});
    }
    expect(window.location.pathname).toBe('/psalms/150/primary');
    expect(transport.play).toHaveBeenCalledTimes(149);
  }, 60000);

  it('does not advance when autoplay is disabled or a verse loop is active', async () => {
    const view = render(<App />);
    transport.completed.add(transport.id); view.rerender(<App />);
    await act(async () => {await vi.advanceTimersByTimeAsync(2500);});
    expect(window.location.pathname).toBe('/psalms/001/primary');
    transport.loop = true; view.rerender(<App />);
    fireEvent.click(screen.getByLabelText('Autoplay next Psalm'));
    await act(async () => {await vi.advanceTimersByTimeAsync(2500);});
    expect(window.location.pathname).toBe('/psalms/001/primary');
    expect(transport.play).not.toHaveBeenCalled();
  });
});
