import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import App from "../src/App";

class FakeParam {
  value = 0;

  setValueAtTime(value: number) {
    this.value = value;
  }

  linearRampToValueAtTime(value: number) {
    this.value = value;
  }

  exponentialRampToValueAtTime(value: number) {
    this.value = value;
  }

  cancelScheduledValues() {}

  setTargetAtTime(value: number) {
    this.value = value;
  }
}

class FakeNode {
  gain = new FakeParam();
  frequency = new FakeParam();
  detune = new FakeParam();
  Q = new FakeParam();
  type = "sine";
  buffer: FakeBuffer | null = null;
  periodicWave: FakePeriodicWave | null = null;
  onended: (() => void) | null = null;

  connect() {
    return this;
  }

  disconnect() {}

  setPeriodicWave(wave: FakePeriodicWave) {
    this.periodicWave = wave;
  }

  start() {}

  stop() {}
}

interface FakePeriodicWave {
  real: Float32Array;
  imag: Float32Array;
}

class FakeBuffer {
  readonly numberOfChannels: number;
  readonly #channels: Float32Array[];

  constructor(numberOfChannels: number, length: number) {
    this.numberOfChannels = numberOfChannels;
    this.#channels = Array.from(
      { length: numberOfChannels },
      () => new Float32Array(length),
    );
  }

  getChannelData(channel: number) {
    return this.#channels[channel];
  }
}

function installFakeAudioContext() {
  const previous = Object.getOwnPropertyDescriptor(
    globalThis,
    "AudioContext",
  );
  const instances: FakeAudioContext[] = [];

  class FakeAudioContext extends EventTarget {
    state = "suspended";
    destination = {};
    sampleRate = 1_000;
    startedAt = performance.now();
    closeCalls = 0;
    oscillators: FakeNode[] = [];
    periodicWaves: FakePeriodicWave[] = [];

    constructor() {
      super();
      instances.push(this);
    }

    get currentTime() {
      return (performance.now() - this.startedAt) / 1_000;
    }

    createGain() {
      return new FakeNode();
    }

    createOscillator() {
      const oscillator = new FakeNode();
      this.oscillators.push(oscillator);
      return oscillator;
    }

    createBiquadFilter() {
      return new FakeNode();
    }

    createConvolver() {
      return new FakeNode();
    }

    createBuffer(numberOfChannels: number, length: number) {
      return new FakeBuffer(numberOfChannels, length);
    }

    createPeriodicWave(real: Float32Array, imag: Float32Array) {
      const wave = { real, imag };
      this.periodicWaves.push(wave);
      return wave;
    }

    async resume() {
      this.state = "running";
      this.dispatchEvent(new Event("statechange"));
    }

    async close() {
      this.closeCalls += 1;
      this.state = "closed";
    }

    getOutputTimestamp() {
      return {
        contextTime: this.currentTime,
        performanceTime: performance.now(),
      };
    }
  }

  Object.defineProperty(globalThis, "AudioContext", {
    configurable: true,
    value: FakeAudioContext,
  });

  return {
    instances,
    restore() {
      if (previous) {
        Object.defineProperty(globalThis, "AudioContext", previous);
      } else {
        Reflect.deleteProperty(globalThis, "AudioContext");
      }
    },
  };
}

describe("sing-along application", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/psalms/100/primary");
  });

  it("opens directly on the selected Psalm, lyrics, and player", () => {
    render(<App />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Psalm 100" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("combobox", { name: "Tune for Psalm 100" }),
    ).toHaveDisplayValue("Old Hundredth");
    expect(
      screen.queryByRole("button", { name: /^Follow(?:ing)?$/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "Synchronized lyrics" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Play tune" })).toBeVisible();
    expect(
      screen.getAllByRole("button", { name: /^Start from:/ }),
    ).toHaveLength(16);
  });

  it.each([
    {
      number: 1,
      tune: "St. Peter",
      lines: 24,
      tempo: 86,
      key: "E-flat major",
      meter: "8.6.8.6",
      time: "4/4",
    },
    {
      number: 23,
      tune: "Crimond",
      lines: 20,
      tempo: 80,
      key: "F major",
      meter: "8.6.8.6",
      time: "3/4",
    },
    {
      number: 100,
      tune: "Old Hundredth",
      lines: 16,
      tempo: 84,
      key: "G major",
      meter: "8.8.8.8",
      time: "4/4",
    },
  ])(
    "loads the stable Psalm $number and $tune route",
    async ({ number, tune, lines, tempo, key, meter, time }) => {
      const user = userEvent.setup();
      window.history.replaceState(
        {},
        "",
        `/psalms/${String(number).padStart(3, "0")}/primary`,
      );
      render(<App />);

      expect(
        screen.getByRole("heading", {
          level: 1,
          name: `Psalm ${number}`,
        }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("combobox", {
          name: `Tune for Psalm ${number}`,
        }),
      ).toHaveDisplayValue(tune);
      expect(
        screen.getByRole("region", { name: "Synchronized lyrics" }),
      ).toBeInTheDocument();
      const playbackSummary = screen.getByLabelText(
        "More playback options",
      );
      await user.click(playbackSummary);
      expect(
        within(
          playbackSummary.closest("details") as HTMLElement,
        ).getByRole("slider", { name: "Tempo" }),
      ).toHaveValue(String(tempo));
      expect(
        screen.getAllByRole("button", { name: /^Start from:/ }),
      ).toHaveLength(lines);

      const summary = screen.getByLabelText("Song details");
      await user.click(summary);
      const details = summary.closest("details");
      expect(details).toHaveAttribute("open");
      const detailPanel = within(details as HTMLElement);
      expect(detailPanel.getByText(meter)).toBeInTheDocument();
      expect(detailPanel.getByText(key)).toBeInTheDocument();
      expect(detailPanel.getByText(time)).toBeInTheDocument();
      expect(
        detailPanel.getByRole("button", {
          name: "Sources & credits",
        }),
      ).toBeInTheDocument();
    },
  );

  it("offers only meter-compatible tunes and resets playback when the tune changes", async () => {
    const audio = installFakeAudioContext();
    const user = userEvent.setup();
    try {
      render(<App />);

      const picker = screen.getByRole("combobox", {
        name: "Tune for Psalm 100",
      });
      expect(
        within(picker).getAllByRole("option").map((option) =>
          option.textContent,
        ),
      ).toEqual(["Old Hundredth", "Tallis’ Canon", "Warrington"]);
      expect(
        within(picker).queryByRole("option", { name: "Crimond" }),
      ).not.toBeInTheDocument();

      await user.click(
        screen.getByRole("button", {
          name: "Start from: All people that on earth do dwell,",
        }),
      );

      const oldMore = screen.getByLabelText("More playback options");
      await user.click(oldMore);
      const oldOptions = within(oldMore.closest("details") as HTMLElement);
      fireEvent.change(oldOptions.getByRole("slider", { name: "Tempo" }), {
        target: { value: "96" },
      });
      await user.click(
        oldOptions.getByRole("button", { name: "Loop verse" }),
      );
      await user.click(screen.getByRole("button", { name: "Play tune" }));
      await waitFor(() =>
        expect(
          screen.getByRole("button", { name: "Pause tune" }),
        ).toBeVisible(),
      );

      await user.selectOptions(picker, "ps1650.tune.tallis-canon");

      await waitFor(() =>
        expect(
          screen.getByRole("combobox", { name: "Tune for Psalm 100" }),
        ).toHaveDisplayValue("Tallis’ Canon"),
      );
      expect(window.location.pathname).toBe("/psalms/100/primary");
      expect(window.location.search).toBe("?tune=tallis-canon");
      expect(
        screen.getByRole("button", {
          name: "Start from: All people that on earth do dwell,",
        }),
      ).toBeVisible();
      expect(screen.getByLabelText("Song position")).toHaveValue("0");
      expect(screen.getByRole("button", { name: "Play tune" })).toBeVisible();

      const newMore = screen.getByLabelText("More playback options");
      await user.click(newMore);
      const newOptions = within(newMore.closest("details") as HTMLElement);
      expect(
        newOptions.getByRole("slider", { name: "Tempo" }),
      ).toHaveValue("84");
      expect(
        newOptions.getByRole("button", { name: "Loop verse" }),
      ).toHaveAttribute("aria-pressed", "false");
      await waitFor(() => expect(audio.instances[0]?.closeCalls).toBe(1));
    } finally {
      audio.restore();
    }
  });

  it("loads a selected compatible tune directly from its stable URL", () => {
    window.history.replaceState(
      {},
      "",
      "/psalms/100/primary?tune=tallis-canon",
    );
    render(<App />);

    expect(
      screen.getByRole("combobox", { name: "Tune for Psalm 100" }),
    ).toHaveDisplayValue("Tallis’ Canon");
    expect(
      screen.getByRole("button", {
        name: "Start from: All people that on earth do dwell,",
      }),
    ).toBeVisible();
    expect(screen.getByLabelText("Song position")).toHaveValue("0");
  });

  it("lists and searches only Psalms that can be sung", async () => {
    const user = userEvent.setup();
    render(<App />);

    const library = screen.getByRole("navigation", {
      name: "Select a Psalm",
    });
    expect(within(library).getAllByRole("button")).toHaveLength(150);
    expect(
      within(library).getByRole("button", {
        name: "Sing Psalm 1 to St. Peter",
      }),
    ).toBeInTheDocument();
    expect(
      within(library).getByRole("button", {
        name: "Sing Psalm 23 to Crimond",
      }),
    ).toBeInTheDocument();
    expect(
      within(library).getByRole("button", {
        name: "Sing Psalm 100 to Old Hundredth",
      }),
    ).toHaveAttribute("aria-current", "page");
    expect(
      within(library).getByRole("button", {
        name: "Sing Psalm 2 to Dundee",
      }),
    ).toBeInTheDocument();
    expect(
      within(library).getByRole("button", {
        name: "Sing Psalm 5 to Abbey",
      }),
    ).toBeInTheDocument();
    expect(
      within(library).getByRole("button", {
        name: "Sing Psalm 150 to Wigtown",
      }),
    ).toBeInTheDocument();

    const search = screen.getByRole("searchbox", {
      name: "Search by Psalm or tune",
    });
    await user.type(search, "Crimond");

    expect(within(library).getAllByRole("button")).toHaveLength(6);
    expect(
      within(library).getByRole("button", {
        name: "Sing Psalm 23 to Crimond",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("6 Psalms match your search."),
    ).toBeInTheDocument();

    await user.clear(search);
    await user.type(search, "shepherd");
    expect(within(library).getAllByRole("button")).toHaveLength(2);
    expect(
      within(library).getByRole("button", {
        name: "Sing Psalm 80 to Culross",
      }),
    ).toBeInTheDocument();

    await user.click(
      within(library).getByRole("button", {
        name: "Sing Psalm 23 to Crimond",
      }),
    );
    expect(window.location.pathname).toBe("/psalms/023/primary");
    expect(
      screen.getByRole("combobox", { name: "Tune for Psalm 23" }),
    ).toHaveDisplayValue("Crimond");
  });

  it("offers a compact empty search state that can be cleared", async () => {
    const user = userEvent.setup();
    render(<App />);

    const search = screen.getByRole("searchbox", {
      name: "Search by Psalm or tune",
    });
    await user.type(search, "not a psalm");

    expect(screen.getByText("No results for “not a psalm”.")).toBeVisible();
    await user.click(
      screen.getByText("Clear search", { selector: "button" }),
    );
    expect(search).toHaveValue("");
    expect(
      screen.getByRole("button", {
        name: "Sing Psalm 100 to Old Hundredth",
      }),
    ).toBeInTheDocument();
  });

  it("seeks to a selected lyric line using the musical timeline", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(
      screen.getByRole("button", {
        name: "Start from: Sing to the LORD with cheerful voice.",
      }),
    );

    expect(screen.getByLabelText("Song position")).toHaveValue("28800");
    expect(screen.getAllByText("Verse 1, line 2")).toHaveLength(2);
  });

  it("highlights one timed syllable rather than its whole word", () => {
    render(<App />);

    const position = screen.getByLabelText("Song position");
    const peo = screen.getByText("peo", {
      selector: "[data-lyric-syllable]",
    });
    const ple = screen.getByText("ple", {
      selector: "[data-lyric-syllable]",
    });

    expect(peo.parentElement?.textContent).toBe("people");
    expect(peo.parentElement?.previousSibling?.textContent).toBe(" ");
    const line = screen.getByRole("button", {
      name: "Start from: All people that on earth do dwell,",
    });
    const lineText = line.querySelector("[data-lyric-text]");
    const words = Array.from(
      lineText?.querySelectorAll("[data-lyric-word]") ?? [],
    );

    expect(lineText?.textContent).toBe(
      "All people that on earth do dwell,",
    );
    expect(words).toHaveLength(7);
    words.forEach((word, index) => {
      expect(word.textContent).toBe(word.textContent?.trim());
      if (index > 0) {
        expect(word.previousSibling?.nodeType).toBe(Node.TEXT_NODE);
        expect(word.previousSibling?.textContent).toBe(" ");
      }
    });

    fireEvent.change(position, { target: { value: "24000" } });
    expect(peo).toHaveAttribute("data-active", "true");
    expect(ple).toHaveAttribute("data-active", "false");
    expect(
      document.querySelectorAll('[data-lyric-syllable][data-active="true"]'),
    ).toHaveLength(1);

    fireEvent.change(position, { target: { value: "24480" } });
    expect(peo).toHaveAttribute("data-active", "false");
    expect(ple).toHaveAttribute("data-active", "true");
    expect(
      document.querySelectorAll('[data-lyric-syllable][data-active="true"]'),
    ).toHaveLength(1);
  });

  it("keeps rehearsal controls concise and secondary options on demand", async () => {
    const user = userEvent.setup();
    render(<App />);

    const summary = screen.getByLabelText("More playback options");
    await user.click(summary);
    const options = summary.closest("details");
    expect(options).toHaveAttribute("open");

    const optionPanel = within(options as HTMLElement);
    const tempo = optionPanel.getByRole("slider", { name: "Tempo" });
    fireEvent.change(tempo, { target: { value: "96" } });
    expect(tempo).toHaveValue("96");

    const loop = optionPanel.getByRole("button", {
      name: "Loop verse",
    });
    expect(loop).toHaveAttribute("aria-pressed", "false");
    await user.click(loop);
    expect(loop).toHaveAttribute("aria-pressed", "true");

    const volume = optionPanel.getByRole("slider", {
      name: "Volume",
    });
    fireEvent.change(volume, { target: { value: "0.35" } });
    expect(volume).toHaveValue("0.35");
    expect(
      optionPanel.getByRole("button", { name: "Download MIDI" }),
    ).toBeInTheDocument();
  });

  it("opens peer playback from the existing options menu", async () => {
    const user = userEvent.setup();
    render(<App />);

    const summary = screen.getByLabelText("More playback options");
    await user.click(summary);
    await user.click(
      within(summary.closest("details") as HTMLElement).getByRole("button", {
        name: "Play together",
      }),
    );

    const dialog = screen.getByRole("dialog", { name: "Play together" });
    expect(
      within(dialog).getByRole("button", { name: "Start a group" }),
    ).toBeVisible();
    expect(
      within(dialog).getByRole("textbox", { name: "Group code" }),
    ).toBeVisible();
  });

  it("unlocks Web Audio from Play and can pause again", async () => {
    const audio = installFakeAudioContext();
    const user = userEvent.setup();
    try {
      render(<App />);
      await user.click(screen.getByRole("button", { name: "Play tune" }));

      await waitFor(() =>
        expect(
          screen.getByRole("button", { name: "Pause tune" }),
        ).toBeVisible(),
      );
      expect(
        screen.getAllByText("Four-part introduction"),
      ).not.toHaveLength(0);
      expect(audio.instances[0]?.periodicWaves).toHaveLength(2);
      expect(
        audio.instances[0]?.periodicWaves[0]?.imag.slice(1, 5),
      ).toEqual(new Float32Array([1, 0.42, 0.22, 0.125]));
      expect(audio.instances[0]?.oscillators).toHaveLength(8);
      expect(
        audio.instances[0]?.oscillators.map(
          (oscillator) => oscillator.detune.value,
        ),
      ).toEqual([
        -1.2,
        1.2,
        -1.2,
        1.2,
        -1.2,
        1.2,
        -1.2,
        1.2,
      ]);
      expect(
        audio.instances[0]?.oscillators.every(
          (oscillator) => oscillator.periodicWave,
        ),
      ).toBe(true);
      expect(
        screen.getByRole("button", {
          name: "Start from: All people that on earth do dwell,",
        }),
      ).not.toHaveAttribute("aria-current");

      await user.click(screen.getByRole("button", { name: "Pause tune" }));
      expect(screen.getByRole("button", { name: "Play tune" })).toBeVisible();
      expect(
        screen.getAllByText("Introduction paused"),
      ).not.toHaveLength(0);
    } finally {
      audio.restore();
    }
  });

  it("plays all four parts after seeking to a sung stanza", async () => {
    const audio = installFakeAudioContext();
    const user = userEvent.setup();
    try {
      render(<App />);
      await user.click(
        screen.getByRole("button", {
          name: "Start from: All people that on earth do dwell,",
        }),
      );
      await user.click(screen.getByRole("button", { name: "Play tune" }));

      await waitFor(() =>
        expect(
          screen.getByRole("button", { name: "Pause tune" }),
        ).toBeVisible(),
      );
      await waitFor(() =>
        expect(audio.instances[0]?.oscillators).toHaveLength(8),
      );
      expect(
        audio.instances[0]?.oscillators.every(
          (oscillator) => oscillator.periodicWave,
        ),
      ).toBe(true);
    } finally {
      audio.restore();
    }
  });

  it("resets playback and closes the old audio context when selecting another song", async () => {
    const audio = installFakeAudioContext();
    const user = userEvent.setup();
    try {
      render(<App />);

      await user.click(
        screen.getByRole("button", {
          name: "Start from: Sing to the LORD with cheerful voice.",
        }),
      );

      const more = screen.getByLabelText("More playback options");
      await user.click(more);
      const oldOptions = within(
        more.closest("details") as HTMLElement,
      );
      fireEvent.change(oldOptions.getByRole("slider", { name: "Tempo" }), {
        target: { value: "96" },
      });
      fireEvent.change(
        oldOptions.getByRole("slider", {
          name: "Volume",
        }),
        { target: { value: "0.35" } },
      );
      await user.click(
        oldOptions.getByRole("button", { name: "Loop verse" }),
      );
      await user.click(screen.getByRole("button", { name: "Play tune" }));
      await waitFor(() =>
        expect(
          screen.getByRole("button", { name: "Pause tune" }),
        ).toBeVisible(),
      );

      await user.click(
        screen.getByRole("button", {
          name: "Sing Psalm 23 to Crimond",
        }),
      );

      expect(
        screen.getByRole("combobox", { name: "Tune for Psalm 23" }),
      ).toHaveDisplayValue("Crimond");
      expect(window.location.pathname).toBe("/psalms/023/primary");
      expect(screen.getByLabelText("Song position")).toHaveValue("0");

      const newMore = screen.getByLabelText("More playback options");
      await user.click(newMore);
      const newOptions = within(
        newMore.closest("details") as HTMLElement,
      );
      expect(
        newOptions.getByRole("slider", { name: "Tempo" }),
      ).toHaveValue("80");
      expect(
        newOptions.getByRole("slider", { name: "Volume" }),
      ).toHaveValue("0.7");
      expect(
        newOptions.getByRole("button", { name: "Loop verse" }),
      ).toHaveAttribute("aria-pressed", "false");
      expect(
        screen.queryByRole("button", { name: /^Follow(?:ing)?$/ }),
      ).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Play tune" })).toBeVisible();
      await waitFor(() => expect(audio.instances[0]?.closeCalls).toBe(1));
    } finally {
      audio.restore();
    }
  });

  it("uses a concise unavailable state for a missing version route", () => {
    window.history.replaceState({}, "", "/psalms/149/alternate");
    render(<App />);

    const main = screen.getByRole("main");
    expect(
      within(main).getByRole("heading", { level: 1, name: "Psalm 149" }),
    ).toBeInTheDocument();
    expect(
      within(main).getByText("This Psalm isn’t available yet."),
    ).toBeVisible();
    expect(
      within(main).getByRole("button", { name: "Choose a Psalm" }),
    ).toBeVisible();
    expect(
      within(main).queryByText(/corpus|underlay|received text/i),
    ).not.toBeInTheDocument();
  });

  it("opens Sources from song details and returns to the same Psalm", async () => {
    const user = userEvent.setup();
    window.history.replaceState({}, "", "/psalms/023/primary");
    render(<App />);

    await user.click(screen.getByLabelText("Song details"));
    await user.click(
      screen.getByRole("button", { name: "Sources & credits" }),
    );

    expect(window.location.pathname).toBe("/sources");
    expect(
      screen.getByRole("heading", { level: 1, name: "Sources" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "Words" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "Tune" }),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Return to Psalm" }),
    );
    expect(window.location.pathname).toBe("/psalms/023/primary");
    expect(
      screen.getByRole("combobox", { name: "Tune for Psalm 23" }),
    ).toHaveDisplayValue("Crimond");
  });

  it("opens the concise About page and returns to the same Psalm", async () => {
    const user = userEvent.setup();
    window.history.replaceState({}, "", "/psalms/001/primary");
    render(<App />);

    await user.click(screen.getByRole("button", { name: "About" }));

    expect(window.location.pathname).toBe("/about");
    expect(
      screen.getByRole("heading", { level: 1, name: "Open 1650" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("table", { name: "Credits and rights" }),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Return to Psalm" }),
    );
    expect(window.location.pathname).toBe("/psalms/001/primary");
    expect(
      screen.getByRole("combobox", { name: "Tune for Psalm 1" }),
    ).toHaveDisplayValue("St. Peter");
  });

  it("serves the direct Downloads route and returns to its Psalm", async () => {
    const user = userEvent.setup();
    window.history.replaceState({}, "", "/downloads");
    render(<App />);

    expect(window.location.pathname).toBe("/downloads");
    expect(
      screen.getByRole("heading", { level: 1, name: "Psalm 100" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Plain text/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /JSON/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /TEI XML/ }),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Return to Psalm" }),
    );
    expect(window.location.pathname).toBe("/psalms/100/primary");
    expect(
      screen.getByRole("combobox", { name: "Tune for Psalm 100" }),
    ).toHaveDisplayValue("Old Hundredth");
  });
});
