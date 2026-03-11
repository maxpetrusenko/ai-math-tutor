"use client";

import React, { type ReactNode } from "react";

import { FirebaseAuthProvider } from "../lib/firebase_auth";

export function AppProviders({ children }: { children: ReactNode }) {
  return <FirebaseAuthProvider>{children}</FirebaseAuthProvider>;
}
