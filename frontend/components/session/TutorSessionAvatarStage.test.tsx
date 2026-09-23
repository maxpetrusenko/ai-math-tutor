import React from "react";
import type { ForwardedRef } from "react";
import { render, screen } from "@testing-library/react";

import { TutorSessionAvatarStage } from "./TutorSessionAvatarStage";
import type { ManagedAvatarSessionHandle } from "../ManagedAvatarSession";

const managedAvatarSessionSpy = vi.fn();
const managedModuleState = vi.hoisted(() => ({ loadCount: 0 }));

vi.mock("../ManagedAvatarSession", async () => {
  managedModuleState.loadCount += 1;
  const ReactModule = await import("react");
  const MockManagedAvatarSession = ReactModule.forwardRef(function MockManagedAvatarSession(
    props: Record<string, unknown>,
    ref: ForwardedRef<unknown>
  ) {
    managedAvatarSessionSpy(props);
    ReactModule.useImperativeHandle(ref, () => ({ mockHandle: true }));
    return (
      <div data-testid="managed-avatar-session-props">
        {JSON.stringify({ autoStart: props.autoStart, microphoneMode: props.microphoneMode })}
      </div>
    );
  });
  return { ManagedAvatarSession: MockManagedAvatarSession };
});

vi.mock("../TalkingHeadAvatar", () => ({
  TalkingHeadAvatar: () => <div data-testid="talking-head-mock" />,
}));

afterEach(() => {
  managedAvatarSessionSpy.mockReset();
});

function renderStage(overrides: Partial<React.ComponentProps<typeof TutorSessionAvatarStage>> = {}) {
  return render(
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
      speechCue={null}
      timestamps={[]}
      tutorText=""
      {...overrides}
    />
  );
}

// NOTE: order matters — the first two tests assert the managed avatar module
// has not been evaluated yet, so they must run before any managed render.
test("importing the stage module does not load the managed avatar session", () => {
  expect(managedModuleState.loadCount).toBe(0);
});

test("rendering the local avatar path never loads the managed avatar session", () => {
  renderStage({
    avatarId: "nerdy-talkinghead-3d",
    isManagedAvatar: false,
    selectedAvatar: { id: "nerdy-talkinghead-3d", kind: "local", label: "Nerdy Tutor" },
  });

  expect(screen.getByTestId("talking-head-mock")).toBeInTheDocument();
  expect(managedModuleState.loadCount).toBe(0);
});

test("managed session loads on demand, autostarts, and keeps the mic muted", async () => {
  renderStage();

  const managed = await screen.findByTestId("managed-avatar-session-props");
  expect(managedModuleState.loadCount).toBe(1);
  expect(managed).toBeInTheDocument();
  expect(managedAvatarSessionSpy).toHaveBeenCalledWith(expect.objectContaining({
    autoStart: true,
    microphoneMode: "off",
  }));
});

test("managed session receives the imperative handle ref through the lazy boundary", async () => {
  const sessionRef = React.createRef<ManagedAvatarSessionHandle>();
  renderStage({ managedSessionRef: sessionRef });

  await screen.findByTestId("managed-avatar-session-props");
  expect(sessionRef.current).toEqual({ mockHandle: true });
});
