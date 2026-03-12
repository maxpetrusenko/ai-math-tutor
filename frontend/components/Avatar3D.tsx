"use client";

import React, { useEffect, useRef } from "react";
import type { Avatar3DAsset } from "../lib/avatar_asset_loader";
import type { AvatarConfig, AvatarVisualState, WordTimestamp } from "../lib/avatar_contract";
import { sampleAvatar3DFrame } from "../lib/avatar_3d_driver";
import { createAvatar3DScene } from "../lib/avatar_3d_scene";
import { applyAvatar3DFrame } from "../lib/avatar_3d_runtime";

type Avatar3DProps = {
  asset: Avatar3DAsset;
  config: AvatarConfig;
  state: Exclude<AvatarVisualState, "fading">;
  timestamps: WordTimestamp[];
  nowMs: number;
  energy?: number;
  onError?: (error: Error) => void;
};

export function Avatar3D({
  asset,
  config,
  state,
  timestamps,
  nowMs,
  energy = 0.5,
  onError,
}: Avatar3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Refs for runtime props - animation loop reads current values via refs
  const stateRef = useRef(state);
  const timestampsRef = useRef(timestamps);
  const nowMsRef = useRef(nowMs);
  const energyRef = useRef(energy);

  // Keep refs in sync with props
  useEffect(() => {
    stateRef.current = state;
  }, [state]);
  useEffect(() => {
    timestampsRef.current = timestamps;
  }, [timestamps]);
  useEffect(() => {
    nowMsRef.current = nowMs;
  }, [nowMs]);
  useEffect(() => {
    energyRef.current = energy;
  }, [energy]);

  // Initialize Three.js scene
  useEffect(() => {
    if (!containerRef.current) return;
    let sceneHandle;
    try {
      sceneHandle = createAvatar3DScene(containerRef.current, config, asset);
    } catch (error) {
      onError?.(error instanceof Error ? error : new Error("Failed to create 3D avatar scene"));
      return;
    }

    // Animation loop - reads current props via refs to avoid stale closures
    let frameId: number | undefined;
    const animate = () => {
      const time = Date.now() / 1000;
      const currentState = stateRef.current;
      const currentTimestamps = timestampsRef.current;
      const currentNowMs = nowMsRef.current;
      const currentEnergy = energyRef.current;
      const frame = sampleAvatar3DFrame({
        energy: currentEnergy,
        nowMs: currentNowMs,
        state: currentState,
        timeSeconds: time,
        timestamps: currentTimestamps,
      });

      applyAvatar3DFrame(sceneHandle, frame);
      sceneHandle.renderer.render(sceneHandle.scene, sceneHandle.camera);
      frameId = requestAnimationFrame(animate);
    };
    animate();

    // Cleanup
    return () => {
      if (frameId !== undefined) {
        cancelAnimationFrame(frameId);
      }
      sceneHandle.dispose();
    };
  }, [asset, config, onError]);

  return (
    <div
      ref={containerRef}
      className="avatar-container"
      style={{ width: "100%", height: "100%", minHeight: "300px" }}
    />
  );
}
