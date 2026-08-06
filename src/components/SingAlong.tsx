import {
  Download,
  Ellipsis,
  Pause,
  Play,
  Repeat1,
  RotateCcw,
  UsersRound,
  Volume2,
} from "lucide-react";
import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  compilePerformance,
  ticksToSeconds,
} from "../audio/compilePerformance";
import { downloadMidiFile } from "../audio/midiFile";
import { useSingAlong } from "../audio/useSingAlong";
import type {
  PsalmRecord,
  PsalmSetting,
  TuneRecord,
  TuneSummary,
} from "../data/types";
import type { TogetherSelection } from "../sync/protocol";
import type {
  TogetherPlayer,
  TogetherSession,
} from "../sync/useTogetherSession";
import {
  TogetherDialog,
  type TogetherDialogState,
} from "./TogetherDialog";

interface SingAlongProps {
  psalm: PsalmRecord;
  tune: TuneRecord;
  setting: PsalmSetting;
  compatibleTunes: TuneSummary[];
  together: TogetherSession;
  togetherSelection: TogetherSelection;
  onSelectTune: (tuneId: string) => void;
  onViewSources: () => void;
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds)) return "0:00";
  const minutes = Math.floor(Math.max(0, seconds) / 60);
  const remainder = Math.floor(Math.max(0, seconds) % 60);
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

export function SingAlong({
  psalm,
  tune,
  setting,
  compatibleTunes,
  together,
  togetherSelection,
  onSelectTune,
  onViewSources,
}: SingAlongProps) {
  const performance = useMemo(
    () => compilePerformance(tune, setting),
    [setting, tune],
  );
  const syllableCueById = useMemo(
    () =>
      new Map(
        performance.syllables.map((syllable) => [
          syllable.syllableId,
          syllable,
        ]),
      ),
    [performance.syllables],
  );
  const stanzaCueById = useMemo(
    () =>
      new Map(
        performance.stanzas.map((stanza) => [stanza.stanzaId, stanza]),
      ),
    [performance.stanzas],
  );
  const lineCueById = useMemo(
    () =>
      new Map(performance.lines.map((line) => [line.lineId, line])),
    [performance.lines],
  );
  const settingLineById = useMemo(
    () =>
      new Map(
        setting.stanzas.flatMap((stanza) =>
          stanza.lines.map((line) => [line.line_id, line] as const),
        ),
      ),
    [setting.stanzas],
  );
  const player = useSingAlong(performance);
  const lineElements = useRef(new Map<string, HTMLButtonElement>());
  const playerRef = useRef(player);
  playerRef.current = player;
  const togetherPlayer = useMemo<TogetherPlayer>(
    () => ({
      get status() {
        return playerRef.current.status;
      },
      get currentTick() {
        return playerRef.current.currentTick;
      },
      get bpm() {
        return playerRef.current.bpm;
      },
      prepareAudio: () => playerRef.current.prepareAudio(),
      scheduleTransport: (command) =>
        playerRef.current.scheduleTransport(command),
      getTransportSnapshot: () =>
        playerRef.current.getTransportSnapshot(),
      toggle: () => playerRef.current.toggle(),
      pause: () => playerRef.current.pause(),
      restart: () => playerRef.current.restart(),
      seek: (tick) => playerRef.current.seek(tick),
      setBpm: (bpm) => playerRef.current.setBpm(bpm),
      setLoopStanza: (enabled) =>
        playerRef.current.setLoopStanza(enabled),
    }),
    [],
  );
  const [togetherDialogOpen, setTogetherDialogOpen] = useState(false);
  const closeTogetherDialog = useCallback(
    () => setTogetherDialogOpen(false),
    [],
  );
  const togetherActive = together.snapshot.mode !== "idle";
  const controlsLocked = together.snapshot.mode === "guest";

  const firstStanza = performance.stanzas[0];
  const firstLine = performance.lines[0];
  const introActive =
    player.currentTick < performance.introTicks &&
    ["unlocking", "playing", "paused"].includes(player.status);
  const visualStanza = introActive
    ? undefined
    : player.activeStanza ?? firstStanza;
  const visualLine =
    introActive
      ? undefined
      : player.activeLine ??
        (player.status === "idle" ? firstLine : undefined);
  const activeSyllableId = player.activeSyllable?.syllableId;
  const isPlaying = player.status === "playing";
  const isUnlocking = player.status === "unlocking";
  const playControlActive =
    togetherActive && together.snapshot.playback
      ? together.snapshot.playback === "playing"
      : isPlaying;

  useEffect(
    () =>
      together.attachPlayer(
        togetherPlayer,
        performance,
        togetherSelection,
      ),
    [
      performance,
      together.attachPlayer,
      togetherPlayer,
      togetherSelection,
    ],
  );

  const currentSeconds = ticksToSeconds(
    player.currentTick,
    performance.ppq,
    player.bpm,
  );
  const totalSeconds = ticksToSeconds(
    performance.durationTicks,
    performance.ppq,
    player.bpm,
  );
  const progress =
    performance.durationTicks > 0
      ? (player.currentTick / performance.durationTicks) * 100
      : 0;
  const beatTicks =
    (performance.ppq * 4) / performance.timeSignature[1];
  const beat =
    Math.floor(player.currentTick / beatTicks) %
    performance.timeSignature[0];

  useEffect(() => {
    if (!isPlaying || !visualLine) return;
    const target = lineElements.current.get(visualLine.lineId);
    if (!target || typeof target.scrollIntoView !== "function") return;

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    target.scrollIntoView({
      block: "center",
      behavior: reducedMotion ? "auto" : "smooth",
    });
  }, [isPlaying, visualLine?.lineId]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        target.matches("button, input, textarea, select, a, [contenteditable]")
      ) {
        return;
      }

      const controller = playerRef.current;
      if (event.code === "Space") {
        event.preventDefault();
        void together.toggle();
      } else if (event.key === "Home") {
        event.preventDefault();
        together.restart();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        together.seek(controller.currentTick - performance.ppq * 4);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        together.seek(controller.currentTick + performance.ppq * 4);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [performance.ppq, together.restart, together.seek, together.toggle]);

  let statusCopy = "Ready to sing";
  if (isUnlocking) {
    statusCopy = "Starting audio…";
  } else if (introActive) {
    statusCopy = isPlaying
      ? "Four-part introduction"
      : "Introduction paused";
  } else if (player.status === "ended") {
    statusCopy = "Psalm complete";
  } else if (
    visualLine &&
    visualStanza &&
    (player.status !== "idle" ||
      player.currentTick >= performance.introTicks)
  ) {
    statusCopy = `Verse ${visualStanza.index + 1}, line ${visualLine.index + 1}`;
  }

  const sourceWork = tune.source.source_work;
  const attribution = tune.source.attribution;
  const togetherDialogState: TogetherDialogState =
    together.snapshot.mode === "host"
      ? {
          mode: "host",
          code: together.snapshot.roomCode ?? "",
          deviceCount: together.snapshot.deviceCount,
        }
      : together.snapshot.mode === "guest"
        ? {
            mode: "guest",
            code: together.snapshot.roomCode ?? "",
            status:
              together.snapshot.connection === "ready"
                ? "ready"
                : "connecting",
          }
        : { mode: "setup" };

  return (
    <>
      <main
        id="main-content"
        className="col-start-2 row-start-1 min-h-0 min-w-0 overflow-auto overscroll-contain bg-[#fbfaf6] bg-[radial-gradient(circle_at_50%_-10%,rgba(167,136,86,0.11),transparent_32%),linear-gradient(90deg,rgba(215,205,187,0.08)_1px,transparent_1px)] [background-position:0_0,0_0] [background-size:auto,41px_41px] [scrollbar-color:#dcd5c8_transparent] [scrollbar-width:thin] max-[980px]:overflow-visible print:h-auto print:overflow-visible"
        tabIndex={-1}
      >
        <article className="mx-auto min-h-full w-full max-w-[1020px] px-14 pt-6 pb-[190px] max-[1120px]:px-[38px] max-[780px]:px-5 max-[780px]:pt-3.5 max-[780px]:pb-[150px] print:min-h-0 print:w-full print:max-w-none print:p-0">
          <header className="relative flex min-h-[62px] items-center justify-between gap-6 border-b border-[#dcd5c8] pt-1.5 pb-[18px] max-[780px]:min-h-[54px] max-[780px]:gap-3 max-[780px]:pt-0.5 max-[780px]:pb-3 print:border-b-0">
            <div className="flex min-w-0 flex-1 items-center gap-2.5 max-[780px]:gap-[7px]">
              <h1 className="m-0 flex-none overflow-hidden text-ellipsis whitespace-nowrap font-serif text-[31px] font-[540] tracking-[-0.035em] max-[780px]:text-[27px]">
                Psalm {psalm.psalm_number}
              </h1>
              <span
                className="font-serif text-[22px] text-[#a7a094]"
                aria-hidden="true"
              >
                ·
              </span>
              <label className="block min-w-0 max-w-[300px] flex-1">
                <span className="sr-only">Tune</span>
                <select
                  className="w-full max-w-full cursor-pointer truncate rounded-[7px] border-0 bg-transparent py-1.5 pr-6 pl-1 font-serif text-lg font-[540] tracking-[-0.015em] text-[#777268] hover:bg-white/45 hover:text-[#26251f] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4f614a] disabled:cursor-default disabled:opacity-100 max-[780px]:text-base"
                  aria-label={`Tune for Psalm ${psalm.psalm_number}`}
                  value={tune.id}
                  disabled={controlsLocked || compatibleTunes.length < 2}
                  onChange={(event) => onSelectTune(event.target.value)}
                >
                  {compatibleTunes.map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {candidate.title}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="flex flex-none items-center gap-2 print:hidden">
              <details className="group relative">
                <summary
                  className="inline-flex min-h-[34px] cursor-pointer list-none items-center gap-[7px] rounded-full border border-[#dcd5c8] bg-white/55 px-[11px] text-[9px] font-[750] text-[#777268] group-open:border-[#cbaaa2] group-open:bg-[#f2e5e1] group-open:text-[#7f352d] [&::-webkit-details-marker]:hidden max-[780px]:w-[34px] max-[780px]:justify-center max-[780px]:px-0"
                  aria-label="Song details"
                >
                  <Ellipsis size={17} aria-hidden="true" />
                  <span className="max-[780px]:hidden">Details</span>
                </summary>
                <div className="absolute top-[calc(100%+8px)] right-0 z-[18] w-[min(320px,calc(100vw-40px))] rounded-[7px] border border-[#dcd5c8] bg-[#fbfaf6] p-[15px] shadow-[0_18px_45px_rgba(38,32,23,0.16)]">
                  <dl className="m-0 grid grid-cols-3 gap-3">
                    <div className="flex min-w-0 flex-col gap-[3px]">
                      <dt className="text-[7px] font-extrabold tracking-[0.09em] text-[#a7a094] uppercase">
                        Meter
                      </dt>
                      <dd className="m-0 truncate font-mono text-[9px] text-[#4f4d45]">
                        {psalm.meter.pattern}
                      </dd>
                    </div>
                    <div className="flex min-w-0 flex-col gap-[3px]">
                      <dt className="text-[7px] font-extrabold tracking-[0.09em] text-[#a7a094] uppercase">
                        Key
                      </dt>
                      <dd className="m-0 truncate font-mono text-[9px] text-[#4f4d45]">
                        {tune.key}
                      </dd>
                    </div>
                    <div className="flex min-w-0 flex-col gap-[3px]">
                      <dt className="text-[7px] font-extrabold tracking-[0.09em] text-[#a7a094] uppercase">
                        Time
                      </dt>
                      <dd className="m-0 truncate font-mono text-[9px] text-[#4f4d45]">
                        {tune.time_signature.join("/")}
                      </dd>
                    </div>
                  </dl>
                  <p className="mt-3.5 mb-0 border-t border-[#e9e4da] pt-3 text-[9px] leading-normal text-[#777268]">
                    {attribution} · {sourceWork}
                  </p>
                  <button
                    type="button"
                    className="mt-3 cursor-pointer bg-transparent p-0 text-[9px] font-extrabold text-[#7f352d]"
                    onClick={onViewSources}
                  >
                    Sources &amp; credits
                  </button>
                </div>
              </details>
            </div>
          </header>

          <p className="sr-only" aria-live="polite" aria-atomic="true">
            {statusCopy}
          </p>

          <section className="pt-2 pb-10" aria-label="Synchronized lyrics">
            {psalm.stanzas.map((stanza, stanzaIndex) => {
              const stanzaCue = stanzaCueById.get(stanza.id);
              const stanzaActive =
                visualStanza?.stanzaId === stanza.id;
              const stanzaComplete = Boolean(
                stanzaCue && player.currentTick >= stanzaCue.endTick,
              );

              return (
                <section
                  className="relative grid grid-cols-[64px_minmax(0,1fr)] gap-2.5 border-t border-[#e9e4da] pt-8 pr-[18px] pb-[34px] opacity-55 transition-[opacity,background-color,transform] duration-180 first:border-t-transparent data-[active=true]:translate-x-1 data-[active=true]:bg-[linear-gradient(90deg,rgba(242,229,225,0.58),rgba(242,229,225,0.08)_68%,transparent)] data-[active=true]:opacity-100 data-[complete=true]:opacity-38 max-[780px]:grid-cols-[36px_minmax(0,1fr)] max-[780px]:pt-5 max-[780px]:pr-1 max-[780px]:pb-[22px] max-[430px]:grid-cols-[24px_minmax(0,1fr)] max-[430px]:gap-0.5 print:break-inside-avoid print:translate-x-0! print:opacity-100!"
                  key={stanza.id}
                  aria-label={`Verse ${stanzaIndex + 1}`}
                  data-active={stanzaActive}
                  data-complete={stanzaComplete}
                >
                  <div
                    className={`flex flex-col items-center gap-2 pt-[11px] font-mono text-[8px] tracking-[0.08em] max-[780px]:pt-[9px] ${
                      stanzaActive ? "text-[#7f352d]" : "text-[#a7a094]"
                    }`}
                    aria-hidden="true"
                  >
                    <span className="max-[430px]:hidden">Verse</span>
                    <strong className="font-serif text-2xl leading-none font-[450] text-inherit max-[780px]:text-lg">
                      {stanzaIndex + 1}
                    </strong>
                  </div>
                  <div className="min-w-0">
                    {stanza.lines.map((line) => {
                      const lineCue = lineCueById.get(line.id);
                      const settingLine = settingLineById.get(line.id);
                      const lineActive = visualLine?.lineId === line.id;

                      return (
                        <button
                          type="button"
                          className="group relative flex min-h-12 w-full cursor-pointer items-baseline gap-3 rounded-[5px] bg-transparent py-[5px] pr-3 pl-7 text-left text-[#4f4d45] before:absolute before:top-1/2 before:left-2 before:h-2 before:w-2 before:-translate-y-1/2 before:rounded-full before:border before:border-transparent before:content-[''] hover:bg-white/57 hover:text-[#26251f] disabled:cursor-default data-[active=true]:bg-white/74 data-[active=true]:text-[#26251f] data-[active=true]:shadow-[0_6px_18px_rgba(69,53,38,0.05)] data-[active=true]:before:border-[#7f352d] data-[active=true]:before:bg-[#7f352d] data-[active=true]:before:shadow-[0_0_0_3px_#f2e5e1] max-[780px]:min-h-[45px] max-[780px]:gap-[5px] max-[780px]:pr-[7px] max-[780px]:pl-[22px] max-[780px]:before:left-[5px] max-[430px]:pl-[18px]"
                          key={line.id}
                          data-active={lineActive}
                          aria-current={lineActive ? "true" : undefined}
                          aria-label={`Start from: ${line.text.reading}`}
                          disabled={controlsLocked}
                          ref={(element) => {
                            if (element) {
                              lineElements.current.set(line.id, element);
                            } else {
                              lineElements.current.delete(line.id);
                            }
                          }}
                          onClick={() => {
                            if (lineCue) together.seek(lineCue.startTick);
                          }}
                        >
                          <span
                            className="min-w-0 font-serif text-[clamp(23px,2.5vw,31px)] leading-[1.45] font-[430] tracking-[-0.012em] max-[780px]:text-[clamp(21px,6.1vw,27px)] max-[780px]:leading-[1.48]"
                            data-lyric-text
                            aria-hidden="true"
                          >
                            {settingLine?.tokens.map((token, tokenIndex) => {
                              return (
                                <Fragment key={token.id}>
                                  {tokenIndex > 0 && " "}
                                  <span
                                    className="whitespace-nowrap"
                                    data-lyric-word
                                  >
                                    {token.syllable_map.map((syllable) => {
                                      const cue = syllableCueById.get(
                                        syllable.id,
                                      );
                                      const syllableComplete = Boolean(
                                        cue &&
                                          player.currentTick >= cue.endTick &&
                                          player.status !== "idle",
                                      );

                                      return (
                                        <span
                                          className={`relative transition-[color,background-color,text-decoration-color] duration-90 ${
                                            activeSyllableId === syllable.id
                                              ? "bg-[#f0e9da] text-[#61251f]"
                                              : syllableComplete
                                                ? "text-[#7f352d]"
                                                : ""
                                          }`}
                                          key={syllable.id}
                                          data-syllable-id={syllable.id}
                                          data-lyric-syllable
                                          data-active={
                                            activeSyllableId === syllable.id
                                          }
                                          data-complete={syllableComplete}
                                        >
                                          {syllable.text}
                                        </span>
                                      );
                                    })}
                                  </span>
                                </Fragment>
                              );
                            }) ?? line.text.reading}
                          </span>
                          <span
                            className="ml-auto inline-flex flex-none items-center gap-1 font-sans text-[8px] font-bold tracking-[0.06em] text-[#a7a094] uppercase opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 max-[780px]:hidden"
                            aria-hidden="true"
                          >
                            <Play size={10} fill="currentColor" />
                            Start here
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </section>
        </article>
      </main>

      <aside
        className="pointer-events-none fixed right-0 bottom-0 left-[254px] z-28 px-6 pb-[18px] max-[1240px]:left-[230px] max-[980px]:left-0 max-[780px]:px-[9px] max-[780px]:pb-[max(9px,env(safe-area-inset-bottom))] print:hidden"
        aria-label="Tune player"
      >
        <div
          className="pointer-events-auto mx-auto w-full max-w-[980px] overflow-visible rounded-[10px] border border-white/9 bg-[#282721] bg-[radial-gradient(circle_at_80%_-40%,rgba(167,136,86,0.3),transparent_35%)] text-[#f8f5ef] shadow-[0_20px_55px_rgba(27,24,19,0.3)]"
          data-status={player.status}
        >
          <div className="relative h-[5px] rounded-t-[9px] bg-white/11">
            <progress
              className="pointer-events-none absolute inset-0 block h-full w-full appearance-none overflow-hidden rounded-[inherit] border-0 bg-transparent [&::-moz-progress-bar]:rounded-[inherit] [&::-moz-progress-bar]:bg-[linear-gradient(to_right,#a78856,#d7bd8e)] [&::-webkit-progress-bar]:rounded-[inherit] [&::-webkit-progress-bar]:bg-transparent [&::-webkit-progress-value]:rounded-[inherit] [&::-webkit-progress-value]:bg-[linear-gradient(to_right,#a78856,#d7bd8e)]"
              max={100}
              value={progress}
              aria-hidden="true"
            />
            <input
              className="absolute inset-x-0 -top-[7px] h-5 w-full cursor-pointer opacity-0"
              type="range"
              min={0}
              max={performance.durationTicks}
              step={performance.ppq / 8}
              value={Math.round(player.currentTick)}
              aria-label="Song position"
              aria-valuetext={`${formatTime(currentSeconds)} of ${formatTime(totalSeconds)}`}
              disabled={controlsLocked}
              onChange={(event) =>
                together.seek(Number(event.target.value))
              }
            />
          </div>

          <div className="grid min-h-[88px] grid-cols-[auto_minmax(190px,1fr)_auto] items-center gap-[22px] px-[18px] pt-[13px] pb-3.5 max-[1120px]:gap-3.5 max-[780px]:min-h-[84px] max-[780px]:grid-cols-[auto_minmax(0,1fr)_auto] max-[780px]:gap-3 max-[780px]:px-[11px] max-[780px]:pt-[9px] max-[780px]:pb-2.5">
            <div className="flex items-center gap-[7px]">
              <button
                type="button"
                className="grid h-[38px] w-[38px] flex-none cursor-pointer place-items-center rounded-full bg-transparent text-[#d7d0c4] hover:bg-white/8 hover:text-white max-[430px]:h-[34px] max-[430px]:w-[34px]"
                aria-label="Restart Psalm"
                title="Restart (Home)"
                disabled={controlsLocked}
                onClick={together.restart}
              >
                <RotateCcw size={18} aria-hidden="true" />
              </button>
              <button
                type="button"
                className="grid h-[58px] w-[58px] flex-none cursor-pointer place-items-center rounded-full bg-[#f8f3e8] text-[#61251f] shadow-[0_8px_24px_rgba(0,0,0,0.22)] hover:-translate-y-px hover:bg-white disabled:cursor-progress disabled:opacity-65 max-[780px]:h-[50px] max-[780px]:w-[50px]"
                aria-label={
                  controlsLocked
                    ? "Playback controlled by host"
                    : isUnlocking
                    ? "Starting audio"
                    : playControlActive
                      ? "Pause tune"
                      : "Play tune"
                }
                title={playControlActive ? "Pause (Space)" : "Play (Space)"}
                disabled={isUnlocking || controlsLocked}
                onClick={() => void together.toggle()}
              >
                {playControlActive ? (
                  <Pause size={23} fill="currentColor" aria-hidden="true" />
                ) : (
                  <Play
                    size={23}
                    fill="currentColor"
                    aria-hidden="true"
                  />
                )}
              </button>
            </div>

            <div className="min-w-0">
              <div className="flex min-w-0 items-baseline justify-between gap-3">
                <span className="truncate font-serif text-[15px] font-semibold">
                  {statusCopy}
                </span>
                <small className="flex-none font-mono text-[9px] text-[#bdb5a7]">
                  {formatTime(currentSeconds)} / {formatTime(totalSeconds)}
                </small>
              </div>
              <div className="mt-[7px] flex items-center gap-2 text-[9px] text-[#aaa294]">
                <span>{tune.title}</span>
                {togetherActive && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span
                      className="inline-flex items-center gap-1"
                      title={
                        together.snapshot.mode === "host"
                          ? `${together.snapshot.deviceCount} devices in group`
                          : "Joined group"
                      }
                    >
                      <UsersRound size={11} aria-hidden="true" />
                      {together.snapshot.mode === "host"
                        ? together.snapshot.deviceCount
                        : together.snapshot.connection === "ready"
                          ? "Synced"
                          : "Joining"}
                    </span>
                  </>
                )}
                <span aria-hidden="true">·</span>
                <div className="flex gap-1" aria-label={`Beat ${beat + 1}`}>
                  {Array.from(
                    { length: performance.timeSignature[0] },
                    (_, index) => (
                      <i
                        className="h-[5px] w-[5px] rounded-full bg-white/18 data-[active=true]:bg-[#a78856]"
                        key={index}
                        data-active={isPlaying && index === beat}
                      />
                    ),
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-[13px] max-[780px]:justify-end max-[780px]:gap-0 max-[430px]:justify-stretch">
              <details className="group relative">
                <summary
                  className="grid h-[38px] w-[38px] flex-none cursor-pointer list-none place-items-center rounded-full bg-transparent text-[#d7d0c4] group-open:bg-white/10 group-open:text-white hover:bg-white/8 hover:text-white [&::-webkit-details-marker]:hidden max-[430px]:h-[34px] max-[430px]:w-[34px]"
                  aria-label="More playback options"
                  title="More playback options"
                >
                  <Ellipsis size={18} aria-hidden="true" />
                </summary>
                <div className="absolute right-0 bottom-[calc(100%+12px)] z-1 flex max-h-[calc(100dvh-170px)] w-[230px] flex-col gap-3.5 overflow-y-auto rounded-[7px] border border-white/12 bg-[#282721] p-[15px] text-[#f8f5ef] shadow-[0_18px_45px_rgba(0,0,0,0.32)] max-[720px]:max-h-[calc(100dvh-160px)]">
                  <label className="flex flex-col gap-[5px]">
                    <span className="flex items-center justify-between gap-2.5 text-[7px] font-extrabold tracking-[0.08em] text-[#bdb5a7] uppercase">
                      Tempo
                      <output className="font-mono text-[8px] text-[#f1ece3]">
                        {player.bpm}
                      </output>
                    </span>
                    <input
                      className="w-full cursor-pointer accent-[#a78856]"
                      type="range"
                      min={60}
                      max={112}
                      step={1}
                      value={player.bpm}
                      aria-label="Tempo"
                      disabled={controlsLocked}
                      onChange={(event) =>
                        together.setBpm(Number(event.target.value))
                      }
                    />
                  </label>
                  <button
                    type="button"
                    className="inline-flex min-h-[38px] cursor-pointer items-center gap-[7px] rounded-[5px] border border-white/13 bg-transparent px-2.5 text-[8px] font-bold text-[#c9c1b5] data-[active=true]:border-[rgba(167,136,86,0.72)] data-[active=true]:bg-[rgba(167,136,86,0.17)] data-[active=true]:text-white max-[780px]:min-h-[34px] max-[780px]:justify-center"
                    data-active={player.loopStanza}
                    aria-pressed={player.loopStanza}
                    disabled={togetherActive}
                    onClick={() =>
                      player.setLoopStanza(!player.loopStanza)
                    }
                  >
                    <Repeat1 size={15} aria-hidden="true" />
                    Loop verse
                  </button>
                  <button
                    type="button"
                    className="inline-flex min-h-9 cursor-pointer items-center justify-center gap-[7px] rounded-[5px] border border-white/13 bg-transparent text-[8px] font-extrabold text-[#e0d9cd] hover:bg-white/8 hover:text-white"
                    onClick={() => setTogetherDialogOpen(true)}
                  >
                    <UsersRound size={15} aria-hidden="true" />
                    Play together
                  </button>
                  <label className="flex flex-col gap-[5px]">
                    <span className="flex items-center justify-between gap-2.5 text-[7px] font-extrabold tracking-[0.08em] text-[#bdb5a7] uppercase">
                      <Volume2 size={11} aria-hidden="true" />
                      Volume
                      <output className="font-mono text-[8px] text-[#f1ece3]">
                        {Math.round(player.volume * 100)}%
                      </output>
                    </span>
                    <input
                      className="w-full cursor-pointer accent-[#a78856]"
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={player.volume}
                      aria-label="Volume"
                      onChange={(event) =>
                        player.setVolume(Number(event.target.value))
                      }
                    />
                  </label>
                  <button
                    type="button"
                    className="inline-flex min-h-9 cursor-pointer items-center justify-center gap-[7px] rounded-[5px] border border-white/13 bg-transparent text-[8px] font-extrabold text-[#e0d9cd] hover:bg-white/8 hover:text-white"
                    onClick={() =>
                      downloadMidiFile(performance, player.bpm)
                    }
                  >
                    <Download size={15} aria-hidden="true" />
                    Download MIDI
                  </button>
                </div>
              </details>
            </div>
          </div>

          {player.error && (
            <p
              className="m-0 border-t border-white/8 bg-[rgba(127,53,45,0.7)] px-[18px] py-2 text-[9px] text-[#ffe9e6]"
              role="alert"
            >
              {player.error}
            </p>
          )}
        </div>
      </aside>

      <TogetherDialog
        open={togetherDialogOpen}
        state={togetherDialogState}
        error={together.snapshot.error}
        onClose={closeTogetherDialog}
        onStartGroup={together.startGroup}
        onJoinGroup={together.joinGroup}
        onEndGroup={together.leaveGroup}
        onLeaveGroup={together.leaveGroup}
      />
    </>
  );
}
