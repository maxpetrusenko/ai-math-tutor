import React from "react";
import { render, screen } from "@testing-library/react";

import { AvatarRenderer } from "./AvatarRenderer";
import { buildAvatarFrame } from "../lib/avatar_driver";
import { getMouthOpenAmount } from "../lib/avatar_timing";


test("avatar timing opens mouth during active word window", () => {
  const openness = getMouthOpenAmount(
    [{ word: "Nice", startMs: 0, endMs: 100 }],
    50
  );

  expect(openness).toBeGreaterThan(0);
});


test("avatar renderer reflects speaking state", () => {
  render(
    <AvatarRenderer
      frame={buildAvatarFrame({
        energy: 0.7,
        state: "speaking",
        timestamps: [{ word: "idea", startMs: 0, endMs: 180 }],
        nowMs: 90,
      })}
    />
  );

  expect(screen.getByText("speaking")).toBeInTheDocument();
  expect(Number(screen.getByTestId("avatar-mouth").getAttribute("data-open"))).toBeGreaterThan(0.8);
});
