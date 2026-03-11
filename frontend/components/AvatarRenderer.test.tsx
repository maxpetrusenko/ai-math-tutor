import React from "react";
import { render, screen } from "@testing-library/react";

import { AvatarRenderer } from "./AvatarRenderer";
import { loadAvatarAsset, type Avatar2DAsset } from "../lib/avatar_asset_loader";
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
      asset={loadAvatarAsset({ type: "2d", assetRef: "human" }) as Avatar2DAsset}
      frame={buildAvatarFrame({
        energy: 0.7,
        state: "speaking",
        timestamps: [{ word: "idea", startMs: 0, endMs: 180 }],
        nowMs: 90,
      })}
    />
  );

  expect(screen.getByRole("heading", { name: "Avatar" })).toBeInTheDocument();
  expect(screen.getByText("Speaking: idea")).toBeInTheDocument();
  expect(Number(screen.getByTestId("avatar-mouth").getAttribute("data-open"))).toBeGreaterThan(0.8);
});
