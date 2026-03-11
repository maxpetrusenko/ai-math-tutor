"use client";

import React, { useState } from "react";
import Link from "next/link";

type HeaderProps = {
  sidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
  user?: {
    name?: string;
    email?: string;
    avatar?: string;
  };
};

export function Header({ sidebarCollapsed, onToggleSidebar, user }: HeaderProps) {
  const [showMenu, setShowMenu] = useState(false);

  const getInitials = (name?: string, email?: string) => {
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
    <header className="app-header">
      <div className="app-header__left">
        <button
          className="app-sidebar__toggle"
          onClick={onToggleSidebar}
          aria-label="Toggle sidebar"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
          >
            <line x1="3" y1="12" x2="21" y2="12" strokeLinecap="round" strokeLinejoin="round"/>
            <line x1="3" y1="6" x2="21" y2="6" strokeLinecap="round" strokeLinejoin="round"/>
            <line x1="3" y1="18" x2="21" y2="18" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        <Link href="/dashboard" className="app-header__logo">
          <div className="app-header__logo-icon">N</div>
          <span className="app-header__logo-text">Nerdy</span>
        </Link>
      </div>

      <div className="app-header__right">
        <div className="app-header__search">
          <svg
            className="app-header__search-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
          >
            <circle cx="11" cy="11" r="8" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M21 21l-4.35-4.35" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <input type="search" placeholder="Search lessons..." aria-label="Search" />
        </div>

        <button
          className="icon-button"
          aria-label="Notifications"
          style={{ border: "none", background: "transparent" }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M13.73 21a2 2 0 0 1-3.46 0" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        <div className="app-header__avatar" onClick={() => setShowMenu(!showMenu)}>
          {user?.avatar ? (
            <img src={user.avatar} alt="" style={{ width: "100%", height: "100%", borderRadius: "10px" }} />
          ) : (
            getInitials(user?.name, user?.email)
          )}
        </div>

        {showMenu && (
          <div
            style={{
              position: "absolute",
              top: "var(--header-height)",
              right: "24px",
              background: "var(--bg-elevated)",
              border: "1px solid var(--line)",
              borderRadius: "12px",
              padding: "8px 0",
              minWidth: "180px",
              boxShadow: "var(--shadow)",
              zIndex: 20,
            }}
            onClick={() => setShowMenu(false)}
          >
            <Link
              href="/profile"
              style={{
                display: "block",
                padding: "10px 16px",
                color: "var(--ink)",
                textDecoration: "none",
                fontSize: "0.9rem",
              }}
            >
              Profile
            </Link>
            <Link
              href="/settings"
              style={{
                display: "block",
                padding: "10px 16px",
                color: "var(--ink)",
                textDecoration: "none",
                fontSize: "0.9rem",
              }}
            >
              Settings
            </Link>
            <hr style={{ border: "none", borderTop: "1px solid var(--line)", margin: "8px 0" }} />
            <button
              style={{
                width: "100%",
                padding: "10px 16px",
                border: "none",
                background: "transparent",
                textAlign: "left",
                cursor: "pointer",
                fontSize: "0.9rem",
                color: "var(--danger)",
              }}
            >
              Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
