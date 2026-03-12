import React from "react";

type SurfaceCardProps = {
  children: React.ReactNode;
  className?: string;
};

export function SurfaceCard({ children, className }: SurfaceCardProps) {
  return <section className={`surface-card${className ? ` ${className}` : ""}`}>{children}</section>;
}
