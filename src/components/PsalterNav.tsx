import { Music2, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { primarySongSummaries } from "../data/library";

interface PsalterNavProps {
  selectedPsalm: number;
  open: boolean;
  onSelect: (psalmNumber: number) => void;
  onClose: () => void;
}

export function PsalterNav({
  selectedPsalm,
  open,
  onSelect,
  onClose,
}: PsalterNavProps) {
  const [query, setQuery] = useState("");
  const [isDrawer, setIsDrawer] = useState(false);
  const listRef = useRef<HTMLElement>(null);
  const singableSongs = useMemo(
    () => {
      const normalizedQuery = query.trim().toLocaleLowerCase();

      return primarySongSummaries.flatMap(({ psalm, tune, setting }) => {
        const searchableText = [
          psalm.psalm_number,
          psalm.opening_line,
          tune.title,
          tune.meter,
        ]
          .join(" ")
          .toLocaleLowerCase();

        return !normalizedQuery || searchableText.includes(normalizedQuery)
          ? [{ psalm, tune, setting }]
          : [];
      });
    },
    [query],
  );

  useEffect(() => {
    const media = window.matchMedia("(max-width: 980px)");
    const update = () => setIsDrawer(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const selected = listRef.current?.querySelector<HTMLElement>(
      '[data-selected="true"]',
    );
    if (selected && typeof selected.scrollIntoView === "function") {
      selected.scrollIntoView({ block: "center" });
    }
  }, [open, selectedPsalm]);

  const drawerHidden = isDrawer && !open;

  return (
    <>
      {isDrawer && open && (
        <button
          type="button"
          className="pointer-events-none fixed z-[37] hidden border-0 bg-[rgb(29_27_23_/_45%)] opacity-0 [inset:74px_0_0] max-[980px]:block max-[980px]:transition-opacity max-[980px]:duration-[160ms] max-[980px]:[transition-timing-function:ease] max-[980px]:data-[open=true]:pointer-events-auto max-[980px]:data-[open=true]:opacity-100 max-[720px]:[inset:64px_0_0] print:hidden"
          data-open="true"
          aria-label="Close Psalm library"
          onClick={onClose}
        />
      )}
      <aside
        className="col-start-1 row-start-1 flex min-h-0 min-w-0 flex-col border-r border-[#dcd5c8] [background:linear-gradient(rgb(255_255_255_/_28%),rgb(255_255_255_/_0%)),#f4f0e7] max-[980px]:fixed max-[980px]:z-40 max-[980px]:w-[min(320px,88vw)] max-[980px]:-translate-x-[105%] max-[980px]:border-r max-[980px]:border-[#dcd5c8] max-[980px]:shadow-[20px_0_50px_rgb(30_27_22_/_18%)] max-[980px]:transition-transform max-[980px]:duration-[180ms] max-[980px]:[transition-timing-function:ease] max-[980px]:[inset:74px_auto_0_0] max-[980px]:data-[open=true]:translate-x-0 max-[720px]:[inset:64px_auto_0_0] print:hidden"
        data-open={open}
        aria-label="Choose a Psalm"
        aria-hidden={drawerHidden}
        inert={drawerHidden}
      >
        <div className="flex items-end justify-between px-5 pt-[23px] pb-[17px]">
          <h2 className="mt-[5px] text-xl font-[650] tracking-[-0.025em] [font-family:'Iowan_Old_Style','Palatino_Linotype',Palatino,'Book_Antiqua',Georgia,serif]">
            Psalms
          </h2>
          <button
            type="button"
            className="hidden h-9 w-9 flex-none cursor-pointer place-items-center rounded-full border border-transparent bg-transparent text-[#4f4d45] transition-[color,background,border-color] duration-[140ms] [transition-timing-function:ease] hover:border-[#dcd5c8] hover:bg-[#fbfaf6] hover:text-[#7f352d] max-[980px]:grid"
            onClick={onClose}
            aria-label="Close Psalm library"
          >
            <X size={19} />
          </button>
        </div>

        <label className="mx-[15px] flex min-h-10 items-center gap-2 rounded-[4px] border border-[#dcd5c8] bg-[rgb(255_255_255_/_56%)] px-[11px] text-[#777268] focus-within:border-[#b99b95] focus-within:shadow-[0_0_0_3px_#f2e5e1]">
          <Search size={17} strokeWidth={1.8} aria-hidden="true" />
          <span className="sr-only">Search by Psalm or tune</span>
          <input
            className="w-full min-w-0 border-0 bg-transparent text-[11px] text-[#26251f] outline-0 placeholder:text-[#a7a094]"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Psalm or tune"
          />
          {query && (
            <button
              type="button"
              className="grid h-[25px] w-[25px] flex-none cursor-pointer place-items-center rounded-full bg-transparent text-[#777268] hover:bg-[#e9e4da] hover:text-[#26251f]"
              onClick={() => setQuery("")}
              aria-label="Clear search"
            >
              <X size={15} />
            </button>
          )}
        </label>

        <p className="sr-only" role="status" aria-live="polite">
          {singableSongs.length}{" "}
          {singableSongs.length === 1
            ? "Psalm matches"
            : "Psalms match"}{" "}
          your search.
        </p>

        <nav
          ref={listRef}
          className="min-h-0 flex-1 overflow-y-auto px-[15px] pt-3.5 pb-5 [scrollbar-color:#dcd5c8_transparent] [scrollbar-width:thin]"
          aria-label="Select a Psalm"
        >
          {singableSongs.length > 0 && (
            <div className="flex flex-col gap-1">
              {singableSongs.map(({ psalm, tune, setting }) => (
                <button
                  type="button"
                  className="group grid min-h-[47px] w-full cursor-pointer grid-cols-[30px_minmax(0,1fr)] items-center gap-2 rounded-[4px] border border-[#dccbc3] bg-[rgb(255_253_248_/_65%)] px-[9px] py-[7px] text-left text-[#26251f] transition-[border-color,background,transform] duration-[110ms] [transition-timing-function:ease] hover:translate-x-px hover:border-[#c29d93] hover:bg-[#f0e9da] data-[selected=true]:border-[#7f352d] data-[selected=true]:bg-[#7f352d] data-[selected=true]:text-white data-[selected=true]:shadow-[0_4px_12px_rgb(97_37_31_/_13%)]"
                  key={setting.id}
                  data-selected={selectedPsalm === psalm.psalm_number}
                  aria-current={
                    selectedPsalm === psalm.psalm_number ? "page" : undefined
                  }
                  aria-label={`Sing Psalm ${psalm.psalm_number} to ${tune.title}`}
                  onClick={() => {
                    onSelect(psalm.psalm_number);
                    onClose();
                  }}
                >
                  <span
                    className="grid h-7 w-7 place-items-center rounded-full bg-[#f2e5e1] text-[#7f352d] group-data-[selected=true]:bg-[#fff8ee] group-data-[selected=true]:text-[#7f352d]"
                    aria-hidden="true"
                  >
                    <Music2 size={14} strokeWidth={1.8} />
                  </span>
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <strong className="overflow-hidden text-ellipsis whitespace-nowrap text-xs font-[650] [font-family:'Iowan_Old_Style','Palatino_Linotype',Palatino,'Book_Antiqua',Georgia,serif]">
                      Psalm {psalm.psalm_number}
                    </strong>
                    <small className="overflow-hidden text-ellipsis whitespace-nowrap text-[7px] font-[750] tracking-[0.055em] text-[#777268] uppercase group-data-[selected=true]:text-[rgb(255_255_255_/_72%)]">
                      {tune.title} · {tune.meter}
                    </small>
                  </span>
                </button>
              ))}
            </div>
          )}
        </nav>

        {singableSongs.length === 0 && (
          <div className="grid flex-1 place-content-center p-[25px] text-center">
            <p className="mb-2.5 text-xs text-[#777268]">
              No results for “{query}”.
            </p>
            <button
              type="button"
              className="cursor-pointer bg-transparent text-[11px] font-[750] text-[#7f352d]"
              onClick={() => setQuery("")}
            >
              Clear search
            </button>
          </div>
        )}
      </aside>
    </>
  );
}
