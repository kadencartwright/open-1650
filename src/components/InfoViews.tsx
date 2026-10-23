import {
  ArrowRight,
  Download,
  FileCode2,
  FileJson2,
  FileText,
  Library,
  Music2,
  ShieldCheck,
} from "lucide-react";
import {
  findSetting,
  findTune,
} from "../data/music";
import { bundledTuneCount } from "../data/library";
import type {
  EditionKey,
  PsalmRecord,
  TuneRecord,
} from "../data/types";
import { downloadExport, type ExportFormat } from "../lib/exports";
import { tempoReference } from "../audio/performanceOptions";

interface InfoViewProps {
  psalm: PsalmRecord;
  edition: EditionKey;
  onRead: () => void;
}

interface SourcesViewProps extends InfoViewProps {
  tune?: TuneRecord;
}

export function SourcesView({
  psalm,
  tune: selectedTune,
  onRead,
}: SourcesViewProps) {
  const setting = findSetting(psalm.id);
  const tune = selectedTune ?? (setting ? findTune(setting.tune_id) : undefined);
  const tempo = tune ? tempoReference(tune.id, psalm.id) : undefined;

  return (
    <main
      id="main-content"
      className="col-start-2 row-start-1 min-h-0 min-w-0 overflow-auto overscroll-contain [background:radial-gradient(circle_at_90%_3%,rgb(127_53_45/7%),transparent_25%),#fbfaf6] [scrollbar-color:#dcd5c8_transparent] [scrollbar-width:thin] max-[980px]:overflow-visible"
      tabIndex={-1}
    >
      <article className="mx-auto w-full max-w-[1120px] px-[66px] pt-[66px] pb-[100px] max-[1240px]:px-11 max-[720px]:px-[21px] max-[720px]:pt-[38px] max-[720px]:pb-[75px]">
        <header className="max-w-[820px] pt-[22px] pb-[62px] max-[720px]:pt-5 max-[720px]:pb-[45px]">
          <p className="m-0 text-[10px] leading-[1.25] font-extrabold tracking-[0.18em] text-[#7f352d] uppercase">
            Credits
          </p>
          <h1 className="mt-[13px] mb-5 max-w-[760px] font-serif text-[clamp(46px,6vw,77px)] leading-[0.98] [font-weight:430] tracking-[-0.055em] max-[720px]:text-[clamp(42px,14vw,60px)]">
            Sources
          </h1>
          <button
            type="button"
            className="inline-flex min-h-0 cursor-pointer items-center justify-center gap-[9px] bg-transparent p-0 text-xs font-[750] tracking-[0.02em] text-[#7f352d]"
            onClick={onRead}
          >
            Return to Psalm <ArrowRight size={16} aria-hidden="true" />
          </button>
        </header>

        <section className="border-t border-[#dcd5c8] py-[55px] max-[720px]:py-[42px]">
          <div className="mb-7 max-w-[640px]">
            <h2 className="mt-[7px] mb-0 font-serif text-[clamp(28px,4vw,41px)] [font-weight:480] tracking-[-0.04em]">
              Words
            </h2>
          </div>
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-[52px_minmax(0,1fr)_170px] gap-[18px] rounded-[3px] border border-[#dcd5c8] bg-[#f4f0e7] p-6 max-[720px]:grid-cols-[44px_minmax(0,1fr)] max-[720px]:p-[18px]">
              <div className="grid size-[47px] place-items-center rounded-full bg-[#f2e5e1] text-[#7f352d]">
                <Library size={23} strokeWidth={1.5} aria-hidden="true" />
              </div>
              <div>
                <h3 className="mt-2.5 mb-[7px] font-serif text-[22px] font-semibold">
                  The Psalms of David in Metre · 1650
                </h3>
                <p className="m-0 max-w-[600px] text-[10px] leading-[1.55] text-[#777268]">
                  {psalm.source.note}
                </p>
                {psalm.source.facsimile_url && (
                  <a
                    href={psalm.source.facsimile_url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-flex items-center gap-[7px] text-[9px] font-[750] text-[#7f352d] no-underline hover:underline"
                  >
                    Open text source{" "}
                    <ArrowRight size={13} aria-hidden="true" />
                  </a>
                )}
              </div>
              <dl className="m-0 border-l border-[#dcd5c8] pl-[18px] max-[720px]:col-span-full max-[720px]:grid max-[720px]:grid-cols-3 max-[720px]:border-t max-[720px]:border-l-0 max-[720px]:px-0 max-[720px]:pt-3.5">
                <div className="pt-1 pb-2.5">
                  <dt className="text-[7px] font-[750] tracking-[0.08em] text-[#777268] uppercase">
                    Historic text
                  </dt>
                  <dd className="mt-[3px] mb-0 font-mono text-[9px] font-bold">
                    PDM-1.0
                  </dd>
                </div>
                <div className="pt-1 pb-2.5">
                  <dt className="text-[7px] font-[750] tracking-[0.08em] text-[#777268] uppercase">
                    Transcription
                  </dt>
                  <dd className="mt-[3px] mb-0 font-mono text-[9px] font-bold">
                    CC0-1.0
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </section>

        {tune && (
          <section className="border-t border-[#dcd5c8] py-[55px] max-[720px]:py-[42px]">
            <div className="mb-7 max-w-[640px]">
              <h2 className="mt-[7px] mb-0 font-serif text-[clamp(28px,4vw,41px)] [font-weight:480] tracking-[-0.04em]">
                Tune
              </h2>
            </div>
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-[52px_minmax(0,1fr)_170px] gap-[18px] rounded-[3px] border border-[#dcd5c8] bg-[#f4f0e7] p-6 max-[720px]:grid-cols-[44px_minmax(0,1fr)] max-[720px]:p-[18px]">
                <div className="grid size-[47px] place-items-center rounded-full bg-[#f2e5e1] text-[#7f352d]">
                  <Music2 size={23} strokeWidth={1.5} aria-hidden="true" />
                </div>
                <div>
                  <h3 className="mt-2.5 mb-[7px] font-serif text-[22px] font-semibold">
                    {tune.source.label}
                  </h3>
                  <p className="m-0 max-w-[600px] text-[10px] leading-[1.55] text-[#777268]">
                    {tune.source.attribution} · {tune.source.source_work}
                  </p>
                  <a
                    href={tune.source.record_url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-flex items-center gap-[7px] text-[9px] font-[750] text-[#7f352d] no-underline hover:underline"
                  >
                    Open tune source{" "}
                    <ArrowRight size={13} aria-hidden="true" />
                  </a>
                </div>
                <dl className="m-0 border-l border-[#dcd5c8] pl-[18px] max-[720px]:col-span-full max-[720px]:grid max-[720px]:grid-cols-3 max-[720px]:border-t max-[720px]:border-l-0 max-[720px]:px-0 max-[720px]:pt-3.5">
                  <div className="pt-1 pb-2.5">
                    <dt className="text-[7px] font-[750] tracking-[0.08em] text-[#777268] uppercase">
                      Tune &amp; parts
                    </dt>
                    <dd className="mt-[3px] mb-0 font-mono text-[9px] font-bold">
                      PDM-1.0
                    </dd>
                  </div>
                  <div className="pt-1 pb-2.5">
                    <dt className="text-[7px] font-[750] tracking-[0.08em] text-[#777268] uppercase">
                      Synchronization
                    </dt>
                    <dd className="mt-[3px] mb-0 font-mono text-[9px] font-bold">
                      CC0-1.0
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          </section>
        )}
        {tempo && <section className="border-t border-[#dcd5c8] py-8">
          <h2 className="font-serif text-3xl">Tempo reference</h2>
          <p className="text-sm leading-relaxed">{tune?.title}: quarter note = {tempo.bpm}. {tempo.note}</p>
          <a href={tempo.url} target="_blank" rel="noreferrer" className="text-sm text-[#7f352d] underline">{tempo.label}</a>
          <p className="text-sm leading-relaxed text-[#777268]">These are reference playback paces, not historical prescriptions. No implicit MIDI tempo is treated as an explicit marking. Your tempo is remembered separately for each Psalm version and tune.</p>
        </section>}
      </article>
    </main>
  );
}

export function DownloadsView({
  psalm,
  edition,
  onRead,
}: InfoViewProps) {
  const formats: Array<{
    format: ExportFormat;
    label: string;
    extension: string;
    detail: string;
    icon: typeof FileJson2;
  }> = [
    {
      format: "txt",
      label: "Plain text",
      extension: ".txt",
      detail: "Words and stanza breaks",
      icon: FileText,
    },
    {
      format: "json",
      label: "JSON",
      extension: ".json",
      detail: "Structured Psalm data",
      icon: FileJson2,
    },
    {
      format: "tei",
      label: "TEI XML",
      extension: ".xml",
      detail: "Encoded text",
      icon: FileCode2,
    },
  ];

  return (
    <main
      id="main-content"
      className="col-start-2 row-start-1 min-h-0 min-w-0 overflow-auto overscroll-contain [background:radial-gradient(circle_at_90%_3%,rgb(127_53_45/7%),transparent_25%),#fbfaf6] [scrollbar-color:#dcd5c8_transparent] [scrollbar-width:thin] max-[980px]:overflow-visible"
      tabIndex={-1}
    >
      <article className="mx-auto w-full max-w-[1120px] px-[66px] pt-[66px] pb-[100px] max-[1240px]:px-11 max-[720px]:px-[21px] max-[720px]:pt-[38px] max-[720px]:pb-[75px]">
        <header className="max-w-[820px] pt-[22px] pb-[62px] max-[720px]:pt-5 max-[720px]:pb-[45px]">
          <p className="m-0 text-[10px] leading-[1.25] font-extrabold tracking-[0.18em] text-[#7f352d] uppercase">
            Downloads
          </p>
          <h1 className="mt-[13px] mb-5 max-w-[760px] font-serif text-[clamp(46px,6vw,77px)] leading-[0.98] [font-weight:430] tracking-[-0.055em] max-[720px]:text-[clamp(42px,14vw,60px)]">
            Psalm {psalm.psalm_number}
          </h1>
          <p className="mt-0 mb-[22px] max-w-[650px] font-serif text-lg leading-[1.58] text-[#777268] max-[720px]:text-base">
            {edition} edition
          </p>
          <button
            type="button"
            className="inline-flex min-h-0 cursor-pointer items-center justify-center gap-[9px] bg-transparent p-0 text-xs font-[750] tracking-[0.02em] text-[#7f352d]"
            onClick={onRead}
          >
            Return to Psalm <ArrowRight size={16} aria-hidden="true" />
          </button>
        </header>

        <section className="py-[55px]">
          <div className="grid grid-cols-3 gap-3 max-[720px]:grid-cols-1">
            {formats.map(
              ({ format, label, extension, detail, icon: Icon }) => (
                <button
                  type="button"
                  key={format}
                  className="grid min-h-[210px] cursor-pointer grid-cols-[1fr_auto] items-start rounded border border-[#dcd5c8] bg-[#fbfaf6] p-[22px] text-left text-[#26251f] hover:-translate-y-0.5 hover:border-[#c9aaa3] hover:text-[#7f352d] hover:shadow-[0_18px_50px_rgb(47_39_26/8%)] max-[720px]:min-h-[175px]"
                  onClick={() => downloadExport(psalm, edition, format)}
                >
                  <Icon
                    className="text-[#7f352d]"
                    size={26}
                    strokeWidth={1.4}
                    aria-hidden="true"
                  />
                  <span className="col-span-full mt-[35px] flex self-end flex-col">
                    <small className="font-mono text-[8px] text-[#7f352d]">
                      {extension}
                    </small>
                    <strong className="my-[5px] font-serif text-[21px]">
                      {label}
                    </strong>
                    <p className="m-0 text-[9px] leading-[1.45] text-[#777268]">
                      {detail}
                    </p>
                  </span>
                  <Download size={17} aria-hidden="true" />
                </button>
              ),
            )}
          </div>
        </section>
      </article>
    </main>
  );
}

export function AboutView({ onRead }: InfoViewProps) {
  return (
    <main
      id="main-content"
      className="col-start-2 row-start-1 min-h-0 min-w-0 overflow-auto overscroll-contain [background:radial-gradient(circle_at_90%_3%,rgb(127_53_45/7%),transparent_25%),#fbfaf6] [scrollbar-color:#dcd5c8_transparent] [scrollbar-width:thin] max-[980px]:overflow-visible"
      tabIndex={-1}
    >
      <article className="mx-auto w-full max-w-[1120px] px-[66px] pt-[66px] pb-[100px] max-[1240px]:px-11 max-[720px]:px-[21px] max-[720px]:pt-[38px] max-[720px]:pb-[75px]">
        <header className="max-w-[820px] pt-[22px] pb-[62px] max-[720px]:pt-5 max-[720px]:pb-[45px]">
          <p className="m-0 text-[10px] leading-[1.25] font-extrabold tracking-[0.18em] text-[#7f352d] uppercase">
            About
          </p>
          <h1 className="mt-[13px] mb-5 max-w-[760px] font-serif text-[clamp(46px,6vw,77px)] leading-[0.98] [font-weight:430] tracking-[-0.055em] max-[720px]:text-[clamp(42px,14vw,60px)]">
            Open 1650
          </h1>
          <p className="mt-0 mb-[22px] max-w-[650px] font-serif text-lg leading-[1.58] text-[#777268] max-[720px]:text-base">
            A browser-based player for singing the 1650 Scottish Psalter.
            Each available Psalm pairs its words with a public-domain tune.
          </p>
          <button
            type="button"
            className="inline-flex min-h-[42px] cursor-pointer items-center justify-center gap-[9px] rounded bg-[#7f352d] px-[17px] text-xs font-[750] tracking-[0.02em] text-white shadow-[0_7px_18px_rgb(97_37_31/15%)] hover:bg-[#61251f]"
            onClick={onRead}
          >
            Return to Psalm <ArrowRight size={16} aria-hidden="true" />
          </button>
        </header>

        <section className="grid grid-cols-[minmax(220px,0.7fr)_minmax(400px,1.3fr)] items-start gap-[55px] border-t border-[#dcd5c8] py-[55px] max-[720px]:grid-cols-1 max-[720px]:gap-[30px] max-[720px]:py-[42px]">
          <div>
            <ShieldCheck
              className="mb-[25px] text-[#4f614a]"
              size={28}
              strokeWidth={1.5}
              aria-hidden="true"
            />
            <h2 className="mt-[7px] mb-0 font-serif text-[37px] [font-weight:480] tracking-[-0.04em]">
              Credits and rights
            </h2>
          </div>
          <div
            className="border border-[#dcd5c8]"
            role="table"
            aria-label="Credits and rights"
          >
            <div
              className="grid grid-cols-[1fr_1.2fr] gap-5 border-b border-[#dcd5c8] bg-[#fbfaf6] px-4 py-3.5 max-[720px]:grid-cols-1 max-[720px]:gap-[5px]"
              role="row"
            >
              <span className="text-[9px] text-[#777268]" role="cell">
                Words
              </span>
              <strong className="font-mono text-[8px] text-[#4f614a]" role="cell">
                The Psalms of David in Metre · 1650
              </strong>
            </div>
            <div
              className="grid grid-cols-[1fr_1.2fr] gap-5 border-b border-[#dcd5c8] bg-[#fbfaf6] px-4 py-3.5 max-[720px]:grid-cols-1 max-[720px]:gap-[5px]"
              role="row"
            >
              <span className="text-[9px] text-[#777268]" role="cell">
                Tunes
              </span>
              <strong className="font-mono text-[8px] text-[#4f614a]" role="cell">
                {bundledTuneCount} public-domain SATB{" "}
                {bundledTuneCount === 1 ? "tune" : "tunes"}
              </strong>
            </div>
            <div
              className="grid grid-cols-[1fr_1.2fr] gap-5 border-b border-[#dcd5c8] bg-[#fbfaf6] px-4 py-3.5 max-[720px]:grid-cols-1 max-[720px]:gap-[5px]"
              role="row"
            >
              <span className="text-[9px] text-[#777268]" role="cell">
                Historic text and melodies
              </span>
              <strong className="font-mono text-[8px] text-[#4f614a]" role="cell">
                Public Domain Mark 1.0
              </strong>
            </div>
            <div
              className="grid grid-cols-[1fr_1.2fr] gap-5 bg-[#fbfaf6] px-4 py-3.5 max-[720px]:grid-cols-1 max-[720px]:gap-[5px]"
              role="row"
            >
              <span className="text-[9px] text-[#777268]" role="cell">
                Transcription and synchronization
              </span>
              <strong className="font-mono text-[8px] text-[#4f614a]" role="cell">
                CC0 1.0
              </strong>
            </div>
          </div>
        </section>
      </article>
    </main>
  );
}
