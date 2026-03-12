"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";

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

const PREVIEW_GREETING = "Hello, ready to learn?";
const PREVIEW_TIMESTAMPS = [
  { endMs: 140, startMs: 0, word: "Hello" },
  { endMs: 260, startMs: 150, word: "ready" },
  { endMs: 360, startMs: 270, word: "to" },
  { endMs: 520, startMs: 370, word: "learn" },
];

function getAvatarPickerCopy(bestFor?: string, description?: string) {
  if (bestFor) {
    return bestFor[0].toUpperCase() + bestFor.slice(1);
  }
  return description ?? "";
}

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
  const selectedAvatarSummary = selectedAvatar.description ?? "";

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
              <div className="avatar-option__preview avatar-option__preview--padded">
                <AvatarProvider
                  avatarId={avatar.id}
                  energy={0.6}
                  nowMs={220}
                  state="speaking"
                  timestamps={PREVIEW_TIMESTAMPS}
                  variant="gallery"
                />
              </div>
              <div className="avatar-option__name">{avatar.label}</div>
              <p className="row-card__copy avatar-option__copy">
                {getAvatarPickerCopy(avatar.bestFor, avatar.description)}
              </p>
            </button>
          ))}
        </div>

        <div className="avatar-page__detail-grid">
          <SurfaceCard className="surface-card--soft avatar-spotlight">
            <div className="avatar-spotlight__header">
              <div>
                <div className="section-title">{selectedAvatar.label}</div>
                <p className="section-copy section-copy--top-sm">
                  {selectedAvatar.persona ?? selectedAvatar.description}
                </p>
              </div>
              <Link className="primary-button" href="/session">
                Start session
              </Link>
            </div>
            {selectedAvatar.kind === "managed" ? (
              <div className="avatar-spotlight__local-preview">
                <AvatarProvider
                  avatarId={selectedAvatar.id}
                  energy={0.6}
                  nowMs={220}
                  state="speaking"
                  timestamps={PREVIEW_TIMESTAMPS}
                  variant="gallery"
                />
              </div>
            ) : (
              <div className="avatar-spotlight__local-preview">
                <AvatarProvider
                  avatarId={selectedAvatar.id}
                  energy={0.6}
                  nowMs={220}
                  state="speaking"
                  subtitle={PREVIEW_GREETING}
                  timestamps={PREVIEW_TIMESTAMPS}
                  variant="hero"
                />
              </div>
            )}
            <div className="avatar-spotlight__footer">
              <div className="avatar-spotlight__summary">
                {selectedAvatar.kind === "managed"
                  ? "Opens as a live camera stage in the tutor session."
                  : selectedAvatarSummary}
              </div>
            </div>
          </SurfaceCard>
        </div>
      </div>
    </DashboardLayout>
  );
}
