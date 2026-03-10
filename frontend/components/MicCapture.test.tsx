import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";

import { MicCapture } from "./MicCapture";

test("mic capture shows unsupported state and disables the button", () => {
  render(<MicCapture active={false} onToggle={() => {}} supported={false} />);

  expect(screen.getByText("unsupported")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Arm Mic" })).toBeDisabled();
});

test("mic capture shows live state and stop label when active", () => {
  const onToggle = vi.fn();

  render(<MicCapture active={true} onToggle={onToggle} />);

  fireEvent.click(screen.getByRole("button", { name: "Stop Mic" }));
  expect(screen.getByText("live")).toBeInTheDocument();
  expect(onToggle).toHaveBeenCalledTimes(1);
});

test("mic capture surfaces recorder errors", () => {
  render(<MicCapture active={false} error="mic failed" onToggle={() => {}} />);

  expect(screen.getByText("error")).toBeInTheDocument();
  expect(screen.getByText("mic failed")).toBeInTheDocument();
});
