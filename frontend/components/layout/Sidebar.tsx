"use client";

import React, { useState, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = {
  id: string;
  label: string;
  href: string;
  icon: React.ReactNode;
  children?: NavItem[];
};

const navItems: NavItem[] = [
  {
    id: "home",
    label: "Home",
    href: "/dashboard",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" strokeLinecap="round" strokeLinejoin="round"/>
        <polyline points="9 22 9 12 15 12 15 22" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    id: "lessons",
    label: "Lessons",
    href: "/lessons",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    children: [
      { id: "math", label: "Math", href: "/lessons/math", icon: null },
      { id: "science", label: "Science", href: "/lessons/science", icon: null },
      { id: "english", label: "English", href: "/lessons/english", icon: null },
    ],
  },
  {
    id: "avatar",
    label: "Avatar",
    href: "/avatar",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx="12" cy="7" r="4" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    id: "models",
    label: "Models",
    href: "/models",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <rect x="2" y="3" width="20" height="14" rx="2" ry="2" strokeLinecap="round" strokeLinejoin="round"/>
        <line x1="8" y1="21" x2="16" y2="21" strokeLinecap="round" strokeLinejoin="round"/>
        <line x1="12" y1="17" x2="12" y2="21" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    id: "profile",
    label: "Profile",
    href: "/profile",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx="12" cy="7" r="4" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    id: "settings",
    label: "Settings",
    href: "/settings",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <circle cx="12" cy="12" r="3" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
];

type SidebarProps = {
  collapsed?: boolean;
  onToggle?: () => void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
};

export function Sidebar({ collapsed = false, onToggle, mobileOpen, onMobileClose }: SidebarProps) {
  const pathname = usePathname();
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const toggleExpanded = useCallback((id: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const isItemActive = useCallback((item: NavItem): boolean => {
    if (pathname === item.href) return true;
    if (item.children) {
      return item.children.some((child) => pathname === child.href);
    }
    return false;
  }, [pathname]);

  return (
    <aside
      className={`app-sidebar ${collapsed ? "app-sidebar--collapsed" : ""} ${
        mobileOpen ? "app-sidebar--mobile-open" : ""
      }`}
    >
      <button
        className="app-sidebar__toggle"
        onClick={() => {
          onToggle?.();
          onMobileClose?.();
        }}
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
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" strokeLinecap="round" strokeLinejoin="round"/>
          <line x1="9" y1="3" x2="9" y2="21" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      <nav className="app-sidebar__nav">
        {navItems.map((item) => {
          const hasChildren = item.children && item.children.length > 0;
          const isActive = isItemActive(item);
          const isExpanded = expandedItems.has(item.id);

          return (
            <div key={item.id}>
              <Link
                href={item.href}
                className={`nav-item ${isActive ? "nav-item--active" : ""} ${
                  hasChildren && isExpanded ? "nav-item--expanded" : ""
                }`}
                onClick={(e) => {
                  if (hasChildren) {
                    e.preventDefault();
                    toggleExpanded(item.id);
                  }
                  onMobileClose?.();
                }}
              >
                <span className="nav-item__icon">{item.icon}</span>
                {!collapsed && <span className="nav-item__label">{item.label}</span>}
                {hasChildren && !collapsed && (
                  <svg
                    className="nav-item__chevron"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <polyline points="9 18 15 12 9 6" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </Link>
              {hasChildren && !collapsed && (
                <div className={`nav-submenu ${isExpanded ? "nav-submenu--open" : ""}`}>
                  {item.children!.map((child) => (
                    <Link
                      key={child.id}
                      href={child.href}
                      className={`nav-submenu__item ${
                        pathname === child.href ? "nav-submenu__item--active" : ""
                      }`}
                      onClick={onMobileClose}
                    >
                      {child.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
