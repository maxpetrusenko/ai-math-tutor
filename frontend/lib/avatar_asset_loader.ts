import type { AvatarConfig } from "./avatar_contract";

export const LOCAL_AVATAR_ASSET_REFS = [
  "banana",
  "apple",
  "human",
  "robot",
  "wizard-school-inspired",
  "yellow-sidekick-inspired",
] as const;

type AvatarAssetRef = (typeof LOCAL_AVATAR_ASSET_REFS)[number];

type AvatarAssetCommon = {
  assetRef: AvatarAssetRef;
  fallback: boolean;
  label: string;
  mode: "2d" | "3d";
  status: "ready" | "fallback";
};

export type Avatar2DAsset = AvatarAssetCommon & {
  mode: "2d";
  appearance: {
    accent: string;
    accentSoft: string;
    eyeStyle: "round" | "visor";
    halo: string;
    head: string;
    mouth: string;
    panel: string;
    stage: string;
  };
};

export type Avatar3DAsset = AvatarAssetCommon & {
  mode: "3d";
  appearance: {
    accentColor: number;
    accessory: "none" | "banana" | "leaf" | "antenna" | "wizard-hat" | "goggles";
    backgroundColor: number;
    bodyColor: number;
    eyeColor: number;
    floorColor: number;
    headColor: number;
    mouthColor: number;
    pupilColor: number;
    roughness: number;
    metalness: number;
  };
};

export type LoadedAvatarAsset = Avatar2DAsset | Avatar3DAsset;

type Avatar2DAssetMap = Record<Exclude<AvatarAssetRef, "wizard-school-inspired" | "yellow-sidekick-inspired">, Avatar2DAsset>;
type Avatar3DAssetMap = Record<Exclude<AvatarAssetRef, "banana" | "apple">, Avatar3DAsset>;

const TWO_D_ASSETS: Avatar2DAssetMap = {
  banana: {
    assetRef: "banana",
    fallback: false,
    label: "Banana",
    mode: "2d",
    status: "ready",
    appearance: {
      accent: "#f6d84d",
      accentSoft: "#fff3b6",
      eyeStyle: "round",
      halo: "rgba(246, 216, 77, 0.45)",
      head: "#ffe37a",
      mouth: "#8c4b11",
      panel: "linear-gradient(160deg, rgba(58, 42, 4, 0.98), rgba(120, 92, 14, 0.95))",
      stage: "radial-gradient(circle at top, rgba(255, 243, 182, 0.22), transparent 58%)",
    },
  },
  apple: {
    assetRef: "apple",
    fallback: false,
    label: "Apple",
    mode: "2d",
    status: "ready",
    appearance: {
      accent: "#df4c4c",
      accentSoft: "#ffd2c7",
      eyeStyle: "round",
      halo: "rgba(223, 76, 76, 0.36)",
      head: "#ff7f66",
      mouth: "#5e1e1e",
      panel: "linear-gradient(160deg, rgba(77, 18, 18, 0.98), rgba(124, 42, 31, 0.95))",
      stage: "radial-gradient(circle at top, rgba(255, 183, 168, 0.24), transparent 58%)",
    },
  },
  human: {
    assetRef: "human",
    fallback: false,
    label: "Human",
    mode: "2d",
    status: "ready",
    appearance: {
      accent: "#7aa2ff",
      accentSoft: "#dbe5ff",
      eyeStyle: "round",
      halo: "rgba(122, 162, 255, 0.38)",
      head: "#ffd9b0",
      mouth: "#8a3d4b",
      panel: "linear-gradient(160deg, rgba(18, 27, 51, 0.98), rgba(36, 54, 99, 0.95))",
      stage: "radial-gradient(circle at top, rgba(122, 162, 255, 0.2), transparent 58%)",
    },
  },
  robot: {
    assetRef: "robot",
    fallback: false,
    label: "Robot",
    mode: "2d",
    status: "ready",
    appearance: {
      accent: "#67d5ff",
      accentSoft: "#bff3ff",
      eyeStyle: "visor",
      halo: "rgba(103, 213, 255, 0.38)",
      head: "#bfd8e2",
      mouth: "#24445b",
      panel: "linear-gradient(160deg, rgba(9, 28, 38, 0.98), rgba(18, 62, 79, 0.95))",
      stage: "radial-gradient(circle at top, rgba(103, 213, 255, 0.18), transparent 58%)",
    },
  },
};

const THREE_D_ASSETS: Avatar3DAssetMap = {
  human: {
    assetRef: "human",
    fallback: false,
    label: "Human",
    mode: "3d",
    status: "ready",
    appearance: {
      accentColor: 0x7aa2ff,
      accessory: "none",
      backgroundColor: 0x1a1a2e,
      bodyColor: 0x3b82f6,
      eyeColor: 0xffffff,
      floorColor: 0x2a2a4a,
      headColor: 0xffdbac,
      mouthColor: 0xcc6666,
      pupilColor: 0x222222,
      roughness: 0.8,
      metalness: 0.1,
    },
  },
  robot: {
    assetRef: "robot",
    fallback: false,
    label: "Robot",
    mode: "3d",
    status: "ready",
    appearance: {
      accentColor: 0x67d5ff,
      accessory: "antenna",
      backgroundColor: 0x08141d,
      bodyColor: 0x4b6f88,
      eyeColor: 0x9bf7ff,
      floorColor: 0x102636,
      headColor: 0xbfd8e2,
      mouthColor: 0x24445b,
      pupilColor: 0x0e1e2a,
      roughness: 0.45,
      metalness: 0.62,
    },
  },
  "wizard-school-inspired": {
    assetRef: "wizard-school-inspired",
    fallback: false,
    label: "Wizard School Inspired",
    mode: "3d",
    status: "ready",
    appearance: {
      accentColor: 0xf8d66d,
      accessory: "wizard-hat",
      backgroundColor: 0x141028,
      bodyColor: 0x253a74,
      eyeColor: 0xffffff,
      floorColor: 0x241b42,
      headColor: 0xf1d1ad,
      mouthColor: 0x9e5a61,
      pupilColor: 0x222222,
      roughness: 0.72,
      metalness: 0.12,
    },
  },
  "yellow-sidekick-inspired": {
    assetRef: "yellow-sidekick-inspired",
    fallback: false,
    label: "Yellow Sidekick Inspired",
    mode: "3d",
    status: "ready",
    appearance: {
      accentColor: 0x3656c8,
      accessory: "goggles",
      backgroundColor: 0x281e08,
      bodyColor: 0xf2c84c,
      eyeColor: 0xffffff,
      floorColor: 0x3d2d0b,
      headColor: 0xf3d16a,
      mouthColor: 0x7a3d1e,
      pupilColor: 0x1f1f1f,
      roughness: 0.78,
      metalness: 0.08,
    },
  },
};

const FALLBACK_ASSET_REFS = {
  "2d": "human",
  "3d": "human",
} as const;

function isLocalModelUrl(modelUrl: string | undefined): boolean {
  return !modelUrl || (/^\/avatars\/[a-z0-9-]+\.glb$/).test(modelUrl);
}

export function loadAvatarAsset(config: Pick<AvatarConfig, "type" | "assetRef" | "model_url">): LoadedAvatarAsset {
  if (config.type === "2d") {
    const asset = config.assetRef ? TWO_D_ASSETS[config.assetRef as keyof Avatar2DAssetMap] : undefined;
    if (asset) {
      return asset;
    }

    return {
      ...TWO_D_ASSETS[FALLBACK_ASSET_REFS["2d"]],
      fallback: true,
      status: "fallback",
    };
  }

  const asset = config.assetRef ? THREE_D_ASSETS[config.assetRef as keyof Avatar3DAssetMap] : undefined;
  if (asset && isLocalModelUrl(config.model_url)) {
    return asset;
  }

  return {
    ...THREE_D_ASSETS[FALLBACK_ASSET_REFS["3d"]],
    fallback: true,
    status: "fallback",
  };
}
