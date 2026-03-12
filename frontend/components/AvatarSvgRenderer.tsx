"use client";

import React, { type CSSProperties } from "react";
import type { AvatarFrame } from "../lib/avatar_contract";
import { resolveSvgAvatar } from "../lib/avatar_svg_registry";

type AvatarSvgRendererProps = {
  assetRef?: string;
  controls?: React.ReactNode;
  frame: AvatarFrame;
  historyToggle?: React.ReactNode;
  subtitle?: string;
  title?: string;
  variant?: "panel" | "hero" | "gallery";
};

export function AvatarSvgRenderer({
  assetRef,
  controls,
  frame,
  historyToggle,
  subtitle = "",
  title = "Avatar",
  variant = "panel",
}: AvatarSvgRendererProps) {
  const avatar = resolveSvgAvatar(assetRef);
  const SvgAvatar = avatar.component;
  const size = variant === "hero" ? 260 : variant === "gallery" ? 150 : 190;
  const outerStyle: CSSProperties = {
    background: avatar.panel,
    border: `1px solid ${avatar.border}`,
  };
  const stageStyle: CSSProperties = {
    alignItems: "center",
    background: `${avatar.stage}, radial-gradient(circle at 50% 28%, ${avatar.halo} 0%, transparent 52%)`,
    display: "flex",
    flexDirection: "column",
    gap: "0.85rem",
    justifyContent: "center",
    height: variant === "gallery" ? "100%" : undefined,
    minHeight: variant === "hero" ? "25rem" : variant === "gallery" ? "100%" : "18rem",
    overflow: "hidden",
    padding: variant === "hero" ? "2.25rem 1.5rem 1.75rem" : variant === "gallery" ? "0.9rem 0.75rem 0.75rem" : "1.5rem 1rem 1.25rem",
    position: "relative",
  };
  const chipStyle: CSSProperties = {
    border: `1px solid ${avatar.border}`,
    borderRadius: "999px",
    color: avatar.accent,
    fontSize: "0.7rem",
    fontWeight: 700,
    letterSpacing: "0.06em",
    padding: "0.25rem 0.6rem",
    textTransform: "uppercase",
  };
  const captionStyle: CSSProperties = {
    color: "rgba(228, 231, 236, 0.82)",
    fontSize: "0.88rem",
    margin: 0,
    textAlign: "center",
  };
  const subtitleStyle: CSSProperties = {
    color: "rgba(154, 163, 179, 0.95)",
    fontSize: variant === "hero" ? "0.95rem" : "0.82rem",
    margin: 0,
    textAlign: "center",
  };

  const content = (
    <div style={stageStyle}>
      <div style={chipStyle}>{avatar.childLabel}</div>
      <SvgAvatar mouthOpen={frame.mouthOpen} size={size} state={frame.state} title={avatar.label} />
      {variant === "panel" ? <p style={captionStyle}>{frame.caption}</p> : null}
      {subtitle ? (
        <p data-testid="avatar-subtitle" style={subtitleStyle}>
          {subtitle}
        </p>
      ) : null}
    </div>
  );

  if (variant === "hero" || variant === "gallery") {
    return (
      <div className={`avatar-surface avatar-surface--${variant}`} data-testid="avatar-surface-2d" style={outerStyle}>
        {content}
      </div>
    );
  }

  return (
    <div className="panel avatar-panel" data-testid="avatar-surface-2d" style={outerStyle}>
      <div className="panel__header avatar-panel__header">
        <div className="avatar-panel__meta">
          <h3>{title}</h3>
        </div>
        <div className="avatar-panel__actions">
          {controls}
          {historyToggle}
        </div>
      </div>
      {content}
    </div>
  );
}
