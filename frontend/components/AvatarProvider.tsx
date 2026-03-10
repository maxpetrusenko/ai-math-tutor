"use client";

import React from "react";
import dynamic from "next/dynamic";
import { AvatarRenderer } from "./AvatarRenderer";
import { resolveAvatarProvider } from "./avatar_registry";
import type { AvatarConfig, AvatarSignal, AvatarVisualState, WordTimestamp } from "../lib/avatar_contract";
import { buildAvatarFrame } from "../lib/avatar_driver";

// Lazy-load 3D avatar only when needed - avoids Three.js bundle cost for 2D default
const Avatar3D = dynamic(() => import("./Avatar3D").then((m) => ({ default: m.Avatar3D })), {
  ssr: false,
  loading: () => (
    <div className="panel avatar-panel" data-testid="avatar-surface-3d-loading">
      <div className="panel__header">
        <h3>Avatar (3D)</h3>
        <span className="status-pill">loading...</span>
      </div>
      <div style={{ width: "100%", height: "100%", minHeight: "300px", display: "flex", alignItems: "center", justifyContent: "center" }}>
        Loading 3D avatar...
      </div>
    </div>
  ),
});

type AvatarProviderProps = {
  config?: AvatarConfig;
  energy: number;
  state: AvatarVisualState;
  timestamps: WordTimestamp[];
  nowMs: number;
};

export function AvatarProvider({
  config,
  energy,
  state,
  timestamps,
  nowMs,
}: AvatarProviderProps) {
  const signal: AvatarSignal = { energy, nowMs, state, timestamps };
  const avatarConfig: AvatarConfig = config ?? resolveAvatarProvider().config;

  if (avatarConfig.type === "3d") {
    // Map "fading" to "speaking" for 3D avatar since it doesn't have fading state
    const mappedState: Exclude<AvatarVisualState, "fading"> = state === "fading" ? "speaking" : state;

    return (
      <div className="panel avatar-panel" data-testid="avatar-surface-3d">
        <div className="panel__header">
          <h3>Avatar (3D)</h3>
          <span className="status-pill">{state}</span>
        </div>
        <Avatar3D
          config={avatarConfig}
          state={mappedState}
          timestamps={timestamps}
          nowMs={nowMs}
          energy={energy}
        />
      </div>
    );
  }

  // Fall back to 2D CSS avatar
  return <AvatarRenderer frame={buildAvatarFrame(signal)} />;
}
