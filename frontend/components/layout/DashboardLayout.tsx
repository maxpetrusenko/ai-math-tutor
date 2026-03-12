"use client";

import React, { useState } from "react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { useFirebaseAuth } from "../../lib/firebase_auth";

type DashboardLayoutProps = {
  children: React.ReactNode;
  headerActions?: React.ReactNode;
  headerContext?: {
    badge?: string | null;
    subtitle?: string;
    title: string;
  } | null;
};

export function DashboardLayout({ children, headerActions, headerContext }: DashboardLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const { signOutUser, user } = useFirebaseAuth();

  const handleSignOut = async () => {
    await signOutUser();
    window.location.href = "/";
  };

  return (
    <div className={`app-shell ${sidebarCollapsed ? "app-shell--sidebar-collapsed" : ""}`}>
      <Header
        actions={headerActions}
        context={headerContext}
        onToggleSidebar={() => {
          if (window.innerWidth < 768) {
            setMobileSidebarOpen(!mobileSidebarOpen);
          } else {
            setSidebarCollapsed(!sidebarCollapsed);
          }
        }}
        onSignOut={handleSignOut}
        user={user ? { email: user.email ?? undefined, name: user.displayName ?? undefined } : undefined}
      />
      <Sidebar
        collapsed={sidebarCollapsed}
        mobileOpen={mobileSidebarOpen}
        onMobileClose={() => setMobileSidebarOpen(false)}
      />
      <main className="app-main">
        <div className="app-main__content">{children}</div>
      </main>
    </div>
  );
}
