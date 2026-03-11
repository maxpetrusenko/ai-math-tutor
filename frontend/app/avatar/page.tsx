"use client";

import React, { useState } from "react";
import { DashboardLayout } from "../../components/layout";
import { writeAvatarProviderPreference } from "../../lib/avatar_preference";
import {
  resolveDefaultAvatarProviderId,
} from "../../components/avatar_registry";

type AvatarStyle = "2d" | "3d" | "cartoon" | "robot";

const avatarOptions: Array<{
  id: string;
  name: string;
  type: AvatarStyle;
  emoji: string;
}> = [
  { id: "2d-fallback", name: "2D Friendly", type: "2d", emoji: "😊" },
  { id: "3d-fallback", name: "3D Character", type: "3d", emoji: "🎭" },
  { id: "cartoon", name: "Cartoon", type: "cartoon", emoji: "🎨" },
  { id: "robot", name: "Robot", type: "robot", emoji: "🤖" },
];

export default function AvatarPage() {
  const [selectedAvatar, setSelectedAvatar] = useState<string>("2d-fallback");

  const handleSelectAvatar = (avatarId: string) => {
    setSelectedAvatar(avatarId);
    writeAvatarProviderPreference(avatarId);
  };

  return (
    <DashboardLayout>
      <div style={{ padding: 0 }}>
        <div style={{ marginBottom: "32px" }}>
          <h1 style={{ fontSize: "1.8rem", fontWeight: 700, marginBottom: "8px" }}>
            Choose Your Avatar
          </h1>
          <p style={{ color: "var(--ink-dim)" }}>
            Pick a style that makes learning fun for you!
          </p>
        </div>

        <div className="avatar-gallery">
          {avatarOptions.map((avatar) => (
            <button
              key={avatar.id}
              className={`avatar-option ${
                selectedAvatar === avatar.id ? "avatar-option--selected" : ""
              }`}
              onClick={() => handleSelectAvatar(avatar.id)}
            >
              <div className="avatar-option__preview">
                <span style={{ fontSize: "48px" }}>{avatar.emoji}</span>
              </div>
              <div className="avatar-option__name">{avatar.name}</div>
              <div className="avatar-option__type">{avatar.type}</div>
              {selectedAvatar === avatar.id && (
                <div
                  style={{
                    marginTop: "8px",
                    color: "var(--accent)",
                    fontSize: "0.85rem",
                    fontWeight: 500,
                  }}
                >
                  ✓ Selected
                </div>
              )}
            </button>
          ))}
        </div>

        <div
          style={{
            marginTop: "32px",
            padding: "20px",
            background: "var(--bg-elevated)",
            border: "1px solid var(--line)",
            borderRadius: "16px",
          }}
        >
          <h3 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "8px" }}>
            Tips for choosing an avatar
          </h3>
          <ul
            style={{
              color: "var(--ink-dim)",
              fontSize: "0.9rem",
              lineHeight: 1.6,
              paddingLeft: "20px",
            }}
          >
            <li>2D avatars are simple and load quickly</li>
            <li>3D avatars are more interactive and expressive</li>
            <li>Cartoon style is fun and friendly for younger students</li>
            <li>Robot style is great for science and tech topics</li>
          </ul>
        </div>
      </div>
    </DashboardLayout>
  );
}
