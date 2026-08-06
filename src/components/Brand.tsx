interface BrandProps {
  compact?: boolean;
}

export function Brand({ compact = false }: BrandProps) {
  return (
    <span
      className="inline-flex min-w-0 items-center gap-[11px]"
      data-compact={compact || undefined}
    >
      <svg
        className="h-9 w-9 flex-none text-[#7f352d] max-[980px]:h-8 max-[980px]:w-8 max-[430px]:hidden"
        viewBox="0 0 44 44"
        aria-hidden="true"
        focusable="false"
      >
        <path
          d="M8 7.5h28v29H8z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
        />
        <path
          d="M14 14h16M14 20h11M14 26h16M14 32h8"
          fill="none"
          stroke="currentColor"
          strokeLinecap="square"
          strokeWidth="1"
        />
        <path
          d="M22 7.5v29"
          fill="none"
          stroke="#a78856"
          strokeWidth="0.8"
        />
      </svg>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-[19px] leading-none font-[650] tracking-[-0.02em] [font-family:'Iowan_Old_Style','Palatino_Linotype',Palatino,'Book_Antiqua',Georgia,serif] max-[720px]:text-[17px]">
          Open 1650
        </span>
      </span>
    </span>
  );
}
