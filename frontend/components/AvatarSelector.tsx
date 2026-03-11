"use client";

import React from "react";

import {
  listAvatarProvidersForMode,
  type AvatarProviderOption,
} from "./avatar_registry";
import type { AvatarMode } from "../lib/avatar_manifest";

type AvatarSelectorProps = {
  selectedMode: AvatarMode;
  selectedAvatarId: string;
  onModeChange: (mode: AvatarMode) => void;
  onAvatarChange: (avatarId: string) => void;
};

const MODE_DESCRIPTIONS: Record<AvatarMode, string> = {
  "2d": "Fast default for lesson work and demo rehearsal",
  "3d": "Lazy-loaded Three.js view for richer presentation",
};

export function AvatarSelector({
  selectedMode,
  selectedAvatarId,
  onModeChange,
  onAvatarChange,
}: AvatarSelectorProps) {
  const modeOptions: Array<{ value: AvatarMode; label: string }> = [
    { value: "2d", label: "2D" },
    { value: "3d", label: "3D" },
  ];
  const avatarOptions: AvatarProviderOption[] = listAvatarProvidersForMode(selectedMode);
  const selectedAvatar = avatarOptions.find((a) => a.id === selectedAvatarId);

  return (
    <div className="avatar-selector" data-testid="avatar-selector">
      <label className="field">
        <span>Render mode</span>
        <select
          aria-label="Render mode"
          className="avatar-selector__mode-select"
          onChange={(event) => onModeChange(event.target.value as AvatarMode)}
          value={selectedMode}
        >
          {modeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <small className="field-hint">{MODE_DESCRIPTIONS[selectedMode]}</small>
      </label>

      <label className="field">
        <span>Avatar</span>
        <select
          aria-label="Avatar"
          onChange={(event) => onAvatarChange(event.target.value)}
          value={selectedAvatarId}
        >
          {avatarOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
        {selectedAvatar?.description && (
          <small className="field-hint">{selectedAvatar.description}</small>
        )}
      </label>
    </div>
  );
}
