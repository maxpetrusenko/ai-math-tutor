import { resolveAvatarProvider } from "../components/avatar_registry";

type AvatarPersona = {
  label: string;
  prompt: string;
};

const PERSONAS: Record<string, AvatarPersona> = {
  "nerdy-talkinghead-3d": {
    label: "Nerdy Tutor",
    prompt: "Sound warm, patient, and confidence-building. Explain clearly, slow down for uncertainty, and make it feel safe to be wrong.",
  },
};

const FALLBACK_PERSONA: AvatarPersona = {
  label: "Tutor",
  prompt: "Sound encouraging, concise, and Socratic. Keep spoken responses short and forward-moving.",
};

export function resolveAvatarPersona(providerId: string): AvatarPersona {
  const preset = PERSONAS[providerId];
  if (preset) {
    return preset;
  }

  const avatar = resolveAvatarProvider(providerId);
  return {
    label: avatar.label,
    prompt: FALLBACK_PERSONA.prompt,
  };
}
