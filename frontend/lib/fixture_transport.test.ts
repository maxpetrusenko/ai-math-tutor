import { describe, expect, test } from "vitest";

import { createFixtureTransport } from "./fixture_transport";

describe("fixture transport", () => {
  test("returns deterministic text-only lesson results without live providers", async () => {
    const transport = createFixtureTransport({
      avatarId: "banana-css-2d",
    });

    await expect(transport.connect()).resolves.toBe("connected");

    await expect(
      transport.runTurn({
        studentText: "I don't get fractions.",
        subject: "math",
        gradeBand: "6-8",
        audioChunks: [],
      })
    ).resolves.toMatchObject({
      transcript: "I don't get fractions.",
      tutorText: expect.stringContaining("fraction"),
      state: "speaking",
      avatarConfig: {
        assetRef: "banana",
        provider: "css",
        type: "2d",
      },
    });
  });

  test("reset restarts the scripted lesson flow from turn one", async () => {
    const transport = createFixtureTransport({
      scenarioId: "guided-fractions",
      avatarId: "human-threejs-3d",
    });

    const firstTurn = await transport.runTurn({
      studentText: "I need help with fractions.",
      subject: "math",
      gradeBand: "6-8",
      audioChunks: [],
    });
    const followUpTurn = await transport.runTurn({
      studentText: "So I multiply first?",
      subject: "math",
      gradeBand: "6-8",
      audioChunks: [],
    });

    if (!transport.reset) {
      throw new Error("transport.reset is not implemented");
    }

    await transport.reset();

    const afterResetTurn = await transport.runTurn({
      studentText: "Fresh start please.",
      subject: "math",
      gradeBand: "6-8",
      audioChunks: [],
    });

    expect(firstTurn.tutorText).not.toEqual(followUpTurn.tutorText);
    expect(afterResetTurn.tutorText).toEqual(firstTurn.tutorText);
    expect(afterResetTurn.avatarConfig).toMatchObject({
      assetRef: "human",
      provider: "threejs",
      type: "3d",
    });
  });
});
