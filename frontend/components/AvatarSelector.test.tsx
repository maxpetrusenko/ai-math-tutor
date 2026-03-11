import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";

import { AvatarSelector } from "./AvatarSelector";
import { resolveAvatarProvider } from "./avatar_registry";

test("avatar selector filters avatar options by render mode", () => {
  const selectedAvatar = resolveAvatarProvider("human-css-2d");
  const onAvatarChange = vi.fn();
  const onModeChange = vi.fn();

  render(
    <AvatarSelector
      onAvatarChange={onAvatarChange}
      onModeChange={onModeChange}
      selectedAvatarId="human-css-2d"
      selectedMode={selectedAvatar.mode}
    />
  );

  expect(screen.getByLabelText("Render mode")).toHaveValue("2d");
  expect(screen.getByLabelText("Avatar")).toHaveValue("human-css-2d");
  expect(screen.getByRole("option", { name: "Human" })).toBeInTheDocument();
  expect(screen.queryByRole("option", { name: "Human 3D" })).not.toBeInTheDocument();

  fireEvent.change(screen.getByLabelText("Render mode"), {
    target: { value: "3d" },
  });

  expect(onModeChange).toHaveBeenCalledWith("3d");
});
