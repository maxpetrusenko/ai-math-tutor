"use client";

import React from "react";

import type { TalkingHead } from "@met4citizen/talkinghead";
import type { AvatarFrame, AvatarSpeechCue } from "../lib/avatar_contract";
import {
  AVATAR_VISEMES,
  buildAvatarVisemeTimeline,
  sampleAvatarVisemeTimeline,
  type VisemeProcessor,
} from "../lib/avatar_viseme_timeline";

type TalkingHeadAvatarProps = {
  frame: AvatarFrame;
  modelUrl: string;
  onError?: (error: Error) => void;
  onVisemeStart?: (cueId: string) => void;
  speechCue?: AvatarSpeechCue | null;
  variant: "panel" | "hero" | "gallery";
};

type LoadState = "loading" | "ready" | "error";

const MOOD_BY_STATE: Record<AvatarFrame["state"], string> = {
  idle: "happy",
  listening: "neutral",
  thinking: "neutral",
  speaking: "happy",
  fading: "neutral",
};

const MAX_EFFECTIVE_PIXEL_RATIO = 1.5;
const VISEME_RENDER_LEAD_MS = 30;

function resolveModelPixelRatio(devicePixelRatio: number) {
  const safeDevicePixelRatio = Math.max(devicePixelRatio || 1, 1);
  return Math.min(1, MAX_EFFECTIVE_PIXEL_RATIO / safeDevicePixelRatio);
}

function asError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}

function readActiveVisemes(head: TalkingHead): string {
  const active = new Set<string>();
  head.morphs.forEach((morph) => {
    Object.entries(morph.morphTargetDictionary).forEach(([name, index]) => {
      if (name.startsWith("viseme_") && (morph.morphTargetInfluences[index] ?? 0) >= 0.08) {
        active.add(name.slice("viseme_".length));
      }
    });
  });
  return [...active].sort().join("+");
}

function setImmediateViseme(head: TalkingHead, viseme: string, value: number) {
  const morphTarget = `viseme_${viseme}`;
  head.setFixedValue(morphTarget, value, 0);

  // TalkingHead's generic fixed-value path has acceleration intended for
  // expressions and head motion. Keep its internal state and the rendered GLB
  // target in sync so speech phonemes do not spend ~400 ms easing in.
  const state = head.mtAvatar?.[morphTarget];
  if (state) {
    Object.assign(state, { applied: value, fixed: value, needsUpdate: false, v: 0, value });
  }
  head.morphs.forEach((morph) => {
    const index = morph.morphTargetDictionary[morphTarget];
    if (index !== undefined) {
      morph.morphTargetInfluences[index] = value;
    }
  });
}

export function TalkingHeadAvatar({
  frame,
  modelUrl,
  onError,
  onVisemeStart,
  speechCue,
  variant,
}: TalkingHeadAvatarProps) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const headRef = React.useRef<TalkingHead | null>(null);
  const moodRef = React.useRef<string | null>(null);
  const speechCueStartedAtRef = React.useRef<number | null>(null);
  const speechCueRef = React.useRef<string | null>(null);
  const stateRef = React.useRef<AvatarFrame["state"] | null>(null);
  const [loadAttempt, setLoadAttempt] = React.useState(0);
  const [loadDurationMs, setLoadDurationMs] = React.useState<number | null>(null);
  const [loadState, setLoadState] = React.useState<LoadState>("loading");

  React.useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }
    const avatarContainer = container;

    let disposed = false;
    let activeHead: TalkingHead | null = null;
    const loadStartedAt = performance.now();
    setLoadDurationMs(null);
    setLoadState("loading");

    async function loadAvatar() {
      try {
        const [talkingHeadModule, englishLipsyncModule] = await Promise.all([
          import("@met4citizen/talkinghead"),
          import("@met4citizen/talkinghead/modules/lipsync-en.mjs"),
        ]);
        if (disposed) {
          return;
        }

        const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
        activeHead = new talkingHeadModule.TalkingHead(avatarContainer, {
          avatarMood: "happy",
          cameraPanEnable: false,
          cameraRotateEnable: false,
          cameraView: "upper",
          cameraZoomEnable: false,
          // Package-relative dynamic imports break after Next.js bundles the
          // engine. The English processor is imported explicitly above.
          lipsyncModules: [],
          modelFPS: reducedMotion ? 20 : 30,
          modelMovementFactor: reducedMotion ? 0.2 : 0.65,
          // TalkingHead multiplies this value by window.devicePixelRatio.
          modelPixelRatio: resolveModelPixelRatio(window.devicePixelRatio),
        });
        activeHead.lipsync.en = new englishLipsyncModule.LipsyncEn();
        headRef.current = activeHead;

        await activeHead.showAvatar({
          avatarMood: "happy",
          baseline: {
            eyeBlinkLeft: 0.05,
            eyeBlinkRight: 0.05,
            headRotateX: -0.01,
          },
          body: "F",
          lipsyncLang: "en",
          url: modelUrl,
        });

        if (disposed) {
          activeHead.dispose();
          return;
        }
        setLoadDurationMs(Math.round(performance.now() - loadStartedAt));
        setLoadState("ready");
      } catch (value: unknown) {
        if (disposed) {
          return;
        }
        const error = asError(value);
        console.error(
          `[TalkingHeadAvatar] avatar.load_failed model=${modelUrl} message=${error.message}`
        );
        setLoadState("error");
        onError?.(error);
      }
    }

    void loadAvatar();

    return () => {
      disposed = true;
      moodRef.current = null;
      speechCueStartedAtRef.current = null;
      speechCueRef.current = null;
      stateRef.current = null;
      if (headRef.current === activeHead) {
        headRef.current = null;
      }
      activeHead?.dispose();
      container.replaceChildren();
    };
  }, [loadAttempt, modelUrl, onError]);

  React.useEffect(() => {
    const head = headRef.current;
    if (!head || loadState !== "ready") {
      return;
    }

    if (!speechCue) {
      if (speechCueRef.current) {
        head.stopSpeaking();
        speechCueRef.current = null;
      }
      return;
    }
    if (speechCueRef.current === speechCue.id) {
      return;
    }

    head.stopSpeaking();
    head.setFixedValue("mouthOpen", null, 0);
    head.setFixedValue("jawOpen", null, 0);
    const processor = head.lipsync.en as VisemeProcessor;
    const timeline = buildAvatarVisemeTimeline(speechCue, processor);
    const root = rootRef.current;
    if (root) {
      root.dataset.lastVisemeCueId = speechCue.id;
      root.dataset.lastVisemeWordCount = String(speechCue.words.length);
      root.removeAttribute("data-observed-visemes");
      root.removeAttribute("data-first-visible-viseme-ms");
    }
    const startedAt = performance.now();
    speechCueStartedAtRef.current = startedAt;
    const applyVisemes = () => {
      // Begin on the first syllable's attack instead of scheduling an
      // invisible zero-amplitude frame while the renderer catches up.
      const elapsedMs = performance.now() - startedAt + VISEME_RENDER_LEAD_MS;
      const values = sampleAvatarVisemeTimeline(timeline, elapsedMs);
      AVATAR_VISEMES.forEach((viseme) => {
        setImmediateViseme(head, viseme, values.get(viseme) ?? 0);
      });
    };
    applyVisemes();
    const intervalId = window.setInterval(applyVisemes, 20);
    speechCueRef.current = speechCue.id;
    onVisemeStart?.(speechCue.id);
    return () => {
      window.clearInterval(intervalId);
      AVATAR_VISEMES.forEach((viseme) => setImmediateViseme(head, viseme, 0));
    };
  }, [loadState, onVisemeStart, speechCue]);

  React.useEffect(() => {
    const head = headRef.current;
    if (!head || loadState !== "ready") {
      return;
    }

    const nextMood = MOOD_BY_STATE[frame.state];
    if (moodRef.current !== nextMood) {
      head.setMood(nextMood);
      moodRef.current = nextMood;
    }

    const visemeActive = Boolean(speechCue && (frame.state === "speaking" || frame.state === "fading"));
    if (!visemeActive) {
      const mouthOpen = frame.state === "speaking" || frame.state === "fading"
        ? Math.min(1, Math.max(0, frame.mouthOpen))
        : 0;
      head.setFixedValue("mouthOpen", mouthOpen, mouthOpen > 0 ? 25 : 40);
      head.setFixedValue("jawOpen", mouthOpen * 0.52, mouthOpen > 0 ? 25 : 40);
    }
    head.setFixedValue("browInnerUp", frame.state === "listening" ? 0.16 : null, 140);
    head.setFixedValue("eyesRotateX", frame.state === "thinking" ? -0.08 : null, 180);

    if (
      (frame.state === "fading" || frame.state === "idle")
      && stateRef.current !== frame.state
    ) {
      head.stopSpeaking();
      speechCueRef.current = null;
    }
    stateRef.current = frame.state;
  }, [frame, loadState, speechCue]);

  React.useEffect(() => {
    const head = headRef.current;
    const root = rootRef.current;
    if (!head || !root || loadState !== "ready" || !speechCue) {
      root?.removeAttribute("data-active-visemes");
      return;
    }

    const sample = () => {
      const signature = readActiveVisemes(head);
      if (signature) {
        root.dataset.activeVisemes = signature;
        if (!root.dataset.firstVisibleVisemeMs && speechCueStartedAtRef.current !== null) {
          root.dataset.firstVisibleVisemeMs = String(
            Math.round(performance.now() - speechCueStartedAtRef.current),
          );
        }
        const observed = new Set((root.dataset.observedVisemes ?? "").split("+").filter(Boolean));
        signature.split("+").forEach((viseme) => observed.add(viseme));
        root.dataset.observedVisemes = [...observed].sort().join("+");
      } else {
        root.removeAttribute("data-active-visemes");
      }
    };
    sample();
    const intervalId = window.setInterval(sample, 30);
    return () => {
      window.clearInterval(intervalId);
      root.removeAttribute("data-active-visemes");
    };
  }, [loadState, speechCue]);

  return (
    <div
      aria-busy={loadState === "loading"}
      className="talking-head"
      data-active-word={frame.activeWord ?? undefined}
      data-avatar-state={frame.state}
      data-load-ms={loadDurationMs ?? undefined}
      data-load-state={loadState}
      data-lipsync-mode={speechCue ? "viseme" : "energy"}
      data-mouth-open={frame.mouthOpen.toFixed(3)}
      data-viseme-cue-id={speechCue?.id ?? undefined}
      data-viseme-word-count={speechCue?.words.length ?? 0}
      data-testid="talking-head"
      ref={rootRef}
    >
      <div
        aria-hidden="true"
        className="talking-head__canvas"
        data-testid="talking-head-canvas"
        ref={containerRef}
      />
      {loadState === "loading" ? (
        <div aria-live="polite" className="talking-head__status" data-testid="talking-head-loading">
          Preparing your tutor…
        </div>
      ) : null}
      {loadState === "error" ? (
        <div className="talking-head__status talking-head__status--error" role="alert">
          <strong>Avatar could not load.</strong>
          {variant === "gallery" ? (
            <span>Reload the page to retry.</span>
          ) : (
            <button className="button button--ghost" onClick={() => setLoadAttempt((value) => value + 1)} type="button">
              Retry avatar
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}
