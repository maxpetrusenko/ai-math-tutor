import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";

import { AudioPlayer } from "./AudioPlayer";
import { PlaybackController } from "../lib/playback_controller";


test("audio player interrupts queued playback", async () => {
  const controller = new PlaybackController();
  controller.enqueue({ id: "a", text: "hello" });
  controller.enqueue({ id: "b", text: "world" });

  render(<AudioPlayer controller={controller} />);

  fireEvent.click(screen.getByRole("button", { name: "Interrupt Audio" }));

  expect(controller.queueLength()).toBe(0);
  expect(screen.getByText("idle")).toBeInTheDocument();
});
