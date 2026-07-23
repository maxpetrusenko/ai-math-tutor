"use client";

import React from "react";
import { TalkingHeadAvatar } from "./TalkingHeadAvatar";
import { resolveAvatarProvider, resolveAvatarProviderId } from "./avatar_registry";
import type { AvatarConfig, AvatarSignal, AvatarSpeechCue, AvatarVisualState, WordTimestamp } from "../lib/avatar_contract";
import { buildAvatarFrame } from "../lib/avatar_driver";

type AvatarProviderProps = {
  audioEnergy?: number;
  avatarId?: string;
  config?: AvatarConfig;
  controls?: React.ReactNode;
  energy: number;
  historyToggle?: React.ReactNode;
  state: AvatarVisualState;
  speechCue?: AvatarSpeechCue | null;
  subtitle?: string;
  timestamps: WordTimestamp[];
  nowMs: number;
  variant?: "panel" | "hero" | "gallery";
};

export function AvatarProvider({
  audioEnergy,
  avatarId,
  config,
  controls,
  energy,
  historyToggle,
  state,
  speechCue,
  subtitle = "",
  timestamps,
  nowMs,
  variant = "panel",
}: AvatarProviderProps) {
  const signal: AvatarSignal = { audioEnergy, energy, nowMs, state, timestamps };
  const resolvedAvatarId = avatarId ?? (config ? resolveAvatarProviderId(config) : undefined);
  const avatarOption = resolveAvatarProvider(resolvedAvatarId);
  const requestedConfig: AvatarConfig = config ?? avatarOption.config;
  const avatarConfig: AvatarConfig = avatarOption.kind === "managed" ? requestedConfig : avatarOption.config;
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

  return (
    <div
      className={`avatar-surface avatar-surface--talkinghead avatar-surface--${variant}`}
      data-testid="avatar-surface-talkinghead"
    >
      {variant === "panel" ? (
        <div className="avatar-surface__header">
          <h3 className="avatar-surface__title">{avatarOption.label}</h3>
          <div className="avatar-surface__actions">
            {controls}
            {historyToggle}
          </div>
        </div>
      ) : null}
      <div className="avatar avatar--talkinghead">
        <TalkingHeadAvatar
          frame={frame}
          modelUrl={avatarConfig.model_url ?? "/avatars/nerdy-tutor.glb?v=7a05c998"}
          speechCue={speechCue}
          variant={variant}
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
