import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";

import { AvatarSelector } from "./AvatarSelector";

test("avatar selector exposes only dependable local tutors", () => {
  const onAvatarChange = vi.fn();

  render(
    <AvatarSelector
      onAvatarChange={onAvatarChange}
      selectedAvatarId="nerdy-talkinghead-3d"
    />
  );

  expect(screen.queryByLabelText("Render mode")).not.toBeInTheDocument();
  expect(screen.getByLabelText("Avatar")).toHaveValue("nerdy-talkinghead-3d");
  expect(screen.getByRole("option", { name: "Nerdy Tutor" })).toBeInTheDocument();
  expect(screen.queryByRole("option", { name: "Simli Tutor" })).not.toBeInTheDocument();

  fireEvent.change(screen.getByLabelText("Avatar"), {
    target: { value: "nerdy-talkinghead-3d" },
  });
  expect(onAvatarChange).toHaveBeenCalledWith("nerdy-talkinghead-3d");
});
