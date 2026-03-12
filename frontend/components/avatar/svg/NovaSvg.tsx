"use client";

import React, { memo, useId } from "react";
import type { SvgAvatarProps } from "./types";
import { clamp01, svgMouthProps, svgScopeId } from "./utils";

export const NovaSvg = memo(function NovaSvg({
  className,
  mouthOpen = 0,
  size = 200,
  state = "idle",
  title = "Nova",
}: SvgAvatarProps) {
  const uid = useId();
  const p = (name: string) => svgScopeId(uid, "nova", name);
  const mo = clamp01(mouthOpen);
  const isListening = state === "listening";
  const isThinking = state === "thinking";
  const isFading = state === "fading";
  const antennaDx = isListening ? 5 : mo * 2;
  const eyeH = isListening ? 14 : isThinking ? 5 : 10;
  const visorAlpha = isThinking ? 0.65 : 0.3;
  const cheekAlpha = state === "speaking" ? 0.44 + mo * 0.25 : isListening ? 0.32 : 0.14;
  const fadeOpacity = isFading ? 0.45 : 1;
  const bars = [mo * 10, mo * 15, mo * 8, mo * 13, mo * 9];
  const mouthHeight = Math.max(5, 6 + mo * 18);
  const mouthProps = svgMouthProps(mo);

  return (
    <svg
      aria-hidden="true"
      className={className}
      height={size}
      style={{ display: "block", opacity: fadeOpacity, transition: "opacity 0.4s ease" }}
      viewBox="0 0 200 200"
      width={size}
    >
      <title>{title}</title>
      <defs>
        <linearGradient id={p("body")} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#EAF0F6" />
          <stop offset="100%" stopColor="#CDD5DE" />
        </linearGradient>
        <linearGradient id={p("visor")} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stopColor="#3ED6C8" />
          <stop offset="50%" stopColor="#2CC4B6" />
          <stop offset="100%" stopColor="#3ED6C8" />
        </linearGradient>
      </defs>

      <line stroke="#9EAAB5" strokeLinecap="round" strokeWidth="2.8" x1="100" x2={100 + antennaDx} y1="50" y2="32" />
      <circle cx={100 + antennaDx} cy="28" fill="#7C5CFF" r="5.5" />
      <circle cx={100 + antennaDx} cy="28" fill="#C8B8FF" r="2.8" />

      <rect fill={`url(#${p("body")})`} height="80" rx="22" ry="22" width="84" x="58" y="54" />
      <line opacity="0.5" stroke="#B8C2CC" strokeWidth="0.7" x1="72" x2="72" y1="54" y2="68" />
      <line opacity="0.5" stroke="#B8C2CC" strokeWidth="0.7" x1="128" x2="128" y1="54" y2="68" />

      <rect fill="#9EAAB5" height="22" rx="4" ry="4" width="12" x="48" y="84" />
      <rect fill="#9EAAB5" height="22" rx="4" ry="4" width="12" x="140" y="84" />
      <rect fill="#3ED6C8" height="4" opacity={cheekAlpha} rx="2" ry="2" width="8" x="50" y="90" />
      <rect fill="#3ED6C8" height="4" opacity={cheekAlpha} rx="2" ry="2" width="8" x="142" y="90" />

      <rect fill={`url(#${p("visor")})`} height="26" opacity={visorAlpha} rx="11" ry="11" width="68" x="66" y="84" />
      <rect fill="none" height="26" rx="11" ry="11" stroke="#2CC4B6" strokeWidth="1.2" width="68" x="66" y="84" />

      <rect fill="#0B4F4A" height={eyeH} rx="4" ry="4" width="18" x="76" y="90" />
      <rect fill="#0B4F4A" height={eyeH} rx="4" ry="4" width="18" x="106" y="90" />
      <rect fill="#E0F7FA" height={Math.max(2, eyeH - 4)} opacity="0.8" rx="3" ry="3" width="14" x="78" y="92" />
      <rect fill="#E0F7FA" height={Math.max(2, eyeH - 4)} opacity="0.8" rx="3" ry="3" width="14" x="108" y="92" />

      <circle cx="70" cy="108" fill="#FF8A80" opacity={cheekAlpha} r="4.5" />
      <circle cx="130" cy="108" fill="#FF8A80" opacity={cheekAlpha} r="4.5" />
      <ellipse cx="100" cy="140" fill="none" opacity={0.3 + mo * 0.4} rx="10" ry="4" stroke="#7C5CFF" strokeWidth="1.8" />
      <ellipse cx="100" cy="140" fill="#7C5CFF" opacity={0.15 + mo * 0.25} rx="6" ry="2.5" />

      <g {...mouthProps}>
        <rect fill="#0B4F4A" height={mouthHeight} rx="5" ry="5" width="24" x="88" y="116" />
        {bars.map((barHeight, index) => (
          <rect
            fill="#3ED6C8"
            height={Math.max(0.5, barHeight)}
            key={`${index}-${barHeight.toFixed(2)}`}
            opacity={mo > 0.04 ? 0.85 : 0.15}
            rx="1"
            width="2.5"
            x={90 + index * 4.2}
            y={118 + (12 - barHeight) * 0.5}
          />
        ))}
        {mo < 0.04 && state !== "speaking" ? (
          <path d="M90 120 Q100 127 110 120" fill="none" stroke="#2CC4B6" strokeLinecap="round" strokeWidth="2" />
        ) : null}
      </g>

      <rect fill="#B8C2CC" height="10" rx="4" ry="4" width="28" x="86" y="134" />
      <rect fill="#9EAAB5" height="14" rx="6" ry="6" width="52" x="74" y="142" />

      {isThinking ? (
        <g>
          <circle cx="140" cy="64" fill="#7C5CFF" opacity="0.45" r="3" />
          <circle cx="148" cy="52" fill="#7C5CFF" opacity="0.3" r="4" />
        </g>
      ) : null}
    </svg>
  );
});
