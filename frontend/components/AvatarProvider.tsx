"use client";

import React from "react";
import dynamic from "next/dynamic";
import { AvatarRenderer } from "./AvatarRenderer";
import { resolveAvatarProvider } from "./avatar_registry";
import {
  loadAvatarAsset,
  type Avatar2DAsset,
  type Avatar3DAsset,
} from "../lib/avatar_asset_loader";
import type { AvatarConfig, AvatarSignal, AvatarVisualState, WordTimestamp } from "../lib/avatar_contract";
import { buildAvatarFrame } from "../lib/avatar_driver";

// Lazy-load 3D avatar only when needed - avoids Three.js bundle cost for 2D default
const Avatar3D = dynamic(() => import("./Avatar3D").then((m) => ({ default: m.Avatar3D })), {
  ssr: false,
  loading: () => (
    <div
      aria-live="polite"
      className="avatar-3d-loading"
      data-testid="avatar-3d-loading"
    >
      Loading 3D avatar...
    </div>
  ),
});

type AvatarProviderProps = {
  avatarId?: string;
  config?: AvatarConfig;
  controls?: React.ReactNode;
  energy: number;
  historyToggle?: React.ReactNode;
  state: AvatarVisualState;
  subtitle?: string;
  timestamps: WordTimestamp[];
  nowMs: number;
  variant?: "panel" | "hero";
};

export function AvatarProvider({
  avatarId,
  config,
  controls,
  energy,
  historyToggle,
  state,
  subtitle = "",
  timestamps,
  nowMs,
  variant = "panel",
}: AvatarProviderProps) {
  const signal: AvatarSignal = { energy, nowMs, state, timestamps };
  const avatarOption = resolveAvatarProvider(avatarId);
  const avatarConfig: AvatarConfig = config ?? avatarOption.config;
  const avatarAsset = loadAvatarAsset(avatarConfig);

  if (avatarConfig.type === "3d") {
    const avatar3DAsset = (
      avatarAsset.mode === "3d" ? avatarAsset : loadAvatarAsset({ type: "3d", assetRef: "human" })
    ) as Avatar3DAsset;
    // Map "fading" to "speaking" for 3D avatar since it doesn't have fading state
    const mappedState: Exclude<AvatarVisualState, "fading"> = state === "fading" ? "speaking" : state;

    return (
      <div className={`avatar-surface avatar-surface--${avatarConfig.type} avatar-surface--${variant}`} data-testid="avatar-surface-3d">
        {variant === "panel" && (
          <div className="avatar-surface__header">
            <h3 className="avatar-surface__title">{avatarOption.label}</h3>
            <div className="avatar-surface__actions">
              {controls}
              {historyToggle}
            </div>
          </div>
        )}
        <div className="avatar avatar--three">
          <Avatar3D
            asset={avatar3DAsset}
            config={avatarConfig}
            state={mappedState}
            timestamps={timestamps}
            nowMs={nowMs}
            energy={energy}
          />
          {subtitle ? (
            <div className="avatar__subtitle" data-testid="avatar-subtitle">
              {subtitle}
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  // Fall back to 2D CSS avatar
  const avatar2DAsset = (
    avatarAsset.mode === "2d" ? avatarAsset : loadAvatarAsset({ type: "2d", assetRef: "human" })
  ) as Avatar2DAsset;

  return (
    <AvatarRenderer
      asset={avatar2DAsset}
      controls={variant === "hero" ? null : controls}
      frame={buildAvatarFrame(signal)}
      historyToggle={variant === "hero" ? null : historyToggle}
      subtitle={subtitle}
      title={variant === "hero" ? "" : avatarOption.label}
      variant={variant}
    />
  );
}
