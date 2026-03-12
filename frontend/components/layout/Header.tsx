"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type HeaderProps = {
  onToggleSidebar?: () => void;
  onSignOut?: () => Promise<void> | void;
  user?: {
    name?: string;
    email?: string;
    avatar?: string;
  };
};

export function Header({ onToggleSidebar, onSignOut, user }: HeaderProps) {
  const [showMenu, setShowMenu] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchValue, setSearchValue] = useState(() => searchParams.get("q") ?? "");

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

  const submitSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextQuery = searchValue.trim();
    const params = new URLSearchParams();
    if (nextQuery) {
      params.set("q", nextQuery);
    }
    router.push(`/lessons${params.size ? `?${params.toString()}` : ""}`);
  };

  useEffect(() => {
    setShowMenu(false);
  }, [pathname]);

  useEffect(() => {
    if (!showMenu) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }

      if (target.closest(".app-header__menu") || target.closest(".app-header__avatar")) {
        return;
      }

      setShowMenu(false);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowMenu(false);
      }
    };

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [showMenu]);

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
        <form className="app-header__search" onSubmit={submitSearch}>
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
          <input
            aria-label="Search lessons"
            onChange={(event) => setSearchValue(event.target.value)}
            placeholder={pathname === "/lessons" ? "Search this lesson library..." : "Search lessons..."}
            type="search"
            value={searchValue}
          />
        </form>

        <button
          className="icon-button"
          aria-label="Learning updates"
          onClick={() => router.push("/dashboard")}
          type="button"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M13.73 21a2 2 0 0 1-3.46 0" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        <button
          aria-label="Open account menu"
          aria-expanded={showMenu}
          aria-haspopup="menu"
          className="app-header__avatar"
          onClick={() => setShowMenu((current) => !current)}
          type="button"
        >
          {user?.avatar ? (
            <img alt="" className="app-header__avatar-image" src={user.avatar} />
          ) : (
            getInitials(user?.name, user?.email)
          )}
        </button>

        {showMenu && (
          <div className="app-header__menu" onClick={() => setShowMenu(false)} role="menu">
            <Link
              className="app-header__menu-link"
              href="/profile"
              role="menuitem"
            >
              Profile
            </Link>
            <Link
              className="app-header__menu-link"
              href="/settings"
              role="menuitem"
            >
              Settings
            </Link>
            <hr className="app-header__menu-separator" />
            <button
              className="app-header__menu-button"
              onClick={() => {
                setShowMenu(false);
                void onSignOut?.();
              }}
              role="menuitem"
              type="button"
            >
              Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
