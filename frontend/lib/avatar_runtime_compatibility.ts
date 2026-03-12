import { resolveAvatarManifestEntry } from "./avatar_manifest";
import {
  normalizeRuntimeSelection,
  OPENAI_REALTIME_PROVIDER,
  OPENAI_REALTIME_MODEL,
  type RuntimeSelection,
} from "./runtime_options";

export type RuntimeCompatibilityMode = "flexible" | "realtime-only";

export type RuntimeCompatibilityPolicy = {
  avatarId: string;
  avatarLabel: string;
  compatibleLlmProviders: string[];
  compatibleTtsProviders: string[];
  mode: RuntimeCompatibilityMode;
  reason?: string;
};

const FULL_REALTIME_SELECTION: RuntimeSelection = {
  llmModel: OPENAI_REALTIME_MODEL,
  llmProvider: OPENAI_REALTIME_PROVIDER,
  ttsModel: OPENAI_REALTIME_MODEL,
  ttsProvider: OPENAI_REALTIME_PROVIDER,
};

function isSplitRealtimeSelection(selection: RuntimeSelection) {
  const usesRealtimeLlm = selection.llmProvider === OPENAI_REALTIME_PROVIDER;
  const usesRealtimeTts = selection.ttsProvider === OPENAI_REALTIME_PROVIDER;
  return usesRealtimeLlm !== usesRealtimeTts;
}

export function resolveRuntimeCompatibilityPolicy(avatarProviderId: string): RuntimeCompatibilityPolicy {
  const avatar = resolveAvatarManifestEntry(avatarProviderId);
  if (avatar.kind === "managed") {
    return {
      avatarId: avatar.id,
      avatarLabel: avatar.label,
      compatibleLlmProviders: [OPENAI_REALTIME_PROVIDER],
      compatibleTtsProviders: [OPENAI_REALTIME_PROVIDER],
      mode: "realtime-only",
      reason: `${avatar.label} uses the realtime conversation stack.`,
    };
  }

  return {
    avatarId: avatar.id,
    avatarLabel: avatar.label,
    compatibleLlmProviders: ["gemini", "minimax", "openai", OPENAI_REALTIME_PROVIDER],
    compatibleTtsProviders: ["cartesia", "minimax", OPENAI_REALTIME_PROVIDER],
    mode: "flexible",
  };
}

export function resolveCompatibleRuntimeSelectionForAvatar(
  avatarProviderId: string,
  selection: RuntimeSelection,
) {
  const policy = resolveRuntimeCompatibilityPolicy(avatarProviderId);
  const normalized = normalizeRuntimeSelection(selection);
  const adjustedSelection =
    policy.mode === "realtime-only" || isSplitRealtimeSelection(normalized)
      ? FULL_REALTIME_SELECTION
      : normalized;

  return {
    policy,
    selection: adjustedSelection,
    wasAdjusted:
      adjustedSelection.llmProvider !== normalized.llmProvider
      || adjustedSelection.llmModel !== normalized.llmModel
      || adjustedSelection.ttsProvider !== normalized.ttsProvider
      || adjustedSelection.ttsModel !== normalized.ttsModel,
  };
}
