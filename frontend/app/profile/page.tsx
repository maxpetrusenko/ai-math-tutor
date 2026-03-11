"use client";

import React from "react";
import { DashboardLayout } from "../../components/layout";
import { useFirebaseAuth } from "../../lib/firebase_auth";

export default function ProfilePage() {
  const { user } = useFirebaseAuth();

  const getInitials = (name?: string | null, email?: string | null) => {
    if (name) {
      return name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
    }
    if (email) {
      return email[0].toUpperCase();
    }
    return "?";
  };

  return (
    <DashboardLayout>
      <div style={{ padding: 0 }}>
        <div style={{ marginBottom: "32px" }}>
          <h1 style={{ fontSize: "1.8rem", fontWeight: 700, marginBottom: "8px" }}>
            Profile
          </h1>
          <p style={{ color: "var(--ink-dim)" }}>
            Manage your account settings and preferences
          </p>
        </div>

        {/* Profile Header */}
        <div className="profile-page__header">
          <div className="profile-page__avatar">
            {getInitials(user?.displayName, user?.email || undefined)}
          </div>
          <div className="profile-page__info">
            <h1>{user?.displayName || "Student"}</h1>
            <p>{user?.email}</p>
          </div>
        </div>

        {/* Profile Form */}
        <form className="profile-page__form" onSubmit={(e) => e.preventDefault()}>
          <h2 className="profile-page__form-title">Personal Information</h2>

          <div className="profile-page__form-group">
            <label>Display Name</label>
            <input
              type="text"
              defaultValue={user?.displayName ?? ""}
              placeholder="Enter your name"
            />
          </div>

          <div className="profile-page__form-group">
            <label>Email Address</label>
            <input
              type="email"
              defaultValue={user?.email ?? ""}
              placeholder="your@email.com"
            />
          </div>

          <div className="profile-page__form-group">
            <label>Birthday</label>
            <input
              type="date"
              placeholder="Select your birthday"
            />
          </div>

          <div className="profile-page__form-group">
            <label>Grade Level</label>
            <select>
              <option value="">Select your grade</option>
              <option value="K-2">K-2 (Elementary)</option>
              <option value="3-5">3-5 (Elementary)</option>
              <option value="6-8">6-8 (Middle School)</option>
              <option value="9-12">9-12 (High School)</option>
            </select>
          </div>

          <button
            type="submit"
            style={{
              padding: "12px 24px",
              background: "linear-gradient(135deg, var(--accent), var(--secondary))",
              color: "white",
              border: "none",
              borderRadius: "10px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Save Changes
          </button>
        </form>
      </div>
    </DashboardLayout>
  );
}
