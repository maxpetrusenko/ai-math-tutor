import React from "react";

type MetricCardProps = {
  accent?: "primary" | "secondary" | "success" | "neutral";
  label: string;
  value: string;
};

export function MetricCard({ accent = "primary", label, value }: MetricCardProps) {
  return (
    <div className={`metric-card metric-card--${accent}`}>
      <div className="metric-card__value">{value}</div>
      <div className="metric-card__label">{label}</div>
    </div>
  );
}
