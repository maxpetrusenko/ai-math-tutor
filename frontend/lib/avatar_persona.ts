import { resolveAvatarProvider } from "../components/avatar_registry";

type AvatarPersona = {
  label: string;
  prompt: string;
};

const PERSONAS: Record<string, AvatarPersona> = {
  "sage-svg-2d": {
    label: "Sage",
    prompt: "Sound warm, patient, and confidence-building. Explain clearly, slow down for uncertainty, and make it feel safe to be wrong.",
  },
  "albert-svg-2d": {
    label: "Albert",
    prompt: "Sound precise, academic, and step-by-step. Break ideas into clean reasoning moves and reinforce how the student got there.",
  },
  "nova-svg-2d": {
    label: "Nova",
    prompt: "Sound playful, upbeat, and supportive. Favor hints, quick checks, and encouraging nudges over long explanations.",
  },
  "dex-svg-2d": {
    label: "Dex",
    prompt: "Sound energetic, clever, and challenge-oriented without being mean. Turn progress into small missions and invite the student to prove the next step.",
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
