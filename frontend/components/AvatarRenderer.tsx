"use client";

import React from "react";
import type { CSSProperties } from "react";
import type { AvatarFrame } from "../lib/avatar_contract";

type AvatarRendererProps = {
  frame: AvatarFrame;
};

export function AvatarRenderer({ frame }: AvatarRendererProps) {
  return (
    <div className="panel avatar-panel" data-testid="avatar-surface-2d">
      <div className="panel__header">
        <h3>Avatar</h3>
        <span className="status-pill">{frame.state}</span>
      </div>
      <div className={`avatar avatar--${frame.state}`} data-state={frame.state}>
        <div className="avatar__stage">
          <div className="avatar__halo" />
          <div className="avatar__head">
            <div className="avatar__brow" />
            <div className="avatar__eyes">
              <span className="avatar__eye" />
              <span className="avatar__eye" />
            </div>
            <div className="avatar__cheeks" />
            <div className="avatar__mouth-wrap">
              <div
                data-open={frame.mouthOpen.toFixed(2)}
                data-testid="avatar-mouth"
                className="avatar__mouth"
                style={{ "--mouth-open": frame.mouthOpen.toFixed(3) } as CSSProperties}
              />
            </div>
          </div>
          <p className="avatar__caption">{frame.caption}</p>
        </div>
      </div>
    </div>
  );
}
