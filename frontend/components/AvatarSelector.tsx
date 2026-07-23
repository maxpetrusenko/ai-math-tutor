"use client";

import React from "react";

import {
  listSelectableAvatarProviders,
  type AvatarProviderOption,
} from "./avatar_registry";

type AvatarSelectorProps = {
  selectedAvatarId: string;
  onAvatarChange: (avatarId: string) => void;
};

export function AvatarSelector({
  selectedAvatarId,
  onAvatarChange,
}: AvatarSelectorProps) {
  const avatarOptions: AvatarProviderOption[] = listSelectableAvatarProviders();
  const selectedAvatar = avatarOptions.find((a) => a.id === selectedAvatarId);

  return (
    <div className="avatar-selector" data-testid="avatar-selector">
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
