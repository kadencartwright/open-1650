import { Check } from "lucide-react";

interface ToastProps {
  message: string | null;
}

export function Toast({ message }: ToastProps) {
  return (
    <div
      className="pointer-events-none fixed right-[22px] bottom-[22px] z-[90] flex min-h-[42px] translate-y-3.5 items-center gap-2 rounded border border-[#c5d4be] bg-[#4f614a] px-[15px] text-[10px] font-[750] text-white opacity-0 shadow-[0_13px_35px_rgb(40_44_35/22%)] transition-[opacity,transform] duration-160 data-[visible=true]:translate-y-0 data-[visible=true]:opacity-100 motion-reduce:duration-[0.01ms] max-[720px]:right-3 max-[720px]:bottom-3 max-[720px]:left-3 max-[720px]:justify-center print:hidden"
      data-visible={Boolean(message)}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <Check size={16} strokeWidth={2} aria-hidden="true" />
      <span>{message ?? ""}</span>
    </div>
  );
}
