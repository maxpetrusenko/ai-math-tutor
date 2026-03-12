"use client";

import React from "react";
import type { CSSProperties } from "react";
import type { Avatar2DAsset } from "../lib/avatar_asset_loader";
import type { AvatarFrame } from "../lib/avatar_contract";

type AvatarRendererProps = {
  asset: Avatar2DAsset;
  frame: AvatarFrame;
  title?: string;
  controls?: React.ReactNode;
  historyToggle?: React.ReactNode;
  subtitle?: string;
  variant?: "panel" | "hero" | "gallery";
};

export function AvatarRenderer({
  asset,
  frame,
  title = "Avatar",
  controls,
  historyToggle,
  subtitle = "",
  variant = "panel",
}: AvatarRendererProps) {
  const theme = {
    "--avatar-accent": asset.appearance.accent,
    "--avatar-accent-soft": asset.appearance.accentSoft,
    "--avatar-halo": asset.appearance.halo,
    "--avatar-head": asset.appearance.head,
    "--avatar-mouth-color": asset.appearance.mouth,
    "--avatar-panel": asset.appearance.panel,
  } as CSSProperties;
  const eyeStyle =
    asset.appearance.eyeStyle === "visor"
      ? { width: "1.2rem", borderRadius: "999px", background: "var(--avatar-accent-soft)" }
      : undefined;

  const avatarContent = (
    <div className={`avatar avatar--${frame.state}${variant === "hero" ? " avatar--hero" : ""}`} data-state={frame.state} style={theme}>
      <div className="avatar__stage">
        <div className="avatar__halo" style={{ background: "radial-gradient(circle, var(--avatar-halo) 0%, transparent 72%)" }} />
        <div className="avatar__head" style={{ background: "var(--avatar-head)" }}>
          <div className="avatar__brow" />
          <div className="avatar__eyes">
            <span className="avatar__eye" style={eyeStyle} />
            <span className="avatar__eye" style={eyeStyle} />
          </div>
          <div className="avatar__cheeks" />
          <div className="avatar__mouth-wrap">
            <div
              data-open={frame.mouthOpen.toFixed(2)}
              data-testid="avatar-mouth"
              className="avatar__mouth"
              style={{ "--mouth-open": frame.mouthOpen.toFixed(3), background: "var(--avatar-mouth-color)" } as CSSProperties}
            />
          </div>
        </div>
        {variant === "panel" ? <p className="avatar__caption">{frame.caption}</p> : null}
        {subtitle && variant !== "gallery" ? <div className="avatar__subtitle" data-testid="avatar-subtitle">{subtitle}</div> : null}
      </div>
    </div>
  );

  if (variant === "hero" || variant === "gallery") {
    return (
      <div className={`avatar-surface avatar-surface--${variant}`} data-testid="avatar-surface-2d" style={theme}>
        {avatarContent}
      </div>
    );
  }

  return (
    <div className="panel avatar-panel" data-testid="avatar-surface-2d" style={{ background: "var(--avatar-panel)", ...theme }}>
      <div className="panel__header avatar-panel__header">
        <div className="avatar-panel__meta">
          <h3>{title}</h3>
        </div>
        <div className="avatar-panel__actions">
          {controls}
          {historyToggle}
        </div>
      </div>
      {avatarContent}
    </div>
  );
}
