"use client";

import React from "react";
import dynamic from "next/dynamic";
import { AvatarRenderer } from "./AvatarRenderer";
import { AvatarSvgRenderer } from "./AvatarSvgRenderer";
import { resolveAvatarProvider, resolveAvatarProviderId } from "./avatar_registry";
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

type Avatar3DLoadBoundaryProps = {
  children: React.ReactNode;
  fallback: React.ReactNode;
};

type Avatar3DLoadBoundaryState = {
  hasError: boolean;
};

class Avatar3DLoadBoundary extends React.Component<Avatar3DLoadBoundaryProps, Avatar3DLoadBoundaryState> {
  state: Avatar3DLoadBoundaryState = {
    hasError: false,
  };

  static getDerivedStateFromError(): Avatar3DLoadBoundaryState {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

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
  variant?: "panel" | "hero" | "gallery";
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
  const [failed3DAvatarKey, setFailed3DAvatarKey] = React.useState<string | null>(null);
  const signal: AvatarSignal = { energy, nowMs, state, timestamps };
  const resolvedAvatarId = avatarId ?? (config ? resolveAvatarProviderId(config) : undefined);
  const avatarOption = resolveAvatarProvider(resolvedAvatarId);
  const avatarConfig: AvatarConfig = config ?? avatarOption.config;
  const frame = buildAvatarFrame(signal);
  const managedPreviewGreeting = subtitle || avatarOption.previewGreeting || "";

  if (avatarConfig.type === "video" || avatarOption.kind === "managed") {
    if (variant === "gallery") {
      return (
        <div
          className="avatar-surface avatar-surface--managed avatar-surface--gallery avatar-surface--managed-gallery"
          data-testid="avatar-surface-managed"
        >
          <div className="avatar avatar--managed-gallery">
            {avatarOption.previewVideoUrl ? (
              <div className="avatar__managed-gallery-card avatar__managed-gallery-card--video">
                <video
                  aria-hidden="true"
                  autoPlay
                  className="avatar__managed-gallery-video"
                  loop
                  muted
                  playsInline
                  poster={avatarOption.previewPosterUrl}
                  preload="metadata"
                >
                  <source src={avatarOption.previewVideoUrl} type="video/mp4" />
                </video>
                {managedPreviewGreeting ? (
                  <div className="avatar__managed-gallery-subtitle" data-testid="avatar-subtitle">
                    {managedPreviewGreeting}
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="avatar__managed-gallery-card">
                <div className="avatar__managed-gallery-orb" />
                {managedPreviewGreeting ? (
                  <div className="avatar__managed-gallery-subtitle" data-testid="avatar-subtitle">
                    {managedPreviewGreeting}
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>
      );
    }

    return (
      <div className={`avatar-surface avatar-surface--managed avatar-surface--${variant}`} data-testid="avatar-surface-managed">
        <div className="avatar avatar--managed">
          <div className="avatar__managed-card">
            {avatarOption.previewVideoUrl ? (
              <video
                aria-hidden="true"
                autoPlay
                className="avatar__managed-preview-video"
                loop
                muted
                playsInline
                poster={avatarOption.previewPosterUrl}
                preload="metadata"
              >
                <source src={avatarOption.previewVideoUrl} type="video/mp4" />
              </video>
            ) : null}
            {managedPreviewGreeting ? (
              <div className="avatar__subtitle" data-testid="avatar-subtitle">
                {managedPreviewGreeting}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  if (avatarConfig.provider === "svg") {
    return (
      <AvatarSvgRenderer
        assetRef={avatarConfig.assetRef}
        controls={variant === "hero" || variant === "gallery" ? null : controls}
        frame={frame}
        historyToggle={variant === "hero" || variant === "gallery" ? null : historyToggle}
        subtitle={subtitle}
        title={variant === "panel" ? avatarOption.label : ""}
        variant={variant}
      />
    );
  }

  const avatarAsset = loadAvatarAsset(avatarConfig);

  const avatar2DAsset = (
    avatarAsset.mode === "2d" ? avatarAsset : loadAvatarAsset({ type: "2d", assetRef: avatarConfig.assetRef ?? "human" })
  ) as Avatar2DAsset;

  const avatar2DFallback = (
    <AvatarRenderer
      asset={avatar2DAsset}
      controls={variant === "hero" || variant === "gallery" ? null : controls}
      frame={frame}
      historyToggle={variant === "hero" || variant === "gallery" ? null : historyToggle}
      subtitle={subtitle}
      title={variant === "panel" ? avatarOption.label : ""}
      variant={variant}
    />
  );
  const avatar3DKey = `${avatarConfig.assetRef ?? "default"}:${avatarConfig.model_url ?? "local"}`;

  if (avatarConfig.type === "3d" && failed3DAvatarKey !== avatar3DKey) {
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
          <Avatar3DLoadBoundary
            key={avatar3DKey}
            fallback={avatar2DFallback}
          >
            <>
              <Avatar3D
                asset={avatar3DAsset}
                config={avatarConfig}
                onError={() => setFailed3DAvatarKey(avatar3DKey)}
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
            </>
          </Avatar3DLoadBoundary>
        </div>
      </div>
    );
  }

  return avatar2DFallback;
}
