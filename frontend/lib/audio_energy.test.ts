import { buildPcm16EnergyEnvelope, buildWavPcm16EnergyEnvelope, sampleAudioEnergy } from "./audio_energy";

function pcm16Bytes(values: number[]) {
  const bytes = new Uint8Array(values.length * 2);
  const view = new DataView(bytes.buffer);
  values.forEach((value, index) => view.setInt16(index * 2, value, true));
  return bytes;
}

test("builds a bounded changing envelope from silent and voiced PCM", () => {
  const sampleRate = 1_000;
  const silence = Array(20).fill(0);
  const voiced = Array.from({ length: 40 }, (_, index) => index % 2 === 0 ? 24_000 : -24_000);
  const envelope = buildPcm16EnergyEnvelope(pcm16Bytes([...silence, ...voiced, ...silence]), sampleRate);

  expect(envelope).toHaveLength(4);
  expect(envelope[0].value).toBe(0);
  expect(envelope[2].value).toBeGreaterThan(0.8);
  expect(envelope[3].value).toBeLessThan(envelope[2].value);
  expect(envelope.every((sample) => Number.isFinite(sample.value) && sample.value >= 0 && sample.value <= 1)).toBe(true);
});

test("interpolates energy on the avatar clock", () => {
  expect(sampleAudioEnergy([{ atMs: 0, value: 0 }, { atMs: 20, value: 1 }], 10)).toBe(0.5);
  expect(sampleAudioEnergy([], 10)).toBeUndefined();
});

test("extracts the same envelope from mono PCM16 WAV audio", () => {
  const pcm = pcm16Bytes([...Array(20).fill(0), ...Array.from({ length: 20 }, (_, index) => index % 2 ? 20_000 : -20_000)]);
  const wav = new Uint8Array(44 + pcm.length);
  const view = new DataView(wav.buffer);
  const write = (offset: number, value: string) => [...value].forEach((character, index) => view.setUint8(offset + index, character.charCodeAt(0)));
  write(0, "RIFF");
  view.setUint32(4, 36 + pcm.length, true);
  write(8, "WAVE");
  write(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, 1_000, true);
  view.setUint32(28, 2_000, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  write(36, "data");
  view.setUint32(40, pcm.length, true);
  wav.set(pcm, 44);

  expect(buildWavPcm16EnergyEnvelope(wav).map((sample) => sample.value)).toEqual([0, 0.65]);
});
