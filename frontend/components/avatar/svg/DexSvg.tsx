"use client";

import React, { memo, useId } from "react";
import type { SvgAvatarProps } from "./types";
import { clamp01, svgMouthProps, svgScopeId } from "./utils";

export const DexSvg = memo(function DexSvg({
  className,
  mouthOpen = 0,
  size = 200,
  state = "idle",
  title = "Dex",
}: SvgAvatarProps) {
  const uid = useId();
  const p = (name: string) => svgScopeId(uid, "dex", name);
  const mo = clamp01(mouthOpen);
  const isListening = state === "listening";
  const isThinking = state === "thinking";
  const isFading = state === "fading";
  const browTilt = isThinking ? 5 : -1;
  const eyeScale = isThinking ? 0.7 : isListening ? 1.1 : 1;
  const smirkDx = state === "idle" ? 3 : 0;
  const fadeOpacity = isFading ? 0.45 : 1;
  const mouthRx = 5 + mo * 8;
  const mouthRy = 1 + mo * 9;
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
        <linearGradient id={p("skin")} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#F5D4B3" />
          <stop offset="100%" stopColor="#E2BA8E" />
        </linearGradient>
        <linearGradient id={p("hair")} x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor="#FF8A3D" />
          <stop offset="100%" stopColor="#E06A1F" />
        </linearGradient>
        <linearGradient id={p("jacket")} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#1E2A5E" />
          <stop offset="100%" stopColor="#141D42" />
        </linearGradient>
      </defs>

      <ellipse cx="102" cy="76" fill={`url(#${p("hair")})`} rx="42" ry="32" />
      <ellipse cx="76" cy="72" fill="#FF8A3D" rx="20" ry="16" transform="rotate(-12 76 72)" />
      <ellipse cx="120" cy="68" fill="#E06A1F" rx="16" ry="12" transform="rotate(8 120 68)" />
      <polygon fill="#FF8A3D" points="86,52 92,40 98,54" />
      <polygon fill="#E06A1F" points="100,48 108,36 112,50" />

      <ellipse cx="100" cy="100" fill={`url(#${p("skin")})`} rx="36" ry="38" />
      <ellipse cx="64" cy="100" fill="#E2BA8E" rx="6" ry="8" />
      <ellipse cx="136" cy="100" fill="#E2BA8E" rx="6" ry="8" />

      <path d="M66 86 Q100 80 134 86" fill="none" stroke="#1E2A5E" strokeLinecap="round" strokeWidth="4.5" />
      <path d="M66 86 Q100 80 134 86" fill="none" stroke="#C8FF66" strokeLinecap="round" strokeWidth="1.5" />

      <line
        stroke="#7A4A1E"
        strokeLinecap="round"
        strokeWidth="2.3"
        x1="76"
        x2="92"
        y1={90 + browTilt * 0.4}
        y2={88 - browTilt * 0.3}
      />
      <line
        stroke="#7A4A1E"
        strokeLinecap="round"
        strokeWidth="2.3"
        x1="108"
        x2="124"
        y1={88 - browTilt * 0.3}
        y2={90 + browTilt * 0.4}
      />

      <ellipse cx="86" cy="97" fill="white" rx="7" ry={7.5 * eyeScale} />
      <ellipse cx="114" cy="97" fill="white" rx="7" ry={7.5 * eyeScale} />
      <circle cx="86" cy="97" fill="#1E2A5E" r="4" />
      <circle cx="114" cy="97" fill="#1E2A5E" r="4" />
      <circle cx="86" cy="97" fill="#0A0F24" r="2.2" />
      <circle cx="114" cy="97" fill="#0A0F24" r="2.2" />
      <circle cx="84" cy="95" fill="white" opacity="0.85" r="1.5" />
      <circle cx="112" cy="95" fill="white" opacity="0.85" r="1.5" />

      <path d="M98 106 Q96 112 100 112 Q104 112 102 106" fill="#C89E70" opacity="0.3" />

      {mo > 0.03 ? (
        <g {...mouthProps}>
          <ellipse cx={100 + smirkDx * 0.3} cy="120" fill="#8B5041" rx={mouthRx} ry={mouthRy} />
          {mo > 0.4 ? (
            <ellipse
              cx="100"
              cy={120 - mouthRy * 0.3}
              fill="#D4A68A"
              opacity="0.4"
              rx={mouthRx * 0.7}
              ry={Math.max(1, mouthRy * 0.25)}
            />
          ) : null}
        </g>
      ) : (
        <path
          {...mouthProps}
          d={`M90 118 Q${100 + smirkDx} 124 ${108 + smirkDx} 117`}
          fill="none"
          stroke="#8B5041"
          strokeLinecap="round"
          strokeWidth="2"
        />
      )}

      <path
        d="M62 140 Q80 148 100 145 Q120 148 138 140 L142 160 L58 160 Z"
        fill={`url(#${p("jacket")})`}
      />
      <path d="M90 140 L96 148 L100 140" fill="#141D42" opacity="0.5" />
      <path d="M100 140 L104 148 L110 140" fill="#141D42" opacity="0.5" />
      <g transform="translate(124 144)">
        <rect fill="#C8FF66" height="10" opacity="0.85" rx="2" width="10" x="0" y="0" />
        <rect fill="#C8FF66" height="5" opacity="0.6" rx="1.5" width="5" x="3" y="-3" />
      </g>

      {isThinking ? (
        <g opacity="0.55" transform="translate(142 62) rotate(12)">
          <rect fill="#C8FF66" height="10" rx="2" width="10" x="-5" y="-5" />
          <circle cx="0" cy="-8" fill="#C8FF66" r="3.5" />
        </g>
      ) : null}
    </svg>
  );
});
