"use client";

import React, { memo, useId } from "react";
import type { SvgAvatarProps } from "./types";
import { clamp01, svgMouthProps, svgScopeId } from "./utils";

export const SageSvg = memo(function SageSvg({
  className,
  mouthOpen = 0,
  size = 200,
  state = "idle",
  title = "Sage",
}: SvgAvatarProps) {
  const uid = useId();
  const p = (name: string) => svgScopeId(uid, "sage", name);
  const mo = clamp01(mouthOpen);
  const isListening = state === "listening";
  const isThinking = state === "thinking";
  const isFading = state === "fading";
  const browLift = isThinking ? -5 : isListening ? -2 : 0;
  const eyeOpenY = isThinking ? 7 : isListening ? 11 : 9;
  const pupilDx = isListening ? 1.5 : isThinking ? -1 : 0;
  const fadeOpacity = isFading ? 0.45 : 1;
  const mouthRx = 6 + mo * 7;
  const mouthRy = 1.5 + mo * 10;
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
          <stop offset="0%" stopColor="#C68B59" />
          <stop offset="100%" stopColor="#A97044" />
        </linearGradient>
        <linearGradient id={p("hair")} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#2A1A0E" />
          <stop offset="100%" stopColor="#1A0F07" />
        </linearGradient>
        <linearGradient id={p("hoodie")} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#2F5FE3" />
          <stop offset="100%" stopColor="#1E40AF" />
        </linearGradient>
      </defs>

      <ellipse cx="100" cy="78" fill={`url(#${p("hair")})`} rx="46" ry="38" />
      <ellipse cx="82" cy="62" fill="#2A1A0E" rx="14" ry="10" />
      <ellipse cx="114" cy="60" fill="#2A1A0E" rx="16" ry="11" />
      <ellipse cx="102" cy="56" fill="#1A0F07" rx="12" ry="10" />
      <circle cx="70" cy="68" fill="#2A1A0E" r="8" />
      <circle cx="132" cy="66" fill="#2A1A0E" r="9" />

      <ellipse cx="100" cy="100" fill={`url(#${p("skin")})`} rx="38" ry="40" />
      <ellipse cx="62" cy="100" fill="#A97044" rx="6" ry="9" />
      <ellipse cx="138" cy="100" fill="#A97044" rx="6" ry="9" />

      <circle cx="86" cy="96" fill="none" r="14" stroke="#D4A853" strokeWidth="2.2" />
      <circle cx="114" cy="96" fill="none" r="14" stroke="#D4A853" strokeWidth="2.2" />
      <path d="M98 95 Q100 92 102 95" fill="none" stroke="#D4A853" strokeWidth="1.8" />
      <line stroke="#D4A853" strokeWidth="1.8" x1="72" x2="63" y1="95" y2="93" />
      <line stroke="#D4A853" strokeWidth="1.8" x1="128" x2="137" y1="95" y2="93" />
      <circle cx="86" cy="96" fill="#D4A853" opacity="0.06" r="12" />
      <circle cx="114" cy="96" fill="#D4A853" opacity="0.06" r="12" />

      <path
        d={`M76 ${84 + browLift} Q86 ${78 + browLift} 96 ${84 + browLift}`}
        fill="none"
        stroke="#1A0F07"
        strokeLinecap="round"
        strokeWidth="2.2"
      />
      <path
        d={`M104 ${84 + browLift} Q114 ${78 + browLift} 124 ${84 + browLift}`}
        fill="none"
        stroke="#1A0F07"
        strokeLinecap="round"
        strokeWidth="2.2"
      />

      <ellipse cx="86" cy="96" fill="white" rx="6" ry={eyeOpenY * 0.55} />
      <ellipse cx="114" cy="96" fill="white" rx="6" ry={eyeOpenY * 0.55} />
      <circle cx={86 + pupilDx} cy="96" fill="#3E2723" r="3.5" />
      <circle cx={114 + pupilDx} cy="96" fill="#3E2723" r="3.5" />
      <circle cx={84 + pupilDx} cy="94" fill="white" opacity="0.85" r="1.3" />
      <circle cx={112 + pupilDx} cy="94" fill="white" opacity="0.85" r="1.3" />

      <ellipse cx="100" cy="108" fill="#8B5E3C" opacity="0.35" rx="4" ry="3" />

      {mo > 0.03 ? (
        <g {...mouthProps}>
          <ellipse cx="100" cy="120" fill="#6B3A2A" rx={mouthRx} ry={mouthRy} />
          <ellipse
            cx="100"
            cy={120 - mouthRy * 0.35}
            fill="#D4956B"
            opacity="0.5"
            rx={mouthRx * 0.8}
            ry={Math.max(1, mouthRy * 0.3)}
          />
        </g>
      ) : (
        <path
          {...mouthProps}
          d="M92 118 Q100 124 108 118"
          fill="none"
          stroke="#6B3A2A"
          strokeLinecap="round"
          strokeWidth="2"
        />
      )}

      <path
        d="M64 140 Q80 150 100 146 Q120 150 136 140 L140 160 L60 160 Z"
        fill={`url(#${p("hoodie")})`}
      />
      <path d="M92 140 L100 152 L108 140" fill="none" opacity="0.6" stroke="#1E40AF" strokeWidth="1.5" />
      <rect fill="#FFD54A" height="12" opacity="0.8" rx="2" ry="2" width="10" x="120" y="144" />
      <line stroke="#2F5FE3" strokeWidth="0.8" x1="122" x2="128" y1="147" y2="147" />
      <line stroke="#2F5FE3" strokeWidth="0.8" x1="122" x2="127" y1="150" y2="150" />

      {isThinking ? (
        <g opacity="0.6">
          <circle cx="142" cy="68" fill="#FFD54A" r="2.5" />
          <circle cx="150" cy="58" fill="#FFD54A" opacity="0.5" r="3.5" />
        </g>
      ) : null}
    </svg>
  );
});
