"use client";

import React, { memo, useId } from "react";
import type { SvgAvatarProps } from "./types";
import { clamp01, svgMouthProps, svgScopeId } from "./utils";

export const AlbertSvg = memo(function AlbertSvg({
  className,
  mouthOpen = 0,
  size = 200,
  state = "idle",
  title = "Albert",
}: SvgAvatarProps) {
  const uid = useId();
  const p = (name: string) => svgScopeId(uid, "albert", name);
  const mo = clamp01(mouthOpen);
  const isThinking = state === "thinking";
  const isListening = state === "listening";
  const isFading = state === "fading";
  const browLift = isThinking ? -4 : isListening ? -2 : 0;
  const eyeOpenY = isThinking ? 7 : isListening ? 10 : 8.5;
  const fadeOpacity = isFading ? 0.45 : 1;
  const mouthRx = 5 + mo * 7;
  const mouthRy = 1.4 + mo * 9;
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
          <stop offset="0%" stopColor="#F0C9A4" />
          <stop offset="100%" stopColor="#DDAE82" />
        </linearGradient>
        <linearGradient id={p("hair")} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#5C4635" />
          <stop offset="100%" stopColor="#3D2E22" />
        </linearGradient>
        <linearGradient id={p("cardigan")} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#355CDE" />
          <stop offset="100%" stopColor="#223E99" />
        </linearGradient>
      </defs>

      <ellipse cx="100" cy="76" fill={`url(#${p("hair")})`} rx="40" ry="30" />
      <rect fill="#6E5642" height="16" opacity="0.7" rx="8" width="64" x="68" y="56" />
      <ellipse cx="100" cy="100" fill={`url(#${p("skin")})`} rx="36" ry="39" />

      <circle cx="86" cy="96" fill="none" r="13" stroke="#D9B15F" strokeWidth="2.2" />
      <circle cx="114" cy="96" fill="none" r="13" stroke="#D9B15F" strokeWidth="2.2" />
      <path d="M98 95 Q100 93 102 95" fill="none" stroke="#D9B15F" strokeWidth="1.8" />
      <line stroke="#D9B15F" strokeWidth="1.6" x1="73" x2="66" y1="95" y2="94" />
      <line stroke="#D9B15F" strokeWidth="1.6" x1="127" x2="134" y1="95" y2="94" />

      <path
        d={`M76 ${84 + browLift} Q86 ${79 + browLift} 96 ${84 + browLift}`}
        fill="none"
        stroke="#3D2E22"
        strokeLinecap="round"
        strokeWidth="2.2"
      />
      <path
        d={`M104 ${84 + browLift} Q114 ${79 + browLift} 124 ${84 + browLift}`}
        fill="none"
        stroke="#3D2E22"
        strokeLinecap="round"
        strokeWidth="2.2"
      />

      <ellipse cx="86" cy="96" fill="white" rx="6" ry={eyeOpenY * 0.55} />
      <ellipse cx="114" cy="96" fill="white" rx="6" ry={eyeOpenY * 0.55} />
      <circle cx="86" cy="96" fill="#2E3A59" r="3.5" />
      <circle cx="114" cy="96" fill="#2E3A59" r="3.5" />
      <circle cx="84" cy="94" fill="white" opacity="0.75" r="1.2" />
      <circle cx="112" cy="94" fill="white" opacity="0.75" r="1.2" />

      <path d="M98 106 Q96 112 100 112 Q104 112 102 106" fill="#C89E70" opacity="0.3" />

      {mo > 0.03 ? (
        <ellipse {...mouthProps} cx="100" cy="120" fill="#7A4A39" rx={mouthRx} ry={mouthRy} />
      ) : (
        <path
          {...mouthProps}
          d="M92 118 Q100 123 108 118"
          fill="none"
          stroke="#7A4A39"
          strokeLinecap="round"
          strokeWidth="2"
        />
      )}

      <path
        d="M64 140 Q80 149 100 145 Q120 149 136 140 L140 160 L60 160 Z"
        fill={`url(#${p("cardigan")})`}
      />
      <rect fill="#FFD54A" height="10" opacity="0.85" rx="2" width="10" x="122" y="144" />
      <line stroke="#223E99" strokeWidth="0.8" x1="124" x2="128" y1="147" y2="147" />
      <line stroke="#223E99" strokeWidth="0.8" x1="124" x2="129" y1="150" y2="150" />

      {isThinking ? (
        <g opacity="0.45">
          <circle cx="144" cy="72" fill="#FFD54A" r="3" />
          <circle cx="152" cy="62" fill="#FFD54A" opacity="0.6" r="2" />
        </g>
      ) : null}
    </svg>
  );
});
