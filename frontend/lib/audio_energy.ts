import type { AudioEnergySample } from "./avatar_contract";

const WINDOW_MS = 20;
const NOISE_FLOOR = 0.012;
const MIN_REFERENCE_RMS = 0.06;
const ATTACK = 0.65;
const RELEASE = 0.25;

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function percentile(values: number[], ratio: number) {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * ratio))];
}

export function buildPcm16EnergyEnvelope(
  pcmBytes: Uint8Array,
  sampleRate: number,
): AudioEnergySample[] {
  if (sampleRate <= 0 || pcmBytes.length < 2) {
    return [];
  }

  const samplesPerWindow = Math.max(1, Math.round(sampleRate * WINDOW_MS / 1_000));
  const sampleCount = Math.floor(pcmBytes.length / 2);
  const view = new DataView(pcmBytes.buffer, pcmBytes.byteOffset, pcmBytes.byteLength);
  const rmsValues: number[] = [];

  for (let offset = 0; offset < sampleCount; offset += samplesPerWindow) {
    const end = Math.min(sampleCount, offset + samplesPerWindow);
    let sumSquares = 0;
    for (let index = offset; index < end; index += 1) {
      const value = view.getInt16(index * 2, true) / 0x8000;
      sumSquares += value * value;
    }
    rmsValues.push(Math.sqrt(sumSquares / Math.max(1, end - offset)));
  }

  const referenceRms = Math.max(MIN_REFERENCE_RMS, percentile(rmsValues, 0.9));
  let smoothed = 0;

  return rmsValues.map((rms, index) => {
    const normalized = rms <= NOISE_FLOOR
      ? 0
      : clamp((rms - NOISE_FLOOR) / Math.max(0.001, referenceRms - NOISE_FLOOR));
    const smoothing = normalized > smoothed ? ATTACK : RELEASE;
    smoothed += (normalized - smoothed) * smoothing;
    if (smoothed < 0.015) {
      smoothed = 0;
    }
    return {
      atMs: index * WINDOW_MS,
      value: Number(clamp(smoothed).toFixed(4)),
    };
  });
}

export function buildWavPcm16EnergyEnvelope(wavBytes: Uint8Array): AudioEnergySample[] {
  if (wavBytes.length < 44) {
    return [];
  }
  const view = new DataView(wavBytes.buffer, wavBytes.byteOffset, wavBytes.byteLength);
  const ascii = (offset: number, length: number) => String.fromCharCode(
    ...wavBytes.slice(offset, offset + length),
  );
  if (ascii(0, 4) !== "RIFF" || ascii(8, 4) !== "WAVE") {
    return [];
  }

  let offset = 12;
  let sampleRate = 0;
  let bitsPerSample = 0;
  let channels = 0;
  let pcmBytes: Uint8Array | null = null;

  while (offset + 8 <= wavBytes.length) {
    const chunkId = ascii(offset, 4);
    const chunkSize = view.getUint32(offset + 4, true);
    const dataOffset = offset + 8;
    if (chunkId === "fmt " && chunkSize >= 16 && dataOffset + 16 <= wavBytes.length) {
      channels = view.getUint16(dataOffset + 2, true);
      sampleRate = view.getUint32(dataOffset + 4, true);
      bitsPerSample = view.getUint16(dataOffset + 14, true);
    } else if (chunkId === "data" && dataOffset + chunkSize <= wavBytes.length) {
      pcmBytes = wavBytes.slice(dataOffset, dataOffset + chunkSize);
    }
    offset = dataOffset + chunkSize + (chunkSize % 2);
  }

  if (!pcmBytes || channels !== 1 || bitsPerSample !== 16 || sampleRate <= 0) {
    return [];
  }
  return buildPcm16EnergyEnvelope(pcmBytes, sampleRate);
}

export function sampleAudioEnergy(samples: AudioEnergySample[], nowMs: number) {
  if (samples.length === 0) {
    return undefined;
  }
  if (nowMs <= samples[0].atMs) {
    return samples[0].value;
  }

  const last = samples[samples.length - 1];
  if (nowMs >= last.atMs) {
    return last.value;
  }

  const rightIndex = samples.findIndex((sample) => sample.atMs >= nowMs);
  const right = samples[rightIndex];
  const left = samples[rightIndex - 1];
  const spanMs = Math.max(1, right.atMs - left.atMs);
  const progress = (nowMs - left.atMs) / spanMs;
  return clamp(left.value + (right.value - left.value) * progress);
}
