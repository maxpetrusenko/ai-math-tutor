import type React from "react";
import { AlbertSvg } from "../components/avatar/svg/AlbertSvg";
import { DexSvg } from "../components/avatar/svg/DexSvg";
import { NovaSvg } from "../components/avatar/svg/NovaSvg";
import { SageSvg } from "../components/avatar/svg/SageSvg";
import type { SvgAvatarProps } from "../components/avatar/svg/types";

export type SvgAvatarAssetRef = "albert" | "dex" | "nova" | "sage";

export type SvgAvatarDefinition = {
  accent: string;
  assetRef: SvgAvatarAssetRef;
  border: string;
  childLabel: string;
  component: React.ComponentType<SvgAvatarProps>;
  halo: string;
  label: string;
  panel: string;
  stage: string;
};

const SVG_AVATARS: Record<SvgAvatarAssetRef, SvgAvatarDefinition> = {
  sage: {
    accent: "#ffd54a",
    assetRef: "sage",
    border: "rgba(47, 95, 227, 0.28)",
    childLabel: "Explain it clearly",
    component: SageSvg,
    halo: "rgba(255, 213, 74, 0.24)",
    label: "Sage",
    panel: "linear-gradient(180deg, rgba(17, 25, 56, 0.98), rgba(11, 16, 38, 0.98))",
    stage: "radial-gradient(circle at top, rgba(47, 95, 227, 0.2), transparent 58%)",
  },
  albert: {
    accent: "#ffd54a",
    assetRef: "albert",
    border: "rgba(53, 92, 222, 0.28)",
    childLabel: "Break it down",
    component: AlbertSvg,
    halo: "rgba(217, 177, 95, 0.2)",
    label: "Albert",
    panel: "linear-gradient(180deg, rgba(20, 28, 60, 0.98), rgba(11, 18, 40, 0.98))",
    stage: "radial-gradient(circle at top, rgba(255, 213, 74, 0.14), transparent 58%)",
  },
  nova: {
    accent: "#3ed6c8",
    assetRef: "nova",
    border: "rgba(62, 214, 200, 0.28)",
    childLabel: "Give me hints",
    component: NovaSvg,
    halo: "rgba(124, 92, 255, 0.18)",
    label: "Nova",
    panel: "linear-gradient(180deg, rgba(12, 24, 33, 0.98), rgba(7, 16, 24, 0.98))",
    stage: "radial-gradient(circle at top, rgba(62, 214, 200, 0.18), transparent 58%)",
  },
  dex: {
    accent: "#c8ff66",
    assetRef: "dex",
    border: "rgba(255, 138, 61, 0.3)",
    childLabel: "Challenge me",
    component: DexSvg,
    halo: "rgba(200, 255, 102, 0.16)",
    label: "Dex",
    panel: "linear-gradient(180deg, rgba(27, 20, 46, 0.98), rgba(15, 11, 28, 0.98))",
    stage: "radial-gradient(circle at top, rgba(255, 138, 61, 0.18), transparent 58%)",
  },
};

export function listSvgAvatars(): SvgAvatarDefinition[] {
  return Object.values(SVG_AVATARS);
}

export function resolveSvgAvatar(assetRef?: string): SvgAvatarDefinition {
  if (!assetRef) {
    return SVG_AVATARS.sage;
  }

  return SVG_AVATARS[assetRef as SvgAvatarAssetRef] ?? SVG_AVATARS.sage;
}
