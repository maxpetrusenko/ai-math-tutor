"use client";

import React, { useEffect, useMemo, useState } from "react";

import { AvatarProvider } from "../../components/AvatarProvider";
import { DashboardLayout } from "../../components/layout";
import { OptionPillRow } from "../../components/ui/OptionPillRow";
import { PageHeader } from "../../components/ui/PageHeader";
import {
  listAvatarProvidersForMode,
  resolveAvatarProvider,
  resolveAvatarMode,
  resolveDefaultAvatarProviderId,
  type AvatarRenderMode,
} from "../../components/avatar_registry";
import { readAvatarProviderPreference, writeAvatarProviderPreference } from "../../lib/avatar_preference";

const PREVIEW_GREETING = "Hello, ready to learn?";
const PREVIEW_LOOP_MS = 1600;
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
  const [hoveredAvatarId, setHoveredAvatarId] = useState<string | null>(null);
  const [previewNowMs, setPreviewNowMs] = useState(0);
  const [selectedMode, setSelectedMode] = useState<AvatarRenderMode>(() => resolveAvatarMode(selectedAvatarId));
  const avatarOptions = useMemo(() => listAvatarProvidersForMode(selectedMode), [selectedMode]);
  const safeSelectedAvatarId = avatarOptions.some((avatar) => avatar.id === selectedAvatarId)
    ? selectedAvatarId
    : resolveDefaultAvatarProviderId(selectedMode);

  useEffect(() => {
    const startedAt = performance.now();
    const interval = window.setInterval(() => {
      setPreviewNowMs(Math.floor((performance.now() - startedAt) % PREVIEW_LOOP_MS));
    }, 90);

    return () => window.clearInterval(interval);
  }, []);

  const handleSelectAvatar = (avatarId: string) => {
    setSelectedAvatarId(avatarId);
    writeAvatarProviderPreference(avatarId);
  };

  const handleModeChange = (mode: string) => {
    const nextMode = mode as AvatarRenderMode;
    setSelectedMode(nextMode);
    const nextId = resolveDefaultAvatarProviderId(nextMode);
    setSelectedAvatarId(nextId);
    setHoveredAvatarId(null);
    writeAvatarProviderPreference(nextId);
  };

  const isPreviewTalking = (avatarId: string) => safeSelectedAvatarId === avatarId || hoveredAvatarId === avatarId;

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
              aria-label={avatar.label}
              className={`avatar-option ${
                safeSelectedAvatarId === avatar.id ? "avatar-option--selected" : ""
              }`}
              onBlur={() => setHoveredAvatarId((current) => (current === avatar.id ? null : current))}
              onClick={() => handleSelectAvatar(avatar.id)}
              onFocus={() => setHoveredAvatarId(avatar.id)}
              onMouseEnter={() => setHoveredAvatarId(avatar.id)}
              onMouseLeave={() => setHoveredAvatarId((current) => (current === avatar.id ? null : current))}
              type="button"
            >
              <div className="avatar-option__preview avatar-option__preview--padded">
                <AvatarProvider
                  avatarId={avatar.id}
                  energy={isPreviewTalking(avatar.id) ? 0.72 : 0.18}
                  nowMs={isPreviewTalking(avatar.id) ? previewNowMs : 0}
                  state={isPreviewTalking(avatar.id) ? "speaking" : "idle"}
                  subtitle={isPreviewTalking(avatar.id) ? PREVIEW_GREETING : ""}
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
      </div>
    </DashboardLayout>
  );
}
