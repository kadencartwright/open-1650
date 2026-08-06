import { Music2 } from "lucide-react";

interface UnarrangedPsalmProps {
  number: number;
  onChoosePsalm: () => void;
}

export function UnarrangedPsalm({
  number,
  onChoosePsalm,
}: UnarrangedPsalmProps) {
  return (
    <main
      id="main-content"
      className="col-start-2 row-start-1 min-h-0 min-w-0 overflow-auto overscroll-contain [background:radial-gradient(circle_at_50%_-10%,rgb(167_136_86/11%),transparent_32%),linear-gradient(90deg,rgb(215_205_187/8%)_1px,transparent_1px)_0_0/41px_41px,#fbfaf6] [scrollbar-color:#dcd5c8_transparent] [scrollbar-width:thin] max-[980px]:overflow-visible print:h-auto print:overflow-visible"
      tabIndex={-1}
    >
      <section className="grid min-h-full place-items-center p-[42px] text-center max-[430px]:p-[22px]">
        <div className="w-full max-w-[640px] rounded-[10px] border border-[#dcd5c8] bg-[rgb(255_255_255/62%)] p-12 shadow-[0_18px_50px_rgb(47_39_26/8%)] max-[430px]:px-[22px] max-[430px]:py-9">
          <div
            className="mx-auto mb-[22px] grid size-[72px] place-items-center rounded-full border border-[#d8c9b6] bg-[#f0e9da] text-[#7f352d]"
            aria-hidden="true"
          >
            <Music2 size={30} strokeWidth={1.5} />
          </div>
          <h1 className="mt-2.5 mb-[15px] font-serif text-[clamp(42px,7vw,66px)] [font-weight:450] tracking-[-0.05em]">
            Psalm {number}
          </h1>
          <p className="mx-auto max-w-[470px] font-serif text-[17px] leading-[1.55] text-[#777268]">
            This Psalm isn’t available yet.
          </p>
          <div className="mt-7 flex justify-center gap-3 max-[430px]:flex-col">
            <button
              type="button"
              className="inline-flex min-h-[42px] cursor-pointer items-center justify-center gap-[9px] rounded bg-[#7f352d] px-[17px] text-xs font-[750] tracking-[0.02em] text-white shadow-[0_7px_18px_rgb(97_37_31/15%)] hover:bg-[#61251f]"
              onClick={onChoosePsalm}
            >
              Choose a Psalm
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
