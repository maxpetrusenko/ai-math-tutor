"use client";

import React, { useMemo, useState } from "react";

import { AvatarProvider } from "../../components/AvatarProvider";
import { DashboardLayout } from "../../components/layout";
import { OptionPillRow } from "../../components/ui/OptionPillRow";
import { PageHeader } from "../../components/ui/PageHeader";
import { SurfaceCard } from "../../components/ui/SurfaceCard";
import {
  listAvatarProvidersForMode,
  resolveAvatarProvider,
  resolveAvatarMode,
  resolveDefaultAvatarProviderId,
  type AvatarRenderMode,
} from "../../components/avatar_registry";
import { readAvatarProviderPreference, writeAvatarProviderPreference } from "../../lib/avatar_preference";

export default function AvatarPage() {
  const [selectedAvatarId, setSelectedAvatarId] = useState<string>(() => {
    const preferredAvatarId = readAvatarProviderPreference();
    return resolveAvatarProvider(preferredAvatarId ?? undefined).id;
  });
  const [selectedMode, setSelectedMode] = useState<AvatarRenderMode>(() => resolveAvatarMode(selectedAvatarId));
  const avatarOptions = useMemo(() => listAvatarProvidersForMode(selectedMode), [selectedMode]);
  const safeSelectedAvatarId = avatarOptions.some((avatar) => avatar.id === selectedAvatarId)
    ? selectedAvatarId
    : resolveDefaultAvatarProviderId(selectedMode);
  const selectedAvatar = resolveAvatarProvider(safeSelectedAvatarId);

  const handleSelectAvatar = (avatarId: string) => {
    setSelectedAvatarId(avatarId);
    writeAvatarProviderPreference(avatarId);
  };

  const handleModeChange = (mode: string) => {
    const nextMode = mode as AvatarRenderMode;
    setSelectedMode(nextMode);
    const nextId = resolveDefaultAvatarProviderId(nextMode);
    setSelectedAvatarId(nextId);
    writeAvatarProviderPreference(nextId);
  };

  return (
    <DashboardLayout>
      <div className="page-shell">
        <PageHeader
          subtitle="Pick the teaching personality and render style for your tutor."
          title="Choose Your Tutor"
        />

        <OptionPillRow
          activeValue={selectedMode}
          ariaLabel="Avatar render mode"
          onSelect={handleModeChange}
          options={[
            { label: "2D tutors", value: "2d" },
            { label: "3D tutors", value: "3d" },
            { label: "Live avatars", value: "live" },
          ]}
        />

        <div className="avatar-gallery">
          {avatarOptions.map((avatar) => (
            <button
              key={avatar.id}
              className={`avatar-option ${
                safeSelectedAvatarId === avatar.id ? "avatar-option--selected" : ""
              }`}
              onClick={() => handleSelectAvatar(avatar.id)}
              type="button"
            >
              <div className="avatar-option__preview" style={{ padding: "12px" }}>
                <AvatarProvider
                  avatarId={avatar.id}
                  energy={0.6}
                  nowMs={90}
                  state="speaking"
                  timestamps={[{ endMs: 180, startMs: 0, word: "hello" }]}
                  variant="gallery"
                />
              </div>
              <div className="avatar-option__name">{avatar.label}</div>
              <div className="avatar-option__type">{avatar.persona}</div>
              <p className="row-card__copy" style={{ marginBottom: 0 }}>{avatar.description}</p>
              <div className="lesson-card__meta" style={{ justifyContent: "center", marginTop: "12px" }}>
                <span>Best for {avatar.bestFor}</span>
              </div>
            </button>
          ))}
        </div>

        <SurfaceCard className="surface-card--soft">
          <div className="section-title">{selectedAvatar.label}</div>
          <p className="section-copy" style={{ marginTop: "8px" }}>
            {selectedAvatar.description} Best for {selectedAvatar.bestFor}.
          </p>
        </SurfaceCard>
      </div>
    </DashboardLayout>
  );
}
