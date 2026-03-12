export function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function svgScopeId(uid: string, avatar: string, name: string): string {
  return `${uid.replace(/:/g, "")}-${avatar}-${name}`;
}

export function svgMouthProps(mouthOpen: number) {
  return {
    "data-open": mouthOpen.toFixed(3),
    "data-testid": "avatar-mouth",
  };
}
