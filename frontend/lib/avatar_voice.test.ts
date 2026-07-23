import { resolveAvatarVoiceConfig } from "./avatar_voice";

test("pins the local tutor to stable provider voices", () => {
  expect(resolveAvatarVoiceConfig("nerdy-talkinghead-3d", "cartesia")).toEqual({
    voice_id: "db6b0ed5-d5d3-463d-ae85-518a07d3c2b4",
  });
  expect(resolveAvatarVoiceConfig("nerdy-talkinghead-3d", "openai-realtime")).toEqual({
    voice: "marin",
  });
});

test("legacy local avatar ids inherit the replacement tutor voice", () => {
  expect(resolveAvatarVoiceConfig("sage-svg-2d", "cartesia")).toEqual({
    voice_id: "db6b0ed5-d5d3-463d-ae85-518a07d3c2b4",
  });
});
