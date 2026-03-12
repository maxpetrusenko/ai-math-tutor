import React from "react";
import { render, screen } from "@testing-library/react";

import { TutorSessionAvatarStage } from "./TutorSessionAvatarStage";

const managedAvatarSessionSpy = vi.fn();

vi.mock("../ManagedAvatarSession", () => ({
  ManagedAvatarSession: (props: Record<string, unknown>) => {
    managedAvatarSessionSpy(props);
    return <div data-testid="managed-avatar-session-props">{JSON.stringify(props)}</div>;
  },
}));

afterEach(() => {
  managedAvatarSessionSpy.mockReset();
});

test("managed session stage autostarts the avatar and keeps the mic muted on load", () => {
  render(
    <TutorSessionAvatarStage
      avatarConfig={undefined}
      avatarId="simli-b97a7777-live"
      avatarNowMs={0}
      avatarState="idle"
      energy={0.2}
      isManagedAvatar
      lessonQuestion={null}
      lessonState={null}
      selectedAvatar={{
        id: "simli-b97a7777-live",
        kind: "managed",
        label: "Simli Tutor",
        description: "Realtime face",
      }}
      selectedAvatarLabel="Simli Tutor"
      timestamps={[]}
      tutorText=""
    />
  );

  expect(screen.getByTestId("managed-avatar-session-props")).toBeInTheDocument();
  expect(managedAvatarSessionSpy).toHaveBeenCalledWith(expect.objectContaining({
    autoStart: true,
    microphoneMode: "off",
  }));
});
