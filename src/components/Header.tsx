import { Info, Menu, Music2 } from "lucide-react";
import type { AppRoute } from "../data/types";
import { Brand } from "./Brand";

interface HeaderProps {
  route: AppRoute;
  onNavigate: (view: AppRoute["view"]) => void;
  onOpenLibrary: () => void;
}

const navItems = [
  { view: "reader" as const, label: "Sing", icon: Music2 },
  { view: "about" as const, label: "About", icon: Info },
];

export function Header({
  route,
  onNavigate,
  onOpenLibrary,
}: HeaderProps) {
  return (
    <>
      <a
        className="fixed top-2.5 left-1/2 z-[1000] -translate-x-1/2 -translate-y-[160%] rounded-[4px] bg-[#61251f] px-4 py-2.5 text-[13px] font-bold text-white transition-transform duration-[160ms] [transition-timing-function:ease] focus:translate-y-0"
        href="#main-content"
      >
        Skip to sing-along
      </a>
      <header className="relative z-30 grid h-[74px] flex-none grid-cols-[254px_minmax(0,1fr)] items-stretch border-b border-[#dcd5c8] bg-[rgb(249_247_241_/_94%)] shadow-[0_1px_0_rgb(255_255_255_/_70%)] backdrop-blur-[16px] max-[1240px]:grid-cols-[230px_minmax(0,1fr)] max-[980px]:grid-cols-[54px_minmax(180px,1fr)_auto] max-[720px]:h-16 max-[720px]:grid-cols-[50px_minmax(140px,1fr)_auto] print:hidden">
        <button
          type="button"
          className="hidden h-9 w-9 flex-none cursor-pointer place-items-center rounded-full border border-transparent bg-transparent text-[#4f4d45] transition-[color,background,border-color] duration-[140ms] [transition-timing-function:ease] hover:border-[#dcd5c8] hover:bg-[#fbfaf6] hover:text-[#7f352d] max-[980px]:grid max-[980px]:self-center max-[980px]:justify-self-center"
          onClick={onOpenLibrary}
          aria-label="Open Psalm library"
        >
          <Menu size={20} strokeWidth={1.7} />
        </button>

        <button
          className="flex cursor-pointer items-center border-r border-[#dcd5c8] bg-transparent px-[18px] text-left max-[980px]:border-r-0 max-[980px]:px-3"
          type="button"
          onClick={() => onNavigate("reader")}
          aria-label="Open 1650 home"
        >
          <Brand />
        </button>

        <nav
          className="flex min-w-0 items-center gap-1 px-[22px] max-[1240px]:px-3 max-[980px]:col-start-3 max-[980px]:row-start-1 max-[980px]:px-[9px] max-[720px]:gap-px max-[720px]:pr-1.5 max-[720px]:pl-0"
          aria-label="Primary navigation"
        >
          {navItems.map(({ view, label, icon: Icon }) => (
            <button
              type="button"
              key={view}
              className="relative inline-flex min-h-[38px] cursor-pointer items-center gap-[7px] rounded-[4px] bg-transparent px-[11px] text-[11px] font-bold whitespace-nowrap text-[#777268] after:absolute after:right-[11px] after:bottom-[-18px] after:left-[11px] after:h-0.5 after:bg-transparent after:content-[''] hover:bg-[rgb(255_255_255_/_55%)] hover:text-[#26251f] data-[active=true]:text-[#7f352d] data-[active=true]:after:bg-[#7f352d] max-[1240px]:px-2 max-[720px]:w-[38px] max-[720px]:justify-center max-[720px]:px-0 max-[720px]:after:right-[7px] max-[720px]:after:bottom-[-13px] max-[720px]:after:left-[7px] max-[720px]:[&_span]:hidden"
              data-active={route.view === view}
              aria-current={route.view === view ? "page" : undefined}
              aria-label={label}
              onClick={() => onNavigate(view)}
            >
              <Icon size={16} strokeWidth={1.8} aria-hidden="true" />
              <span>{label}</span>
            </button>
          ))}
        </nav>
      </header>
    </>
  );
}
