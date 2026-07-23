import { resolveAvatarManifestEntry } from "./avatar_manifest";

export type AvatarVoiceConfig = {
  voice?: string;
  voice_id?: string;
};

export function resolveAvatarVoiceConfig(avatarId: string, ttsProvider: string): AvatarVoiceConfig {
  const profile = resolveAvatarManifestEntry(avatarId).voiceProfile;
  if (!profile) {
    return {};
  }

  if (ttsProvider === "cartesia") {
    return { voice_id: profile.cartesiaVoiceId };
  }
  if (ttsProvider === "openai-realtime") {
    return { voice: profile.openAIRealtimeVoice };
  }
  return {};
}
