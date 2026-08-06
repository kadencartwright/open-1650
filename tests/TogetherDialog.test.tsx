import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  normalizeTogetherCode,
  TogetherDialog,
} from "../src/components/TogetherDialog";

const baseProps = {
  open: true,
  onClose: vi.fn(),
  onStartGroup: vi.fn(),
  onJoinGroup: vi.fn(),
  onEndGroup: vi.fn(),
  onLeaveGroup: vi.fn(),
};

describe("TogetherDialog", () => {
  it("normalizes codes to the six unambiguous characters used by rooms", () => {
    expect(normalizeTogetherCode("o1i-a2b3 c4z9")).toBe("A2B3C4");
  });

  it("renders through a portal and joins with a normalized complete code", async () => {
    const user = userEvent.setup();
    const onJoinGroup = vi.fn().mockResolvedValue(undefined);
    const { container } = render(
      <div className="overflow-hidden">
        <TogetherDialog
          {...baseProps}
          state={{ mode: "setup" }}
          onJoinGroup={onJoinGroup}
        />
      </div>,
    );

    const dialog = screen.getByRole("dialog", { name: "Play together" });
    expect(container).not.toContainElement(dialog);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Start a group" })).toHaveFocus(),
    );

    await user.type(screen.getByRole("textbox", { name: "Group code" }), "oi-a2b3c4");
    expect(screen.getByRole("textbox", { name: "Group code" })).toHaveValue(
      "A2B3C4",
    );
    await user.click(screen.getByRole("button", { name: "Join" }));
    expect(onJoinGroup).toHaveBeenCalledWith("A2B3C4");
  });

  it("shows host sharing controls, devices, and async errors", async () => {
    const user = userEvent.setup();
    const onCopyCode = vi.fn().mockResolvedValue(undefined);
    const onShareCode = vi
      .fn()
      .mockRejectedValue(new Error("Sharing was cancelled."));

    render(
      <TogetherDialog
        {...baseProps}
        state={{ mode: "host", code: "ABC234", deviceCount: 3 }}
        shareSupported
        onCopyCode={onCopyCode}
        onShareCode={onShareCode}
      />,
    );

    expect(screen.getByText("3 devices")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Copy" }));
    expect(onCopyCode).toHaveBeenCalledWith("ABC234");
    expect(screen.getByRole("button", { name: "Copied" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Share" }));
    expect(onShareCode).toHaveBeenCalledWith("ABC234");
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Sharing was cancelled.",
    );
  });

  it("shows guest readiness and closes with Escape while restoring focus", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const trigger = document.createElement("button");
    trigger.textContent = "Open";
    document.body.append(trigger);
    trigger.focus();

    const { rerender } = render(
      <TogetherDialog
        {...baseProps}
        open
        state={{ mode: "guest", code: "ABC234", status: "ready" }}
        onClose={onClose}
      />,
    );

    expect(screen.getByText("Ready")).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Leave group" })).toHaveFocus(),
    );
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledOnce();

    rerender(
      <TogetherDialog
        {...baseProps}
        open={false}
        state={{ mode: "guest", code: "ABC234", status: "ready" }}
        onClose={onClose}
      />,
    );
    expect(trigger).toHaveFocus();
    trigger.remove();
  });
});
