import {
  Check,
  Copy,
  Share2,
  UsersRound,
  X,
} from "lucide-react";
import {
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

export const TOGETHER_CODE_LENGTH = 6;

export function normalizeTogetherCode(value: string): string {
  return value
    .toUpperCase()
    .replace(/[^2-9A-HJ-NP-Z]/g, "")
    .slice(0, TOGETHER_CODE_LENGTH);
}

export type TogetherDialogState =
  | { mode: "setup" }
  | {
      mode: "host";
      code: string;
      deviceCount: number;
    }
  | {
      mode: "guest";
      code: string;
      status: "connecting" | "ready";
    };

type MaybePromise = void | Promise<void>;

export interface TogetherDialogProps {
  open: boolean;
  state: TogetherDialogState;
  busy?: boolean;
  error?: string | null;
  shareSupported?: boolean;
  onClose: () => void;
  onStartGroup: () => MaybePromise;
  onJoinGroup: (code: string) => MaybePromise;
  onEndGroup: () => MaybePromise;
  onLeaveGroup: () => MaybePromise;
  onCopyCode?: (code: string) => MaybePromise;
  onShareCode?: (code: string) => MaybePromise;
}

type PendingAction =
  | "start"
  | "join"
  | "copy"
  | "share"
  | "end"
  | "leave";

const interactiveSelector = [
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "a[href]",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  return "Something went wrong.";
}

function deviceLabel(count: number): string {
  const safeCount = Math.max(1, Math.round(count));
  return `${safeCount} ${safeCount === 1 ? "device" : "devices"}`;
}

export function TogetherDialog({
  open,
  state,
  busy = false,
  error,
  shareSupported,
  onClose,
  onStartGroup,
  onJoinGroup,
  onEndGroup,
  onLeaveGroup,
  onCopyCode,
  onShareCode,
}: TogetherDialogProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const [code, setCode] = useState("");
  const [pendingAction, setPendingAction] =
    useState<PendingAction | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const isBusy = busy || pendingAction !== null;
  const normalizedStateCode =
    state.mode === "setup" ? "" : normalizeTogetherCode(state.code);
  const canShare =
    shareSupported ??
    (typeof navigator !== "undefined" &&
      typeof navigator.share === "function");

  useEffect(() => {
    setActionError(null);
    setCopied(false);
  }, [open, state.mode, normalizedStateCode]);

  useEffect(() => {
    if (!open) return;

    previousFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const frame = window.requestAnimationFrame(() => {
      const autofocus = dialogRef.current?.querySelector<HTMLElement>(
        "[data-autofocus]",
      );
      (autofocus ?? dialogRef.current)?.focus();
    });

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;

      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(interactiveSelector),
      ).filter((element) => !element.hidden);
      if (focusable.length === 0) {
        event.preventDefault();
        dialogRef.current.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      const previousFocus = previousFocusRef.current;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [onClose, open]);

  if (!open || typeof document === "undefined") return null;

  const runAction = async (
    action: PendingAction,
    callback: () => MaybePromise,
  ) => {
    if (isBusy) return;
    setActionError(null);
    setPendingAction(action);
    try {
      await callback();
      if (action === "copy") setCopied(true);
    } catch (caught) {
      setActionError(getErrorMessage(caught));
    } finally {
      setPendingAction(null);
    }
  };

  const copyCode = () =>
    runAction("copy", () => {
      if (onCopyCode) return onCopyCode(normalizedStateCode);
      if (!navigator.clipboard?.writeText) {
        throw new Error("Copy is unavailable on this device.");
      }
      return navigator.clipboard.writeText(normalizedStateCode);
    });

  const shareCode = () =>
    runAction("share", () => {
      if (onShareCode) return onShareCode(normalizedStateCode);
      if (!navigator.share) {
        throw new Error("Sharing is unavailable on this device.");
      }
      return navigator.share({
        title: "Open 1650",
        text: `Join group ${normalizedStateCode}`,
      });
    });

  return createPortal(
    <div
      className="fixed inset-0 z-[90] grid place-items-center overflow-y-auto bg-[#171612]/55 px-4 py-8 backdrop-blur-[2px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isBusy) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-[390px] rounded-[10px] border border-[#dcd5c8] bg-[#fbfaf6] p-5 text-[#26251f] shadow-[0_24px_70px_rgba(27,24,19,0.28)] outline-none max-[430px]:p-[18px]"
        tabIndex={-1}
      >
        <header className="flex items-center justify-between gap-4 border-b border-[#e9e4da] pb-3.5">
          <h2
            id={titleId}
            className="m-0 font-serif text-[24px] font-[540] tracking-[-0.025em]"
          >
            Play together
          </h2>
          <button
            type="button"
            aria-label="Close"
            className="grid h-9 w-9 cursor-pointer place-items-center rounded-full bg-transparent text-[#777268] hover:bg-[#eee9df] hover:text-[#26251f] disabled:cursor-wait disabled:opacity-50"
            disabled={isBusy}
            onClick={onClose}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        {state.mode === "setup" && (
          <div className="pt-5">
            <button
              type="button"
              data-autofocus
              className="min-h-11 w-full cursor-pointer rounded-[6px] border border-[#61251f] bg-[#61251f] px-4 text-[11px] font-extrabold tracking-[0.02em] text-[#fffaf3] hover:bg-[#742e27] disabled:cursor-wait disabled:opacity-55"
              disabled={isBusy}
              onClick={() => void runAction("start", onStartGroup)}
            >
              {pendingAction === "start" ? "Starting…" : "Start a group"}
            </button>

            <div className="my-4 flex items-center gap-3 text-[8px] font-extrabold tracking-[0.09em] text-[#a7a094] uppercase before:h-px before:flex-1 before:bg-[#e9e4da] after:h-px after:flex-1 after:bg-[#e9e4da]">
              Or
            </div>

            <form
              className="grid grid-cols-[minmax(0,1fr)_auto] gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                if (code.length === TOGETHER_CODE_LENGTH) {
                  void runAction("join", () => onJoinGroup(code));
                }
              }}
            >
              <label className="min-w-0">
                <span className="sr-only">Group code</span>
                <input
                  className="h-11 w-full rounded-[6px] border border-[#cfc6b7] bg-white/65 px-3 font-mono text-[17px] tracking-[0.18em] uppercase outline-none placeholder:text-[#b9b1a4] focus:border-[#7f352d] focus:ring-2 focus:ring-[#f2e5e1] disabled:cursor-wait disabled:opacity-55"
                  type="text"
                  inputMode="text"
                  autoCapitalize="characters"
                  autoComplete="off"
                  spellCheck={false}
                  maxLength={TOGETHER_CODE_LENGTH}
                  placeholder="CODE"
                  aria-label="Group code"
                  value={code}
                  disabled={isBusy}
                  onChange={(event) =>
                    setCode(normalizeTogetherCode(event.target.value))
                  }
                />
              </label>
              <button
                type="submit"
                className="min-h-11 cursor-pointer rounded-[6px] border border-[#cfc6b7] bg-transparent px-4 text-[10px] font-extrabold text-[#4f4d45] hover:bg-[#eee9df] hover:text-[#26251f] disabled:cursor-not-allowed disabled:opacity-45"
                disabled={isBusy || code.length !== TOGETHER_CODE_LENGTH}
              >
                {pendingAction === "join" ? "Joining…" : "Join"}
              </button>
            </form>
          </div>
        )}

        {state.mode === "host" && (
          <div className="pt-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="font-mono text-[27px] font-semibold tracking-[0.16em] text-[#61251f]">
                  {normalizedStateCode}
                </div>
                <div className="mt-1 flex items-center gap-1.5 text-[9px] font-bold text-[#777268]">
                  <UsersRound size={13} aria-hidden="true" />
                  {deviceLabel(state.deviceCount)}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  data-autofocus
                  className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-[5px] bg-[#eee9df] px-2.5 text-[9px] font-extrabold text-[#4f4d45] hover:bg-[#e3dcd0] hover:text-[#26251f] disabled:cursor-wait disabled:opacity-50"
                  disabled={isBusy}
                  onClick={() => void copyCode()}
                >
                  {copied ? (
                    <Check size={14} aria-hidden="true" />
                  ) : (
                    <Copy size={14} aria-hidden="true" />
                  )}
                  {copied ? "Copied" : "Copy"}
                </button>
                {canShare && (
                  <button
                    type="button"
                    className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-[5px] bg-[#eee9df] px-2.5 text-[9px] font-extrabold text-[#4f4d45] hover:bg-[#e3dcd0] hover:text-[#26251f] disabled:cursor-wait disabled:opacity-50"
                    disabled={isBusy}
                    onClick={() => void shareCode()}
                  >
                    <Share2 size={14} aria-hidden="true" />
                    Share
                  </button>
                )}
              </div>
            </div>
            <button
              type="button"
              className="mt-6 min-h-10 w-full cursor-pointer rounded-[6px] border border-[#cfc6b7] bg-transparent px-4 text-[10px] font-extrabold text-[#7f352d] hover:bg-[#f2e5e1] disabled:cursor-wait disabled:opacity-50"
              disabled={isBusy}
              onClick={() => void runAction("end", onEndGroup)}
            >
              {pendingAction === "end" ? "Ending…" : "End group"}
            </button>
          </div>
        )}

        {state.mode === "guest" && (
          <div className="pt-5">
            <div className="flex items-center justify-between gap-4">
              <div className="font-mono text-[27px] font-semibold tracking-[0.16em] text-[#61251f]">
                {normalizedStateCode}
              </div>
              <div
                className="inline-flex items-center gap-2 text-[10px] font-bold text-[#4f4d45]"
                aria-live="polite"
              >
                <span
                  className="h-2 w-2 rounded-full bg-[#a78856] data-[ready=true]:bg-[#4f614a]"
                  data-ready={state.status === "ready"}
                  aria-hidden="true"
                />
                {state.status === "ready" ? "Ready" : "Connecting…"}
              </div>
            </div>
            <button
              type="button"
              data-autofocus
              className="mt-6 min-h-10 w-full cursor-pointer rounded-[6px] border border-[#cfc6b7] bg-transparent px-4 text-[10px] font-extrabold text-[#7f352d] hover:bg-[#f2e5e1] disabled:cursor-wait disabled:opacity-50"
              disabled={isBusy}
              onClick={() => void runAction("leave", onLeaveGroup)}
            >
              {pendingAction === "leave" ? "Leaving…" : "Leave group"}
            </button>
          </div>
        )}

        {(error || actionError) && (
          <p
            className="mt-4 mb-0 rounded-[5px] bg-[#f2e5e1] px-3 py-2.5 text-[9px] font-semibold leading-normal text-[#7f352d]"
            role="alert"
          >
            {actionError ?? error}
          </p>
        )}
      </div>
    </div>,
    document.body,
  );
}
